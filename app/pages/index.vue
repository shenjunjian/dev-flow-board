<script setup lang="ts">
import { BOARD_COLUMNS, type BoardIssue } from '#shared/utils/board'

const {
  repos,
  repoFilter,
  importanceFilter,
  filteredIssues,
  loading,
  refreshing,
  now,
  load,
  refresh,
  applyPatch,
} = useBoard()

const managerOpen = ref(false)

// -- 筛选选项 --
const repoOptions = computed(() => repos.value.map(r => ({
  label: r.fullName,
  value: r.id,
})))

const importanceOptions = [
  { label: '全部重要性', value: 'all' },
  { label: 'High', value: 'high' },
  { label: 'Low', value: 'low' },
]

// -- SSE：页面打开后连上，断开重连 --
let source: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function connectStream() {
  source?.close()
  source = new EventSource('/api/board/stream')
  source.onmessage = (ev) => {
    try {
      handlePatch(JSON.parse(ev.data))
    }
    catch {
      // 忽略坏帧
    }
  }
  source.onerror = () => {
    // EventSource 会自动重连；兜底：连接彻底关闭时定时重建
    if (source && source.readyState === EventSource.CLOSED) {
      scheduleReconnect()
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectStream()
  }, 5000)
}

// -- FLIP：应用补丁前记下每张卡片的位置 --
function snapshotCardRects(): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>()
  for (const el of document.querySelectorAll<HTMLElement>('[data-card]')) {
    const key = el.dataset.card
    if (key) rects.set(key, el.getBoundingClientRect())
  }
  return rects
}

/** 列变了且旧位置还在的卡片才飞 */
function flipMovedCards(before: Map<string, DOMRect>, movedKeys: Set<string>) {
  for (const key of movedKeys) {
    const el = document.querySelector<HTMLElement>(`[data-card="${CSS.escape(key)}"]`)
    const oldRect = before.get(key)
    if (!el || !oldRect) continue
    const newRect = el.getBoundingClientRect()
    const dx = oldRect.left - newRect.left
    const dy = oldRect.top - newRect.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
    el.style.transition = 'none'
    el.style.transform = `translate(${dx}px, ${dy}px)`
    void el.offsetWidth // 强制 reflow
    el.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)'
    el.style.transform = ''
    el.addEventListener('transitionend', () => {
      el.style.transition = ''
    }, { once: true })
  }
}

function handlePatch(patch: { upserts: BoardIssue[], deleted: Array<{ repoId: number, number: number }> }) {
  const before = snapshotCardRects()
  // 补丁前本地行的列，用于判断「列变了」
  const oldColumns = new Map(issuesByKey().map(i => [`${i.repoId}-${i.number}`, i.column]))

  applyPatch(patch)

  const movedKeys = new Set<string>()
  for (const up of patch.upserts) {
    const key = `${up.repoId}-${up.number}`
    if (oldColumns.get(key) !== undefined && oldColumns.get(key) !== up.column) {
      movedKeys.add(key)
    }
  }
  nextTick(() => flipMovedCards(before, movedKeys))
}

function issuesByKey(): BoardIssue[] {
  // filteredIssues 与渲染一致性：飞入判断用原始列表即可
  return filteredIssues.value
}

onMounted(async () => {
  await load()
  connectStream()
})

onBeforeUnmount(() => {
  source?.close()
  source = null
  if (reconnectTimer) clearTimeout(reconnectTimer)
})
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <!-- 顶栏 -->
    <header class="flex shrink-0 items-center gap-3 border-b border-default bg-default px-4 py-2.5">
      <h1 class="text-base font-bold text-highlighted">
        Dev Flow Board
      </h1>

      <div class="ml-2 flex flex-1 items-center gap-2">
        <USelectMenu
          v-model="repoFilter"
          :items="repoOptions"
          value-key="value"
          multiple
          placeholder="全部仓库"
          size="sm"
          class="w-64"
          :ui-menu="{ content: 'max-h-72' }"
        />
        <USelect
          v-model="importanceFilter"
          :items="importanceOptions"
          value-key="value"
          size="sm"
          class="w-36"
        />
      </div>

      <UButton
        icon="i-lucide-settings-2"
        color="neutral"
        variant="soft"
        size="sm"
        @click="managerOpen = true"
      >
        管理仓库
      </UButton>
      <UButton
        icon="i-lucide-refresh-cw"
        color="primary"
        variant="solid"
        size="sm"
        :loading="refreshing"
        :disabled="refreshing"
        @click="refresh"
      >
        刷新
      </UButton>
    </header>

    <!-- 四列看板 -->
    <main class="flex min-h-0 flex-1 gap-2 p-2">
      <div v-if="loading" class="flex flex-1 items-center justify-center">
        <USkeleton class="h-full w-full" />
      </div>
      <template v-else>
        <BoardColumn
          v-for="col in BOARD_COLUMNS"
          :key="col"
          :column="col"
          :repos="repos"
          :issues="filteredIssues"
          :now="now"
        />
      </template>
    </main>

    <!-- 阶段4 实现仓库管理弹窗 -->
    <RepoManagerModal v-model:open="managerOpen" />
  </div>
</template>
