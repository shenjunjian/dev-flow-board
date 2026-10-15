import { syncRepo } from '../../../utils/sync'

/** POST /api/repos/:id/sync-initial：整仓初始查询，按纳入规则对账（不在集合里的本地行删掉） */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'id 不合法' })
  }
  const result = await syncRepo(id, 'initial')
  if (!result.ok) {
    throw createError({ statusCode: 409, statusMessage: result.error })
  }
  return result
})
