/** 看板四列 */
export type BoardColumn = 'story' | 'dev' | 'review' | 'done'

export const BOARD_COLUMNS: readonly BoardColumn[] = ['story', 'dev', 'review', 'done']

export const BOARD_COLUMN_LABELS: Record<BoardColumn, string> = {
  story: '需求',
  dev: '开发',
  review: '检视',
  done: '已完成',
}

/** 重要性：有 High label 为 high，否则 low */
export type Importance = 'high' | 'low'

/** 任务类型：issue 上的 feature / bug / refactor label；三者都没有时为 null */
export type TaskType = 'feature' | 'bug' | 'refactor'

/** 仓库（看板展示用） */
export interface BoardRepo {
  id: number
  owner: string
  name: string
  fullName: string
  sortOrder: number
  color: string
  refreshIntervalMs: number
}

/** 生命周期一句：at 是 occurredAt 的 ISO 时间，message 是带时间前缀的中文句子 */
export interface BoardTimelineItem {
  at: string
  message: string
}

/** Issue（看板展示用），时间均为 ISO 字符串 */
export interface BoardIssue {
  repoId: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  importance: Importance
  /** 任务类型 label（feature | bug | refactor），无则 null */
  taskType: TaskType | null
  /** 当前仍贴着的状态 label */
  statusLabel: string | null
  column: BoardColumn
  assignee: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  /** 列变化后的高亮截止时间 */
  highlightUntil: string | null
  /** 父工单编号；没有父子关系时为 null */
  parentNumber: number | null
  /** 生命周期句子，按 occurredAt 升序 */
  timeline: BoardTimelineItem[]
}

/** GET /api/board 的响应 */
export interface BoardData {
  repos: BoardRepo[]
  issues: BoardIssue[]
}

/** SSE 补丁：只包含本次真正变动的 Issue */
export interface BoardPatch {
  upserts: BoardIssue[]
  deleted: Array<{ repoId: number, number: number }>
}
