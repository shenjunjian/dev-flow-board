import { describe, expect, it } from 'vitest'
import { decideIssueColumn, isDoneIssueVisible, parseTaskType } from '../../shared/utils/columns'

const DAY = 2 * 24 * 60 * 60 * 1000

describe('decideIssueColumn 列判定优先级', () => {
  it('closed + Merged → 已完成列，无状态图标', () => {
    const d = decideIssueColumn({ state: 'closed', labels: ['Story', 'Dev', 'Merged'] })
    expect(d.included).toBe(true)
    expect(d.column).toBe('done')
    expect(d.statusLabel).toBeNull()
  })

  it('closed 无 Merged → 不纳入', () => {
    const d = decideIssueColumn({ state: 'closed', labels: ['Story', 'Dev'] })
    expect(d.included).toBe(false)
    expect(d.column).toBeNull()
  })

  it('open 带检视 label → 检视列', () => {
    for (const label of ['Review', 'ReviewDone', 'ReviewErrors']) {
      const d = decideIssueColumn({ state: 'open', labels: ['Story', 'Dev', label] })
      expect(d.column).toBe('review')
      expect(d.statusLabel).toBe(label)
    }
  })

  it('open 带开发 label 无检视 → 开发列', () => {
    for (const label of ['WaitDev', 'Dev', 'DevDone']) {
      const d = decideIssueColumn({ state: 'open', labels: ['Story', label] })
      expect(d.column).toBe('dev')
      expect(d.statusLabel).toBe(label)
    }
  })

  it('open 仅 Story → 需求列', () => {
    const d = decideIssueColumn({ state: 'open', labels: ['Story'] })
    expect(d.included).toBe(true)
    expect(d.column).toBe('story')
    expect(d.statusLabel).toBe('Story')
  })

  it('open 无 Story 也无状态 label → 不纳入', () => {
    const d = decideIssueColumn({ state: 'open', labels: ['bug', 'High'] })
    expect(d.included).toBe(false)
  })

  it('检视优先于开发，开发优先于需求', () => {
    const d = decideIssueColumn({
      state: 'open',
      labels: ['Story', 'WaitDev', 'Dev', 'Review'],
    })
    expect(d.column).toBe('review')
  })
})

describe('decideIssueColumn 同阶段多 label 取最近 labeled', () => {
  it('同在开发阶段：Dev 比 WaitDev 更近 → Dev', () => {
    const d = decideIssueColumn({
      state: 'open',
      labels: ['Story', 'WaitDev', 'Dev'],
      latestLabeledAt: { WaitDev: 1000, Dev: 2000 },
    })
    expect(d.statusLabel).toBe('Dev')
  })

  it('同在开发阶段：WaitDev 更近 → WaitDev', () => {
    const d = decideIssueColumn({
      state: 'open',
      labels: ['Story', 'WaitDev', 'Dev'],
      latestLabeledAt: { WaitDev: 3000, Dev: 2000 },
    })
    expect(d.statusLabel).toBe('WaitDev')
  })

  it('同在检视阶段：ReviewErrors 最近 → 检视到错误', () => {
    const d = decideIssueColumn({
      state: 'open',
      labels: ['Story', 'Dev', 'Review', 'ReviewDone', 'ReviewErrors'],
      latestLabeledAt: { Review: 1000, ReviewDone: 2000, ReviewErrors: 3000 },
    })
    expect(d.column).toBe('review')
    expect(d.statusLabel).toBe('ReviewErrors')
  })

  it('时间缺失时按声明顺序取靠前的', () => {
    const d = decideIssueColumn({
      state: 'open',
      labels: ['Story', 'WaitDev', 'Dev'],
    })
    expect(d.statusLabel).toBe('WaitDev')
  })
})

describe('decideIssueColumn 重要性', () => {
  it('带 High → high', () => {
    const d = decideIssueColumn({ state: 'open', labels: ['Story', 'High'] })
    expect(d.importance).toBe('high')
  })

  it('无 High → low（即使带 Low）', () => {
    const d = decideIssueColumn({ state: 'open', labels: ['Story', 'Low'] })
    expect(d.importance).toBe('low')
  })
})

describe('decideIssueColumn 任务类型', () => {
  it('带 feature → feature', () => {
    const d = decideIssueColumn({ state: 'open', labels: ['Story', 'feature'] })
    expect(d.taskType).toBe('feature')
  })

  it('带 bug → bug（不影响纳入判定，仍按状态 label 定列）', () => {
    const d = decideIssueColumn({ state: 'open', labels: ['Story', 'Dev', 'bug'] })
    expect(d.column).toBe('dev')
    expect(d.taskType).toBe('bug')
  })

  it('带 refactor → refactor；closed+Merged 也带类型', () => {
    const d = decideIssueColumn({ state: 'closed', labels: ['DevDone', 'refactor', 'Merged'] })
    expect(d.column).toBe('done')
    expect(d.taskType).toBe('refactor')
  })

  it('多贴时按 feature > bug > refactor 取第一个命中', () => {
    expect(decideIssueColumn({ state: 'open', labels: ['Story', 'refactor', 'bug', 'feature'] }).taskType).toBe('feature')
    expect(decideIssueColumn({ state: 'open', labels: ['Story', 'refactor', 'bug'] }).taskType).toBe('bug')
  })

  it('大小写不敏感：Bug / Feature / Refactor 也能识别', () => {
    expect(decideIssueColumn({ state: 'open', labels: ['Story', 'Bug'] }).taskType).toBe('bug')
    expect(decideIssueColumn({ state: 'open', labels: ['Story', 'Feature'] }).taskType).toBe('feature')
    expect(decideIssueColumn({ state: 'open', labels: ['Story', 'Refactor'] }).taskType).toBe('refactor')
  })

  it('三种都没有 → null（卡片不显示 tag）', () => {
    const d = decideIssueColumn({ state: 'open', labels: ['Story', 'High'] })
    expect(d.taskType).toBeNull()
  })
})

describe('parseTaskType', () => {
  it('命中类型 label', () => {
    expect(parseTaskType(['Story', 'feature'])).toBe('feature')
    expect(parseTaskType(['Bug'])).toBe('bug')
    expect(parseTaskType(['Refactor'])).toBe('refactor')
  })

  it('非类型 label 与空数组返回 null', () => {
    expect(parseTaskType([])).toBeNull()
    expect(parseTaskType(['Story', 'High', 'Dev'])).toBeNull()
  })
})

describe('isDoneIssueVisible 完成列 2 天窗口', () => {
  const now = Date.now()

  it('closedAt 在近 2 天内 → 展示', () => {
    expect(isDoneIssueVisible(new Date(now - DAY / 2).toISOString(), now)).toBe(true)
  })

  it('closedAt 恰好 2 天前（边界外）→ 不展示', () => {
    expect(isDoneIssueVisible(new Date(now - DAY).toISOString(), now)).toBe(false)
  })

  it('closedAt 缺失 → 不展示', () => {
    expect(isDoneIssueVisible(null, now)).toBe(false)
    expect(isDoneIssueVisible(undefined, now)).toBe(false)
  })
})
