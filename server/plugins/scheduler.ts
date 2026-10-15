/**
 * 服务启动时为每个仓库按 refreshIntervalMs 排程后台当天查询。
 * 只排计时器，不在启动瞬间打 GitHub（首拍在一个间隔之后）。
 */
export default defineNitroPlugin(() => {
  rescheduleAll()
})
