import type { BoardRepo } from '#shared/utils/board'
import { isRefreshInterval } from '#shared/utils/colors'
import { parseRepoAddress } from '#shared/utils/repo-address'
import { eq } from 'drizzle-orm'
import { repos as reposTable, useDb } from '../../utils/db'
import { checkGhAuth } from '../../utils/gh'
import { scheduleSingleRepo } from '../../utils/scheduler'
import { toBoardRepo } from '../../utils/serialize'

interface RepoInput {
  address?: unknown
  sortOrder?: unknown
  color?: unknown
  refreshIntervalMs?: unknown
}

type ReadResult<T> = { ok: true, value: T } | { ok: false, error: string }

const DEFAULT_INTERVAL = 60_000

function readAddress(input: RepoInput): ReadResult<{ owner: string, name: string }> {
  const address = typeof input.address === 'string' ? input.address : ''
  const parsed = parseRepoAddress(address)
  if (!parsed) {
    return { ok: false, error: '仓库地址不合法，应为 owner/repo 或 https://github.com/owner/repo' }
  }
  return { ok: true, value: parsed }
}

function readSortOrder(input: RepoInput): ReadResult<number> {
  if (input.sortOrder === undefined || input.sortOrder === null || input.sortOrder === '') {
    return { ok: true, value: 1 }
  }
  const n = Number(input.sortOrder)
  if (!Number.isFinite(n)) return { ok: false, error: '排序号必须是数字' }
  return { ok: true, value: Math.trunc(n) }
}

function readColor(input: RepoInput): ReadResult<string> {
  const color = typeof input.color === 'string' ? input.color : ''
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { ok: false, error: '颜色不合法，必须是 #RRGGBB' }
  }
  return { ok: true, value: color }
}

function readInterval(input: RepoInput): ReadResult<number> {
  if (input.refreshIntervalMs === undefined || input.refreshIntervalMs === null || input.refreshIntervalMs === '') {
    return { ok: true, value: DEFAULT_INTERVAL }
  }
  const n = Number(input.refreshIntervalMs)
  if (!isRefreshInterval(n)) {
    return { ok: false, error: '刷新间隔只允许 30000 / 60000 / 300000 / 1800000 毫秒' }
  }
  return { ok: true, value: n }
}

/** POST /api/repos：新增仓库（新增后开始计时） */
export default defineEventHandler(async (event): Promise<{ repo?: BoardRepo, error?: string }> => {
  const body = await readBody<RepoInput>(event).catch(() => ({}) as RepoInput)

  const owner = readAddress(body)
  if (!owner.ok) return { error: owner.error }
  const sortOrder = readSortOrder(body)
  if (!sortOrder.ok) return { error: sortOrder.error }
  const color = readColor(body)
  if (!color.ok) return { error: color.error }
  const refreshIntervalMs = readInterval(body)
  if (!refreshIntervalMs.ok) return { error: refreshIntervalMs.error }

  const { db } = useDb()
  const fullName = `${owner.value.owner}/${owner.value.name}`
  const exists = db.select({ id: reposTable.id }).from(reposTable).where(eq(reposTable.fullName, fullName)).get()
  if (exists) {
    return { error: `仓库 ${fullName} 已存在` }
  }

  // 提前校验 gh 可用性，给页面一个明确错误
  const auth = await checkGhAuth()
  if (!auth.ok) return { error: auth.message }

  const now = new Date()
  const result = db.insert(reposTable).values({
    owner: owner.value.owner,
    name: owner.value.name,
    fullName,
    sortOrder: sortOrder.value,
    color: color.value,
    refreshIntervalMs: refreshIntervalMs.value,
    createdAt: now,
    updatedAt: now,
  }).run()

  const saved = db.select().from(reposTable).where(eq(reposTable.id, Number(result.lastInsertRowid))).get()
  if (saved) scheduleSingleRepo(saved.id)
  return { repo: saved ? toBoardRepo(saved) : undefined }
})
