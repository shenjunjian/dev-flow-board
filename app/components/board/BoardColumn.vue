<script setup lang="ts">
import { BOARD_COLUMN_LABELS, type BoardColumn, type BoardIssue, type BoardRepo } from '#shared/utils/board'
import { isDoneIssueVisible } from '#shared/utils/columns'

const props = defineProps<{
  column: BoardColumn
  repos: BoardRepo[]
  issues: BoardIssue[]
  now: number
}>()

// 完成列只展示近 2 天。甘特图和研发分析不走这里，读的是未裁剪的全表。
const columnIssues = computed(() => props.issues.filter((issue) => {
  if (issue.column !== props.column) return false
  if (props.column === 'done') return isDoneIssueVisible(issue.closedAt, props.now)
  return true
}))

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
