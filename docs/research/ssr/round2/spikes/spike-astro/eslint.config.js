import js from '@eslint/js'
import astro from 'eslint-plugin-astro'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // Слайсовые слои: @/<layer>/<slice>/<segment>/<file>
            { group: ['@/*/*/*/*'], message: 'FSD: импорт мимо public API слайса' },
            // shared — sliceless: @/shared/<segment>/<file>
            { group: ['@/shared/*/*'], message: 'FSD: импорт мимо public API сегмента shared' },
          ],
        },
      ],
    },
  },
  {
    // Точки входа, навязанные Astro. Им приходится обходить public API слайса:
    // server-only код (actions) и content-config нельзя тащить через баррель.
    files: ['src/actions/**', 'src/content.config.ts', 'src/middleware.ts', 'src/fetch.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
)
