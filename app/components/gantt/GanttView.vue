<script setup lang="ts">
import type { BoardIssue, BoardRepo } from '#shared/utils/board'
import {
  GANTT_NAME_DEFAULT,
  GANTT_WORK_BANDS,
  addLocalDays,
  buildGanttTree,
  clampNameWidth,
  defaultGanttWindowStart,
  formatGanttCursor,
  ganttDays,
  ganttMarks,
  ratioToTime,
  startOfLocalDay,
  timeToRatio,
  windowIncludesToday,
  type GanttIssueNode,
  type GanttMark,
} from '#shared/utils/gantt'
import { PHASE_COLORS, type PhaseKind } from '#shared/utils/phases'

const props = defineProps<{
  repos: BoardRepo[]
  issues: BoardIssue[]
  now: number
}>()

const PHASE_LABEL: Record<PhaseKind, string> = {
  story: '需求',
  dev: '开发',
  review: '检视',
  idle: '空闲',
}

const legend: { kind: PhaseKind, label: string }[] = [
  { kind: 'story', label: '需求' },
  { kind: 'dev', label: '开发' },
  { kind: 'review', label: '检视' },
  { kind: 'idle', label: '空闲' },
]

const windowStart = ref(defaultGanttWindowStart(props.now))
const nameWidth = ref(GANTT_NAME_DEFAULT)
const hoverOn = ref(true)
const hoverRatio = ref<number | null>(null)
const resizing = ref(false)
const collapsed = ref(new Set<string>())
const scrollerRef = ref<HTMLElement | null>(null)

const days = computed(() => ganttDays(windowStart.value))
const rangeLabel = computed(() => {
  const first = days.value[0]
  const last = days.value[days.value.length - 1]
  return first && last ? `${first.label} – ${last.label}` : ''
})
const gridStyle = computed(() => ({
  gridTemplateColumns: `${nameWidth.value}px minmax(0, 1fr)`,
}))
const tree = computed(() => buildGanttTree(props.repos, props.issues, windowStart.value, props.now))
const showNowLine = computed(() => windowIncludesToday(windowStart.value, props.now))
const nowRatio = computed(() => showNowLine.value ? timeToRatio(props.now, windowStart.value) : null)
const hoverLabel = computed(() =>
  hoverRatio.value == null ? '' : formatGanttCursor(ratioToTime(hoverRatio.value, windowStart.value)),
)

interface GanttRow {
  key: string
  kind: 'repo' | 'issue'
  depth: number
  hasChildren: boolean
  href: string
  color?: string
  number?: number
  title: string
  count?: number
  bars: GanttMark[]
}

const rows = computed(() => {
  const closed = collapsed.value
  const out: GanttRow[] = []

  function walk(nodes: GanttIssueNode[], repo: BoardRepo, depth: number) {
    for (const node of nodes) {
      const key = issueKey(node.issue)
      const hasChildren = node.children.length > 0
      out.push({
        key,
        kind: 'issue',
        depth,
        hasChildren,
        href: issueHref(repo, node.issue.number),
        number: node.issue.number,
        title: node.issue.title,
        bars: ganttMarks(node.issue.timeline, windowStart.value, props.now),
      })
      if (hasChildren && !closed.has(key)) walk(node.children, repo, depth + 1)
    }
  }

  for (const node of tree.value) {
    const key = `repo:${node.repo.id}`
    out.push({
      key,
      kind: 'repo',
      depth: 0,
      hasChildren: true,
      href: `https://github.com/${node.repo.owner}/${node.repo.name}/issues`,
      color: node.repo.color,
      title: node.repo.fullName,
      count: countIssues(node.issues),
      bars: [],
    })
    if (!closed.has(key)) walk(node.issues, node.repo, 1)
  }
  return out
})

function issueKey(issue: BoardIssue): string {
  return `issue:${issue.repoId}-${issue.number}`
}

function issueHref(repo: BoardRepo, number: number): string {
  return `https://github.com/${repo.owner}/${repo.name}/issues/${number}`
}

function countIssues(nodes: readonly GanttIssueNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countIssues(node.children), 0)
}

function shift(days: number) {
  windowStart.value = addLocalDays(windowStart.value, days)
}

function toggle(key: string) {
  const next = new Set(collapsed.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsed.value = next
}

function isCollapsed(key: string): boolean {
  return collapsed.value.has(key)
}

function dayIsToday(start: number): boolean {
  return start === startOfLocalDay(props.now)
}

function lineLeft(ratio: number): string {
  return `calc(${nameWidth.value}px + (100% - ${nameWidth.value}px) * ${ratio})`
}

function hoverLabelStyle(): Record<string, string> | null {
  const ratio = hoverRatio.value
  if (ratio == null) return null
  const translate = ratio < 0.08 ? '0' : ratio > 0.92 ? '-100%' : '-50%'
  return { left: `${ratio * 100}%`, transform: `translateX(${translate})` }
}

function markStyle(mark: GanttMark): Record<string, string> {
  const backgroundColor = PHASE_COLORS[mark.kind]
  if (mark.kind === 'story') {
    return { left: `${mark.startRatio * 100}%`, backgroundColor }
  }
  return {
    left: `${mark.startRatio * 100}%`,
    width: `${(mark.endRatio - mark.startRatio) * 100}%`,
    minWidth: '1px',
    backgroundColor,
  }
}

function markTitle(mark: GanttMark): string {
  const label = PHASE_LABEL[mark.kind]
  if (mark.kind === 'story') return `${label} ${formatGanttCursor(mark.start)}`
  return `${label} ${formatGanttCursor(mark.start)} – ${formatGanttCursor(mark.end)}`
}

function onScrollerMove(event: MouseEvent) {
  const scroller = scrollerRef.value
  if (!scroller || !hoverOn.value) {
    hoverRatio.value = null
    return
  }
  const rect = scroller.getBoundingClientRect()
  const x = event.clientX - rect.left - nameWidth.value
  const track = scroller.clientWidth - nameWidth.value
  if (track <= 0 || x < 0 || x > track) {
    hoverRatio.value = null
    return
  }
  hoverRatio.value = x / track
}

function onScrollerLeave() {
  hoverRatio.value = null
}

function onResizePointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  resizing.value = true
  const originX = event.clientX
  const originW = nameWidth.value
  const move = (ev: PointerEvent) => {
    nameWidth.value = clampNameWidth(originW + ev.clientX - originX)
  }
  const up = (ev: PointerEvent) => {
    resizing.value = false
    if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId)
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', up)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', up)
}

watch(hoverOn, (on) => {
  if (!on) hoverRatio.value = null
})
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col"
    data-view="gantt"
    :class="resizing ? 'select-none' : ''"
  >
    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-default px-3 py-2">
      <div class="flex items-center rounded-md bg-elevated p-0.5">
        <UButton
          icon="i-lucide-chevrons-left"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="前移 5 天"
          @click="shift(-5)"
        />
        <UButton
          icon="i-lucide-chevron-left"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="前移 1 天"
          @click="shift(-1)"
        />
        <span class="min-w-28 px-2 text-center text-xs font-medium tabular-nums text-highlighted">{{ rangeLabel }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="后移 1 天"
          @click="shift(1)"
        />
        <UButton
          icon="i-lucide-chevrons-right"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="后移 5 天"
          @click="shift(5)"
        />
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2.5 text-[11px] text-muted">
          <span v-for="item in legend" :key="item.kind" class="inline-flex items-center gap-1">
            <span
              class="inline-block rounded-[1px]"
              :class="item.kind === 'story' ? 'h-3 w-0.5' : 'h-2.5 w-2.5'"
              :style="{ backgroundColor: PHASE_COLORS[item.kind] }"
            />
            {{ item.label }}
          </span>
        </div>
        <UButton
          size="sm"
          icon="i-lucide-mouse-pointer-2"
          :color="hoverOn ? 'primary' : 'neutral'"
          :variant="hoverOn ? 'soft' : 'ghost'"
          :aria-pressed="hoverOn"
          @click="hoverOn = !hoverOn"
        >
          鼠标时间线
        </UButton>
      </div>
    </div>

    <div
      ref="scrollerRef"
      class="relative min-h-0 flex-1 overflow-auto"
      @mousemove="onScrollerMove"
      @mouseleave="onScrollerLeave"
    >
      <div class="relative min-h-full">
        <div
          class="sticky top-0 z-30 grid border-b border-default bg-[color-mix(in_srgb,var(--ui-bg-inverted)_8%,var(--ui-bg))]"
          :style="gridStyle"
        >
          <div class="flex items-center border-r border-default px-3 text-[11px] font-medium text-dimmed">
            任务
          </div>
          <div class="relative min-w-0">
            <div class="grid h-11 grid-cols-5">
              <div
                v-for="day in days"
                :key="day.start"
                class="relative flex flex-col items-center justify-center border-l border-muted"
                :data-day="day.label"
                :data-today="dayIsToday(day.start) ? 'true' : undefined"
              >
                <span
                  class="text-[11px] font-medium tabular-nums"
                  :class="dayIsToday(day.start) ? 'text-primary' : 'text-highlighted'"
                >{{ day.label }}</span>
                <span class="text-[10px] text-dimmed">{{ day.weekday }}</span>
              </div>
            </div>
            <div
              v-if="nowRatio != null"
              class="pointer-events-none absolute inset-y-0 z-10 w-px bg-error"
              :style="{ left: `${nowRatio * 100}%` }"
            />
            <div
              v-if="hoverRatio != null"
              class="pointer-events-none absolute inset-y-0 z-10 w-px bg-inverted/70"
              :style="{ left: `${hoverRatio * 100}%` }"
            />
            <div
              v-if="hoverRatio != null"
              class="pointer-events-none absolute top-0.5 z-10"
              :style="hoverLabelStyle() ?? undefined"
            >
              <span class="inline-block rounded bg-inverted px-1.5 py-0.5 text-[10px] leading-4 text-inverted tabular-nums">
                {{ hoverLabel }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="rows.length === 0" class="px-3 py-16 text-center text-xs text-dimmed">
          这五天没有工单
        </div>

        <div v-else role="tree">
          <div
            v-for="row in rows"
            :key="row.key"
            class="grid border-b border-muted"
            :class="row.kind === 'repo' ? 'bg-elevated/40' : 'hover:bg-elevated/50'"
            :style="gridStyle"
            role="treeitem"
            :aria-level="row.depth + 1"
            :aria-expanded="row.hasChildren ? !isCollapsed(row.key) : undefined"
            :data-row="row.kind"
            :data-key="row.key"
          >
            <div
              class="flex min-w-0 items-center gap-1 border-r border-default py-1 pr-2"
              :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
            >
              <button
                v-if="row.hasChildren"
                type="button"
                class="grid h-4 w-4 shrink-0 place-items-center rounded text-dimmed hover:bg-elevated hover:text-highlighted"
                :aria-label="isCollapsed(row.key) ? '展开' : '折叠'"
                @click="toggle(row.key)"
              >
                <UIcon
                  name="i-lucide-chevron-right"
                  class="h-3.5 w-3.5 transition-transform"
                  :class="isCollapsed(row.key) ? '' : 'rotate-90'"
                />
              </button>
              <span v-else class="h-4 w-4 shrink-0" />

              <template v-if="row.kind === 'repo'">
                <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: row.color }" />
                <a
                  :href="row.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="min-w-0 truncate text-[13px] font-semibold text-highlighted underline-offset-2 hover:text-primary hover:underline"
                  :title="row.title"
                >{{ row.title }}</a>
                <span class="ml-auto shrink-0 rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-dimmed">{{ row.count }}</span>
              </template>
              <a
                v-else
                :href="row.href"
                target="_blank"
                rel="noopener noreferrer"
                class="flex min-w-0 flex-1 items-baseline gap-1.5 underline-offset-2 hover:underline"
                :title="`#${row.number} ${row.title}`"
              >
                <span class="shrink-0 font-mono text-xs font-semibold text-primary">#{{ row.number }}</span>
                <span class="truncate text-xs text-highlighted">{{ row.title }}</span>
              </a>
            </div>

            <div class="relative min-w-0 overflow-hidden">
              <div class="grid h-full grid-cols-5">
                <div
                  v-for="day in days"
                  :key="day.start"
                  class="relative min-h-9 border-l border-muted"
                >
                  <div
                    v-for="band in GANTT_WORK_BANDS"
                    :key="band.start"
                    class="absolute inset-y-0 bg-inverted/5"
                    :style="{ left: `${band.start * 100}%`, width: `${(band.end - band.start) * 100}%` }"
                  />
                </div>
              </div>
              <div
                v-for="(mark, index) in row.bars"
                :key="`${row.key}-${index}`"
                class="absolute top-1/2 -translate-y-1/2"
                :class="mark.kind === 'story' ? 'z-[1] h-4 w-0.5' : 'z-0 h-3.5'"
                :style="markStyle(mark)"
                :title="markTitle(mark)"
              />
            </div>
          </div>
        </div>

        <div
          v-if="nowRatio != null"
          class="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-error"
          :style="{ left: lineLeft(nowRatio) }"
        />
        <div
          v-if="hoverRatio != null"
          class="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-inverted/70"
          :style="{ left: lineLeft(hoverRatio) }"
        />

        <div
          class="absolute bottom-0 top-0 z-40 w-1.5 -translate-x-1/2 cursor-col-resize touch-none"
          :style="{ left: `${nameWidth}px` }"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整任务名列宽度"
          :aria-valuemin="160"
          :aria-valuemax="480"
          :aria-valuenow="nameWidth"
          @pointerdown.prevent="onResizePointerDown"
        />
      </div>
    </div>
  </div>
</template>
