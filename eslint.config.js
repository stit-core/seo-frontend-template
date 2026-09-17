import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import testingLibrary from 'eslint-plugin-testing-library'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const fsdLayers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'src/app/router/routeTree.gen.ts',
      'public/mockServiceWorker.js',
      'public/config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      'testing-library': testingLibrary,
      boundaries,
    },
    settings: {
      react: { version: 'detect' },
      'boundaries/elements': fsdLayers.map((layer) => ({
        type: layer,
        pattern: `src/${layer}/*`,
      })),
    },
    rules: {
      // recommended у react-hooks@7 включает compiler-powered правила
      // (purity, immutability, refs, …) — отдельный плагин компилятора не нужен.
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['pages', 'widgets', 'features', 'entities', 'shared'] },
            { from: 'pages', allow: ['widgets', 'features', 'entities', 'shared'] },
            { from: 'widgets', allow: ['features', 'entities', 'shared'] },
            { from: 'features', allow: ['entities', 'shared'] },
            { from: 'entities', allow: ['shared'] },
            { from: 'shared', allow: ['shared'] },
          ],
        },
      ],
      // Кросс-слайсовые импорты (в т.ч. относительные) ловят boundaries и Steiger;
      // здесь — только запрет deep-импорта мимо public API через алиас.
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['@/*/*/*/*'], message: 'Deep-импорт мимо public API запрещён' }],
        },
      ],
    },
  },
  {
    // Только vitest-тесты: e2e (Playwright) — не testing-library.
    files: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}', 'vitest.setup.ts'],
    plugins: { 'testing-library': testingLibrary },
    rules: {
      ...testingLibrary.configs.react.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      // Augmentation-паттерн: пустой interface extends в declare module.
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // js/cjs-конфиги вне ts-программы — линтим без type-aware правил.
    files: ['**/*.{js,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // throw redirect() — идиома TanStack Router в guard'ах/loader'ах.
    files: ['src/pages/**/*.tsx'],
    rules: {
      '@typescript-eslint/only-throw-error': 'off',
    },
  },
  {
    files: ['*.config.{ts,js}', 'vite.config.ts', 'vitest.config.ts'],
    rules: {
      'no-console': 'off',
      // Конфиги стыкуются с нестрого типизированными плагинами (steiger и т.п.).
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
)
