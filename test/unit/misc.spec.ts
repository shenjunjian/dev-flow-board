import { describe, expect, it } from 'vitest'
import { parseRepoAddress } from '../../shared/utils/repo-address'
import { isRefreshInterval, isRepoColor, REPO_COLORS } from '../../shared/utils/colors'

describe('parseRepoAddress', () => {
  it('owner/repo 形态', () => {
    expect(parseRepoAddress('vuejs/core')).toEqual({ owner: 'vuejs', name: 'core' })
  })

  it('https URL 可带 .git 后缀', () => {
    expect(parseRepoAddress('https://github.com/vuejs/core.git')).toEqual({ owner: 'vuejs', name: 'core' })
    expect(parseRepoAddress('https://github.com/vuejs/core')).toEqual({ owner: 'vuejs', name: 'core' })
  })

  it('非法输入返回 null', () => {
    expect(parseRepoAddress('')).toBeNull()
    expect(parseRepoAddress('justoneword')).toBeNull()
    expect(parseRepoAddress('a/b/c')).toBeNull()
    expect(parseRepoAddress('https://gitlab.com/a/b')).toBeNull()
  })
})

describe('colors 纯函数', () => {
  it('色板 6 色且 isRepoColor 正确判别', () => {
    expect(REPO_COLORS).toHaveLength(6)
    expect(isRepoColor('#1971c2')).toBe(true)
    expect(isRepoColor('#ffffff')).toBe(false)
    // 浅色已从色板移除
    expect(isRepoColor('#a5d8ff')).toBe(false)
  })

  it('isRefreshInterval 只认 4 档', () => {
    for (const ok of [30_000, 60_000, 300_000, 1_800_000]) {
      expect(isRefreshInterval(ok)).toBe(true)
    }
    expect(isRefreshInterval(45_000)).toBe(false)
  })
})
