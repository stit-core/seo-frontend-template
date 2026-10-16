/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config'

// getViteConfig из astro/config даёт тестам виртуальные модули Astro и алиас @/*.
export default getViteConfig({
  test: {
    globals: true,
    // `.only`, забытый в тесте, молча выключил бы остальные тесты гейта — это ошибка прогона.
    allowOnly: false,
    coverage: {
      provider: 'v8',
      // Широкий объём: всё, что исполняется на сборке или на запросе, — страницы, app и .astro.
      include: ['src/**/*.{ts,astro}'],
      // Исключения — связки без своей логики; тестовые файлы Vitest исключает сам.
      exclude: [
        // Баррели: только `export … from` — держит ESLint no-restricted-syntax.
        'src/{entities,features,widgets}/*/index.ts',
        'src/shared/*/index.ts',
        'src/shared/{ui,lib}/*/index.ts',
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
      // Храповик (rule tests-pipeline): факт, округлённый вниз; пол — 90 %, потолок — 99 %.
      thresholds: { statements: 99, branches: 99, functions: 99, lines: 99 },
    },
    projects: [
      {
        // .astro рендерится Container API только в node-окружении:
        // в браузерных условиях astro-плагин отдаёт заглушку-ошибку.
        extends: true,
        test: {
          name: 'astro',
          environment: 'node',
          include: ['src/**/*.{astro,server}.{test,spec}.{ts,mts}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          // Любой тест-файл src запускается: .spec и .mts не выпадают из гейта молча.
          include: ['src/**/*.{test,spec}.{ts,mts}'],
          exclude: ['src/**/*.{astro,server}.{test,spec}.{ts,mts}'],
        },
      },
    ],
  },
})
