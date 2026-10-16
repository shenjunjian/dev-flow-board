import { describe, expect, it } from 'vitest'
import { PHASE_COLORS, isCreatedAndClosedInRange, issueOverlapsWindow, rangesOverlap, splitPhases, sumPhaseDurations } from '../../shared/utils/phases'
import type { PhaseKind } from '../../shared/utils/phases'
import { buildTimelineSentences } from '../../shared/utils/timeline'
import type { IssueTimelineEvent } from '../../shared/utils/timeline'

const CREATE = '2026-10-10T01:00:00.000Z'
const WAIT_DEV = '2026-10-10T02:00:00.000Z'
const DEV = '2026-10-10T03:00:00.000Z'
const DEV_DONE = '2026-10-10T05:00:00.000Z'
const REVIEW = '2026-10-10T06:00:00.000Z'
const REVIEW_END = '2026-10-10T08:00:00.000Z'
const WAIT_DEV_2 = '2026-10-11T01:00:00.000Z'
const DEV_2 = '2026-10-11T02:00:00.000Z'
const MERGED = '2026-10-11T03:00:00.000Z'
const REOPENED = '2026-10-11T05:00:00.000Z'
const NOW = '2026-10-11T06:00:00.000Z'

function labeled(createdAt: string, label: string): IssueTimelineEvent {
  return { event: 'labeled', createdAt, label }
}

function run(events: IssueTimelineEvent[], now: string, hasMerged = false) {
  const sentences = buildTimelineSentences({ issueCreatedAt: CREATE, hasMerged, events })
  return splitPhases(sentences, now).map(phase => ({
    kind: phase.kind,
    start: new Date(phase.start).toISOString(),
    end: new Date(phase.end).toISOString(),
  }))
}

function seg(kind: PhaseKind, start: string, end = start) {
  return { kind, start, end }
}

describe('splitPhases 阶段切分', () => {
  it('需求后空闲', () => {
    expect(run([], NOW)).toEqual([
      seg('story', CREATE),
      seg('idle', CREATE, NOW),
    ])
  })

  it('开发整段：待开发到开发完成是一段，中间的开发中不拆开', () => {
    expect(run([
      labeled(WAIT_DEV, 'WaitDev'),
      labeled(DEV, 'Dev'),
      labeled(DEV_DONE, 'DevDone'),
    ], NOW)).toEqual([
      seg('story', CREATE),
      seg('idle', CREATE, WAIT_DEV),
      seg('dev', WAIT_DEV, DEV_DONE),
      seg('idle', DEV_DONE, NOW),
    ])
  })

  it('开发中直接进入检视，中间不插入空闲', () => {
    expect(run([
      labeled(DEV, 'Dev'),
      labeled(REVIEW, 'Review'),
    ], NOW)).toEqual([
      seg('story', CREATE),
      seg('idle', CREATE, DEV),
      seg('dev', DEV, REVIEW),
      seg('review', REVIEW, NOW),
    ])
  })

  it('检视打回再开发，多段各自加总', () => {
    const events = [
      labeled(WAIT_DEV, 'WaitDev'),
      labeled(DEV, 'Dev'),
      labeled(DEV_DONE, 'DevDone'),
      labeled(REVIEW, 'Review'),
      labeled(REVIEW_END, 'ReviewErrors'),
      labeled(WAIT_DEV_2, 'WaitDev'),
      labeled(DEV_2, 'Dev'),
    ]
    const sentences = buildTimelineSentences({ issueCreatedAt: CREATE, hasMerged: false, events })
    const phases = splitPhases(sentences, NOW)

    expect(phases.map(phase => phase.kind)).toEqual([
      'story', 'idle', 'dev', 'idle', 'review', 'idle', 'dev',
    ])
    expect(new Date(phases[2]!.start).toISOString()).toBe(WAIT_DEV)
    expect(new Date(phases[2]!.end).toISOString()).toBe(DEV_DONE)
    expect(new Date(phases[4]!.start).toISOString()).toBe(REVIEW)
    expect(new Date(phases[4]!.end).toISOString()).toBe(REVIEW_END)
    expect(new Date(phases[6]!.start).toISOString()).toBe(WAIT_DEV_2)
    expect(new Date(phases[6]!.end).toISOString()).toBe(NOW)

    const sum = sumPhaseDurations(phases)
    const ms = (iso: string) => new Date(iso).getTime()
    expect(sum.story).toBe(0)
    expect(sum.dev).toBe((ms(DEV_DONE) - ms(WAIT_DEV)) + (ms(NOW) - ms(WAIT_DEV_2)))
    expect(sum.review).toBe(ms(REVIEW_END) - ms(REVIEW))
    expect(sum.idle).toBe(
      (ms(WAIT_DEV) - ms(CREATE))
      + (ms(REVIEW) - ms(DEV_DONE))
      + (ms(WAIT_DEV_2) - ms(REVIEW_END)),
    )
  })

  it('检视成功同样结束检视并进入空闲', () => {
    expect(run([
      labeled(WAIT_DEV, 'WaitDev'),
      labeled(DEV_DONE, 'DevDone'),
      labeled(REVIEW, 'Review'),
      labeled(REVIEW_END, 'ReviewDone'),
    ], NOW)).toEqual([
      seg('story', CREATE),
      seg('idle', CREATE, WAIT_DEV),
      seg('dev', WAIT_DEV, DEV_DONE),
      seg('idle', DEV_DONE, REVIEW),
      seg('review', REVIEW, REVIEW_END),
      seg('idle', REVIEW_END, NOW),
    ])
  })

  it('无检视直接合入', () => {
    expect(run([
      labeled(WAIT_DEV, 'WaitDev'),
      labeled(DEV, 'Dev'),
      labeled(DEV_DONE, 'DevDone'),
      { event: 'closed', createdAt: MERGED },
    ], NOW, true)).toEqual([
      seg('story', CREATE),
      seg('idle', CREATE, WAIT_DEV),
      seg('dev', WAIT_DEV, DEV_DONE),
      seg('idle', DEV_DONE, MERGED),
    ])
  })

  it('未标开发完成就合入，开发段在合入处结束且不插入空闲', () => {
    expect(run([
      labeled(WAIT_DEV, 'WaitDev'),
      labeled(DEV, 'Dev'),
      { event: 'closed', createdAt: MERGED },
    ], NOW, true)).toEqual([
      seg('story', CREATE),
      seg('idle', CREATE, WAIT_DEV),
      seg('dev', WAIT_DEV, MERGED),
    ])
  })

  it('合入之后不再画；重新打开到下一状态算空闲', () => {
    expect(run([
      labeled(WAIT_DEV, 'WaitDev'),
      labeled(DEV_DONE, 'DevDone'),
      { event: 'closed', createdAt: MERGED },
      { event: 'reopened', createdAt: REOPENED },
    ], NOW, true)).toEqual([
      seg('story', CREATE),
      seg('idle', CREATE, WAIT_DEV),
      seg('dev', WAIT_DEV, DEV_DONE),
      seg('idle', DEV_DONE, MERGED),
      seg('idle', REOPENED, NOW),
    ])
  })

  it('未结束延伸到 now', () => {
    expect(run([
      labeled(WAIT_DEV, 'WaitDev'),
      labeled(DEV, 'Dev'),
    ], NOW).at(-1)).toEqual(seg('dev', WAIT_DEV, NOW))

    expect(run([
      labeled(DEV, 'Dev'),
      labeled(DEV_DONE, 'DevDone'),
      labeled(REVIEW, 'Review'),
    ], NOW).at(-1)).toEqual(seg('review', REVIEW, NOW))

    expect(run([
      labeled(WAIT_DEV, 'WaitDev'),
      labeled(DEV_DONE, 'DevDone'),
    ], NOW).at(-1)).toEqual(seg('idle', DEV_DONE, NOW))
  })
})

describe('isCreatedAndClosedInRange 创建和完成都落在日期内', () => {
  const start = '2026-10-01T00:00:00.000Z'
  const end = '2026-10-15T00:00:00.000Z'

  it('起止都在范围内，含两端端点', () => {
    expect(isCreatedAndClosedInRange('2026-10-02T00:00:00.000Z', '2026-10-10T00:00:00.000Z', start, end)).toBe(true)
    expect(isCreatedAndClosedInRange(start, end, start, end)).toBe(true)
  })

  it('只擦边、未合入或越出结束日 24 点都不算', () => {
    expect(isCreatedAndClosedInRange('2026-09-30T00:00:00.000Z', '2026-10-10T00:00:00.000Z', start, end)).toBe(false)
    expect(isCreatedAndClosedInRange('2026-10-02T00:00:00.000Z', '2026-10-20T00:00:00.000Z', start, end)).toBe(false)
    expect(isCreatedAndClosedInRange('2026-10-02T00:00:00.000Z', null, start, end)).toBe(false)
    expect(isCreatedAndClosedInRange(start, '2026-10-15T00:00:00.001Z', start, end)).toBe(false)
  })
})

describe('issueOverlapsWindow 甘特图区间相交', () => {
  const windowStart = '2026-10-12T00:00:00.000Z'
  const windowEnd = '2026-10-17T00:00:00.000Z'
  const now = '2026-10-16T08:00:00.000Z'

  it('寿命与五天窗口相交才纳入，未合入的结束时间取 now', () => {
    expect(issueOverlapsWindow('2026-10-01T00:00:00.000Z', '2026-10-10T00:00:00.000Z', windowStart, windowEnd, now)).toBe(false)
    expect(issueOverlapsWindow('2026-10-10T00:00:00.000Z', '2026-10-13T00:00:00.000Z', windowStart, windowEnd, now)).toBe(true)
    expect(issueOverlapsWindow('2026-10-14T00:00:00.000Z', null, windowStart, windowEnd, now)).toBe(true)
    expect(issueOverlapsWindow('2026-10-01T00:00:00.000Z', null, windowStart, windowEnd, now)).toBe(true)
    expect(issueOverlapsWindow('2026-10-18T00:00:00.000Z', null, windowStart, windowEnd, now)).toBe(false)
  })

  it('端点相接不算相交', () => {
    expect(rangesOverlap(0, 100, 100, 200)).toBe(false)
    expect(rangesOverlap(100, 150, 100, 200)).toBe(true)
    expect(rangesOverlap(150, 150, 100, 200)).toBe(true)
    expect(rangesOverlap(200, 200, 100, 200)).toBe(false)
    expect(issueOverlapsWindow('2026-10-01T00:00:00.000Z', windowStart, windowStart, windowEnd, now)).toBe(false)
    expect(issueOverlapsWindow(windowEnd, '2026-10-18T00:00:00.000Z', windowStart, windowEnd, now)).toBe(false)
  })
})

describe('PHASE_COLORS', () => {
  it('需求、开发、检视、空闲', () => {
    expect(PHASE_COLORS).toEqual({
      story: '#f59f00',
      dev: '#3b82f6',
      review: '#8b5cf6',
      idle: '#ced4da',
    })
  })
})
