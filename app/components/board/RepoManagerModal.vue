<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
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

function countOf(row: RepoRow): number {
  return row.repoId === null ? 0 : issueCount.value.get(row.repoId) ?? 0
}

// 表格列：全部用自定义 cell 插槽渲染编辑器；
// 行对象来自 rows.value 本身（Vue 的响应式是代理不是克隆），
// 所以 v-model 写 row.original.xxx 会直接落到 rows 上，保存逻辑无需改动。
const columns = [
  {
    id: 'address',
    header: '仓库地址',
    meta: { class: { th: 'w-[26%] min-w-56', td: 'min-w-56' } },
  },
  {
    id: 'sortOrder',
    header: '排序',
    meta: { class: { th: 'w-28', td: 'w-28' } },
  },
  {
    id: 'color',
    header: '颜色',
    meta: { class: { th: 'w-36' } },
  },
  {
    id: 'refresh',
    header: '刷新间隔',
    meta: { class: { th: 'w-32', td: 'w-32' } },
  },
  {
    id: 'issues',
    header: '任务数',
    meta: { class: { th: 'w-16', td: 'w-16 tabular-nums' } },
  },
  {
    id: 'actions',
    header: '操作',
    meta: { class: { th: 'w-40', td: 'w-40' } },
  },
] satisfies TableColumn<RepoRow>[]
</script>

<template>
  <UModal
    :open="open"
    title="管理仓库"
    :ui="{ content: 'max-w-5xl' }"
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

        <UTable
          :data="rows"
          :columns="columns"
          :get-row-id="(row: RepoRow) => String(row.rowId)"
          empty="还没有仓库，点「新增仓库」添加一个。"
          :ui="{
            th: 'px-3 py-2 text-xs',
            td: 'px-3 py-2 align-middle',
            root: 'max-h-[55vh] rounded-lg border border-default',
          }"
        >
          <!-- 文案必须用短地址形态：长中文含 https:// 的文案会触发 vue-tsc 解析 bug，放大成插槽作用域崩塌 -->
          <template #address-cell="{ row }">
            <UInput
              v-model="row.original.address"
              :placeholder="'owner/repo'"
              size="sm"
              icon="i-lucide-git-branch"
              class="w-full"
            />
          </template>

          <template #sortOrder-cell="{ row }">
            <UInputNumber
              v-model="row.original.sortOrder"
              :min="1"
              :step="1"
              size="sm"
              class="w-full"
            />
          </template>

          <!-- 色板：git-color.png 上排 6 色（黑红绿蓝橙紫）；选中态加圈 -->
          <template #color-cell="{ row }">
            <div class="flex flex-wrap items-center gap-1">
              <button
                v-for="color in REPO_COLORS"
                :key="color"
                type="button"
                class="h-4.5 w-4.5 rounded-full border border-default transition-transform hover:scale-110"
                :class="row.original.color === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-elevated' : ''"
                :style="{ backgroundColor: color }"
                :aria-label="`颜色 ${color}`"
                @click="row.original.color = color"
              />
            </div>
          </template>

          <template #refresh-cell="{ row }">
            <USelect
              v-model="row.original.refreshIntervalMs"
              :items="intervalOptions"
              value-key="value"
              size="sm"
              class="w-full"
            />
          </template>

          <template #issues-cell="{ row }">
            <span class="text-xs" :class="countOf(row.original) > 0 ? 'text-highlighted' : 'text-dimmed'">
              {{ countOf(row.original) }}
            </span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center gap-1">
              <UTooltip v-if="row.original.repoId !== null" text="初始查询：整仓对账拉取全部 Issue">
                <UButton
                  icon="i-lucide-cloud-download"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  :loading="row.original.syncing"
                  :disabled="row.original.syncing"
                  @click="syncInitial(row.original)"
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
                @click="removeRow(row.original)"
              />
            </div>
          </template>
        </UTable>

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
