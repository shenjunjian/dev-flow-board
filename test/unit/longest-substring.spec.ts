import { describe, expect, it } from 'vitest'
import { lengthOfLongestSubstring } from '../../demos/longest-substring.js'

describe('demos/lengthOfLongestSubstring', () => {
  it('Issue #12 题面示例', () => {
    expect(lengthOfLongestSubstring('abcabcbb')).toBe(3)
    expect(lengthOfLongestSubstring('bbbbb')).toBe(1)
    // "pwke" 是子序列（长度 4），但窗口只数连续子串，答案仍是 "wke" 的 3
    expect(lengthOfLongestSubstring('pwwkew')).toBe(3)
  })

  it('空串与单字符', () => {
    expect(lengthOfLongestSubstring('')).toBe(0)
    expect(lengthOfLongestSubstring('a')).toBe(1)
  })

  it('窗口整体前移：重复字符在 left 之前不影响结果', () => {
    expect(lengthOfLongestSubstring('dvdf')).toBe(3)
    expect(lengthOfLongestSubstring('tmmzuxt')).toBe(5)
  })

  it('left 只前进不回退', () => {
    // 第二个 a 的旧下标 0 已在窗口之外，若回退会得到错误的 3
    expect(lengthOfLongestSubstring('abba')).toBe(2)
    expect(lengthOfLongestSubstring('abcbad')).toBe(4)
  })

  it('全同字符与全不同字符', () => {
    expect(lengthOfLongestSubstring('aaaa')).toBe(1)
    expect(lengthOfLongestSubstring('abcdefg')).toBe(7)
  })

  it('按 Unicode 码点遍历，代理对不被拆坏', () => {
    // 😀 是代理对：按码元判重会当成两个不同字符，得出 5
    expect(lengthOfLongestSubstring('😀abc😀')).toBe(4)
    expect(lengthOfLongestSubstring('😀😀')).toBe(1)
    expect(lengthOfLongestSubstring('a😀b😀c')).toBe(3)
  })

  it('包含空格与标点等非字母字符', () => {
    expect(lengthOfLongestSubstring('a b c d')).toBe(3)
    expect(lengthOfLongestSubstring('au')).toBe(2)
    expect(lengthOfLongestSubstring('aab')).toBe(2)
    expect(lengthOfLongestSubstring('wobnbviewqjfdxoibzsuslxfuwtreiwwehsfhzb')).toBe(13)
  })

  it('非法入参返回 0，不抛错', () => {
    // @ts-expect-error 运行期防御：null 返回 0
    expect(lengthOfLongestSubstring(null)).toBe(0)
    // @ts-expect-error 运行期防御：undefined 返回 0
    expect(lengthOfLongestSubstring(undefined)).toBe(0)
    // @ts-expect-error 运行期防御：数字返回 0
    expect(lengthOfLongestSubstring(123)).toBe(0)
    // @ts-expect-error 运行期防御：数组不是字符串，返回 0
    expect(lengthOfLongestSubstring(['a', 'b'])).toBe(0)
    // @ts-expect-error 运行期防御：对象返回 0
    expect(lengthOfLongestSubstring({})).toBe(0)
    // @ts-expect-error 运行期防御：NaN 返回 0
    expect(lengthOfLongestSubstring(Number.NaN)).toBe(0)
  })

  it('未改动入参，且同一输入重复调用结果稳定（纯函数）', () => {
    const input = 'abcabcbb'
    const first = lengthOfLongestSubstring(input)
    expect(first).toBe(3)
    expect(lengthOfLongestSubstring(input)).toBe(first)
    expect(input).toBe('abcabcbb')
  })
})
