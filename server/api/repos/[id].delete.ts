import { eq } from 'drizzle-orm'
import { issues as issuesTable, issueEvents as issueEventsTable, repos as reposTable, useDb } from '../../utils/db'
import { unscheduleRepo } from '../../utils/scheduler'

/** DELETE /api/repos/:id：删除仓库（清掉计时，级联删掉它的 Issue 与时间线） */
export default defineEventHandler((event): { ok: boolean, error?: string } => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) return { ok: false, error: 'id 不合法' }

  const { db, sqlite } = useDb()
  const repo = db.select().from(reposTable).where(eq(reposTable.id, id)).get()
  if (!repo) return { ok: false, error: '仓库不存在' }

  sqlite.transaction(() => {
    db.delete(issuesTable).where(eq(issuesTable.repoId, id)).run()
    db.delete(issueEventsTable).where(eq(issueEventsTable.repoId, id)).run()
    db.delete(reposTable).where(eq(reposTable.id, id)).run()
  })()

  unscheduleRepo(id)
  return { ok: true }
})
