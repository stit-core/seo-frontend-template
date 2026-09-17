import js from '@eslint/js'
import * as astroParser from 'astro-eslint-parser'
import astro from 'eslint-plugin-astro'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'
import { fsdRules, fsdSettings } from './fsd-boundaries.js'

const settings = fsdSettings({ pagesPattern: 'src/pages/**' })

export default [
  { ignores: ['**/node_modules', '**/dist', '**/.astro', '*.config.*', 'fsd-boundaries.js'] },
  js.configs.recommended,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  { files: ['**/*.{ts,tsx,mts,cts}'], languageOptions: { parser: tseslint.parser },
    plugins: { boundaries }, settings, rules: fsdRules },
  { files: ['**/*.astro'],
    languageOptions: { parser: astroParser, parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.astro'] } },
    plugins: { boundaries }, settings, rules: fsdRules },
  { files: ['**/*.astro/*.ts', '**/*.astro/*.js'],
    languageOptions: { parser: tseslint.parser, sourceType: 'module' },
    plugins: { boundaries }, settings, rules: fsdRules },
]
