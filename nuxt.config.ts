export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  nitro: {
    // better-sqlite3 是原生模块，保持为外部依赖，不打进产物
    externals: {
      external: ['better-sqlite3'],
    },
  },
})
