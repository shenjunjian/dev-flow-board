import { describe, expect, it } from 'vitest'
import type { BoardIssue, BoardRepo } from '../../shared/utils/board'
import {
  GANTT_NAME_MAX,
  GANTT_NAME_MIN,
  GANTT_SPAN_DAYS,
  addLocalDays,
  buildGanttTree,
  clampNameWidth,
  defaultGanttWindowStart,
  formatGanttCursor,
  ganttDays,
  ganttMarks,
  ganttWindowEnd,
  ratioToTime,
  startOfLocalDay,
  timeToRatio,
  windowIncludesToday,
} from '../../shared/utils/gantt'
import { buildTimelineSentences } from '../../shared/utils/timeline'

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
  const createdAt = overrides.createdAt ?? new Date(local(2026, 10, 14, 9)).toISOString()
  return {
    title: `#${overrides.number}`,
    body: null,
    state: 'open',
    importance: 'low',
    taskType: null,
    statusLabel: null,
    column: 'dev',
    assignee: null,
    createdAt,
    updatedAt: createdAt,
    closedAt: null,
    highlightUntil: null,
    parentNumber: null,
    timeline: [],
    ...overrides,
  }
}

describe('五天窗口', () => {
  const now = local(2026, 10, 16, 15, 30)

  it('默认是本地今天往前共 5 天，终点是今天 24 点', () => {
    const start = defaultGanttWindowStart(now)
    expect(start).toBe(local(2026, 10, 12))
    expect(ganttWindowEnd(start)).toBe(local(2026, 10, 17))
    expect(ganttDays(start).map(day => day.label)).toEqual(['10-12', '10-13', '10-14', '10-15', '10-16'])
  })

  it('单日平移 1 天，跨日仍落在本地 0 点', () => {
    const start = addLocalDays(defaultGanttWindowStart(now), -1)
    expect(start).toBe(local(2026, 10, 11))
    expect(ganttWindowEnd(start)).toBe(local(2026, 10, 16))
    expect(addLocalDays(defaultGanttWindowStart(now), GANTT_SPAN_DAYS)).toBe(local(2026, 10, 17))
  })

  it('时间在五等分轨道上线性展开，鼠标时间能还原', () => {
    const start = defaultGanttWindowStart(now)
    expect(timeToRatio(start, start)).toBe(0)
    expect(timeToRatio(local(2026, 10, 12, 12), start)).toBeCloseTo(0.1)
    expect(timeToRatio(local(2026, 10, 13), start)).toBeCloseTo(0.2)
    expect(timeToRatio(ganttWindowEnd(start), start)).toBe(1)
    expect(ratioToTime(0.1, start)).toBe(local(2026, 10, 12, 12))
    expect(ratioToTime(1, start)).toBe(local(2026, 10, 17))
    expect(formatGanttCursor(local(2026, 10, 16, 8, 5))).toBe('10-16 08:05')
  })

  it('窗口含今天才有当前时间线', () => {
    const start = defaultGanttWindowStart(now)
    expect(windowIncludesToday(start, now)).toBe(true)
    expect(windowIncludesToday(addLocalDays(start, -GANTT_SPAN_DAYS), now)).toBe(false)
    expect(windowIncludesToday(addLocalDays(start, GANTT_SPAN_DAYS), now)).toBe(false)
  })

  it('任务名列宽限制在 160 到 480', () => {
    expect(clampNameWidth(100)).toBe(GANTT_NAME_MIN)
    expect(clampNameWidth(900)).toBe(GANTT_NAME_MAX)
    expect(clampNameWidth(280.4)).toBe(280)
  })
})

describe('buildGanttTree', () => {
  const now = local(2026, 10, 16, 15)
  const windowStart = defaultGanttWindowStart(now)

  it('按 sortOrder 排仓库，工单按 number 升序，子工单挂在父工单下', () => {
    const tree = buildGanttTree(
      [repo(1, 2), repo(2, 1), repo(3, 3)],
      [
        issue({ repoId: 1, number: 10 }),
        issue({ repoId: 1, number: 2 }),
        issue({ repoId: 1, number: 9, parentNumber: 5 }),
        issue({ repoId: 1, number: 12, parentNumber: 9 }),
        issue({ repoId: 1, number: 5 }),
        issue({ repoId: 2, number: 4, parentNumber: 1 }),
        issue({ repoId: 3, number: 1, createdAt: new Date(local(2026, 9, 1)).toISOString(), closedAt: new Date(local(2026, 9, 2)).toISOString() }),
      ],
      windowStart,
      now,
    )

    expect(tree.map(node => node.repo.id)).toEqual([2, 1])
    expect(tree[1]!.issues.map(node => node.issue.number)).toEqual([2, 5, 10])
    expect(tree[1]!.issues[1]!.children.map(node => node.issue.number)).toEqual([9])
    expect(tree[1]!.issues[1]!.children[0]!.children.map(node => node.issue.number)).toEqual([12])
    expect(tree[0]!.issues.map(node => node.issue.number)).toEqual([4])
  })

  it('父工单不在当前结果里时，子工单升到仓库下', () => {
    const tree = buildGanttTree(
      [repo(1, 1)],
      [
        issue({
          repoId: 1,
          number: 8,
          parentNumber: 3,
          createdAt: new Date(local(2026, 10, 14, 9)).toISOString(),
        }),
        issue({
          repoId: 1,
          number: 3,
          createdAt: new Date(local(2026, 9, 1)).toISOString(),
          closedAt: new Date(local(2026, 9, 2)).toISOString(),
        }),
      ],
      windowStart,
      now,
    )

    expect(tree[0]!.issues.map(node => node.issue.number)).toEqual([8])
    expect(tree[0]!.issues[0]!.children).toEqual([])
  })
})

describe('ganttMarks', () => {
  const now = local(2026, 10, 16, 12)
  const windowStart = defaultGanttWindowStart(now)

  it('窗口外的阶段裁掉，需求只在窗口内画时间点', () => {
    const created = new Date(local(2026, 10, 10, 9)).toISOString()
    const waitDev = new Date(local(2026, 10, 14, 10)).toISOString()
    const devDone = new Date(local(2026, 10, 15, 16)).toISOString()
    const sentences = buildTimelineSentences({
      issueCreatedAt: created,
      hasMerged: false,
      events: [
        { event: 'labeled', createdAt: waitDev, label: 'WaitDev' },
        { event: 'labeled', createdAt: devDone, label: 'DevDone' },
      ],
    })
    const marks = ganttMarks(
      sentences.map(sentence => ({ at: sentence.occurredAt, message: sentence.message })),
      windowStart,
      now,
    )

    expect(marks.map(mark => mark.kind)).toEqual(['idle', 'dev', 'idle'])
    expect(marks[0]!.start).toBe(windowStart)
    expect(marks[0]!.end).toBe(local(2026, 10, 14, 10))
    expect(marks[1]!.startRatio).toBeCloseTo(timeToRatio(local(2026, 10, 14, 10), windowStart))
    expect(marks[1]!.endRatio).toBeCloseTo(timeToRatio(local(2026, 10, 15, 16), windowStart))
    expect(marks[2]!.end).toBe(now)
  })

  it('创建落在窗口内时，需求是零长度刻度', () => {
    const created = new Date(local(2026, 10, 14, 9)).toISOString()
    const sentences = buildTimelineSentences({ issueCreatedAt: created, hasMerged: false, events: [] })
    const marks = ganttMarks(
      sentences.map(sentence => ({ at: sentence.occurredAt, message: sentence.message })),
      windowStart,
      now,
    )
    expect(marks[0]).toMatchObject({ kind: 'story', startRatio: marks[0]!.endRatio })
    expect(marks[0]!.start).toBe(local(2026, 10, 14, 9))
  })
})
