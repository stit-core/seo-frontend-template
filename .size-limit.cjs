// Бюджетируется критический путь загрузки. Ленивые чанки (mock+faker+graphql,
// devtools, web-vitals, locale-каталоги) сюда не входят: в prod (API_MODE=real)
// они не грузятся либо грузятся после старта.
module.exports = [
  {
    name: 'main entry',
    path: 'dist/assets/index-*.js',
    limit: '35 KB',
    gzip: true,
  },
  {
    name: 'react vendor',
    path: 'dist/assets/react-*.js',
    limit: '65 KB',
    gzip: true,
  },
  {
    name: 'router vendor',
    path: 'dist/assets/router-*.js',
    limit: '30 KB',
    gzip: true,
  },
  {
    name: 'query vendor',
    path: 'dist/assets/query-*.js',
    limit: '12 KB',
    gzip: true,
  },
  {
    name: 'initial JS total',
    path: [
      'dist/assets/index-*.js',
      'dist/assets/react-*.js',
      'dist/assets/router-*.js',
      'dist/assets/query-*.js',
      'dist/assets/preload-helper-*.js',
      'dist/assets/rolldown-runtime-*.js',
    ],
    limit: '150 KB',
    gzip: true,
  },
]
