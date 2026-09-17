/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config'

// getViteConfig из astro/config даёт тестам виртуальные модули Astro и алиас @/*.
export default getViteConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,mts}'],
      exclude: ['src/**/*.test.ts', 'src/app/**', 'src/shared/lib/testing/**'],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
    projects: [
      {
        // .astro рендерится Container API только в node-окружении:
        // в браузерных условиях astro-плагин отдаёт заглушку-ошибку.
        extends: true,
        test: {
          name: 'astro',
          environment: 'node',
          include: ['src/**/*.astro.test.ts', 'src/**/*.server.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.astro.test.ts', 'src/**/*.server.test.ts'],
        },
      },
    ],
  },
})
