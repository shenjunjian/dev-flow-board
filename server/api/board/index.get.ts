import type { BoardData } from '#shared/utils/board'
import { repos as reposTable, useDb } from '../../utils/db'
import { toBoardRepo } from '../../utils/serialize'
import { getIssuesWithTimeline } from '../../utils/sync'

/** GET /api/board：首次进入页面拿全量（含每条 Issue 的生命周期句子），筛选在前端做 */
export default defineEventHandler((): BoardData => {
  const { db } = useDb()
  const repoRows = db.select().from(reposTable).all()
  repoRows.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  return {
    repos: repoRows.map(toBoardRepo),
    issues: getIssuesWithTimeline(),
  }
})
