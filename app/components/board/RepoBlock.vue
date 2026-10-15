<script setup lang="ts">
import type { BoardIssue, BoardRepo } from '#shared/utils/board'

const props = defineProps<{
  repo: BoardRepo
  issues: BoardIssue[]
  now: number
}>()

// 块内任务 High 在前，再按 GitHub updatedAt 倒序
const sorted = computed(() => [...props.issues].sort((a, b) => {
  if (a.importance !== b.importance) return a.importance === 'high' ? -1 : 1
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}))

// 仓库色只从色板 11 色里来，直接拼 style（避免 Tailwind 动态类被清除）
const blockStyle = computed(() => ({
  borderColor: props.repo.color,
  backgroundColor: `${props.repo.color}1a`,
}))
</script>

<template>
  <div
    class="rounded-lg border-2 p-2"
    :style="blockStyle"
    :data-repo="repo.id"
  >
    <div class="mb-1.5 flex items-center gap-1.5 px-0.5">
      <UIcon name="i-lucide-git-branch" class="h-3.5 w-3.5" :style="{ color: repo.color }" />
      <span class="truncate text-[13px] font-semibold text-highlighted">{{ repo.fullName }}</span>
      <span class="ml-auto rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-dimmed">{{ sorted.length }}</span>
    </div>
    <div class="space-y-1.5">
      <IssueCard
        v-for="issue in sorted"
        :key="`${issue.repoId}-${issue.number}`"
        :issue="issue"
        :repo="repo"
        :now="now"
      />
    </div>
  </div>
</template>
