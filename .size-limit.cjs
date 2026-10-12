const { globSync, readFileSync } = require('node:fs')
const { brotliCompressSync, constants } = require('node:zlib')

// Бюджеты своих байтов — страховка от регрессии, в brotli: так их отдаёт edge. Вес страницы по
// слоям судят ворота strategy, острова — seo:check по реестру ISLANDS (scripts/lib/site-policy.mjs).
const brotli = (path) =>
  brotliCompressSync(readFileSync(path), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
    .length

// Бюджет HTML — на документ: измеряется самая тяжёлая страница сборки, какой бы она ни была —
// главная, запись или лендинг. Сборка без страниц — путь в пустоту: size-limit падает, а не молчит.
const pages = globSync('dist/client/**/*.html').map((path) => ({ path, size: brotli(path) }))
const heaviest = pages.reduce((a, b) => (b.size > a.size ? b : a), {
  path: 'dist/client/index.html',
  size: 0,
})

// Шрифты ДС — файлы списка src/app/styles/fonts.ts. Строка возникает с первым файлом сборки (путь
// без файлов size-limit считает ошибкой); лимит — цена решения о шрифтах: у шаблона их нет — 0, форк
// ставит факт с запасом не меньше 10 % тем же диффом, что кладёт файлы.
const fonts = globSync('dist/client/_astro/fonts/*')

module.exports = [
  { name: 'CSS сборки (все таблицы)', path: 'dist/client/_astro/*.css', limit: '6.5 KB' },
  { name: `HTML самой тяжёлой страницы (${heaviest.path})`, path: heaviest.path, limit: '5 KB' },
  ...(fonts.length > 0
    ? [{ name: 'Шрифты ДС (все файлы)', path: 'dist/client/_astro/fonts/*', limit: '0 KB' }]
    : []),
]
