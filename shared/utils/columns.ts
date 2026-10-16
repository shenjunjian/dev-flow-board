import type { BoardColumn, Importance, TaskType } from './board'

/** Story label */
export const STORY_LABEL = 'Story'
/** 合入 label：closed 且带它才入库进完成列 */
export const MERGED_LABEL = 'Merged'
/** 高重要性 label */
export const HIGH_LABEL = 'High'

/** 任务类型 label（大小写不敏感匹配），顺序即多贴时的优先顺序 */
export const TASK_TYPE_LABELS: Record<string, TaskType> = {
  feature: 'feature',
  bug: 'bug',
  refactor: 'refactor',
}

/** 从 label 名解析任务类型；非类型 label 返回 null */
export function parseTaskType(labelNames: string[]): TaskType | null {
  for (const [name, type] of Object.entries(TASK_TYPE_LABELS)) {
    if (labelNames.some(l => l.toLowerCase() === name)) return type
  }
  return null
}

/** 状态 label 的固定顺序（同阶段 tie-break 缺时间数据时按此顺序取靠前的） */
export const STATUS_LABELS = ['Story', 'WaitDev', 'Dev', 'DevDone', 'Review', 'ReviewDone', 'ReviewErrors'] as const

/** 状态 label → 所属阶段 */
export const STATUS_LABEL_STAGES: Record<string, 'story' | 'dev' | 'review'> = {
  Story: 'story',
  WaitDev: 'dev',
  Dev: 'dev',
  DevDone: 'dev',
  Review: 'review',
  ReviewDone: 'review',
  ReviewErrors: 'review',
}

/** 状态 label 的 labeled 事件文案（Story 不产生「转为」句子，创建已记「创建需求」） */
export const STATUS_LABEL_TEXT: Record<string, string> = {
  WaitDev: '转为 待开发',
  Dev: '转为 开发中',
  DevDone: '转为 开发完成',
  Review: '转为 检视中',
  ReviewDone: '转为 检视成功',
  ReviewErrors: '转为 检视到错误',
}

/** open 状态下阶段 → 列 的优先顺序（检视 > 开发 > 需求） */
const STAGE_PRIORITY: Array<'review' | 'dev' | 'story'> = ['review', 'dev', 'story']

export interface IssueColumnInput {
  state: 'open' | 'closed'
  /** 当前仍贴着的 label 名 */
  labels: string[]
  /** 各 label 最近一次 labeled 的时间（ms epoch），同一阶段贴多个 label 时取最近的 */
  latestLabeledAt?: Record<string, number>
}

export interface IssueColumnDecision {
  /** 是否纳入看板（入库） */
  included: boolean
  column: BoardColumn | null
  /** 决定列的状态 label；closed+Merged 进完成列时为 null（完成列无状态图标） */
  statusLabel: string | null
  importance: Importance
  /** 任务类型；issue 未带 feature/bug/refactor 任一 label 时为 null */
  taskType: TaskType | null
}

/**
 * 列判定：
 * - closed + Merged → 已完成；closed 无 Merged → 不纳入
 * - open：检视（Review/ReviewDone/ReviewErrors）> 开发（WaitDev/Dev/DevDone）> 需求（仅 Story）
 * - 同一阶段贴多个 label 时，以最近一次 labeled 事件为准
 * - 任务类型与列判定无关，按 feature > bug > refactor 取第一个命中的
 */
export function decideIssueColumn(input: IssueColumnInput): IssueColumnDecision {
  const labels = new Set(input.labels)
  const importance: Importance = labels.has(HIGH_LABEL) ? 'high' : 'low'
  const taskType = parseTaskType(input.labels)

  if (input.state === 'closed') {
    if (labels.has(MERGED_LABEL)) {
      return { included: true, column: 'done', statusLabel: null, importance, taskType }
    }
    return { included: false, column: null, statusLabel: null, importance, taskType }
  }

  for (const stage of STAGE_PRIORITY) {
    const stageLabels = STATUS_LABELS.filter(l => labels.has(l) && STATUS_LABEL_STAGES[l] === stage)
    if (stageLabels.length === 0) continue
    const chosen = pickLatestLabeled(stageLabels, input.latestLabeledAt)
    return { included: true, column: stage, statusLabel: chosen, importance, taskType }
  }

  return { included: false, column: null, statusLabel: null, importance, taskType }
}

/** 同阶段多个 label：取最近 labeled 的；时间缺失或平局时取声明顺序靠前的 */
function pickLatestLabeled(candidates: string[], latestLabeledAt?: Record<string, number>): string {
  let best = candidates[0] ?? ''
  let bestAt = latestLabeledAt?.[best] ?? 0
  for (const c of candidates.slice(1)) {
    const at = latestLabeledAt?.[c] ?? 0
    if (at > bestAt) {
      best = c
      bestAt = at
    }
  }
  return best
}

/** 看板完成列只展示 closedAt 在近 2 天内的任务（更早的行仍留在库里，供甘特图和研发分析使用） */
export function isDoneIssueVisible(closedAt: string | number | Date | null | undefined, now: number): boolean {
  if (!closedAt) return false
  const t = new Date(closedAt).getTime()
  return Number.isFinite(t) && now - t < 2 * 24 * 60 * 60 * 1000
}
