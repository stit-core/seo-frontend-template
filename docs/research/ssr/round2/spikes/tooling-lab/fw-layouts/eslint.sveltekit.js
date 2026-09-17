import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import svelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'
import { fsdRules, fsdSettings } from './fsd-boundaries.js'

const settings = fsdSettings({ pagesPattern: 'src/routes/**' })

export default [
  { ignores: ['**/node_modules', '**/.svelte-kit', '**/build', '*.config.*', 'fsd-boundaries.js'] },
  js.configs.recommended,
  ...svelte.configs.recommended,
  { files: ['**/*.{ts,mts,cts,js}'], languageOptions: { parser: tseslint.parser },
    plugins: { boundaries }, settings, rules: fsdRules },
  { files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parser: svelteParser, parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] } },
    plugins: { boundaries }, settings,
    rules: { ...fsdRules, 'svelte/valid-compile': 'error' } },
]
