import tooltip from '#build/ui/tooltip'

/**
 * 全站 tooltip 固定深色气泡。
 * Nuxt UI 的 tooltip 主题默认 bg-default text-highlighted ring-default，
 * 浅色主题下是白底，贴在看板上对比不足；这里在 theme 层做整串覆盖，
 * 组件的 :ui.content 仍在其后合并（tailwind-variants 用 twMerge），
 * 所以 IssueCard 里 h-auto / max-w-[…] 依旧能覆盖主题的 h-6。
 */
export default defineAppConfig({
  ui: {
    tooltip: {
      slots: {
        ...tooltip.slots,
        content: tooltip.slots.content
          .replace('bg-default', 'bg-neutral-900')
          .replace('text-highlighted', 'text-white')
          .replace('ring-default', 'ring-white/10'),
        arrow: tooltip.slots.arrow
          .replace('fill-bg', 'fill-neutral-900')
          .replace('stroke-default', 'stroke-neutral-900'),
      },
    },
  },
})
