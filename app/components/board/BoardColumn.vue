<script setup lang="ts">
import { BOARD_COLUMNS, BOARD_COLUMN_LABELS, type BoardColumn, type BoardIssue, type BoardRepo } from '#shared/utils/board'

const props = defineProps<{
  column: BoardColumn
  repos: BoardRepo[]
  issues: BoardIssue[]
  now: number
}>()

const columnIssues = computed(() => props.issues.filter(i => i.column === props.column))

// 某列下没有任务的仓库块不渲染
const blocks = computed(() => props.repos
  .map(repo => ({ repo, issues: columnIssues.value.filter(i => i.repoId === repo.id) }))
  .filter(b => b.issues.length > 0))
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col rounded-lg bg-elevated/50 p-2" :data-column="column">
    <div class="mb-2 flex items-center gap-2 px-1">
      <h2 class="text-sm font-semibold text-highlighted">{{ BOARD_COLUMN_LABELS[column] }}</h2>
      <span class="rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-dimmed">{{ columnIssues.length }}</span>
    </div>
    <div class="board-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
      <RepoBlock
        v-for="block in blocks"
        :key="block.repo.id"
        :repo="block.repo"
        :issues="block.issues"
        :now="now"
      />
      <p v-if="blocks.length === 0" class="px-1 py-6 text-center text-[11px] text-dimmed">
        暂无任务
      </p>
    </div>
  </div>
</template>
