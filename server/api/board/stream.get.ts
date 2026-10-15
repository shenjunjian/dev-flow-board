import { subscribeBoardPatches } from '../../utils/publisher'

/** GET /api/board/stream：SSE 补丁，只推真正变动的 Issue */
export default defineEventHandler(async (event) => {
  const stream = createEventStream(event)

  const unsubscribe = subscribeBoardPatches((patch) => {
    void stream.push(JSON.stringify(patch))
  })

  stream.onClosed(() => {
    unsubscribe()
  })

  return stream.send()
})
