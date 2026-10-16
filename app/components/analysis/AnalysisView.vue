<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { CalendarDate, type DateValue } from '@internationalized/date'
import type { BoardIssue, BoardRepo, TaskType } from '#shared/utils/board'
import {
  analysisRangeFromDays,
  buildAnalysisRows,
  defaultAnalysisRange,
  filterAnalysisIssues,
  formatHours,
  groupByAssignee,
  matchesAssigneeFilter,
  matchesTaskFilter,
  sumDurationHours,
  type AnalysisAssigneeFilter,
  type AnalysisRow,
  type AnalysisTaskFilter,
} from '#shared/utils/analysis'
import { PHASE_COLORS } from '#shared/utils/phases'
import type { AnalysisChart } from './load-echarts'

const props = defineProps<{
  repos: BoardRepo[]
  issues: BoardIssue[]
}>()

const UCheckbox = resolveComponent('UCheckbox')

const TASK_BADGE: Record<TaskType, { color: 'info' | 'error' | 'warning', label: string }> = {
  feature: { color: 'info', label: 'feature' },
  bug: { color: 'error', label: 'bug' },
  refactor: { color: 'warning', label: 'refactor' },
}

const taskOptions: { label: string, value: AnalysisTaskFilter }[] = [
  { label: '全部类型', value: 'all' },
  { label: 'feature', value: 'feature' },
  { label: 'bug', value: 'bug' },
  { label: 'refactor', value: 'refactor' },
  { label: '未分类', value: 'untyped' },
]

const SLICES = [
  { key: 'idleHours', name: '空闲', color: PHASE_COLORS.idle },
  { key: 'devHours', name: '开发', color: PHASE_COLORS.dev },
  { key: 'reviewHours', name: '检视', color: PHASE_COLORS.review },
] as const

const initialRange = defaultAnalysisRange(Date.now())
const dateRange = shallowRef<{ start: DateValue, end: DateValue }>({
  start: toCalendarDate(initialRange.start),
  end: toCalendarDate(initialRange.end - 1),
})
const repoId = ref('all')
const taskFilter = ref<AnalysisTaskFilter>('all')
const assigneeFilter = ref<AnalysisAssigneeFilter>('all')
const barDimension = ref<'issue' | 'assignee'>('issue')
const applied = ref<{ start: number, end: number, repoId: number | null } | null>(null)
const rowSelection = ref<Record<string, boolean>>({})
const chartError = ref('')

const repoOptions = computed(() => [
  { label: '全部仓库', value: 'all' },
  ...[...props.repos]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map(repo => ({ label: repo.fullName, value: String(repo.id) })),
])

const canQuery = computed(() => Boolean(dateRange.value.start && dateRange.value.end))

const queriedIssues = computed(() => {
  const query = applied.value
  if (!query) return []
  return filterAnalysisIssues(props.issues, query.start, query.end, query.repoId)
})

const assigneeOptions = computed(() => {
  const names = new Set<string>()
  let unassigned = false
  for (const issue of queriedIssues.value) {
    if (issue.assignee) names.add(issue.assignee)
    else unassigned = true
  }
  return [
    { label: '全部责任人', value: 'all' },
    ...[...names].sort((a, b) => a.localeCompare(b)).map(name => ({ label: name, value: name })),
    ...(unassigned ? [{ label: '未指派', value: 'none' }] : []),
  ]
})

const displayedRows = computed(() => {
  const matched = queriedIssues.value.filter(issue =>
    matchesTaskFilter(issue.taskType, taskFilter.value)
    && matchesAssigneeFilter(issue.assignee, assigneeFilter.value),
  )
  return buildAnalysisRows(matched, props.repos, Date.now())
})

const selectedRows = computed(() => displayedRows.value.filter(row => rowSelection.value[row.id]))

const appliedLabel = computed(() => {
  const query = applied.value
  if (!query) return ''
  const repo = query.repoId == null
    ? '全部仓库'
    : props.repos.find(item => item.id === query.repoId)?.fullName ?? '仓库'
  return `${formatDay(query.start)} – ${formatDay(query.end - 1)} · ${repo}`
})

const barBuckets = computed(() => {
  const rows = selectedRows.value
  if (barDimension.value === 'assignee') return groupByAssignee(rows)
  const multipleRepos = new Set(rows.map(row => row.repoId)).size > 1
  return rows.map(row => ({
    label: barLabel(row, multipleRepos),
    devHours: row.devHours,
    reviewHours: row.reviewHours,
    idleHours: row.idleHours,
  }))
})

const barChartWidth = computed(() => {
  const count = barBuckets.value.length
  return count > 8 ? `${count * 72}px` : '100%'
})

const columns: TableColumn<AnalysisRow>[] = [
  {
    id: 'select',
    enableSorting: false,
    header: ({ table }) => h(UCheckbox, {
      'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
      'aria-label': '全选',
      'size': 'sm',
    }),
    cell: ({ row }) => h(UCheckbox, {
      'modelValue': row.getIsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
      'aria-label': `选择 #${row.original.number}`,
      'size': 'sm',
    }),
    meta: { class: { th: 'w-10', td: 'w-10' } },
  },
  {
    accessorKey: 'repoName',
    header: '仓库',
    meta: { class: { td: 'max-w-48 truncate' } },
  },
  { accessorKey: 'number', header: '编号' },
  {
    accessorKey: 'title',
    header: '标题',
    meta: { class: { td: 'max-w-md truncate' } },
  },
  {
    accessorKey: 'assignee',
    header: '责任人',
    meta: { class: { td: 'max-w-32 truncate' } },
  },
  { accessorKey: 'importance', header: '重要性' },
  { accessorKey: 'taskType', header: '任务类型' },
  hourColumn('devHours', '开发时长'),
  hourColumn('reviewHours', '检视时长'),
  hourColumn('idleHours', '空闲时长'),
]

const pieEl = ref<HTMLElement | null>(null)
const barEl = ref<HTMLElement | null>(null)
let alive = true
let chartModule: typeof import('./load-echarts') | null = null
let pieChart: AnalysisChart | null = null
let barChart: AnalysisChart | null = null
let pieHost: HTMLElement | null = null
let barHost: HTMLElement | null = null
let resizeObserver: ResizeObserver | null = null

function hourColumn(key: 'devHours' | 'reviewHours' | 'idleHours', header: string): TableColumn<AnalysisRow> {
  return {
    accessorKey: key,
    header,
    cell: ({ row }) => formatHours(row.original[key]),
    meta: { class: { th: 'text-end', td: 'text-end tabular-nums' } },
  }
}

function toCalendarDate(ms: number): CalendarDate {
  const date = new Date(ms)
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function formatDay(ms: number): string {
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function selectedRepoId(): number | null {
  if (repoId.value === 'all') return null
  const id = Number(repoId.value)
  return Number.isInteger(id) ? id : null
}

function readRange(): { start: number, end: number } | null {
  const { start, end } = dateRange.value
  if (!start || !end) return null
  return analysisRangeFromDays(
    new Date(start.year, start.month - 1, start.day).getTime(),
    new Date(end.year, end.month - 1, end.day).getTime(),
  )
}

function runQuery() {
  const range = readRange()
  if (!range) return
  applied.value = { ...range, repoId: selectedRepoId() }
  const next: Record<string, boolean> = {}
  for (const row of displayedRows.value) next[row.id] = true
  rowSelection.value = next
}

function rowKey(row: AnalysisRow): string {
  return row.id
}

function cssColor(variable: string, fallback: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${variable})`
  document.body.appendChild(probe)
  try {
    const color = getComputedStyle(probe).color
    return color && color !== 'rgba(0, 0, 0, 0)' ? color : fallback
  }
  finally {
    probe.remove()
  }
}

function bindChart(current: AnalysisChart | null, host: HTMLElement | null, el: HTMLElement): AnalysisChart {
  if (!chartModule) throw new Error('图表尚未加载')
  if (current && !current.isDisposed() && current.getDom() === el) {
    current.resize()
    return current
  }
  if (host) resizeObserver?.unobserve(host)
  current?.dispose()
  resizeObserver?.observe(el)
  return chartModule.createAnalysisChart(el)
}

function disposeCharts() {
  if (pieHost) resizeObserver?.unobserve(pieHost)
  if (barHost) resizeObserver?.unobserve(barHost)
  pieChart?.dispose()
  barChart?.dispose()
  pieChart = null
  barChart = null
  pieHost = null
  barHost = null
}

function paint() {
  if (!chartModule || !alive) return
  const rows = selectedRows.value
  const pieHostEl = pieEl.value
  const barHostEl = barEl.value
  if (rows.length === 0 || !pieHostEl || !barHostEl) {
    disposeCharts()
    return
  }

  const text = cssColor('--ui-text-muted', 'rgb(134, 142, 150)')
  const line = cssColor('--ui-border', 'rgb(222, 226, 230)')
  const total = sumDurationHours(rows)
  const buckets = barBuckets.value
  pieChart = bindChart(pieChart, pieHost, pieHostEl)
  pieHost = pieHostEl
  barChart = bindChart(barChart, barHost, barHostEl)
  barHost = barHostEl

  pieChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = params as { name?: string, value?: number }
        return `${item.name ?? ''}：${formatHours(Number(item.value))} 小时`
      },
    },
    legend: { bottom: 0, textStyle: { color: text } },
    series: [{
      type: 'pie',
      radius: ['46%', '70%'],
      center: ['50%', '44%'],
      stillShowZeroSum: true,
      label: { show: false },
      data: SLICES.map(slice => ({
        name: slice.name,
        value: total[slice.key],
        itemStyle: { color: slice.color },
      })),
    }],
  }, { notMerge: true })

  barChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{
          seriesName?: string
          value?: number
          name?: string
          marker?: string
        }>
        const title = list[0]?.name ?? ''
        const lines = list.map(item => `${item.marker ?? ''}${item.seriesName ?? ''}：${formatHours(Number(item.value))} 小时`)
        return [title, ...lines].join('<br/>')
      },
    },
    legend: { top: 0, textStyle: { color: text } },
    grid: { left: 48, right: 12, top: 32, bottom: buckets.length > 6 ? 72 : 40 },
    xAxis: {
      type: 'category',
      data: buckets.map(bucket => bucket.label),
      axisLabel: {
        color: text,
        interval: 0,
        rotate: buckets.length > 6 ? 40 : 0,
        hideOverlap: true,
      },
      axisLine: { lineStyle: { color: line } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      name: '小时',
      nameTextStyle: { color: text },
      axisLabel: { color: text },
      splitLine: { lineStyle: { color: line } },
    },
    series: SLICES.map(slice => ({
      name: slice.name,
      type: 'bar',
      stack: 'hours',
      barMaxWidth: 28,
      itemStyle: { color: slice.color },
      data: buckets.map(bucket => bucket[slice.key]),
    })),
  }, { notMerge: true })
}

function barLabel(row: AnalysisRow, multipleRepos: boolean): string {
  if (!multipleRepos) return `#${row.number}`
  const short = row.repoName.includes('/') ? row.repoName.slice(row.repoName.lastIndexOf('/') + 1) : row.repoName
  return `${short} #${row.number}`
}

watch(assigneeOptions, (options) => {
  if (!options.some(item => item.value === assigneeFilter.value)) assigneeFilter.value = 'all'
})

watch([selectedRows, barDimension], () => paint(), { flush: 'post' })

runQuery()

onMounted(async () => {
  resizeObserver = new ResizeObserver(() => {
    pieChart?.resize()
    barChart?.resize()
  })
  try {
    chartModule = await import('./load-echarts')
    if (!alive) return
    await nextTick()
    paint()
  }
  catch {
    chartError.value = '图表加载失败'
  }
})

onBeforeUnmount(() => {
  alive = false
  resizeObserver?.disconnect()
  pieChart?.dispose()
  barChart?.dispose()
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col" data-view="analysis">
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-3 py-2">
      <UInputDate v-model="dateRange" range size="sm" />
      <USelect
        v-model="repoId"
        :items="repoOptions"
        value-key="value"
        size="sm"
        class="w-56"
        aria-label="仓库"
      />
      <UButton size="sm" :disabled="!canQuery" @click="runQuery">
        查询
      </UButton>
      <p class="text-xs text-dimmed">
        {{ appliedLabel }}
        <span v-if="applied"> · 已选 {{ selectedRows.length }} / {{ displayedRows.length }}</span>
        <span> · 时长单位：小时</span>
      </p>
      <USelect
        v-model="assigneeFilter"
        :items="assigneeOptions"
        value-key="value"
        size="sm"
        class="ml-auto w-36"
        aria-label="责任人"
      />
      <USelect
        v-model="taskFilter"
        :items="taskOptions"
        value-key="value"
        size="sm"
        class="w-36"
        aria-label="任务类型"
      />
    </div>

    <div class="min-h-0 flex-1 basis-0 overflow-hidden px-3 pt-2">
      <UTable
        v-model:row-selection="rowSelection"
        :data="displayedRows"
        :columns="columns"
        :get-row-id="rowKey"
        sticky
        class="h-full"
        :ui="{ root: 'h-full', td: 'px-2 py-2.5', th: 'whitespace-nowrap px-2 py-2' }"
        empty="没有创建和合入都落在这段日期里的工单"
      >
        <template #number-cell="{ row }">
          <a
            v-if="row.original.href"
            :href="row.original.href"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-sm font-semibold text-primary hover:underline"
          >#{{ row.original.number }}</a>
          <span v-else class="font-mono text-sm font-semibold text-primary">#{{ row.original.number }}</span>
        </template>

        <template #title-cell="{ row }">
          <a
            v-if="row.original.href"
            :href="row.original.href"
            target="_blank"
            rel="noopener noreferrer"
            class="block truncate text-highlighted hover:text-primary hover:underline"
            :title="row.original.title"
          >{{ row.original.title }}</a>
          <span v-else class="block truncate" :title="row.original.title">{{ row.original.title }}</span>
        </template>

        <template #assignee-cell="{ row }">
          <span v-if="row.original.assignee">{{ row.original.assignee }}</span>
          <span v-else class="text-dimmed">未指派</span>
        </template>

        <template #importance-cell="{ row }">
          <UBadge
            :color="row.original.importance === 'high' ? 'error' : 'neutral'"
            :variant="row.original.importance === 'high' ? 'solid' : 'subtle'"
            size="sm"
          >
            {{ row.original.importance === 'high' ? 'High' : 'Low' }}
          </UBadge>
        </template>

        <template #taskType-cell="{ row }">
          <UBadge
            v-if="row.original.taskType"
            :color="TASK_BADGE[row.original.taskType].color"
            variant="subtle"
            size="sm"
          >
            {{ TASK_BADGE[row.original.taskType].label }}
          </UBadge>
          <span v-else class="text-dimmed">未分类</span>
        </template>
      </UTable>
    </div>

    <section class="grid h-72 shrink-0 grid-cols-1 gap-2 overflow-y-auto border-t border-default px-3 py-2 md:grid-cols-2 md:overflow-hidden">
      <p v-if="chartError" class="flex items-center justify-center text-sm text-dimmed md:col-span-2">
        {{ chartError }}
      </p>
      <div
        v-else-if="selectedRows.length === 0"
        class="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-default text-sm text-dimmed md:col-span-2"
      >
        勾选工单后显示空闲、开发和检视
      </div>
      <template v-else>
        <div class="flex h-56 min-w-0 flex-col md:h-full">
          <p class="shrink-0 text-xs font-medium text-muted">
            时长合计
          </p>
          <div ref="pieEl" class="min-h-0 w-full flex-1" />
        </div>
        <div class="flex h-56 min-w-0 flex-col md:h-full">
          <div class="flex shrink-0 items-center justify-between gap-2">
            <p class="text-xs font-medium text-muted">
              {{ barDimension === 'assignee' ? '各责任人时长' : '各工单时长' }}
            </p>
            <div class="flex items-center gap-0.5 rounded-md bg-elevated p-0.5" role="group" aria-label="柱状图维度">
              <UButton
                size="xs"
                :color="barDimension === 'issue' ? 'primary' : 'neutral'"
                :variant="barDimension === 'issue' ? 'solid' : 'ghost'"
                @click="barDimension = 'issue'"
              >
                工单
              </UButton>
              <UButton
                size="xs"
                :color="barDimension === 'assignee' ? 'primary' : 'neutral'"
                :variant="barDimension === 'assignee' ? 'solid' : 'ghost'"
                @click="barDimension = 'assignee'"
              >
                责任人
              </UButton>
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-x-auto">
            <div ref="barEl" class="h-full" :style="{ width: barChartWidth }" />
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
