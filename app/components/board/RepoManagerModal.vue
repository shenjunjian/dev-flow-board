<script setup lang="ts">
/**
 * 阶段3 占位：仓库管理弹窗在阶段4实现（增改删、排序、色板、间隔、初始查询）。
 * 这里先接住顶栏按钮的状态，避免悬空引用。
 */
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal
    :open="open"
    title="管理仓库"
    :ui="{ content: 'max-w-3xl' }"
    @update:open="open = $event"
  >
    <template #body>
      <p class="py-8 text-center text-sm text-muted">
        仓库管理将在下一阶段实现。
      </p>
    </template>
  </UModal>
</template>
