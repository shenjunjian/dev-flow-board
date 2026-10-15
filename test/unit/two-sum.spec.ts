import { describe, expect, it } from 'vitest'
import { twoSum } from '../../demos/two-sum.js'

describe('demos/twoSum', () => {
  it('Issue #12 题面示例', () => {
    expect(twoSum([2, 7, 11, 15], 9)).toEqual([0, 1])
    expect(twoSum([3, 2, 4], 6)).toEqual([1, 2])
  })

  it('下标按升序返回，与数组顺序无关', () => {
    expect(twoSum([15, 11, 7, 2], 9)).toEqual([2, 3])
  })

  it('重复值使用两个不同下标', () => {
    expect(twoSum([3, 3], 6)).toEqual([0, 1])
    // 后出现的 5 存入表，命中时取到的是更早的合法下标
    expect(twoSum([2, 5, 5, 5], 10)).toEqual([1, 2])
  })

  it('含负数与零', () => {
    expect(twoSum([-3, 4, 3, 90], 0)).toEqual([0, 2])
    expect(twoSum([0, 4, 3, 0], 0)).toEqual([0, 3])
  })

  it('同一元素不会被复用：target 为某元素两倍但该值只出现一次时无解', () => {
    expect(twoSum([5], 10)).toEqual([])
    expect(twoSum([1, 2, 5], 10)).toEqual([])
  })

  it('无解返回 []，不抛错', () => {
    expect(twoSum([], 0)).toEqual([])
    expect(twoSum([0], 0)).toEqual([])
    expect(twoSum([1, 2, 3], 100)).toEqual([])
  })

  it('非法入参返回 []，不抛错', () => {
    // @ts-expect-error 运行期防御：非数组一律返回 []
    expect(twoSum(1, 1)).toEqual([])
    // @ts-expect-error 运行期防御：null 返回 []
    expect(twoSum(null, 0)).toEqual([])
    // @ts-expect-error 运行期防御：undefined 返回 []
    expect(twoSum(undefined, 0)).toEqual([])
    // target 为小数：整数数组不可能命中，直接判定非法
    expect(twoSum([1, 2], 3.5)).toEqual([])
    // @ts-expect-error 运行期防御：target 非数字类型返回 []
    expect(twoSum([1, 2], '3')).toEqual([])
    expect(twoSum([1, 2], Number.NaN)).toEqual([])
    expect(twoSum([1, 2], Number.POSITIVE_INFINITY)).toEqual([])
    // 元素含非整数时整体判非法，即使答案排在非法项之前
    expect(twoSum([1, 2.5, 3], 4)).toEqual([])
    // @ts-expect-error 运行期防御：元素含非数字类型返回 []
    expect(twoSum(['1', '2'], 3)).toEqual([])
    expect(twoSum([1, Number.NaN], 2)).toEqual([])
  })

  it('存在多组答案时返回右下肢最小的一组（一次遍历的首个命中）', () => {
    // [1,3]（2+4=6）先被命中；[0,4]（1+5=6）右下肢更大，不会返回
    expect(twoSum([1, 2, 3, 4, 5], 6)).toEqual([1, 3])
  })
})
