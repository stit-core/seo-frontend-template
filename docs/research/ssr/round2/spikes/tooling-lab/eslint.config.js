import js from '@eslint/js'
import * as astroParser from 'astro-eslint-parser'
import astro from 'eslint-plugin-astro'
import boundaries from 'eslint-plugin-boundaries'
import * as svelteParser from 'svelte-eslint-parser'
import * as vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'

const EXT = ['.ts', '.tsx', '.js', '.mjs', '.astro', '.svelte', '.vue']

const fsdSettings = {
  'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
  'boundaries/elements': [
    { type: 'app', pattern: 'src/app' },
    { type: 'pages', pattern: 'src/pages/*', partialMatch: false, capture: ['slice'] },
    { type: 'widgets', pattern: 'src/widgets/*', capture: ['slice'] },
    { type: 'features', pattern: 'src/features/*', capture: ['slice'] },
    { type: 'entities', pattern: 'src/entities/*', capture: ['slice'] },
    { type: 'shared', pattern: 'src/shared' },
  ],
  'import/resolver': {
    typescript: { project: './tsconfig.json', extensions: EXT },
    node: { extensions: EXT },
  },
}

const sameSlice = (type) => ({ to: { element: { type, captured: { slice: '{{from.slice}}' } } } })
const to = (...types) => types.map((type) => ({ to: { element: { type } } }))

const fsdRules = {
  'boundaries/dependencies': [
    'error',
    {
      default: 'disallow',
      policies: [
        { from: [{ element: { type: 'app' } }], allow: to('pages', 'widgets', 'features', 'entities', 'shared') },
        { from: [{ element: { type: 'pages' } }], allow: to('widgets', 'features', 'entities', 'shared') },
        { from: [{ element: { type: 'widgets' } }], allow: [sameSlice('widgets'), ...to('features', 'entities', 'shared')] },
        { from: [{ element: { type: 'features' } }], allow: [sameSlice('features'), ...to('entities', 'shared')] },
        { from: [{ element: { type: 'entities' } }], allow: [sameSlice('entities'), ...to('shared')] },
        { from: [{ element: { type: 'shared' } }], allow: to('shared') },
      ],
    },
  ],
  'no-restricted-imports': [
    'error',
    { patterns: [{ group: ['@/*/*/*', '!@/shared/*/*'], message: 'Deep-импорт мимо public API запрещён' }] },
  ],
}

export default [
  { ignores: ['node_modules', 'dist', '.astro', '*.mjs'] },
  js.configs.recommended,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    files: ['**/*.astro'],
    languageOptions: { parser: astroParser, parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.astro'] } },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    // клиентские <script> Astro вытаскиваются процессором в виртуальные .ts
    files: ['**/*.astro/*.ts', '**/*.astro/*.js'],
    languageOptions: { parser: tseslint.parser, sourceType: 'module' },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    files: ['**/*.svelte'],
    languageOptions: { parser: svelteParser, parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] } },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parser: vueParser, parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
]
