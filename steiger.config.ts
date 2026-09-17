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
      'fsd/excessive-slicing': 'warn',
      'fsd/ambiguous-slice-names': 'error',
      'fsd/inconsistent-naming': 'error',
      'fsd/no-segmentless-slices': 'error',
      'fsd/no-reserved-folder-names': 'error',
      'fsd/typo-in-layer-name': 'error',
    },
  },
  {
    files: ['src/app/router/routeTree.gen.ts'],
    rules: { 'fsd/public-api': 'off' },
  },
  {
    // TanStack file-based routing: index.tsx — это route '/', а не public API слоя.
    files: ['src/pages/index.tsx'],
    rules: { 'fsd/no-layer-public-api': 'off' },
  },
  {
    // Bootstrap: dynamic import mock-подсистемы мимо index — осознанно,
    // чтобы MSW не попадал в prod-граф модулей.
    files: ['src/app/init.ts'],
    rules: { 'fsd/no-public-api-sidestep': 'off' },
  },
  {
    // 'providers' — устоявшееся имя сегмента app-слоя в FSD-практике.
    files: ['src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off' },
  },
])
