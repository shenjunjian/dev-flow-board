import { and, eq } from 'drizzle-orm'
import type { BoardIssue } from '#shared/utils/board'
import { decideIssueColumn, isDoneIssueVisible, STATUS_LABEL_STAGES } from '#shared/utils/columns'
import { buildTimelineSentences } from '#shared/utils/timeline'
import { issues as issuesTable, issueEvents as issueEventsTable, repos as reposTable, useDb, type IssueRow, type RepoRow } from './db'
import { GhError, ghJson } from './gh'
import { publishBoardPatch } from './publisher'
import { toBoardIssue } from './serialize'

/** gh api 返回的 Issue 形状（只取需要的字段） */
interface GhIssue {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: Array<{ name: string }>
  assignees: Array<{ login: string }>
  created_at: string
  updated_at: string
  closed_at: string | null
  /** 带此字段说明是 PR，直接丢掉 */
  pull_request?: unknown
}

interface GhIssueEvent {
  event: string
  created_at: string
  label?: { name: string } | null
}

export type SyncMode = 'initial' | 'today'

export interface SyncResult {
  repoId: number
  repoFullName: string
  ok: boolean
  error?: string
  upserted: number
  deleted: number
}

/** 列变化后的高亮时长 */
export const HIGHLIGHT_MS = 60_000

/** 拉单个 Issue events 的并发数 */
const EVENTS_CONCURRENCY = 4

// 每仓库的同步互斥，globalThis 收口防热更新重复
const globalForSync = globalThis as unknown as { __devFlowBoardSyncing?: Set<number> }

function syncingRepos(): Set<number> {
  if (!globalForSync.__devFlowBoardSyncing) {
    globalForSync.__devFlowBoardSyncing = new Set()
  }
  return globalForSync.__devFlowBoardSyncing
}

/** 某仓库是否正在同步 */
export function isRepoSyncing(repoId: number): boolean {
  return syncingRepos().has(repoId)
}

/** 本地当天 00:00 的 ISO 时间 */
function localTodayStartIso(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

/** 简单并发池 */
async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<Array<R | undefined>> {
  const results: Array<R | undefined> = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      const item = items[i]
      if (item === undefined) continue
      results[i] = await fn(item)
    }
  })
  await Promise.all(workers)
  return results
}

/** 行级变化检测：用于「只推真正变动的 Issue」；高亮自然过期清空不算变动 */
function isIssueRowChanged(old: IssueRow, next: IssueRow): boolean {
  if (
    old.title !== next.title
    || old.body !== next.body
    || old.state !== next.state
    || old.importance !== next.importance
    || old.taskType !== next.taskType
    || old.statusLabel !== next.statusLabel
    || old.column !== next.column
    || old.assignee !== next.assignee
    || old.githubCreatedAt.getTime() !== next.githubCreatedAt.getTime()
    || old.githubUpdatedAt.getTime() !== next.githubUpdatedAt.getTime()
    || (old.githubClosedAt?.getTime() ?? null) !== (next.githubClosedAt?.getTime() ?? null)
  ) {
    return true
  }
  const oldHighlight = old.highlightUntil?.getTime() ?? null
  const nextHighlight = next.highlightUntil?.getTime() ?? null
  // 旧值已过期、新值为 null：自然过期，不算变动
  if (oldHighlight !== null && nextHighlight === null && oldHighlight <= Date.now()) return false
  return oldHighlight !== nextHighlight
}

/** 拉取某仓库的 Issue 列表（--paginate --slurp，返回的是数组的数组） */
async function fetchGhIssues(repo: RepoRow, mode: SyncMode): Promise<GhIssue[]> {
  const base = `repos/${repo.owner}/${repo.name}/issues?state=all&per_page=100`
  const path = mode === 'today' ? `${base}&since=${encodeURIComponent(localTodayStartIso())}` : base
  const pages = await ghJson<GhIssue[][]>(['api', '--paginate', '--slurp', path])
  return pages.flat()
}

/** 拉取单个 Issue 的事件（失败返回空数组，不阻塞整仓同步） */
async function fetchGhIssueEvents(repo: RepoRow, number: number): Promise<GhIssueEvent[]> {
  try {
    const pages = await ghJson<GhIssueEvent[][]>(['api', '--paginate', '--slurp', `repos/${repo.owner}/${repo.name}/issues/${number}/events`])
    return pages.flat()
  }
  catch (err) {
    console.warn(`[sync] 拉取 ${repo.fullName}#${number} 的事件失败：`, err instanceof Error ? err.message : err)
    return []
  }
}

/** 状态 label 最近一次 labeled 的时间（用于同阶段多 label 的 tie-break） */
function buildLatestLabeledAt(events: GhIssueEvent[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const ev of events) {
    if (ev.event !== 'labeled' || !ev.label?.name) continue
    if (!STATUS_LABEL_STAGES[ev.label.name]) continue
    const at = new Date(ev.created_at).getTime()
    if (Number.isFinite(at) && at > (map[ev.label.name] ?? 0)) {
      map[ev.label.name] = at
    }
  }
  return map
}

/**
 * 同步一个仓库：
 * - initial：整仓对账，库里不在纳入集合的行全部删除
 * - today：只 upsert 这次返回且符合条件的行；只删这次看到的 closed-无-Merged；没返回的行不动
 * 变动的 Issue 通过 SSE 发布；某个仓库正在同步时返回 ok:false + error:'busy'。
 */
export async function syncRepo(repoId: number, mode: SyncMode): Promise<SyncResult> {
  const { db } = useDb()
  const repo = db.select().from(reposTable).where(eq(reposTable.id, repoId)).get()
  if (!repo) {
    return { repoId, repoFullName: `#${repoId}`, ok: false, error: '仓库不存在', upserted: 0, deleted: 0 }
  }

  if (syncingRepos().has(repoId)) {
    return { repoId, repoFullName: repo.fullName, ok: false, error: '该仓库正在同步中，本拍跳过', upserted: 0, deleted: 0 }
  }
  syncingRepos().add(repoId)
  try {
    return await syncRepoInner(repo, mode)
  }
  finally {
    syncingRepos().delete(repoId)
  }
}

async function syncRepoInner(repo: RepoRow, mode: SyncMode): Promise<SyncResult> {
  const { db, sqlite } = useDb()

  let ghIssues: GhIssue[]
  try {
    ghIssues = (await fetchGhIssues(repo, mode)).filter(i => !i.pull_request)
  }
  catch (err) {
    const message = err instanceof GhError ? err.message : '调用 GitHub 失败'
    return { repoId: repo.id, repoFullName: repo.fullName, ok: false, error: message, upserted: 0, deleted: 0 }
  }

  const now = Date.now()

  // 纳入条件：开放且带 Story 或任一状态 label；closed 只保留带 Merged 的
  const included: GhIssue[] = []
  const closedNoMerged: GhIssue[] = []
  for (const issue of ghIssues) {
    const names = new Set(issue.labels.map(l => l.name))
    if (issue.state === 'closed') {
      if (names.has('Merged')) included.push(issue)
      else closedNoMerged.push(issue)
    }
    else {
      const hasStatus = [...names].some(n => STATUS_LABEL_STAGES[n])
      if (names.has('Story') || hasStatus) included.push(issue)
    }
  }

  // 库中现有行
  const oldRows = db.select().from(issuesTable).where(eq(issuesTable.repoId, repo.id)).all()
  const oldByNumber = new Map(oldRows.map(r => [r.number, r]))

  const upserts: BoardIssue[] = []
  const deleted: Array<{ repoId: number, number: number }> = []

  // 并发拉纳入行的 events，再判定列并写入
  const written = await mapPool(included, EVENTS_CONCURRENCY, async (issue) => {
    const events = await fetchGhIssueEvents(repo, issue.number)
    const names = issue.labels.map(l => l.name)
    const decision = decideIssueColumn({
      state: issue.state,
      labels: names,
      latestLabeledAt: buildLatestLabeledAt(events),
    })
    if (!decision.included || !decision.column) return

    const old = oldByNumber.get(issue.number)
    const columnChanged = !old || old.column !== decision.column
    let highlightUntil: Date | null = null
    if (columnChanged) {
      highlightUntil = new Date(now + HIGHLIGHT_MS)
    }
    else if (old?.highlightUntil && old.highlightUntil.getTime() > now) {
      // 未变则不覆盖尚未到期的高亮
      highlightUntil = old.highlightUntil
    }

    const timeline = buildTimelineSentences({
      issueCreatedAt: issue.created_at,
      hasMerged: names.includes('Merged'),
      events: events.map(ev => ({
        event: ev.event,
        createdAt: ev.created_at,
        label: ev.label?.name ?? null,
      })),
    })

    const values = {
      repoId: repo.id,
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state,
      importance: decision.importance,
      taskType: decision.taskType,
      statusLabel: decision.statusLabel,
      column: decision.column,
      assignee: issue.assignees[0]?.login ?? null,
      githubCreatedAt: new Date(issue.created_at),
      githubUpdatedAt: new Date(issue.updated_at),
      githubClosedAt: issue.closed_at ? new Date(issue.closed_at) : null,
      highlightUntil,
    }

    sqlite.transaction(() => {
      db.insert(issuesTable)
        .values(values)
        .onConflictDoUpdate({
          target: [issuesTable.repoId, issuesTable.number],
          set: {
            title: values.title,
            body: values.body,
            state: values.state,
            importance: values.importance,
            taskType: values.taskType,
            statusLabel: values.statusLabel,
            column: values.column,
            assignee: values.assignee,
            githubCreatedAt: values.githubCreatedAt,
            githubUpdatedAt: values.githubUpdatedAt,
            githubClosedAt: values.githubClosedAt,
            highlightUntil: values.highlightUntil,
          },
        })
        .run()
      // 时间线整组重写
      db.delete(issueEventsTable).where(and(eq(issueEventsTable.repoId, repo.id), eq(issueEventsTable.number, issue.number))).run()
      db.insert(issueEventsTable).values(
        timeline.map(t => ({ repoId: repo.id, number: issue.number, occurredAt: new Date(t.occurredAt), message: t.message })),
      ).run()
    })()

    // 写后回读，拿到完整行再序列化
    const saved = db.select().from(issuesTable)
      .where(and(eq(issuesTable.repoId, repo.id), eq(issuesTable.number, issue.number)))
      .get()
    if (!saved) return

    return { row: saved, timelineMessages: timeline.map(t => t.message) }
  })

  for (const w of written) {
    if (!w) continue
    // 完成列只展示近 2 天；更早的行留在库里但不推给页面
    if (w.row.column === 'done' && !isDoneIssueVisible(w.row.githubClosedAt, now)) continue
    // 只推真正变动的行：新增或字段有变化（高亮从有值过期清空不算变动）
    const old = oldByNumber.get(w.row.number)
    if (old && !isIssueRowChanged(old, w.row)) continue
    upserts.push(toBoardIssue(w.row, w.timelineMessages))
  }

  // 删除：today 模式只删这次看到的 closed-无-Merged；initial 模式整仓对账
  const numbersToRemove = new Set<number>()
  if (mode === 'today') {
    for (const issue of closedNoMerged) numbersToRemove.add(issue.number)
  }
  else {
    const includedNumbers = new Set(included.map(i => i.number))
    for (const row of oldRows) {
      if (!includedNumbers.has(row.number)) numbersToRemove.add(row.number)
    }
  }

  if (numbersToRemove.size > 0) {
    const nums = [...numbersToRemove]
    for (const n of nums) {
      if (!oldByNumber.has(n)) continue
      db.delete(issuesTable).where(and(eq(issuesTable.repoId, repo.id), eq(issuesTable.number, n))).run()
      db.delete(issueEventsTable).where(and(eq(issueEventsTable.repoId, repo.id), eq(issueEventsTable.number, n))).run()
      deleted.push({ repoId: repo.id, number: n })
    }
  }

  publishBoardPatch({ upserts, deleted })

  return { repoId: repo.id, repoFullName: repo.fullName, ok: true, upserted: upserts.length, deleted: deleted.length }
}

/** 手动刷新：对全部已登记仓库立即做一次当天查询，与定时任务同一套逻辑 */
export async function syncAllReposToday(): Promise<SyncResult[]> {
  const { db } = useDb()
  const all = db.select().from(reposTable).all()
  return Promise.all(all.map(r => syncRepo(r.id, 'today')))
}

/** 供 board 接口取行内联时间线 */
export function getIssuesWithTimeline(): BoardIssue[] {
  const { db } = useDb()
  const now = Date.now()
  const rows = db.select().from(issuesTable).all()

  // 按仓库+编号分组，避免不同仓库同号串线
  const eventsByIssue = new Map<string, string[]>()
  for (const ev of db.select().from(issueEventsTable).all()) {
    const key = `${ev.repoId}#${ev.number}`
    const list = eventsByIssue.get(key) ?? []
    list.push(ev.message)
    eventsByIssue.set(key, list)
  }

  const result: BoardIssue[] = []
  for (const row of rows) {
    // 完成列只返回近 2 天内的，更早的行留在库里
    if (row.column === 'done' && !isDoneIssueVisible(row.githubClosedAt, now)) continue
    result.push(toBoardIssue(row, eventsByIssue.get(`${row.repoId}#${row.number}`) ?? []))
  }
  return result
}
