import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'
import svelteConfig from './svelte.config.js'

const fsdLayers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']

export default tseslint.config(
  {
    ignores: [
      'build',
      '.svelte-kit',
      'coverage',
      '.measure',
      'node_modules',
      'src/shared/i18n/paraglide',
      'test-results',
      'playwright-report',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, __RENDER_MODE__: 'readonly' },
    },
    plugins: { boundaries },
    settings: {
      // Без резолвера алиас @/* считается внешним пакетом «@/features» и правило молчит.
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/elements': fsdLayers.map((layer) => ({ type: layer, pattern: `src/${layer}/*` })),
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // boundaries 7: правило переименовано в dependencies, rules → policies.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: fsdLayers.map((layer, i) => ({
            from: [{ element: { type: layer } }],
            allow: fsdLayers.slice(layer === 'shared' ? i : i + 1).map((lower) => ({
              to: { element: { type: lower } },
            })),
          })),
        },
      ],
      // paths.base у сайта всегда пустой, а href'ы собирает localizeHref():
      // resolve() из $app/paths ждёт route id и с локализацией не стыкуется.
      'svelte/no-navigation-without-resolve': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['@/*/*/*/*'], message: 'Deep-импорт мимо public API запрещён' }],
        },
      ],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tseslint.parser, svelteConfig },
    },
  },
  {
    // Маршруты SvelteKit: /internal/* тянет синглтон кеша из app-слоя осознанно.
    files: ['src/pages/internal/**'],
    rules: { 'boundaries/dependencies': 'off' },
  },
  {
    // Augmentation-паттерн: пустой interface extends в declare module.
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-empty-object-type': 'off' },
  },
  {
    files: ['**/*.config.{js,ts}', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
)
