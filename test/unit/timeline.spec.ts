import { describe, expect, it } from 'vitest'
import { buildTimelineSentences, formatLocalDateTime } from '../../shared/utils/timeline'

describe('buildTimelineSentences 时间线', () => {
  const created = '2026-10-15T04:35:16.000Z'

  it('创建即首句「创建需求」', () => {
    const s = buildTimelineSentences({ issueCreatedAt: created, hasMerged: false, events: [] })
    expect(s).toHaveLength(1)
    expect(s[0]?.message).toMatch(/创建需求$/)
  })

  it('状态 label 的 labeled 记「转为 …」，按时间排序', () => {
    const s = buildTimelineSentences({
      issueCreatedAt: created,
      hasMerged: false,
      events: [
        { event: 'labeled', createdAt: '2026-10-15T05:00:00.000Z', label: 'Dev' },
        { event: 'labeled', createdAt: '2026-10-15T04:50:00.000Z', label: 'WaitDev' },
      ],
    })
    expect(s.map(x => x.message.endsWith('转为 待开发'))).toEqual([false, true, false])
    expect(s.map(x => x.message.endsWith('转为 开发中'))).toEqual([false, false, true])
    // 排序：创建 → WaitDev(04:50) → Dev(05:00)
    expect(s[1]?.occurredAt).toBe('2026-10-15T04:50:00.000Z')
    expect(s[2]?.occurredAt).toBe('2026-10-15T05:00:00.000Z')
  })

  it('closed 且最终带 Merged 记「已合入」；不带 Merged 的 close 不记', () => {
    const merged = buildTimelineSentences({
      issueCreatedAt: created,
      hasMerged: true,
      events: [{ event: 'closed', createdAt: '2026-10-15T06:00:00.000Z' }],
    })
    expect(merged.some(x => x.message.includes('已合入'))).toBe(true)

    const notMerged = buildTimelineSentences({
      issueCreatedAt: created,
      hasMerged: false,
      events: [{ event: 'closed', createdAt: '2026-10-15T06:00:00.000Z' }],
    })
    expect(notMerged.some(x => x.message.includes('已合入'))).toBe(false)
  })

  it('reopened 记「重新打开」', () => {
    const s = buildTimelineSentences({
      issueCreatedAt: created,
      hasMerged: false,
      events: [{ event: 'reopened', createdAt: '2026-10-15T07:00:00.000Z' }],
    })
    expect(s.some(x => x.message.includes('重新打开'))).toBe(true)
  })

  it('重要性 label（High/Low）与其他无关 label 不进时间线', () => {
    const s = buildTimelineSentences({
      issueCreatedAt: created,
      hasMerged: false,
      events: [
        { event: 'labeled', createdAt: '2026-10-15T04:40:00.000Z', label: 'High' },
        { event: 'labeled', createdAt: '2026-10-15T04:41:00.000Z', label: 'bug' },
        { event: 'assigned', createdAt: '2026-10-15T04:42:00.000Z' },
      ],
    })
    expect(s).toHaveLength(1)
  })
})

describe('formatLocalDateTime', () => {
  it('本地时区 MM-DD HH:mm:ss 补零', () => {
    const d = new Date(2026, 0, 5, 3, 4, 5) // 2026-01-05 03:04:05 本地
    expect(formatLocalDateTime(d)).toBe('01-05 03:04:05')
  })
})
