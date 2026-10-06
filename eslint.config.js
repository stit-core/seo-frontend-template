import js from '@eslint/js'
import * as astroParser from 'astro-eslint-parser'
import { defineConfig } from 'eslint/config'
import astro from 'eslint-plugin-astro'
import boundaries from 'eslint-plugin-boundaries'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.astro']
// Код слайсов любого расширения: frontmatter .astro, модули, клиентские <script> (виртуальные
// файлы `<компонент>.astro/<n>.ts` процессора Astro).
const SRC_CODE = 'src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,astro}'
const CLIENT_SCRIPTS = 'src/**/*.astro/*.{ts,js}'

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
  // Входы, навязанные Astro (middleware.ts, content.config.ts, env.d.ts): тонкие связки, не слой.
  'boundaries/files': [{ category: 'astro-entry', pattern: 'src/*.ts' }],
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
  {
    // Относительный путь, вышедший из слайса в каталог слоя, — импорт мимо `@/`: public API и
    // направление слоёв читаются только по алиасу.
    regex: String.raw`^(\.\.?/)+(app|pages|widgets|features|entities|shared)/`,
    message:
      'FSD: из слайса наружу — только `@/<layer>/<slice>`, относительный путь — внутри слайса',
  },
]

// Стили — один токен-слой: CSS UI-кита или пакета приносит свои цвета и размеры мимо токенов.
const importPatterns = [
  ...publicApiPatterns,
  {
    group: ['*.css', '!@/app/styles/index.css'],
    message: 'UI: стили — только токен-слой @/app/styles/index.css, CSS UI-китов и пакетов нет',
  },
]

// Клиентский <script> исполняется в браузере: импортирует только модули без серверного кода.
// Баррель тянет в бандл всё, что за ним (`@/shared/config` — это Zod и env процесса).
const CLIENT_MODULES = ['@/shared/lib', '@/shared/i18n']
const clientPatterns = [
  ...importPatterns,
  {
    regex: String.raw`^(?!\.\.?/|(${CLIENT_MODULES.join('|')})$)`,
    message: `FSD: клиентскому <script> — только свой слайс и ${CLIENT_MODULES.join(', ')}`,
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
        { from: [{ file: { categories: 'astro-entry' } }], allow: to('app', 'entities') },
      ],
    },
  ],
  // Файл вне слоёв (src/components, src/lib…) — мимо всех границ сразу.
  'boundaries/no-unknown-files': 'error',
  'no-restricted-imports': ['error', { patterns: importPatterns }],
}

// Цвет — только токен src/app/styles/index.css: литерал цвета в разметке компонента — сырой цвет.
const COLOR = String.raw`#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(`
const CLASS = "JSXAttribute:matches([name.name='class'], [name.namespace.name='class'])"
// Канон UI (rule shared-ui) в разметке .astro.
const uiSyntax = [
  {
    selector: "JSXOpeningElement[name.name='img']",
    message: 'UI: картинка — <Picture> из astro:assets (форматы, размеры, LCP), а не сырой <img>',
  },
  {
    selector: "JSXNamespacedName[namespace.name='client']",
    message: 'UI: client:* — фреймворка островов нет, остров — инлайн-<script data-island>',
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: 'UI: инлайн-style — значения через утилиты токен-слоя src/app/styles/index.css',
  },
  {
    selector: `${CLASS} Literal[value=/${COLOR}/i]`,
    message: 'UI: сырой цвет в классе — семантическая утилита токен-слоя',
  },
  {
    selector: `JSXElement[openingElement.name.name='style'] > AstroRawText[value=/${COLOR}/i]`,
    message: 'UI: сырой цвет в <style> — токен src/app/styles/index.css',
  },
  {
    selector: `JSXAttribute[name.name=/^(fill|stroke|color|stop-color|flood-color)$/] > Literal[value=/${COLOR}/i]`,
    message: 'UI: сырой цвет в атрибуте — currentColor или токен',
  },
]

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
      // Worktree агентов: чужая незаконченная работа не роняет lint этого дерева.
      '.claude/**',
    ],
  },
  // Правило выключается только блоком этого файла — с причиной. Комментарий-директива в коде не
  // действует, а её предупреждение роняет `pnpm lint` (`--max-warnings 0`).
  { linterOptions: { noInlineConfig: true } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    // Логика слайсов и e2e: здесь можно позволить typed-lint.
    files: ['src/**/*.{ts,mts,cts}', 'e2e/**/*.ts'],
    // Виртуальные блоки клиентских <script> (процессор Astro) не лежат на диске: project
    // service их не видит — они разбираются блоком ниже.
    ignores: [CLIENT_SCRIPTS],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
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
    },
  },
  {
    files: ['src/**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.astro'] },
    },
    rules: { 'no-restricted-syntax': ['error', ...uiSyntax] },
  },
  {
    files: [CLIENT_SCRIPTS],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: 'module',
      parserOptions: { projectService: false },
    },
  },
  {
    // Границы FSD — на всём коде src: модули, frontmatter и клиентские <script>.
    files: [SRC_CODE],
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    files: [CLIENT_SCRIPTS],
    rules: { 'no-restricted-imports': ['error', { patterns: clientPatterns }] },
  },
  {
    // Public API слайса/сегмента: только explicit re-exports — без своего кода, который баррель
    // исполнил бы у каждого импортёра. Примитивы Astro и Node не раздаются мимо API слайса.
    files: ['src/{entities,features,widgets}/*/index.ts', 'src/shared/*/index.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...importPatterns,
            {
              group: ['astro:*', 'node:*'],
              message: 'FSD: примитивы Astro и Node не реэкспортируются из public API слайса',
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
    // Лог — один log() из shared/observability: порог LOG_LEVEL, JSON-строка без PII.
    files: [SRC_CODE],
    ignores: ['src/shared/observability/log.ts', 'src/**/*.test.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    // Среда — только getRuntimeConfig(): на prerender process.env — значение сборки, не контейнера.
    files: [SRC_CODE],
    ignores: ['src/shared/config/**', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'env — только через getRuntimeConfig() из @/shared/config (rule env-local)',
        },
      ],
    },
  },
  {
    // Точки входа, навязанные Astro: server-only код и коллекции контента
    // импортируются напрямую из модуля слайса, не через баррель.
    files: ['src/*.ts'],
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
