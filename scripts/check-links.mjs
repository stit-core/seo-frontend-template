// Гейт ссылок на прод-сборке (после build): каждый внутренний href/src/srcset в dist/client —
// корневой путь или абсолютный URL своего сайта (canonical, hreflang, RSS в <head>) — существует
// как файл или страница (<path>/index.html при build.format 'directory') либо является on-demand
// маршрутом; ссылок с хвостовым слешем, на .html, в неканонической форме (`//`, точки, буква
// процентами) и на адреса из content/redirects.yaml нет — каждая ссылка ведёт сразу на конечный
// документ и называет его единственным адресом.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { load } from 'js-yaml'
import { SITE_ORIGIN_PLACEHOLDER } from '../src/shared/config/runtime.ts'
import { buildRedirectTable, canonicalPath } from '../src/shared/redirects/table.ts'
import { decode } from './lib/html.mjs'
import { pageRoutes, walk } from './lib/routes.mjs'

// Корень проекта; другой корень — негативные фикстуры check:gate (`.gate-fixtures/<скрипт>`).
const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
const client = resolve(root, 'dist/client')
if (!existsSync(client)) {
  console.error('check:links: dist/client не найден — сначала pnpm build')
  process.exit(1)
}

const onDemand = new Set(
  pageRoutes(resolve(root, 'src/pages'))
    .filter((page) => page.mode === 'dynamic' && !page.parametrized)
    .map((page) => page.route),
)
const redirects = buildRedirectTable(
  load(readFileSync(resolve(root, 'content/redirects.yaml'), 'utf8')),
)

const ATTR_RE = /\b(href|src|srcset)=("([^"]*)"|'([^']*)')/gi
// Свой origin в сборке — плейсхолдер; абсолютный URL на нём — внутренняя ссылка.
const OWN_ORIGIN = new URL(SITE_ORIGIN_PLACEHOLDER).origin
const ownPath = (url) =>
  url === OWN_ORIGIN ? '/' : url.startsWith(`${OWN_ORIGIN}/`) ? url.slice(OWN_ORIGIN.length) : url

function targets(html) {
  const out = []
  for (const match of html.matchAll(ATTR_RE)) {
    const value = decode(match[3] ?? match[4] ?? '')
    if (match[1].toLowerCase() === 'srcset') {
      for (const candidate of value.split(',')) {
        const url = candidate.trim().split(/\s+/)[0]
        if (url) out.push(url)
      }
    } else out.push(value)
  }
  return out.map(ownPath)
}

function existsAsFileOrPage(path) {
  const fsPath = resolve(client, `.${path}`)
  if (fsPath !== client && !fsPath.startsWith(client + sep)) return false
  if (existsSync(fsPath) && statSync(fsPath).isFile()) return true
  return existsSync(resolve(fsPath, 'index.html'))
}

const errors = []
let checked = 0
const pages = walk(client).filter((file) => file.endsWith('.html'))
if (pages.length === 0) {
  console.error('check:links: в dist/client нет ни одной страницы — сборка неполная')
  process.exit(1)
}
for (const file of pages) {
  const where = relative(root, file).split(sep).join('/')
  for (const url of targets(readFileSync(file, 'utf8'))) {
    if (/^(#|mailto:|tel:|data:)/i.test(url)) continue
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) continue
    checked++
    if (!url.startsWith('/')) {
      errors.push(`${where}: ${url} — относительная ссылка, нужен корневой путь`)
      continue
    }
    const path = url.replace(/[?#].*$/, '')
    const search = /\?[^#]*/.exec(url)?.[0] ?? ''
    if (path !== '/' && path.endsWith('/'))
      errors.push(`${where}: ${url} — хвостовой слеш (лишний редирект)`)
    else if (path.endsWith('.html')) errors.push(`${where}: ${url} — .html (дубль маршрута)`)
    // `//`, точки и буква процентами: процесс ответил бы 301, а за edge, который приводит такой путь
    // сам, — второй адрес той же страницы.
    else if (canonicalPath(path) !== path)
      errors.push(`${where}: ${url} — неканоническая форма адреса (лишний редирект или дубль)`)
    else if (redirects.find(canonicalPath(path) ?? path, search))
      errors.push(`${where}: ${url} — адрес из redirects.yaml, ведите на конечный`)
    else if (!onDemand.has(path) && !existsAsFileOrPage(path))
      errors.push(`${where}: ${url} — не существует`)
  }
}

if (errors.length > 0) {
  console.error(`check:links: ${errors.length} битых ссылок\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.info(`check:links: ${pages.length} страниц, ${checked} внутренних ссылок — ok`)
