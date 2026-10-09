const { globSync, statSync } = require('node:fs')

// Бюджеты клиентских ассетов (синтез §6.5). size-limit падает на пустом glob'е, поэтому
// строка JS появляется вместе с первым островом и сразу попадает под бюджет.
// Что исполняемых скриптов на страницах нет, кроме островов из списка, проверяет seo:check.
const islands =
  globSync('dist/client/_astro/*.js').length > 0
    ? [{ name: 'JS островов', path: 'dist/client/_astro/*.js', limit: '30 KB', gzip: true }]
    : []

// Бюджет — на документ, а @size-limit/file суммирует все файлы glob'а (бюджет рос бы с
// числом записей): измеряется самая тяжёлая запись обеих локалей.
const posts = globSync(['dist/client/blog/*/index.html', 'dist/client/en/blog/*/index.html'])
const heaviestPost =
  posts.length > 0
    ? posts.reduce((heaviest, path) =>
        statSync(path).size > statSync(heaviest).size ? path : heaviest,
      )
    : undefined
const postHtml = heaviestPost
  ? [{ name: 'HTML поста (самого тяжёлого)', path: heaviestPost, limit: '25 KB', gzip: true }]
  : []

// Остров предпочтений инлайнится в <head> каждой страницы, файла в dist у него нет: его байты
// входят в бюджеты HTML ниже, а сам он меряется один раз — в preferences-init.astro.test.ts.
module.exports = [
  ...islands,
  { name: 'CSS (одна таблица)', path: 'dist/client/_astro/*.css', limit: '15 KB', gzip: true },
  { name: 'HTML главной', path: 'dist/client/index.html', limit: '20 KB', gzip: true },
  { name: 'HTML главной (en)', path: 'dist/client/en/index.html', limit: '20 KB', gzip: true },
  ...postHtml,
]
