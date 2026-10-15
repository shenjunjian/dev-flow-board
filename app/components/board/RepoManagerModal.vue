<script setup lang="ts">
import type { BoardRepo } from '#shared/utils/board'
import { REPO_COLORS, REFRESH_INTERVALS, isRefreshInterval, type RefreshInterval } from '#shared/utils/colors'

const open = defineModel<boolean>('open', { default: false })

const {
  repos,
  issues,
  upsertRepo,
  removeRepo,
} = useBoard()

const toast = useToast()

// -- 行数据：以 repo.id 为锚的本地可编辑副本 --
interface RepoRow {
  /** 已存在仓库的 id；新增行为负数临时 id */
  rowId: number
  repoId: number | null
  address: string
  sortOrder: number
  color: string
  /** 与 USelect 的字面量联合对齐，否则 v-model 类型不匹配会放大成模板作用域崩塌 */
  refreshIntervalMs: RefreshInterval
  /** 行内初始查询按钮状态 */
  syncing: boolean
}

const rows = ref<RepoRow[]>([])
let tempSeq = -1

watch(open, (val) => {
  if (val) {
    rows.value = [...repos.value]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map(r => toRow(r))
  }
})

function toRow(repo: BoardRepo): RepoRow {
  return {
    rowId: repo.id,
    repoId: repo.id,
    address: repo.fullName,
    sortOrder: repo.sortOrder,
    color: repo.color,
    refreshIntervalMs: isRefreshInterval(repo.refreshIntervalMs) ? repo.refreshIntervalMs : 60_000,
    syncing: false,
  }
}

function addRow() {
  rows.value.push({
    rowId: tempSeq--,
    repoId: null,
    address: '',
    sortOrder: nextSortOrder(),
    color: '#1971c2',
    refreshIntervalMs: 60_000,
    syncing: false,
  })
}

function nextSortOrder(): number {
  return rows.value.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1
}

function removeRow(row: RepoRow) {
  rows.value = rows.value.filter(r => r.rowId !== row.rowId)
}

// -- 保存：逐行提交（新增/修改），再处理删除 --
const saving = ref(false)

function errMessage(e: unknown): string {
  const err = e as { data?: { statusMessage?: string, message?: string }, message?: string }
  return err?.data?.statusMessage ?? err?.data?.message ?? err?.message ?? '未知错误'
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const aliveIds = new Set<number>()

    for (const row of rows.value) {
      let res: { repo?: BoardRepo, error?: string }
      if (row.repoId === null) {
        // 新增
        try {
          res = await $fetch<{ repo?: BoardRepo, error?: string }>('/api/repos', {
            method: 'POST',
            body: {
              address: row.address,
              sortOrder: row.sortOrder,
              color: row.color,
              refreshIntervalMs: row.refreshIntervalMs,
            },
          })
        }
        catch (e) {
          res = { error: errMessage(e) }
        }

        if (res.error || !res.repo) {
          toast.add({ title: `新增 ${row.address} 失败`, description: res.error ?? '未知错误', color: 'error' })
          continue
        }
        aliveIds.add(res.repo.id)
        upsertRepo(res.repo)
      }
      else {
        // 修改（排序 / 颜色 / 间隔 / 地址）
        try {
          res = await $fetch<{ repo?: BoardRepo, error?: string }>(`/api/repos/${row.repoId}`, {
            method: 'PATCH',
            body: {
              address: row.address,
              sortOrder: row.sortOrder,
              color: row.color,
              refreshIntervalMs: row.refreshIntervalMs,
            },
          })
        }
        catch (e) {
          res = { error: errMessage(e) }
        }

        if (res.error || !res.repo) {
          toast.add({ title: `修改 ${row.address} 失败`, description: res.error ?? '未知错误', color: 'error' })
          continue
        }
        aliveIds.add(res.repo.id)
        upsertRepo(res.repo)
      }
    }

    // 删除：本轮列表里消失的旧仓库
    for (const repo of repos.value) {
      if (!aliveIds.has(repo.id)) {
        const res = await $fetch<{ ok: boolean, error?: string }>(`/api/repos/${repo.id}`, { method: 'DELETE' })
          .catch(e => ({ ok: false, error: errMessage(e) }))
        if (!res.ok) {
          toast.add({ title: `删除 ${repo.fullName} 失败`, description: res.error ?? '未知错误', color: 'error' })
          continue
        }
        removeRepo(repo.id)
      }
    }

    toast.add({ title: '仓库配置已保存', color: 'success' })
    open.value = false
  }
  finally {
    saving.value = false
  }
}

// -- 每行初始查询（按钮在该行保持 loading，结束前不可重复点） --
async function syncInitial(row: RepoRow) {
  if (row.repoId === null || row.syncing) return
  row.syncing = true
  try {
    await $fetch(`/api/repos/${row.repoId}/sync-initial`, { method: 'POST' })
  }
  catch (e) {
    toast.add({ title: '初始查询失败', description: errMessage(e), color: 'error' })
  }
  finally {
    row.syncing = false
  }
}

const intervalOptions = REFRESH_INTERVALS.map(ms => ({
  label: ms === 30_000 ? '30 秒' : ms === 60_000 ? '1 分钟' : ms === 300_000 ? '5 分钟' : '30 分钟',
  value: ms,
}))

const issueCount = computed(() => {
  const map = new Map<number, number>()
  for (const i of issues.value) {
    map.set(i.repoId, (map.get(i.repoId) ?? 0) + 1)
  }
  return map
})
</script>

<template>
  <UModal
    :open="open"
    title="管理仓库"
    :ui="{ content: 'max-w-4xl' }"
    @update:open="open = $event"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <p class="text-xs text-muted">
          新增仓库后，在该行点「初始查询」拉取全部 Issue；保存后看板立即按新配置显示，后台计时改用新间隔。
        </p>

        <UButton
          icon="i-lucide-plus"
          color="primary"
          variant="soft"
          size="sm"
          class="self-start"
          @click="addRow"
        >
          新增仓库
        </UButton>

        <div
          v-for="row in rows"
          :key="row.rowId"
          class="grid grid-cols-[minmax(0,1fr)_4.5rem_11rem_7rem_auto] items-center gap-2 rounded-lg border border-default bg-elevated/50 p-2.5"
        >
          <!-- 地址 -->
          <!-- 文案必须用短地址形态：长中文含 https:// 的文案会触发 vue-tsc 解析 bug，放大成 v-for 作用域崩塌 -->
          <UInput
            v-model="row.address"
            :placeholder="'owner/repo'"
            size="sm"
            icon="i-lucide-git-branch"
          />

          <!-- 排序号 -->
          <UInputNumber
            v-model="row.sortOrder"
            :min="1"
            :step="1"
            size="sm"
          />

          <!-- 色板：git-color.png 的 11 色，上排黑红绿蓝橙紫，下排灰黄浅绿浅蓝粉；选中态加圈 -->
          <div class="flex flex-wrap items-center gap-1">
            <button
              v-for="color in REPO_COLORS"
              :key="color"
              type="button"
              class="h-4.5 w-4.5 rounded-full border border-default transition-transform hover:scale-110"
              :class="row.color === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-elevated' : ''"
              :style="{ backgroundColor: color }"
              :aria-label="`颜色 ${color}`"
              @click="row.color = color"
            />
          </div>

          <!-- 刷新间隔 -->
          <USelect
            v-model="row.refreshIntervalMs"
            :items="intervalOptions"
            value-key="value"
            size="sm"
          />

          <!-- 操作 -->
          <div class="flex items-center gap-1">
            <UTooltip v-if="row.repoId !== null" text="初始查询：整仓对账拉取全部 Issue">
              <UButton
                icon="i-lucide-cloud-download"
                color="neutral"
                variant="soft"
                size="sm"
                :loading="row.syncing"
                :disabled="row.syncing"
                @click="syncInitial(row)"
              >
                初始查询
              </UButton>
            </UTooltip>
            <span
              v-else
              class="text-[10px] text-dimmed"
            >先保存后再查询</span>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @click="removeRow(row)"
            />
          </div>
        </div>

        <p v-if="rows.length === 0" class="py-6 text-center text-sm text-muted">
          还没有仓库，点「新增仓库」添加一个。
        </p>

        <div class="mt-1 flex items-center justify-between gap-2 border-t border-default pt-3">
          <span class="text-xs text-dimmed">
            共 {{ rows.length }} 个仓库，看板当前 {{ issueCount.size > 0 ? [...issueCount.values()].reduce((a, b) => a + b, 0) : 0 }} 个任务
          </span>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="saving"
              @click="open = false"
            >
              取消
            </UButton>
            <UButton
              color="primary"
              :loading="saving"
              :disabled="saving"
              @click="save"
            >
              保存
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
