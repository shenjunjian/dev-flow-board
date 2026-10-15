import type { BoardRepo } from '#shared/utils/board'
import { isRefreshInterval } from '#shared/utils/colors'
import { parseRepoAddress } from '#shared/utils/repo-address'
import { eq } from 'drizzle-orm'
import { issues as issuesTable, issueEvents as issueEventsTable, repos as reposTable, useDb } from '../../utils/db'
import { scheduleSingleRepo } from '../../utils/scheduler'
import { toBoardRepo } from '../../utils/serialize'

interface PatchInput {
  address?: unknown
  sortOrder?: unknown
  color?: unknown
  refreshIntervalMs?: unknown
}

/** PATCH /api/repos/:id：改地址、排序、颜色、刷新间隔（改完看板立即按新配置显示，后台按新间隔重新计时） */
export default defineEventHandler(async (event): Promise<{ repo?: BoardRepo, error?: string }> => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) return { error: 'id 不合法' }

  const body = await readBody<PatchInput>(event).catch(() => ({}) as PatchInput)
  const patch: Partial<typeof reposTable.$inferInsert> = { updatedAt: new Date() }

  const { db, sqlite } = useDb()
  const current = db.select().from(reposTable).where(eq(reposTable.id, id)).get()
  if (!current) return { error: '仓库不存在' }

  let addressChanged = false
  if (body.address !== undefined && body.address !== null && body.address !== '') {
    const parsed = parseRepoAddress(typeof body.address === 'string' ? body.address : '')
    if (!parsed) return { error: '仓库地址不合法，应为 owner/repo 或 https://github.com/owner/repo' }
    const fullName = `${parsed.owner}/${parsed.name}`
    if (fullName !== current.fullName) {
      const exists = db.select({ id: reposTable.id }).from(reposTable).where(eq(reposTable.fullName, fullName)).get()
      if (exists) return { error: `仓库 ${fullName} 已存在` }
      patch.owner = parsed.owner
      patch.name = parsed.name
      patch.fullName = fullName
      addressChanged = true
    }
  }
  if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== '') {
    const n = Number(body.sortOrder)
    if (!Number.isFinite(n)) return { error: '排序号必须是数字' }
    patch.sortOrder = Math.trunc(n)
  }
  if (body.color !== undefined) {
    const color = typeof body.color === 'string' ? body.color : ''
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: '颜色不合法，必须是 #RRGGBB' }
    patch.color = color
  }
  if (body.refreshIntervalMs !== undefined && body.refreshIntervalMs !== null && body.refreshIntervalMs !== '') {
    const n = Number(body.refreshIntervalMs)
    if (!isRefreshInterval(n)) return { error: '刷新间隔只允许 30000 / 60000 / 300000 / 1800000 毫秒' }
    patch.refreshIntervalMs = n
  }

  if (addressChanged) {
    // 换了仓库：旧 Issue 数据不再适用，清掉后由用户重新做初始查询
    sqlite.transaction(() => {
      db.delete(issuesTable).where(eq(issuesTable.repoId, id)).run()
      db.delete(issueEventsTable).where(eq(issueEventsTable.repoId, id)).run()
      db.update(reposTable).set(patch).where(eq(reposTable.id, id)).run()
    })()
  }
  else {
    db.update(reposTable).set(patch).where(eq(reposTable.id, id)).run()
  }

  const saved = db.select().from(reposTable).where(eq(reposTable.id, id)).get()
  if (saved) scheduleSingleRepo(saved.id)
  return { repo: saved ? toBoardRepo(saved) : undefined }
})
