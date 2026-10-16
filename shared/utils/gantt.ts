import type { BoardIssue, BoardRepo } from './board'
import { issueOverlapsWindow, splitPhases, type PhaseKind } from './phases'

/** 甘特图固定 5 个本地日 */
export const GANTT_SPAN_DAYS = 5

export const GANTT_NAME_DEFAULT = 280
export const GANTT_NAME_MIN = 160
export const GANTT_NAME_MAX = 480

/** 一天里用浅色带标出的工作时段，单位是当天的比例 */
export const GANTT_WORK_BANDS = [
  { start: 8 / 24, end: 12 / 24 },
  { start: 14 / 24, end: 18 / 24 },
] as const

export interface GanttDay {
  start: number
  label: string
  weekday: string
}

/** 画在轨道上的一段。需求的 startRatio 与 endRatio 相同。 */
export interface GanttMark {
  kind: PhaseKind
  start: number
  end: number
  startRatio: number
  endRatio: number
}

export interface GanttIssueNode {
  issue: BoardIssue
  children: GanttIssueNode[]
}

export interface GanttRepoNode {
  repo: BoardRepo
  issues: GanttIssueNode[]
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function startOfLocalDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function addLocalDays(ms: number, days: number): number {
  const date = new Date(ms)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

/** 本地今天往前共 5 天，含今天。起点是今天 0 点再往前 4 天。 */
export function defaultGanttWindowStart(now: number): number {
  return addLocalDays(startOfLocalDay(now), 1 - GANTT_SPAN_DAYS)
}

export function ganttWindowEnd(windowStart: number): number {
  return addLocalDays(windowStart, GANTT_SPAN_DAYS)
}

export function clampNameWidth(width: number): number {
  return Math.min(GANTT_NAME_MAX, Math.max(GANTT_NAME_MIN, Math.round(width)))
}

export function ganttDays(windowStart: number): GanttDay[] {
  return Array.from({ length: GANTT_SPAN_DAYS }, (_, index) => {
    const start = addLocalDays(windowStart, index)
    const date = new Date(start)
    const pad = (value: number) => String(value).padStart(2, '0')
    return {
      start,
      label: `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      weekday: `周${WEEKDAYS[date.getDay()]}`,
    }
  })
}

/** 窗口是否盖住本地今天。盖住才画当前时间线。 */
export function windowIncludesToday(windowStart: number, now: number): boolean {
  const today = startOfLocalDay(now)
  return today >= windowStart && today < ganttWindowEnd(windowStart)
}

/**
 * 把时间映射到五等分轨道上的 0–1。
 * 每一天占 1/5，天内按本地 0–24 时线性展开。窗口外夹到 0 或 1。
 */
export function timeToRatio(ms: number, windowStart: number): number {
  const windowEnd = ganttWindowEnd(windowStart)
  if (ms <= windowStart) return 0
  if (ms >= windowEnd) return 1
  for (let index = 0; index < GANTT_SPAN_DAYS; index++) {
    const dayStart = addLocalDays(windowStart, index)
    const dayEnd = addLocalDays(windowStart, index + 1)
    if (ms < dayEnd) {
      const fraction = (ms - dayStart) / (dayEnd - dayStart)
      return (index + fraction) / GANTT_SPAN_DAYS
    }
  }
  return 1
}

/** timeToRatio 的反函数，给鼠标时间线用 */
export function ratioToTime(ratio: number, windowStart: number): number {
  const clamped = Math.min(1, Math.max(0, ratio))
  const scaled = clamped * GANTT_SPAN_DAYS
  const index = Math.min(GANTT_SPAN_DAYS - 1, Math.floor(scaled))
  const fraction = scaled - index
  const dayStart = addLocalDays(windowStart, index)
  const dayEnd = addLocalDays(windowStart, index + 1)
  return dayStart + fraction * (dayEnd - dayStart)
}

export function formatGanttCursor(ms: number): string {
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 仓库（sortOrder）→ 工单 → 子工单。
 * 先按窗口相交收窄。父工单不在这批结果里时，子工单升到仓库下。空仓库不出现。
 * 工单按 number 升序。
 */
export function buildGanttTree(
  repos: readonly BoardRepo[],
  issues: readonly BoardIssue[],
  windowStart: number,
  now: number,
): GanttRepoNode[] {
  const windowEnd = ganttWindowEnd(windowStart)
  const visible = issues.filter(issue =>
    issueOverlapsWindow(issue.createdAt, issue.closedAt, windowStart, windowEnd, now),
  )
  const byRepo = new Map<number, BoardIssue[]>()
  for (const issue of visible) {
    const list = byRepo.get(issue.repoId) ?? []
    list.push(issue)
    byRepo.set(issue.repoId, list)
  }

  return [...repos]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .flatMap((repo) => {
      const list = byRepo.get(repo.id)
      if (!list?.length) return []
      return [{ repo, issues: buildIssueForest(list) }]
    })
}

/** 把时间线句子裁到窗口内。需求只留窗口内的时间点。 */
export function ganttMarks(
  timeline: readonly { at: string, message: string }[],
  windowStart: number,
  now: number,
): GanttMark[] {
  const windowEnd = ganttWindowEnd(windowStart)
  const phases = splitPhases(
    timeline.map(item => ({ occurredAt: item.at, message: item.message })),
    now,
  )
  const marks: GanttMark[] = []
  for (const phase of phases) {
    if (phase.kind === 'story') {
      if (phase.start >= windowStart && phase.start < windowEnd) {
        const ratio = timeToRatio(phase.start, windowStart)
        marks.push({ kind: 'story', start: phase.start, end: phase.end, startRatio: ratio, endRatio: ratio })
      }
      continue
    }
    const start = Math.max(phase.start, windowStart)
    const end = Math.min(phase.end, windowEnd)
    if (end <= start) continue
    marks.push({
      kind: phase.kind,
      start,
      end,
      startRatio: timeToRatio(start, windowStart),
      endRatio: timeToRatio(end, windowStart),
    })
  }
  return marks
}

function buildIssueForest(list: readonly BoardIssue[]): GanttIssueNode[] {
  const numbers = new Set(list.map(issue => issue.number))
  const childrenByParent = new Map<number, BoardIssue[]>()
  const roots: BoardIssue[] = []

  for (const issue of list) {
    const parent = issue.parentNumber
    if (parent != null && parent !== issue.number && numbers.has(parent)) {
      const siblings = childrenByParent.get(parent) ?? []
      siblings.push(issue)
      childrenByParent.set(parent, siblings)
    }
    else {
      roots.push(issue)
    }
  }

  const placed = new Set<number>()

  function toNode(issue: BoardIssue): GanttIssueNode {
    placed.add(issue.number)
    const children = (childrenByParent.get(issue.number) ?? [])
      .filter(child => !placed.has(child.number))
      .sort((a, b) => a.number - b.number)
      .map(toNode)
    return { issue, children }
  }

  const forest = roots.sort((a, b) => a.number - b.number).map(toNode)
  const leftovers = list
    .filter(issue => !placed.has(issue.number))
    .sort((a, b) => a.number - b.number)
  for (const issue of leftovers) {
    if (!placed.has(issue.number)) forest.push(toNode(issue))
  }
  forest.sort((a, b) => a.issue.number - b.issue.number)
  return forest
}
