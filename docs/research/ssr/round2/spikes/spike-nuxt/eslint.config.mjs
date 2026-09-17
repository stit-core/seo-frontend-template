import boundaries from 'eslint-plugin-boundaries'
// @nuxt/eslint генерирует .nuxt/eslint.config.mjs (правила vue + typescript + сам Nuxt).
import withNuxt from './.nuxt/eslint.config.mjs'

const fsdLayers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']
const allowedBelow = {
  app: ['pages', 'widgets', 'features', 'entities', 'shared'],
  pages: ['widgets', 'features', 'entities', 'shared'],
  widgets: ['features', 'entities', 'shared'],
  features: ['entities', 'shared'],
  entities: ['shared'],
  shared: ['shared'],
}

export default withNuxt(
  {
    ignores: [
      '.nuxt',
      '.output',
      '.data',
      'coverage',
      'node_modules',
      'test-results',
      'playwright-report',
      '_*.mjs',
    ],
  },
  {
    plugins: { boundaries },
    settings: {
      // Без резолвера алиас @/* не резолвится и правило молча ничего не проверяет.
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: ['./.nuxt/tsconfig.app.json'] },
      },
      'boundaries/elements': fsdLayers.map((layer) => ({
        type: layer,
        pattern: `src/${layer}/*`,
      })),
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: Object.entries(allowedBelow).map(([from, to]) => ({
            from: [{ element: { type: from } }],
            allow: to.map((type) => ({ to: { element: { type } } })),
          })),
        },
      ],
      // FSD-имена слайсов односложны по канону; правило Vue тут не работает.
      'vue/multi-word-component-names': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['@/*/*/*/*'], message: 'Deep-импорт мимо public API запрещён' }],
        },
      ],
    },
  },
)
