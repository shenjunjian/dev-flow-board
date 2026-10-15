import { syncAllReposToday } from '../../utils/sync'

/** POST /api/sync/today：手动刷新，对全部已登记仓库立即做一次当天查询；正在同步的仓库跳过这一拍 */
export default defineEventHandler(async () => {
  const results = await syncAllReposToday()
  return {
    results: results.map(r => ({
      repoId: r.repoId,
      repoFullName: r.repoFullName,
      ok: r.ok,
      error: r.error,
      upserted: r.upserted,
      deleted: r.deleted,
    })),
  }
})
