import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import boundaries from 'eslint-plugin-boundaries'

// FSD-слои. `views` — вынужденная замена слоя `pages`: каталог src/pages в Next
// зарезервирован под legacy Pages Router. Слой `app` здесь — маршруты Next:
// композиционный корень FSD и точка входа фреймворка совпали, поэтому app
// разрешён сам себе (сегменты styles/fonts лежат рядом с маршрутами).
const LAYERS = ['app', 'views', 'widgets', 'features', 'entities', 'shared']
const SLICELESS = new Set(['app', 'shared'])

const config = [
  {
    ignores: [
      '.next/**',
      '.probe/**',
      '.probe2/**',
      '.tmp/**',
      'node_modules/**',
      'next-env.d.ts',
      'playwright-report/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': LAYERS.map((layer) => ({ type: layer, pattern: `src/${layer}/*` })),
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: LAYERS.map((layer, index) => ({
            from: [{ element: { type: layer } }],
            allow: (SLICELESS.has(layer)
              ? [layer, ...LAYERS.slice(index + 1)]
              : LAYERS.slice(index + 1)
            ).map((to) => ({ to: { element: { type: to } } })),
          })),
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/*/*/*/*'], message: 'Импорт мимо public API слайса запрещён (FSD).' },
          ],
        },
      ],
    },
  },
  {
    // size-limit читает конфиг через require() — CJS здесь вынужденный.
    files: ['.size-limit.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['postcss.config.mjs', 'eslint.config.mjs'],
    rules: { 'import/no-anonymous-default-export': 'off' },
  },
]

export default config
