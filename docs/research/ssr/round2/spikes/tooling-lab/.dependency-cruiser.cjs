/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'fsd-no-upward',
      severity: 'error',
      from: { path: '^src/entities/' },
      to: { path: '^src/(app|pages|widgets|features)/' },
    },
    {
      name: 'fsd-no-cross-slice-features',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/([^/]+)/', pathNot: '^src/features/$1/' },
    },
    {
      name: 'fsd-no-deep-import',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^src/(entities|features|widgets)/[^/]+/(?!index)[^/]+/' },
    },
  ],
  options: {
    tsConfig: { fileName: './tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.astro', '.svelte', '.vue'],
    },
    doNotFollow: { path: 'node_modules' },
  },
}
