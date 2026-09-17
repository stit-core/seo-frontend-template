import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      'fsd/insignificant-slice': 'off',
      'fsd/repetitive-naming': 'off',
      'fsd/excessive-slicing': 'off',
      'fsd/inconsistent-naming': 'off',
      'fsd/ambiguous-slice-names': 'off',
    },
  },
])
