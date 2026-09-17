// Общая часть FSD-конфига для eslint-plugin-boundaries@7 (API `boundaries/dependencies`).
// pagesPattern различается по фреймворку: Astro/Nuxt — 'src/pages/**', SvelteKit — 'src/routes/**'.
export const EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.astro', '.svelte', '.vue']

export function fsdSettings({ pagesPattern = 'src/pages/**' } = {}) {
  return {
    'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/**', partialMatch: false },
      { type: 'pages', pattern: pagesPattern, partialMatch: false },
      { type: 'widgets', pattern: 'src/widgets/*', capture: ['slice'] },
      { type: 'features', pattern: 'src/features/*', capture: ['slice'] },
      { type: 'entities', pattern: 'src/entities/*', capture: ['slice'] },
      { type: 'shared', pattern: 'src/shared/**', partialMatch: false },
    ],
    'boundaries/include': ['src/**'],
    'import/resolver': {
      typescript: { project: './tsconfig.json', extensions: EXT },
      node: { extensions: EXT },
    },
  }
}

const same = (type) => ({ to: { element: { type, captured: { slice: '{{from.slice}}' } } } })
const to = (...types) => types.map((type) => ({ to: { element: { type } } }))

export const fsdRules = {
  'boundaries/dependencies': [
    'error',
    {
      default: 'disallow',
      policies: [
        { from: [{ element: { type: 'app' } }], allow: to('pages', 'widgets', 'features', 'entities', 'shared') },
        { from: [{ element: { type: 'pages' } }], allow: to('widgets', 'features', 'entities', 'shared') },
        { from: [{ element: { type: 'widgets' } }], allow: [same('widgets'), ...to('features', 'entities', 'shared')] },
        { from: [{ element: { type: 'features' } }], allow: [same('features'), ...to('entities', 'shared')] },
        { from: [{ element: { type: 'entities' } }], allow: [same('entities'), ...to('shared')] },
        { from: [{ element: { type: 'shared' } }], allow: to('shared') },
      ],
    },
  ],
  // Deep-import мимо public API: ловится по форме спецификатора, без резолва —
  // работает для любых расширений целей (.astro/.svelte/.vue тоже).
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['@/entities/*/*', '@/features/*/*', '@/widgets/*/*', '@/pages/*/*'],
          message: 'FSD: импорт мимо public API слайса запрещён (используй @/<layer>/<slice>)',
        },
        {
          group: ['@/shared/*/*/*'],
          message: 'FSD: импорт мимо public API сегмента shared запрещён',
        },
        {
          group: ['../*/*', '../../*'],
          message: 'FSD: относительный импорт за пределы слайса запрещён',
        },
      ],
    },
  ],
}
