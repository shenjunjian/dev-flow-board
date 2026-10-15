export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  ui: {
    // 本机访问不了 fonts.google.com，关闭字体优化避免启动时反复超时重试
    fonts: false,
  },
  components: [
    // board/ 子目录下的组件不加路径前缀，保持 RepoBlock/IssueCard 原名
    { path: '~/components', pathPrefix: false },
  ],
  nitro: {
    // better-sqlite3 是原生模块，保持为外部依赖，不打进产物
    externals: {
      external: ['better-sqlite3'],
    },
  },
})
