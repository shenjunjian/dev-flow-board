<script setup lang="ts">
import type { BoardIssue, BoardRepo } from '#shared/utils/board'

const props = defineProps<{
  issue: BoardIssue
  repo: BoardRepo
  now: number
}>()

const highlighted = computed(() => {
  if (!props.issue.highlightUntil) return false
  return new Date(props.issue.highlightUntil).getTime() > props.now
})

// 需求列和完成列不画状态图标
const showStatusIcon = computed(() => props.issue.column === 'dev' || props.issue.column === 'review')

const timelineText = computed(() => props.issue.timeline.join('\n'))
</script>

<template>
  <UTooltip :text="timelineText" :content="{ side: 'top', collisionPadding: 12 }">
    <div
      class="group relative cursor-default rounded-md border bg-default px-2.5 py-2 text-xs shadow-xs transition-colors"
      :class="highlighted ? 'border-warning ring-2 ring-warning/40' : 'border-muted'"
      :data-card="`${issue.repoId}-${issue.number}`"
    >
      <div class="flex items-start gap-1.5">
        <span class="shrink-0 font-mono text-[11px] leading-5 text-dimmed">#{{ issue.number }}</span>
        <span class="line-clamp-1 flex-1 font-medium text-highlighted">{{ issue.title }}</span>
        <UBadge
          v-if="issue.importance === 'high'"
          color="error"
          variant="solid"
          size="sm"
          class="shrink-0"
        >
          High
        </UBadge>
      </div>
      <p
        v-if="issue.body"
        class="mt-1 line-clamp-2 whitespace-pre-line text-[11px] leading-4 text-muted"
      >
        {{ issue.body }}
      </p>
      <div class="mt-1.5 flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-1">
          <StatusIcon v-if="showStatusIcon" :status="issue.statusLabel ?? ''" />
          <span
            v-if="issue.statusLabel && showStatusIcon"
            class="truncate text-[10px] text-dimmed"
          >{{ issue.statusLabel }}</span>
        </div>
        <span
          v-if="issue.assignee"
          class="inline-flex max-w-[8rem] shrink-0 items-center gap-1 truncate text-[10px] text-dimmed"
        >
          <UIcon name="i-lucide-user" class="h-3 w-3" />
          <span class="truncate">{{ issue.assignee }}</span>
        </span>
      </div>
    </div>
  </UTooltip>
</template>
