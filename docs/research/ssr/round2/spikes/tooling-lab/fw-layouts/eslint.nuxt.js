import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import vue from 'eslint-plugin-vue'
import vueA11y from 'eslint-plugin-vuejs-accessibility'
import vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'
import { fsdRules, fsdSettings } from './fsd-boundaries.js'

const settings = fsdSettings({ pagesPattern: 'src/pages/**' })

export default [
  { ignores: ['**/node_modules', '**/.nuxt', '**/.output', '*.config.*', 'fsd-boundaries.js'] },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...vueA11y.configs['flat/recommended'],
  { files: ['**/*.{ts,mts,cts,js}'], languageOptions: { parser: tseslint.parser },
    plugins: { boundaries }, settings, rules: fsdRules },
  { files: ['**/*.vue'],
    languageOptions: { parser: vueParser, parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } },
    plugins: { boundaries }, settings, rules: fsdRules },
]
