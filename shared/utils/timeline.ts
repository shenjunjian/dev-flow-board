import { MERGED_LABEL, STATUS_LABEL_TEXT } from './columns'
/** GitHub Issue Events 里参与时间线的事件 */
export interface IssueTimelineEvent {
  event: string
  /** ISO 时间 */
  createdAt: string
  label?: string | null
}

/** 一句生命周期文案：occurredAt 排序用，message 自带 `MM-DD HH:mm:ss` 前缀 */
export interface TimelineSentence {
  occurredAt: string
  message: string
}

/** 本地时区的 `MM-DD HH:mm:ss` */
export function formatLocalDateTime(input: string | number | Date): string {
  const d = new Date(input)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * 用 Issue Events 重建时间线：
 * - 创建（issue 的 createdAt）记「创建需求」
 * - 状态 label 的 labeled 记「转为 …」
 * - closed 且（最终）带 Merged 记「已合入」
 * - reopened 记「重新打开」
 * - 重要性 label（High/Low）不进时间线
 */
export function buildTimelineSentences(params: {
  issueCreatedAt: string
  hasMerged: boolean
  events: IssueTimelineEvent[]
}): TimelineSentence[] {
  const sentences: TimelineSentence[] = [
    { occurredAt: params.issueCreatedAt, message: `${formatLocalDateTime(params.issueCreatedAt)} 创建需求` },
  ]
  for (const ev of params.events) {
    if (ev.event === 'labeled' && ev.label && STATUS_LABEL_TEXT[ev.label]) {
      sentences.push({ occurredAt: ev.createdAt, message: `${formatLocalDateTime(ev.createdAt)} ${STATUS_LABEL_TEXT[ev.label]}` })
    }
    else if (ev.event === 'closed' && params.hasMerged) {
      sentences.push({ occurredAt: ev.createdAt, message: `${formatLocalDateTime(ev.createdAt)} 已合入` })
    }
    else if (ev.event === 'reopened') {
      sentences.push({ occurredAt: ev.createdAt, message: `${formatLocalDateTime(ev.createdAt)} 重新打开` })
    }
  }
  sentences.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
  return sentences
}
