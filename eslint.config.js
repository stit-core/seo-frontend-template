import js from '@eslint/js'
import * as astroParser from 'astro-eslint-parser'
import { defineConfig } from 'eslint/config'
import astro from 'eslint-plugin-astro'
import boundaries from 'eslint-plugin-boundaries'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.astro']

// Границы FSD держит именно ESLint: резолвер видит цели любого расширения (в т.ч. .astro),
// а `no-restricted-imports` ловит deep-import по форме спецификатора без резолва вовсе.
const fsdSettings = {
  'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
  'boundaries/elements': [
    // app режется по сегментам: pages могут импортировать только app/layouts (см. policies).
    { type: 'app', pattern: 'src/app/*', capture: ['segment'] },
    { type: 'pages', pattern: 'src/pages/**', partialMatch: false },
    { type: 'widgets', pattern: 'src/widgets/*', capture: ['slice'] },
    { type: 'features', pattern: 'src/features/*', capture: ['slice'] },
    { type: 'entities', pattern: 'src/entities/*', capture: ['slice'] },
    { type: 'shared', pattern: 'src/shared/**', partialMatch: false },
  ],
  'boundaries/include': ['src/**'],
  'import/resolver': { typescript: { project: './tsconfig.json', extensions: EXT } },
}

// Зависимости внутри одного элемента (слайс → свой сегмент, shared → shared) плагин
// не оценивает, поэтому политики только между элементами.
const to = (...types) => types.map((type) => ({ to: { element: { type } } }))
const appLayouts = { to: { element: { type: 'app', captured: { segment: 'layouts' } } } }

const publicApiPatterns = [
  {
    group: ['@/entities/*/*', '@/features/*/*', '@/widgets/*/*', '@/pages/*/*'],
    message: 'FSD: импорт мимо public API слайса',
  },
  {
    group: [
      '@/shared/*/*',
      '!@/shared/ui/*',
      '!@/shared/lib/*',
      '@/shared/ui/*/*',
      '@/shared/lib/*/*',
    ],
    message: 'FSD: импорт мимо public API сегмента shared',
  },
]

const fsdRules = {
  'boundaries/dependencies': [
    'error',
    {
      default: 'disallow',
      policies: [
        {
          from: [{ element: { type: 'app' } }],
          allow: to('app', 'pages', 'widgets', 'features', 'entities', 'shared'),
        },
        {
          from: [{ element: { type: 'pages' } }],
          // Astro не оборачивает страницы снаружи — страница сама импортирует документ-шелл.
          // Это единственный разрешённый импорт вверх; app/layouts не импортирует pages.
          allow: [appLayouts, ...to('widgets', 'features', 'entities', 'shared')],
        },
        { from: [{ element: { type: 'widgets' } }], allow: to('features', 'entities', 'shared') },
        { from: [{ element: { type: 'features' } }], allow: to('entities', 'shared') },
        { from: [{ element: { type: 'entities' } }], allow: to('shared') },
      ],
    },
  ],
  'no-restricted-imports': ['error', { patterns: publicApiPatterns }],
}

export default defineConfig(
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.gate-fixtures/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    // Логика слайсов и e2e: здесь можно позволить typed-lint.
    files: ['src/**/*.{ts,mts,cts}', 'e2e/**/*.ts'],
    // Виртуальные блоки клиентских <script> (процессор Astro) не лежат на диске: project
    // service их не видит, и boundaries на них молча не срабатывает — линтятся блоком ниже.
    ignores: ['src/**/*.astro/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: {
      ...fsdRules,
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.astro'] },
    },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    // Клиентские <script> Astro-процессор отдаёт как виртуальные файлы.
    // Без этого блока импорты из них не проверяются НИЧЕМ.
    files: ['src/**/*.astro/*.ts', 'src/**/*.astro/*.js'],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: 'module',
      parserOptions: { projectService: false },
    },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    // Public API слайса/сегмента: только explicit re-exports. Импорт, объявление или
    // top-level вызов в баррели тянет server-only код и контент в клиентский граф.
    files: ['src/{entities,features,widgets}/*/index.ts', 'src/shared/*/index.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...publicApiPatterns,
            {
              group: ['astro:*', 'node:*'],
              message: 'FSD: server-only символы не реэкспортируются из public API слайса',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program > :not(ExportNamedDeclaration[source])',
          message: 'FSD: в index.ts — только `export { x } from "./…"`, без импортов и вызовов',
        },
      ],
    },
  },
  {
    // Точки входа, навязанные Astro: server-only код и коллекции контента
    // импортируются напрямую из модуля слайса, не через баррель.
    files: ['src/content.config.ts', 'src/middleware.ts', 'src/actions/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // Корневые конфиги — вне ts-программы src/: линтятся без type-aware правил.
    files: ['*.config.{ts,js,mjs}', '.size-limit.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // CommonJS по требованию инструмента (size-limit, commitlint): require здесь легитимен.
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
)
