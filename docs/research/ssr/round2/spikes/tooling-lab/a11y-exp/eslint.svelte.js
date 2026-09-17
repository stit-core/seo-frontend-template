import svelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'

export default [
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte'],
    languageOptions: { parser: svelteParser, parserOptions: { parser: tseslint.parser } },
    rules: { 'svelte/valid-compile': 'error' },
  },
]
