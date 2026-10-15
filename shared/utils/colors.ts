/**
 * 仓库颜色色板，取自 git-color.png 上排的 6 个色块：黑红绿蓝橙紫。
 * 下排的灰黄浅绿浅蓝粉太浅，作为仓库块的边框/底色对比不足，已去掉。
 */
export const REPO_COLORS = [
  '#1e1e1e', // 黑
  '#e03131', // 红
  '#2f9e44', // 绿
  '#1971c2', // 蓝
  '#f08c00', // 橙
  '#4a47b1', // 紫
] as const

export type RepoColor = (typeof REPO_COLORS)[number]

/** 种子仓库用色：色板中的蓝色 */
export const DEFAULT_REPO_COLOR = '#1971c2'

export function isRepoColor(value: string): value is RepoColor {
  return (REPO_COLORS as readonly string[]).includes(value)
}

/** 每个仓库允许的刷新间隔（毫秒） */
export const REFRESH_INTERVALS = [30_000, 60_000, 300_000, 1_800_000] as const

export type RefreshInterval = (typeof REFRESH_INTERVALS)[number]

export const DEFAULT_REFRESH_INTERVAL_MS: RefreshInterval = 60_000

export function isRefreshInterval(value: number): value is RefreshInterval {
  return (REFRESH_INTERVALS as readonly number[]).includes(value)
}
