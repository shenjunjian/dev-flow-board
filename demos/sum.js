/**
 * 计算从 1 累加到 n 的和，采用高斯公式 n*(n+1)/2，O(1) 完成。
 *
 * 边界约定（不抛错，统一返回安全值，与 shared/utils 下纯函数风格一致）：
 * - 非数字类型（string / null / undefined / NaN / Infinity）→ 0
 * - 小于 1 的数（0、负数）→ 0，视作空区间
 * - 小数向下取整，sum(5.9) 等价于 sum(5)
 *
 * 精度说明：结果超出 IEEE754 安全整数需要 n > 134,217,727，
 * 实际使用不会触达，故不引入 BigInt 以免把返回类型拖成联合。
 *
 * @param {number} n 累加上界
 * @returns {number} 1 + 2 + ... + n
 */
export function sum(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0

  const upper = Math.floor(n)
  if (upper < 1) return 0

  return (upper * (upper + 1)) / 2
}
