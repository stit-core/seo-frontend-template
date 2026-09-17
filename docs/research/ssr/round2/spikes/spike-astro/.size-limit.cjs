// Бюджеты клиентских ассетов. Островной JS грузится только на /contact,
// остальные страницы обязаны оставаться нулевыми по JS (проверяется e2e).
module.exports = [
  {
    name: 'contact island (react 19 + form)',
    path: 'dist/client/_astro/*.js',
    limit: '100 KB',
    gzip: true,
  },
  {
    name: 'css (одна таблица на весь сайт)',
    path: 'dist/client/_astro/*.css',
    limit: '5 KB',
    gzip: true,
  },
]
