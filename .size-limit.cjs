const { globSync } = require('node:fs')

// Бюджеты клиентских ассетов (синтез §6.5). size-limit падает на пустом glob'е, поэтому
// строка JS появляется вместе с первым островом и сразу попадает под бюджет.
// «0 script-ресурсов» на индексируемых страницах проверяет e2e.
const islands =
  globSync('dist/client/_astro/*.js').length > 0
    ? [{ name: 'JS островов', path: 'dist/client/_astro/*.js', limit: '30 KB', gzip: true }]
    : []

module.exports = [
  ...islands,
  { name: 'CSS (одна таблица)', path: 'dist/client/_astro/*.css', limit: '15 KB', gzip: true },
  { name: 'HTML главной', path: 'dist/client/index.html', limit: '20 KB', gzip: true },
  { name: 'HTML главной (en)', path: 'dist/client/en/index.html', limit: '20 KB', gzip: true },
]
