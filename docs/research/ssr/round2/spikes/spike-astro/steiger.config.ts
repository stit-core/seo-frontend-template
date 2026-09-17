import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      'fsd/forbidden-imports': 'error',
      'fsd/no-public-api-sidestep': 'error',
      'fsd/public-api': 'error',
      'fsd/insignificant-slice': 'warn',
      'fsd/excessive-slicing': 'warn',
      'fsd/ambiguous-slice-names': 'error',
      'fsd/inconsistent-naming': 'error',
      'fsd/no-segmentless-slices': 'error',
      'fsd/no-reserved-folder-names': 'error',
      'fsd/typo-in-layer-name': 'error',
    },
  },
  {
    // Astro жёстко требует эти пути; это не слои FSD, а точки входа фреймворка.
    ignores: ['src/content.config.ts', 'src/middleware.ts', 'src/fetch.ts', 'src/actions/**'],
  },
  {
    // src/pages — файловый роутинг: index.astro это маршрут '/', подпапки
    // blog/ en/ api/ — сегменты URL, а не слайсы с сегментами.
    files: ['src/pages/**'],
    rules: {
      'fsd/no-layer-public-api': 'off',
      'fsd/no-segmentless-slices': 'off',
      'fsd/no-segments-on-sliced-layers': 'off',
      'fsd/public-api': 'off',
    },
  },
  {
    files: ['src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off', 'fsd/public-api': 'off' },
  },
])
