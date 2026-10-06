/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config'

// getViteConfig из astro/config даёт тестам виртуальные модули Astro и алиас @/*.
export default getViteConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      // Широкий объём: всё, что исполняется на сборке или на запросе, — страницы, app и .astro.
      include: ['src/**/*.{ts,astro}'],
      // Исключения — связки без своей логики; тестовые файлы Vitest исключает сам.
      exclude: [
        // Баррели: только `export … from` — держит ESLint no-restricted-syntax.
        'src/{entities,features,widgets}/*/index.ts',
        'src/shared/*/index.ts',
        // Входы, навязанные Astro: реэкспорт, регистрация коллекций, объявление типов.
        'src/middleware.ts',
        'src/content.config.ts',
        'src/env.d.ts',
        // defineCollection + glob: коллекцию собирает только Content Layer на сборке.
        'src/entities/*/model/collection.ts',
        // Опора тестов, а не код сайта.
        'src/shared/lib/testing/**',
        'src/pages/_tests/**',
      ],
      reporter: [['text', { skipFull: true }]],
      // Храповик: пороги — факт, округлённый вниз; выросло покрытие — пороги растут тем же коммитом.
      thresholds: { statements: 73, branches: 82, functions: 76, lines: 71 },
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
