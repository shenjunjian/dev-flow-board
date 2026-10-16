import type { BoardIssue, BoardRepo, TaskType } from './board'
import { addLocalDays, startOfLocalDay } from './gantt'
import { isCreatedAndClosedInRange, splitPhases, sumPhaseDurations } from './phases'

/** 默认查询近 14 个本地日，含今天 */
export const ANALYSIS_SPAN_DAYS = 14

const MS_PER_HOUR = 3_600_000

/** 研发分析里按任务类型再筛一层。未分类是没有 feature / bug / refactor 的工单。 */
export type AnalysisTaskFilter = 'all' | TaskType | 'untyped'

export interface AnalysisDurations {
  devHours: number
  reviewHours: number
  idleHours: number
}

/** 责任人筛选。`none` 是没有指派人的工单。 */
export type AnalysisAssigneeFilter = 'all' | 'none' | (string & {})

export interface AnalysisRow extends AnalysisDurations {
  id: string
  href: string
  repoId: number
  repoName: string
  number: number
  title: string
  /** GitHub 登录名；没有指派人时为 null */
  assignee: string | null
  importance: BoardIssue['importance']
  taskType: TaskType | null
}

/** 按责任人加总后的一根柱。没有指派人的工单归到「未指派」。 */
export interface AssigneeDurationBar extends AnalysisDurations {
  label: string
}

/**
 * 近 14 个本地日。start 是起始日 0 点，end 是今天 24 点（次日 0 点）。
 */
export function defaultAnalysisRange(now: number): { start: number, end: number } {
  const today = startOfLocalDay(now)
  return {
    start: addLocalDays(today, 1 - ANALYSIS_SPAN_DAYS),
    end: addLocalDays(today, 1),
  }
}

/**
 * 把两个本地日收成 [起始日 0 点, 结束日 24 点]。
 * 结束日 24 点是次日 0 点，含端点。起止颠倒时对调。
 */
export function analysisRangeFromDays(startDay: number, endDay: number): { start: number, end: number } {
  const first = startOfLocalDay(Math.min(startDay, endDay))
  const last = startOfLocalDay(Math.max(startDay, endDay))
  return { start: first, end: addLocalDays(last, 1) }
}

/**
 * 查询条件：创建和合入都落在范围内，并且属于所选仓库。
 * repoId 为空表示全部仓库。只擦边相交、或未合入，都不进结果。
 */
export function filterAnalysisIssues(
  issues: readonly BoardIssue[],
  rangeStart: number,
  rangeEnd: number,
  repoId: number | null,
): BoardIssue[] {
  return issues.filter((issue) => {
    if (repoId != null && issue.repoId !== repoId) return false
    return isCreatedAndClosedInRange(issue.createdAt, issue.closedAt, rangeStart, rangeEnd)
  })
}

export function matchesTaskFilter(taskType: TaskType | null, filter: AnalysisTaskFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'untyped') return taskType == null
  return taskType === filter
}

export function matchesAssigneeFilter(assignee: string | null, filter: AnalysisAssigneeFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return !assignee
  return assignee === filter
}

/** 选中工单按责任人加总。同一个人的多张工单合成一根柱，未指派放在最后。 */
export function groupByAssignee(
  rows: readonly Pick<AnalysisRow, 'assignee' | keyof AnalysisDurations>[],
): AssigneeDurationBar[] {
  const grouped = new Map<string, AssigneeDurationBar>()
  for (const row of rows) {
    const label = row.assignee || '未指派'
    const current = grouped.get(label) ?? { label, devHours: 0, reviewHours: 0, idleHours: 0 }
    current.devHours += row.devHours
    current.reviewHours += row.reviewHours
    current.idleHours += row.idleHours
    grouped.set(label, current)
  }
  return [...grouped.values()].sort((a, b) => {
    if (a.label === '未指派') return 1
    if (b.label === '未指派') return -1
    return a.label.localeCompare(b.label)
  })
}

/** 同一工单的多段开发、检视、空闲先加总，再换成小时。 */
export function analysisDurations(
  timeline: readonly { at: string, message: string }[],
  now: number,
): AnalysisDurations {
  const sum = sumPhaseDurations(splitPhases(
    timeline.map(item => ({ occurredAt: item.at, message: item.message })),
    now,
  ))
  return {
    devHours: sum.dev / MS_PER_HOUR,
    reviewHours: sum.review / MS_PER_HOUR,
    idleHours: sum.idle / MS_PER_HOUR,
  }
}

export function sumDurationHours(rows: readonly AnalysisDurations[]): AnalysisDurations {
  const total: AnalysisDurations = { devHours: 0, reviewHours: 0, idleHours: 0 }
  for (const row of rows) {
    total.devHours += row.devHours
    total.reviewHours += row.reviewHours
    total.idleHours += row.idleHours
  }
  return total
}

/** 小时展示：去掉末尾 0；不足 0.01 小时且大于 0 时标成小于 0.01。 */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0'
  const rounded = Math.round(hours * 100) / 100
  if (rounded <= 0) return '<0.01'
  return String(rounded)
}

/** 仓库按 sortOrder，同仓库按编号升序。 */
export function buildAnalysisRows(
  issues: readonly BoardIssue[],
  repos: readonly BoardRepo[],
  now: number,
): AnalysisRow[] {
  const repoById = new Map(repos.map(repo => [repo.id, repo]))
  return issues
    .map((issue) => {
      const repo = repoById.get(issue.repoId)
      return {
        id: `${issue.repoId}-${issue.number}`,
        href: repo ? `https://github.com/${repo.owner}/${repo.name}/issues/${issue.number}` : '',
        repoId: issue.repoId,
        repoName: repo?.fullName ?? String(issue.repoId),
        number: issue.number,
        title: issue.title,
        assignee: issue.assignee,
        importance: issue.importance,
        taskType: issue.taskType,
        ...analysisDurations(issue.timeline, now),
      }
    })
    .sort((a, b) => {
      const orderA = repoById.get(a.repoId)?.sortOrder ?? Number.MAX_SAFE_INTEGER
      const orderB = repoById.get(b.repoId)?.sortOrder ?? Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) return orderA - orderB
      if (a.repoId !== b.repoId) return a.repoId - b.repoId
      return a.number - b.number
    })
}
