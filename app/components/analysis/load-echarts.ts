import { init, use } from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  PieChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

export type AnalysisChart = ReturnType<typeof init>

export function createAnalysisChart(el: HTMLElement): AnalysisChart {
  return init(el, undefined, { renderer: 'canvas' })
}
