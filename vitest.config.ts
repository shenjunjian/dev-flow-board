import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // shared/ 下的都是纯函数，node 环境即可
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
})
