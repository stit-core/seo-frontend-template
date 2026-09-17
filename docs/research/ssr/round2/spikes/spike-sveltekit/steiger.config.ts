import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      'fsd/forbidden-imports': 'error',
      'fsd/no-public-api-sidestep': 'error',
      'fsd/public-api': 'error',
      // Граф ссылок Steiger не резолвит alias-импорты (@/entities/post),
      // поэтому правило считает все слайсы неиспользуемыми. Ложные срабатывания.
      'fsd/insignificant-slice': 'off',
      'fsd/excessive-slicing': 'warn',
      'fsd/ambiguous-slice-names': 'error',
      'fsd/inconsistent-naming': 'error',
      'fsd/no-segmentless-slices': 'error',
      'fsd/no-reserved-folder-names': 'error',
      'fsd/typo-in-layer-name': 'error',
    },
  },
  {
    // Файловый роутинг SvelteKit: +page/+layout/+server — это маршруты, а не public API слоя.
    files: ['src/pages/**'],
    rules: {
      'fsd/public-api': 'off',
      'fsd/no-layer-public-api': 'off',
      'fsd/segments-by-purpose': 'off',
      'fsd/no-segmentless-slices': 'off',
      'fsd/insignificant-slice': 'off',
      'fsd/excessive-slicing': 'off',
      'fsd/ambiguous-slice-names': 'off',
    },
  },
  {
    // Сегменты app-слоя — хуки и шаблоны документа, у них нет public API.
    files: ['src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off', 'fsd/public-api': 'off' },
  },
  {
    // Кодоген paraglide.
    files: ['src/shared/i18n/paraglide/**'],
    rules: { 'fsd/public-api': 'off', 'fsd/segments-by-purpose': 'off' },
  },
])
