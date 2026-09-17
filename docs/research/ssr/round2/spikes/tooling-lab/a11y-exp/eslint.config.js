import astro from 'eslint-plugin-astro'
import svelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import vue from 'eslint-plugin-vue'
import vueA11y from 'eslint-plugin-vuejs-accessibility'
import tseslint from 'typescript-eslint'

export default [
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  ...svelte.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...vueA11y.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: { parser: svelteParser, parserOptions: { parser: tseslint.parser } },
    rules: { 'svelte/no-at-html-tags': 'error' },
  },
]
