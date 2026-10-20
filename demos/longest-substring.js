/**
 * 无重复字符的最长子串：返回字符串中不含重复字符的最长连续子串的**长度**。
 *
 * 算法：滑动窗口 + 字符最后出现的码点下标，O(n) 时间 / O(k) 空间（k 为不同字符数）。
 * 窗口为 [left, right]，右端逐个码点前进；遇到已在窗口内的字符时，把左端直接跳到
 * 该字符上次出现位置的下一位：`left = lastIndex.get(ch) + 1`。
 * 只前进不回退是关键：`"abba"` 中第二个 `a` 的旧位置在 `left` 之前，若让左端回退，
 * 窗口里会重新出现重复字符，得到错误答案 3。
 * 每步用 `right - left + 1` 刷新最大值，因此结果只可能是连续子串，
 * 像 `"pwwkew"` 里的子序列 `"pwke"` 不会被计入。
 *
 * 遍历按 Unicode 码点（`Array.from(s)`）而非 UTF-16 码元：代理对（如 emoji）作为
 * 一个整体参与判重，不会被拆成两个不同的码元而虚增长度。
 * 例如 `"😀abc😀"` 的两个 😀 判为同一字符，答案是 4（`"abc😀"`），而不是 5。
 *
 * 边界约定（不抛错，统一返回安全值，与 demos/sum.js、demos/two-sum.js 的纯函数风格一致）：
 * - 非字符串（null / undefined / 数字等）→ 0
 * - 空串 → 0
 * - 单字符 / 全同字符（`"bbbbb"`）→ 1
 *
 * @param {string} s 输入字符串
 * @returns {number} 无重复字符的最长子串的长度；入参非法或空串时为 0
 */
export function lengthOfLongestSubstring(s) {
  if (typeof s !== 'string') return 0

  const chars = Array.from(s)
  const lastIndex = new Map()
  let longest = 0
  let left = 0

  for (let right = 0; right < chars.length; right++) {
    const ch = chars[right]
    // 旧位置落在窗口内才需要收缩左端；落在 left 之前说明窗口本身无重复，左端保持不动
    if (lastIndex.has(ch) && lastIndex.get(ch) >= left) {
      left = lastIndex.get(ch) + 1
    }
    lastIndex.set(ch, right)
    longest = Math.max(longest, right - left + 1)
  }

  return longest
}
