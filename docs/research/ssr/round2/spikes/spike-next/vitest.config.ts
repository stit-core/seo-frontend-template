import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` — транзитивный пакет Next; вне RSC-графа его нет в resolve-пути
      // pnpm, а смысла в тесте у него нет. Глушим заглушкой.
      'server-only': fileURLToPath(new URL('./src/shared/lib/testing/noop.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
