import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'

// srcDir = слой app: маршруты, middleware, content.config, env.d.ts — всё «обвязка фреймворка»
export default defineConfig({
  site: 'https://example.com',
  srcDir: './src/app',
  trailingSlash: 'never',
  vite: {
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  },
})
