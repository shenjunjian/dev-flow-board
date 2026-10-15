import { eq } from 'drizzle-orm'
import { repos as reposTable, useDb, type RepoRow } from './db'
import { syncRepo } from './sync'

interface ScheduledRepo {
  repoId: number
  timer: NodeJS.Timeout
}

// globalThis 收口：开发热更新下不叠出多组计时器
const globalForScheduler = globalThis as unknown as {
  __devFlowBoardScheduler?: Map<number, ScheduledRepo>
}

function scheduled(): Map<number, ScheduledRepo> {
  if (!globalForScheduler.__devFlowBoardScheduler) {
    globalForScheduler.__devFlowBoardScheduler = new Map()
  }
  return globalForScheduler.__devFlowBoardScheduler
}

function scheduleRepo(repo: RepoRow): void {
  unscheduleRepo(repo.id)
  const intervalMs = repo.refreshIntervalMs
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) return

  // 首拍在一个间隔之后触发，不在启动/新增瞬间打 GitHub
  const timer = setInterval(() => {
    void syncRepo(repo.id, 'today').catch(err => console.error(`[scheduler] ${repo.fullName} 同步失败：`, err))
  }, intervalMs)
  timer.unref?.()
  scheduled().set(repo.id, { repoId: repo.id, timer })
  console.log(`[scheduler] ${repo.fullName} 按 ${Math.round(intervalMs / 1000)}s 间隔排程`)
}

function unscheduleRepo(repoId: number): void {
  const item = scheduled().get(repoId)
  if (item) {
    clearInterval(item.timer)
    scheduled().delete(repoId)
  }
}

/** 重读数据库，按最新配置为全部仓库排程（修改间隔后按新间隔重新计时） */
export function rescheduleAll(): void {
  const { db } = useDb()
  const rows = db.select().from(reposTable).all()
  const alive = new Set(rows.map(r => r.id))
  for (const repoId of [...scheduled().keys()]) {
    if (!alive.has(repoId)) unscheduleRepo(repoId)
  }
  for (const repo of rows) scheduleRepo(repo)
}

/** 新增仓库后开始计时；修改后按新间隔重新计时；删除后清掉计时 */
export function scheduleSingleRepo(repoId: number): void {
  const { db } = useDb()
  const repo = db.select().from(reposTable).where(eq(reposTable.id, repoId)).get()
  if (repo) scheduleRepo(repo)
  else unscheduleRepo(repoId)
}

export { unscheduleRepo }
