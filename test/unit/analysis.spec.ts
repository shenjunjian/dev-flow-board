import { describe, expect, it } from 'vitest'
import type { BoardIssue, BoardRepo } from '../../shared/utils/board'
import {
  ANALYSIS_SPAN_DAYS,
  analysisDurations,
  analysisRangeFromDays,
  buildAnalysisRows,
  defaultAnalysisRange,
  filterAnalysisIssues,
  formatHours,
  groupByAssignee,
  matchesAssigneeFilter,
  matchesTaskFilter,
  sumDurationHours,
} from '../../shared/utils/analysis'
import { buildTimelineSentences } from '../../shared/utils/timeline'
import type { IssueTimelineEvent } from '../../shared/utils/timeline'

function local(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

function repo(id: number, sortOrder: number): BoardRepo {
  return {
    id,
    owner: 'acme',
    name: `repo-${id}`,
    fullName: `acme/repo-${id}`,
    sortOrder,
    color: '#1971c2',
    refreshIntervalMs: 60_000,
  }
}

function issue(overrides: Partial<BoardIssue> & Pick<BoardIssue, 'repoId' | 'number'>): BoardIssue {
  const createdAt = overrides.createdAt ?? '2026-10-02T00:00:00.000Z'
  return {
    title: `#${overrides.number}`,
    body: null,
    state: 'closed',
    importance: 'low',
    taskType: null,
    statusLabel: null,
    column: 'done',
    assignee: null,
    createdAt,
    updatedAt: createdAt,
    closedAt: '2026-10-10T00:00:00.000Z',
    highlightUntil: null,
    parentNumber: null,
    timeline: [],
    ...overrides,
  }
}

describe('defaultAnalysisRange', () => {
  it('默认近 14 个本地日，含今天，终点是今天 24 点', () => {
    const now = local(2026, 10, 16, 15, 30)
    const range = defaultAnalysisRange(now)
    expect(ANALYSIS_SPAN_DAYS).toBe(14)
    expect(range.start).toBe(local(2026, 10, 3))
    expect(range.end).toBe(local(2026, 10, 17))
  })
})

describe('analysisRangeFromDays', () => {
  it('同一天覆盖该日 0 点到 24 点，起止颠倒时对调', () => {
    expect(analysisRangeFromDays(local(2026, 10, 8, 12), local(2026, 10, 8, 18))).toEqual({
      start: local(2026, 10, 8),
      end: local(2026, 10, 9),
    })
    expect(analysisRangeFromDays(local(2026, 10, 10), local(2026, 10, 3))).toEqual({
      start: local(2026, 10, 3),
      end: local(2026, 10, 11),
    })
  })
})

describe('filterAnalysisIssues', () => {
  const start = Date.parse('2026-10-01T00:00:00.000Z')
  const end = Date.parse('2026-10-15T00:00:00.000Z')
  const issues = [
    issue({ repoId: 1, number: 1, createdAt: '2026-10-02T00:00:00.000Z', closedAt: '2026-10-10T00:00:00.000Z' }),
    issue({ repoId: 2, number: 2, createdAt: '2026-10-02T00:00:00.000Z', closedAt: '2026-10-10T00:00:00.000Z' }),
    issue({ repoId: 1, number: 3, createdAt: '2026-09-30T00:00:00.000Z', closedAt: '2026-10-10T00:00:00.000Z' }),
    issue({ repoId: 1, number: 4, createdAt: '2026-10-02T00:00:00.000Z', closedAt: null }),
    issue({ repoId: 1, number: 5, createdAt: start, closedAt: new Date(end).toISOString() }),
    issue({ repoId: 1, number: 6, createdAt: start, closedAt: new Date(end + 1).toISOString() }),
  ]

  it('创建和合入都落在范围内才纳入，端点含入，擦边和未合入不算', () => {
    expect(filterAnalysisIssues(issues, start, end, null).map(item => item.number)).toEqual([1, 2, 5])
  })

  it('仓库条件与日期同时生效', () => {
    expect(filterAnalysisIssues(issues, start, end, 1).map(item => item.number)).toEqual([1, 5])
  })
})

describe('matchesAssigneeFilter', () => {
  it('全部、具体责任人和未指派', () => {
    expect(matchesAssigneeFilter('shenjunjian', 'all')).toBe(true)
    expect(matchesAssigneeFilter(null, 'all')).toBe(true)
    expect(matchesAssigneeFilter('shenjunjian', 'shenjunjian')).toBe(true)
    expect(matchesAssigneeFilter('other', 'shenjunjian')).toBe(false)
    expect(matchesAssigneeFilter(null, 'none')).toBe(true)
    expect(matchesAssigneeFilter('shenjunjian', 'none')).toBe(false)
  })
})

describe('groupByAssignee', () => {
  it('同一责任人加总，未指派放在最后', () => {
    expect(groupByAssignee([
      { assignee: 'b', devHours: 1, reviewHours: 2, idleHours: 3 },
      { assignee: null, devHours: 4, reviewHours: 0, idleHours: 1 },
      { assignee: 'a', devHours: 1, reviewHours: 1, idleHours: 1 },
      { assignee: 'b', devHours: 0.5, reviewHours: 0, idleHours: 0 },
    ])).toEqual([
      { label: 'a', devHours: 1, reviewHours: 1, idleHours: 1 },
      { label: 'b', devHours: 1.5, reviewHours: 2, idleHours: 3 },
      { label: '未指派', devHours: 4, reviewHours: 0, idleHours: 1 },
    ])
  })
})

describe('matchesTaskFilter', () => {
  it('全部、具体类型和未分类', () => {
    expect(matchesTaskFilter('bug', 'all')).toBe(true)
    expect(matchesTaskFilter(null, 'all')).toBe(true)
    expect(matchesTaskFilter('bug', 'bug')).toBe(true)
    expect(matchesTaskFilter('feature', 'bug')).toBe(false)
    expect(matchesTaskFilter(null, 'untyped')).toBe(true)
    expect(matchesTaskFilter('refactor', 'untyped')).toBe(false)
  })
})

describe('analysisDurations', () => {
  const create = '2026-10-10T01:00:00.000Z'
  const waitDev = '2026-10-10T02:00:00.000Z'
  const devDone = '2026-10-10T05:00:00.000Z'
  const review = '2026-10-10T06:00:00.000Z'
  const reviewEnd = '2026-10-10T08:00:00.000Z'
  const waitDev2 = '2026-10-11T01:00:00.000Z'
  const now = '2026-10-11T06:00:00.000Z'

  function labeled(createdAt: string, label: string): IssueTimelineEvent {
    return { event: 'labeled', createdAt, label }
  }

  it('多段开发、检视先加总再换成小时', () => {
    const timeline = buildTimelineSentences({
      issueCreatedAt: create,
      hasMerged: false,
      events: [
        labeled(waitDev, 'WaitDev'),
        labeled(devDone, 'DevDone'),
        labeled(review, 'Review'),
        labeled(reviewEnd, 'ReviewErrors'),
        labeled(waitDev2, 'WaitDev'),
      ],
    })
    const durations = analysisDurations(
      timeline.map(item => ({ at: item.occurredAt, message: item.message })),
      now,
    )
    expect(durations.devHours).toBe(8)
    expect(durations.reviewHours).toBe(2)
    expect(durations.idleHours).toBe(19)
    expect(sumDurationHours([durations, durations])).toEqual({
      devHours: 16,
      reviewHours: 4,
      idleHours: 38,
    })
  })
})

describe('formatHours', () => {
  it('去掉末尾 0，极短时长标成小于 0.01', () => {
    expect(formatHours(0)).toBe('0')
    expect(formatHours(2)).toBe('2')
    expect(formatHours(1.5)).toBe('1.5')
    expect(formatHours(1.234)).toBe('1.23')
    expect(formatHours(0.004)).toBe('<0.01')
  })
})

describe('buildAnalysisRows', () => {
  it('按仓库排序号再按编号升序', () => {
    const rows = buildAnalysisRows([
      issue({ repoId: 2, number: 8, taskType: 'bug' }),
      issue({ repoId: 1, number: 3, taskType: 'feature' }),
      issue({ repoId: 2, number: 1, assignee: 'shenjunjian' }),
    ], [repo(2, 2), repo(1, 1)], Date.parse('2026-10-16T00:00:00.000Z'))
    expect(rows.map(row => `${row.repoName}#${row.number}`)).toEqual([
      'acme/repo-1#3',
      'acme/repo-2#1',
      'acme/repo-2#8',
    ])
    expect(rows[0]?.href).toBe('https://github.com/acme/repo-1/issues/3')
    expect(rows[0]?.taskType).toBe('feature')
    expect(rows[0]?.assignee).toBeNull()
    expect(rows[1]?.assignee).toBe('shenjunjian')
  })
})
