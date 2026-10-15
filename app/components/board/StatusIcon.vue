<script setup lang="ts">
/**
 * 状态图标：
 * - WaitDev 静态沙漏
 * - Dev / Review 用 SVG 动画表示进行中
 * - DevDone 高对比勾
 * - ReviewErrors 高对比警示
 * - ReviewDone 较平静的成功勾
 */
const props = defineProps<{ status: string }>()
</script>

<template>
  <span
    class="inline-flex h-5 w-5 shrink-0 items-center justify-center"
    :title="props.status"
    aria-hidden="true"
  >
    <!-- WaitDev：静态沙漏 -->
    <svg
      v-if="props.status === 'WaitDev'"
      viewBox="0 0 24 24"
      class="h-5 w-5 text-muted"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3v4l5 5 5-5V3" />
      <path d="M7 21v-4l5-5 5 5v4" />
    </svg>

    <!-- Dev：进行中（旋转弧） -->
    <svg
      v-else-if="props.status === 'Dev'"
      viewBox="0 0 24 24"
      class="board-icon-spin h-5 w-5 text-primary"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>

    <!-- Review：进行中（放大镜脉冲） -->
    <svg
      v-else-if="props.status === 'Review'"
      viewBox="0 0 24 24"
      class="board-icon-pulse h-5 w-5 text-info"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.8-4.8" />
      <path d="m8 10.5 1.8 1.8 3.2-3.6" />
    </svg>

    <!-- DevDone：高对比勾 -->
    <svg
      v-else-if="props.status === 'DevDone'"
      viewBox="0 0 24 24"
      class="h-5 w-5"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" class="fill-[#2f9e44]" />
      <path
        d="m7.5 12.5 3 3 6-7"
        stroke="#fff"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <!-- ReviewErrors：高对比警示 -->
    <svg
      v-else-if="props.status === 'ReviewErrors'"
      viewBox="0 0 24 24"
      class="h-5 w-5"
      fill="none"
    >
      <path d="M12 3 22.5 21H1.5Z" class="fill-[#e03131]" />
      <path d="M12 9.5v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="12" cy="17.2" r="0.5" fill="#fff" stroke="#fff" stroke-width="1.8" />
    </svg>

    <!-- ReviewDone：较平静的成功勾 -->
    <svg
      v-else-if="props.status === 'ReviewDone'"
      viewBox="0 0 24 24"
      class="h-5 w-5 text-[#2f9e44]"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  </span>
</template>

<style scoped>
@keyframes board-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes board-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(0.88);
  }
}

.board-icon-spin {
  animation: board-spin 1.6s linear infinite;
}

.board-icon-pulse {
  animation: board-pulse 1.8s ease-in-out infinite;
}
</style>
