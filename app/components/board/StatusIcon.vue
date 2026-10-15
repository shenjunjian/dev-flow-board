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

    <!-- Review：检视中 —— 放大镜沿圆形轨迹一圈圈巡行（找 bug 的样子），轨迹本身不画出来 -->
    <svg
      v-else-if="props.status === 'Review'"
      viewBox="0 0 24 24"
      class="board-icon-orbit-svg h-5 w-5 text-info"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <g transform="translate(12 12)">
        <!-- 外层 g 只做圆周平移，放大镜姿态保持恒定（手柄始终朝右下） -->
        <g class="board-icon-orbit">
          <circle r="6.5" />
          <path d="m4.6 4.6 2.9 2.9" />
        </g>
      </g>
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

/*
 * 让放大镜沿圆形轨迹巡行：只用 translate 采样圆周（每 30° 一点，半径 4.5），
 * 不做 rotate —— 放大镜姿态恒定（手柄始终朝右下），像举着放大镜扫查。
 * 轨迹本身不画出来，只体现在运动上；20px 尺寸下 30° 折线与圆弧偏差 <0.15px，看不出来。
 */
@keyframes board-orbit {
  0%      { transform: translate(0, -4.5px); }
  8.333%  { transform: translate(2.25px, -3.897px); }
  16.667% { transform: translate(3.897px, -2.25px); }
  25%     { transform: translate(4.5px, 0); }
  33.333% { transform: translate(3.897px, 2.25px); }
  41.667% { transform: translate(2.25px, 3.897px); }
  50%     { transform: translate(0, 4.5px); }
  58.333% { transform: translate(-2.25px, 3.897px); }
  66.667% { transform: translate(-3.897px, 2.25px); }
  75%     { transform: translate(-4.5px, 0); }
  83.333% { transform: translate(-3.897px, -2.25px); }
  91.667% { transform: translate(-2.25px, -3.897px); }
  100%    { transform: translate(0, -4.5px); }
}

.board-icon-spin {
  animation: board-spin 1.6s linear infinite;
}

.board-icon-orbit {
  animation: board-orbit 2.4s linear infinite;
}

/* 轨迹最外点时镜片描边恰好触到 viewBox 边缘，放开裁切让笔画完整显示 */
.board-icon-orbit-svg {
  overflow: visible;
}

/* 减弱动效偏好：停在轨迹顶端 */
@media (prefers-reduced-motion: reduce) {
  .board-icon-orbit {
    animation: none;
    transform: translate(0, -4.5px);
  }
}
</style>
