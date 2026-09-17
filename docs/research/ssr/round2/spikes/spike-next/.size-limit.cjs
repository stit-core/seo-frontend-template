// Next 16 убрал размеры бандлов из вывода `next build`, а `.next/static/chunks/**`
// содержит чанки ВСЕХ маршрутов сразу (плюс legacy-бандл под noModule, который
// современный браузер не грузит). Поэтому бюджет считаем «по странице»: берём
// пререндеренный HTML и суммируем только те чанки, на которые он ссылается.
const { readFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = __dirname
const APP = join(ROOT, '.next', 'server', 'app')

function chunksOf(htmlRelPath) {
  const file = join(APP, htmlRelPath)
  if (!existsSync(file)) throw new Error(`нет пререндера ${htmlRelPath} — сначала pnpm build`)
  const html = readFileSync(file, 'utf8')
  const urls = new Set()

  for (const m of html.matchAll(/<script([^>]*?)>/g)) {
    if (/\bnomodule\b/i.test(m[1])) continue
    const src = /\bsrc="([^"]+)"/.exec(m[1])
    if (src) urls.add(src[1])
  }
  for (const m of html.matchAll(/<link\b([^>]*?)>/g)) {
    const attrs = m[1]
    const rel = /\brel="([^"]+)"/.exec(attrs)
    const href = /\bhref="([^"]+)"/.exec(attrs)
    if (!rel || !href) continue
    const isScript = /\bas="script"/.test(attrs) || rel[1] === 'modulepreload'
    if (isScript) urls.add(href[1])
  }

  return [...urls]
    .filter((u) => u.startsWith('/_next/static/') && u.endsWith('.js'))
    .map((u) => join(ROOT, u.replace('/_next/', '.next/')))
}

function cssOf(htmlRelPath) {
  const html = readFileSync(join(APP, htmlRelPath), 'utf8')
  return [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map((m) => join(ROOT, m[1].replace('/_next/', '.next/')))
}

module.exports = [
  { name: 'JS: / (главная)', path: chunksOf('ru.html'), limit: '150 KB', gzip: true },
  { name: 'JS: /about (нет интерактива)', path: chunksOf('ru/about.html'), limit: '150 KB', gzip: true },
  { name: 'JS: /contact (остров формы)', path: chunksOf('ru/contact.html'), limit: '155 KB', gzip: true },
  { name: 'CSS: /', path: cssOf('ru.html'), limit: '10 KB', gzip: true },
  {
    name: 'legacy noModule-бандл (не грузится современным браузером)',
    path: '.next/static/chunks/*.js',
    limit: '250 KB',
    gzip: true,
  },
]
