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
    // Каталоги, навязанные фреймворком: файловые маршруты и шаблоны OG-картинок.
    files: ['./src/pages/**', './src/components/**'],
    rules: {
      'fsd/public-api': 'off',
      'fsd/no-layer-public-api': 'off',
      'fsd/no-segmentless-slices': 'off',
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // restructureDir @nuxtjs/i18n: каталог с JSON-каталогами, кода там нет.
    files: ['./src/shared/i18n/**'],
    rules: { 'fsd/public-api': 'off' },
  },
  {
    files: ['./src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off' },
  },
])
