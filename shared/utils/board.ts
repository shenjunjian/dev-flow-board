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

/** Issue（看板展示用），时间均为 ISO 字符串 */
export interface BoardIssue {
  repoId: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  importance: Importance
  /** 当前仍贴着的状态 label */
  statusLabel: string | null
  column: BoardColumn
  assignee: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  /** 列变化后的高亮截止时间 */
  highlightUntil: string | null
  /** 生命周期句子，按时间顺序 */
  timeline: string[]
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
