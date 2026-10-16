import { STATUS_LABEL_TEXT } from './columns'
import type { TimelineSentence } from './timeline'

/** 甘特图色块与研发分析加总共用的阶段 */
export type PhaseKind = 'story' | 'dev' | 'review' | 'idle'

/** 需求 / 开发 / 检视 / 空闲 */
export const PHASE_COLORS: Record<PhaseKind, string> = {
  story: '#f59f00',
  dev: '#3b82f6',
  review: '#8b5cf6',
  idle: '#ced4da',
}

/** 一段阶段。需求的 start 与 end 相同，表示零长度。时间是毫秒。 */
export interface Phase {
  kind: PhaseKind
  start: number
  end: number
}

type OpenKind = Exclude<PhaseKind, 'story'>

type Mark = 'story' | 'dev-start' | 'dev-end' | 'review-start' | 'review-end' | 'merged' | 'reopened'

/** 同一时刻多句时的处理顺序，保证「先收束上一段，再开下一段」 */
const MARK_RANK: Record<Mark, number> = {
  'story': 0,
  'reopened': 1,
  'dev-start': 2,
  'dev-end': 3,
  'review-start': 4,
  'review-end': 5,
  'merged': 6,
}

/**
 * 用时间线句子还原阶段。文案与 `buildTimelineSentences` 一致。
 *
 * 空闲只紧跟创建、开发完成、检视成功、检视到错误、重新打开。
 * 开发中直接进入检视，或未标开发完成就合入时，上一段在下一事件结束，中间不插入空闲。
 * 合入之后不再画，直到重新打开。未结束的开发、检视、空闲右端收到 `now`。
 * 同一次开发里的待开发与开发中合成一段；检视打回后再进入开发则新开一段。
 */
export function splitPhases(sentences: readonly TimelineSentence[], now: string | number | Date): Phase[] {
  const nowMs = toMs(now)
  const events = sentences.flatMap((sentence, index) => {
    const at = toMs(sentence.occurredAt)
    const mark = classify(sentence.message)
    if (!Number.isFinite(at) || !mark) return []
    return [{ at, mark, index }]
  })
  events.sort((a, b) => a.at - b.at || MARK_RANK[a.mark] - MARK_RANK[b.mark] || a.index - b.index)

  const phases: Phase[] = []
  let open: { kind: OpenKind, start: number } | null = null
  let afterMerge = false

  function finish(at: number) {
    if (open && at > open.start) phases.push({ kind: open.kind, start: open.start, end: at })
    open = null
  }

  function begin(kind: OpenKind, at: number) {
    finish(at)
    open = { kind, start: at }
    afterMerge = false
  }

  for (const event of events) {
    if (afterMerge && event.mark !== 'reopened' && event.mark !== 'story') continue

    if (event.mark === 'story') {
      if (open && open.kind !== 'idle') finish(event.at)
      phases.push({ kind: 'story', start: event.at, end: event.at })
      if (!open) open = { kind: 'idle', start: event.at }
      afterMerge = false
      continue
    }

    if (event.mark === 'reopened') {
      afterMerge = false
      if (open?.kind !== 'idle') begin('idle', event.at)
      continue
    }

    if (event.mark === 'merged') {
      finish(event.at)
      afterMerge = true
      continue
    }

    if (event.mark === 'dev-start') {
      if (open?.kind !== 'dev') begin('dev', event.at)
      continue
    }

    if (event.mark === 'review-start') {
      if (open?.kind !== 'review') begin('review', event.at)
      continue
    }

    // 开发完成 / 检视成功 / 检视到错误：结束上一段并进入空闲；已经在空闲则保持
    if (open?.kind !== 'idle') begin('idle', event.at)
  }

  if (open && Number.isFinite(nowMs) && nowMs > open.start) {
    phases.push({ kind: open.kind, start: open.start, end: nowMs })
  }

  phases.sort((a, b) => a.start - b.start || a.end - b.end)
  return phases
}

/** 各阶段时长（毫秒）。同一工单的多段开发、多段检视分别加总。需求为零。 */
export function sumPhaseDurations(phases: readonly Phase[]): Record<PhaseKind, number> {
  const sum: Record<PhaseKind, number> = { story: 0, dev: 0, review: 0, idle: 0 }
  for (const phase of phases) {
    const duration = phase.end - phase.start
    if (duration > 0) sum[phase.kind] += duration
  }
  return sum
}

/**
 * 半开区间 [aStart, aEnd) 与 [bStart, bEnd) 是否相交。
 * 零长度看成时间点，点落在对方区间内才算相交；端点相接不算。
 */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false
  if (aEnd < aStart || bEnd < bStart) return false
  if (aStart === aEnd) return aStart >= bStart && aStart < bEnd
  if (bStart === bEnd) return bStart >= aStart && bStart < aEnd
  return aStart < bEnd && bStart < aEnd
}

/**
 * 甘特图纳入：工单 [创建, 结束) 与窗口 [windowStart, windowEnd) 相交。
 * 未合入（closedAt 为空）时结束时间取 now。
 */
export function issueOverlapsWindow(
  createdAt: string | number | Date,
  closedAt: string | number | Date | null | undefined,
  windowStart: string | number | Date,
  windowEnd: string | number | Date,
  now: string | number | Date,
): boolean {
  const start = toMs(createdAt)
  const end = closedAt == null ? toMs(now) : toMs(closedAt)
  return rangesOverlap(start, end, toMs(windowStart), toMs(windowEnd))
}

/**
 * 研发分析纳入：创建时间与合入时间都落在 [rangeStart, rangeEnd] 内。
 * rangeEnd 是结束日 24 点，含端点。未合入，或只有一段时间擦到范围内，都不算。
 */
export function isCreatedAndClosedInRange(
  createdAt: string | number | Date,
  closedAt: string | number | Date | null | undefined,
  rangeStart: string | number | Date,
  rangeEnd: string | number | Date,
): boolean {
  if (closedAt == null) return false
  const created = toMs(createdAt)
  const closed = toMs(closedAt)
  const start = toMs(rangeStart)
  const end = toMs(rangeEnd)
  if (![created, closed, start, end].every(Number.isFinite)) return false
  return created >= start && created <= end && closed >= start && closed <= end
}

/** 句子末尾的中文动作，前缀是 `MM-DD HH:mm:ss` */
function classify(message: string): Mark | null {
  if (message.endsWith('创建需求')) return 'story'
  if (message.endsWith('已合入')) return 'merged'
  if (message.endsWith('重新打开')) return 'reopened'
  if (message.endsWith(STATUS_LABEL_TEXT.DevDone)) return 'dev-end'
  if (message.endsWith(STATUS_LABEL_TEXT.WaitDev) || message.endsWith(STATUS_LABEL_TEXT.Dev)) return 'dev-start'
  if (message.endsWith(STATUS_LABEL_TEXT.ReviewDone) || message.endsWith(STATUS_LABEL_TEXT.ReviewErrors)) return 'review-end'
  if (message.endsWith(STATUS_LABEL_TEXT.Review)) return 'review-start'
  return null
}

function toMs(input: string | number | Date): number {
  return typeof input === 'number' ? input : new Date(input).getTime()
}
