import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      'fsd/forbidden-imports': 'error',
      'fsd/no-public-api-sidestep': 'error',
      'fsd/public-api': 'error',
      'fsd/insignificant-slice': 'warn',
    },
  },
  { ignores: ['src/content.config.ts', 'src/middleware.ts', 'src/actions/**', 'src/env.d.ts'] },
  {
    files: ['src/pages/**'],
    rules: {
      'fsd/no-layer-public-api': 'off',
      'fsd/no-segmentless-slices': 'off',
      'fsd/no-segments-on-sliced-layers': 'off',
      'fsd/public-api': 'off',
      'fsd/insignificant-slice': 'off',
    },
  },
  { files: ['src/app/**'], rules: { 'fsd/segments-by-purpose': 'off', 'fsd/public-api': 'off' } },
])
