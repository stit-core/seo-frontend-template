import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

// Steiger — структурный линтер (public API, сегменты, имена). Границы импортов
// держит ESLint (`pnpm lint`): Steiger не видит цели `.astro` и `export … from`.
export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      'fsd/forbidden-imports': 'error',
      'fsd/no-public-api-sidestep': 'error',
      'fsd/public-api': 'error',
      'fsd/no-segmentless-slices': 'error',
      'fsd/no-reserved-folder-names': 'error',
      'fsd/ambiguous-slice-names': 'error',
      'fsd/inconsistent-naming': 'error',
      'fsd/typo-in-layer-name': 'error',
      'fsd/excessive-slicing': 'warn',
      // Референсы из вложенных каталогов маршрутов Steiger не видит,
      // поэтому widgets ложно числятся «без референсов». Границы держит ESLint.
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Входы, навязанные Astro (middleware.ts, content.config.ts, env.d.ts), — не слои FSD.
    ignores: ['src/*.ts'],
  },
  {
    // src/pages — файловый роутинг: index.astro это маршрут '/', подпапки en/ blog/ [slug]/ —
    // сегменты URL, а не слайсы с сегментами FSD.
    files: ['src/pages/**'],
    rules: {
      'fsd/no-layer-public-api': 'off',
      'fsd/no-segmentless-slices': 'off',
      'fsd/no-segments-on-sliced-layers': 'off',
      'fsd/public-api': 'off',
    },
  },
  {
    // 'layouts' / 'middleware' / 'styles' — устоявшиеся имена сегментов app-слоя.
    files: ['src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off', 'fsd/public-api': 'off' },
  },
])
