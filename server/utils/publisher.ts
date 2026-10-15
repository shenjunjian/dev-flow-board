import type { BoardPatch } from '#shared/utils/board'

type PatchListener = (patch: BoardPatch) => void

// globalThis 收口：开发热更新下也只保留一组订阅者
const globalForPublisher = globalThis as unknown as { __devFlowBoardPublisher?: Set<PatchListener> }

function listeners(): Set<PatchListener> {
  if (!globalForPublisher.__devFlowBoardPublisher) {
    globalForPublisher.__devFlowBoardPublisher = new Set()
  }
  return globalForPublisher.__devFlowBoardPublisher
}

/** 订阅看板补丁，返回取消订阅函数 */
export function subscribeBoardPatches(fn: PatchListener): () => void {
  listeners().add(fn)
  return () => {
    listeners().delete(fn)
  }
}

/** 把补丁发给所有 SSE 连接；没有变动就不发 */
export function publishBoardPatch(patch: BoardPatch): void {
  if (patch.upserts.length === 0 && patch.deleted.length === 0) return
  for (const fn of listeners()) {
    try {
      fn(patch)
    }
    catch {
      // 单个订阅者失败不影响其他订阅者
    }
  }
}
