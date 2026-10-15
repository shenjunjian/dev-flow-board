import type { BoardData, BoardIssue, BoardPatch, BoardRepo } from '#shared/utils/board'

function cardKey(repoId: number, number: number): string {
  return `${repoId}-${number}`
}

function errMessage(e: unknown): string {
  const err = e as { data?: { statusMessage?: string, message?: string }, message?: string }
  return err?.data?.statusMessage ?? err?.data?.message ?? err?.message ?? '未知错误'
}

// -- 模块级单例状态：页面与仓库管理弹窗共享同一份 --
// SSR 端从不写这些状态（load 只在 onMounted 跑），服务端渲染恒为初始空值，跨请求共享是安全的。
const repos = ref<BoardRepo[]>([])
const issues = ref<BoardIssue[]>([])

/** 仓库筛选：空数组 = 全部 */
const repoFilter = ref<number[]>([])
/** 重要性筛选 */
const importanceFilter = ref<'all' | 'high' | 'low'>('all')

const loading = ref(false)
const refreshing = ref(false)

/** 每秒走一拍，驱动 highlightUntil 过期后的样式回收 */
const now = ref(Date.now())
if (import.meta.client) {
  setInterval(() => (now.value = Date.now()), 1000)
}

/** 应用 SSE 补丁 */
function applyPatch(patch: BoardPatch) {
  const deletedSet = new Set(patch.deleted.map(d => cardKey(d.repoId, d.number)))
  const upsertMap = new Map(patch.upserts.map(i => [cardKey(i.repoId, i.number), i]))
  const kept = issues.value.filter(i => {
    const key = cardKey(i.repoId, i.number)
    return !deletedSet.has(key) && !upsertMap.has(key)
  })
  issues.value = [...kept, ...patch.upserts]
}

/** 首次进入页面拿全量 */
async function load() {
  loading.value = true
  try {
    const data = await $fetch<BoardData>('/api/board')
    repos.value = data.repos
    issues.value = data.issues
  }
  catch (e) {
    useToast().add({ title: '加载看板失败', description: errMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

/** 手动「刷新」：对全部仓库立即做一次当天查询 */
async function refresh() {
  refreshing.value = true
  try {
    const res = await $fetch<{ results: Array<{ repoFullName: string, ok: boolean, error?: string, upserted: number, deleted: number }> }>('/api/sync/today', { method: 'POST' })
    const failed = res.results.filter(r => !r.ok)
    if (failed.length > 0) {
      useToast().add({
        title: '部分仓库刷新失败',
        description: failed.map(f => `${f.repoFullName}：${f.error ?? '未知错误'}`).join('；'),
        color: 'error',
      })
    }
    else if (res.results.length > 0) {
      const changed = res.results.reduce((acc, r) => acc + r.upserted + r.deleted, 0)
      useToast().add({ title: '刷新完成', description: changed > 0 ? `共 ${changed} 条变动` : '没有变动', color: 'success' })
    }
    else {
      useToast().add({ title: '刷新完成', description: '还没有登记任何仓库', color: 'neutral' })
    }
  }
  catch (e) {
    useToast().add({ title: '刷新失败', description: errMessage(e), color: 'error' })
  }
  finally {
    refreshing.value = false
  }
}

/** 仓库配置变更（管理弹窗保存接口的响应里直接改本地状态） */
function applyRepos(next: BoardRepo[]) {
  repos.value = [...next].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  const alive = new Set(repos.value.map(r => r.id))
  if (repoFilter.value.some(id => !alive.has(id))) {
    repoFilter.value = repoFilter.value.filter(id => alive.has(id))
  }
  issues.value = issues.value.filter(i => alive.has(i.repoId))
}

function upsertRepo(repo: BoardRepo) {
  const next = repos.value.filter(r => r.id !== repo.id)
  next.push(repo)
  applyRepos(next)
}

function removeRepo(repoId: number) {
  applyRepos(repos.value.filter(r => r.id !== repoId))
  issues.value = issues.value.filter(i => i.repoId !== repoId)
}

const filteredIssues = computed<BoardIssue[]>(() => issues.value.filter(i =>
  (repoFilter.value.length === 0 || repoFilter.value.includes(i.repoId))
  && (importanceFilter.value === 'all' || i.importance === importanceFilter.value),
))

/**
 * 看板状态：全量加载、SSE 补丁应用、筛选、手动刷新。
 * 页面上没有统一定时间隔——刷新只来自服务端后台计时或手动按钮。
 * 状态是模块级单例，页面与仓库管理弹窗共享。
 */
export function useBoard() {
  return {
    repos,
    issues,
    repoFilter,
    importanceFilter,
    filteredIssues,
    loading,
    refreshing,
    now,
    load,
    refresh,
    applyPatch,
    applyRepos,
    upsertRepo,
    removeRepo,
  }
}
