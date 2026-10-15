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

// 时间线逐条渲染进 tooltip 的 #content 插槽：
// text 属性渲染的是带 truncate（white-space:nowrap）的单行 span，\n 不会换行，
// 且 content 主题自带 h-6，多行会被裁掉，所以这里用插槽 + 覆盖 ui.content。
//
// 深色气泡由 app/app.config.ts 在 tooltip 主题层统一配（全站生效，弹窗里的 tooltip 也一起变深），
// 这里只留布局类；主题自带 h-6，靠 twMerge 用 h-auto 顶掉。
</script>

<template>
  <UTooltip
    :disabled="!issue.timeline.length"
    :content="{ side: 'top', align: 'start', collisionPadding: 12 }"
    :ui="{
      content: 'flex-col items-start gap-1.5 h-auto max-w-[min(28rem,calc(100vw-2rem))] px-2.5 py-2',
    }"
  >
    <div
      class="group relative cursor-default rounded-md border bg-default px-2.5 py-2 text-xs shadow-xs transition-colors"
      :class="highlighted ? 'border-warning ring-2 ring-warning/40' : 'border-muted'"
      :data-card="`${issue.repoId}-${issue.number}`"
    >
      <div class="flex items-start gap-2">
        <span class="shrink-0 font-mono text-lg leading-6 font-bold tracking-tight text-primary">#{{ issue.number }}</span>
        <span class="line-clamp-1 flex-1 text-sm leading-6 font-medium text-highlighted">{{ issue.title }}</span>
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
    <template #content>
      <span
        v-for="(line, i) in issue.timeline"
        :key="i"
        class="block w-full whitespace-pre-line break-words text-left leading-4"
      >{{ line }}</span>
    </template>
  </UTooltip>
</template>
