import { describe, expect, it } from 'vitest'
import { sum } from '../../demos/sum.js'

describe('demos/sum', () => {
  it('常规累加', () => {
    expect(sum(1)).toBe(1)
    expect(sum(5)).toBe(15)
    expect(sum(100)).toBe(5050)
  })

  it('空区间与负数返回 0', () => {
    expect(sum(0)).toBe(0)
    expect(sum(-3)).toBe(0)
  })

  it('小数向下取整', () => {
    expect(sum(5.9)).toBe(15)
    expect(sum(1.999)).toBe(1)
  })

  it('非法入参返回 0，不抛错', () => {
    expect(sum(Number.NaN)).toBe(0)
    expect(sum(Number.POSITIVE_INFINITY)).toBe(0)
    // @ts-expect-error 运行期防御：非数字类型一律返回 0
    expect(sum('5')).toBe(0)
    // @ts-expect-error 运行期防御：非数字类型一律返回 0
    expect(sum(undefined)).toBe(0)
    // @ts-expect-error 运行期防御：非数字类型一律返回 0
    expect(sum(null)).toBe(0)
  })

  it('安全整数范围内不失精', () => {
    expect(sum(1_000_000)).toBe(500_000_500_000)
  })
})
