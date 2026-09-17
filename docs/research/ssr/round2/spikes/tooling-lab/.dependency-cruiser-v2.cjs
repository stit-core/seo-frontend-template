/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'fsd-no-higher-layer',
      comment: 'Импорт вверх по слоям запрещён',
      severity: 'error',
      from: { path: '^src/entities/' },
      to: { path: '^src/(app|pages|widgets|features)/' },
    },
    {
      name: 'fsd-no-higher-layer-features',
      severity: 'error',
      from: { path: '^src/features/' },
      to: { path: '^src/(app|pages|widgets)/' },
    },
    {
      name: 'fsd-no-higher-layer-widgets',
      severity: 'error',
      from: { path: '^src/widgets/' },
      to: { path: '^src/(app|pages)/' },
    },
    {
      name: 'fsd-no-higher-layer-shared',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(app|pages|widgets|features|entities)/' },
    },
    {
      name: 'fsd-no-cross-slice',
      comment: 'Между слайсами одного слоя импорт запрещён',
      severity: 'error',
      from: { path: '^src/(entities|features|widgets|pages)/([^/]+)/' },
      to: { path: '^src/$1/([^/]+)/', pathNot: ['^src/$1/$2/'] },
    },
    {
      name: 'fsd-no-deep-import',
      comment: 'Импорт мимо public API слайса запрещён (кроме своего слайса)',
      severity: 'error',
      from: { path: '^src/[^/]+/([^/]+)/' },
      to: {
        path: '^src/(entities|features|widgets)/[^/]+/(ui|model|api|lib|config)/',
        pathNot: ['^src/[^/]+/$1/'],
      },
    },
    {
      name: 'fsd-no-deep-import-from-unsliced',
      comment: 'app/shared тоже обязаны ходить через public API слайса',
      severity: 'error',
      from: { path: '^src/(app|shared)/' },
      to: { path: '^src/(entities|features|widgets)/[^/]+/(ui|model|api|lib|config)/' },
    },
  ],
  options: {
    tsConfig: { fileName: './tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.astro', '.svelte', '.vue'],
    },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: 'node_modules' },
  },
}
