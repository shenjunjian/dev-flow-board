/**
 * 两数之和：在整数数组中找出和为 target 的两个数，返回它们的下标（升序）。
 *
 * 算法：哈希表一次遍历，O(n) 时间 / O(n) 空间。
 * 每一步先查 `target - nums[i]` 是否已入表，命中即返回；否则再把当前值入表。
 * 「先查后存」保证命中的下标必然来自更早的位置，因此同一元素不会被重复使用，
 * 且返回的下标对天然升序。
 *
 * 入参校验：先用一趟 `every` 整体校验元素均为整数，再做哈希遍历。
 * 这样含非法元素的数组一律返回 []，不会因为非法项恰好排在答案之后而返回结果，
 * 行为与文档描述完全一致（总复杂度仍为 O(n)）。
 *
 * 边界约定（不抛错，统一返回安全值，与 demos/sum.js 的纯函数风格一致）：
 * - 非数组 → []
 * - 元素非整数（小数 / NaN / Infinity / 非数字类型）→ []
 * - target 非有限整数（3.5 / NaN / Infinity / 非数字类型）→ []
 * - 元素不足 2 个无法配对，或遍历完仍无匹配 → []
 *
 * 说明：入参约定为整数，故不做超出安全整数的精度处理，不引入 BigInt。
 *
 * @param {number[]} nums 整数数组
 * @param {number} target 目标和
 * @returns {number[]} 两个下标，升序；无解或入参非法时为 []
 */
export function twoSum(nums, target) {
  if (!Array.isArray(nums) || !Number.isInteger(target)) return []
  if (!nums.every(x => Number.isInteger(x))) return []

  const seenIndex = new Map()
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i]
    if (seenIndex.has(complement)) return [seenIndex.get(complement), i]
    seenIndex.set(nums[i], i)
  }

  return []
}
