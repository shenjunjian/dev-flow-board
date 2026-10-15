/**
 * 服务启动时初始化数据库：建目录、建表、首次建库写入种子仓库。
 * 只碰本地 SQLite，不在启动瞬间访问 GitHub。
 */
export default defineNitroPlugin(() => {
  useDb()
})
