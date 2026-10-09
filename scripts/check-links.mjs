// Гейт ссылок на прод-сборке (после build): каждый внутренний href/src/srcset в dist/client —
// корневой путь или абсолютный URL своего сайта (canonical, hreflang, RSS в <head>) — существует
// как файл или страница (<path>/index.html при build.format 'directory') либо является on-demand
// маршрутом; ссылок с хвостовым слешем, на .html, в неканонической форме (двойной слеш в пути,
// буква процентами), на адреса из content/redirects.yaml и без схемы на другой хост (`//contacts`)
// нет — каждая ссылка ведёт сразу на конечный документ и называет его единственным адресом.
// Ссылку гейт читает как браузер (разбор URL от своего origin): путь — тот, что уйдёт в запросе.
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
const SCHEME = /^[a-z][a-z0-9+.-]*:/i
// Свой origin в сборке — плейсхолдер; абсолютный URL на нём — внутренняя ссылка.
const OWN_ORIGIN = new URL(SITE_ORIGIN_PLACEHOLDER).origin

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
  return out
}

// Файл лежит под именем буквами, а в запросе путь придёт процентами: существование сверяется в
// записи файла.
function existsAsFileOrPage(pathname) {
  const fsPath = resolve(client, `.${decodeURIComponent(pathname)}`)
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
  for (const written of targets(readFileSync(file, 'utf8'))) {
    if (/^(#|mailto:|tel:|data:)/i.test(written)) continue
    const absolute = SCHEME.test(written)
    const link = URL.parse(written, OWN_ORIGIN)
    const own = link?.origin === OWN_ORIGIN
    if (absolute && !own) continue
    checked++
    // В сообщении ссылка — как записана; свой абсолютный URL — путём от корня.
    const url = absolute ? `${link.pathname}${link.search}${link.hash}` : written
    // `//contacts` — так склеивается путь с лишним слешем — и `/\contacts` браузер прочтёт как хост.
    if (!own) {
      errors.push(
        `${where}: ${url} — без схемы это другой хост: свой адрес — с одним слешем, чужой — со схемой`,
      )
      continue
    }
    if (!absolute && !written.startsWith('/')) {
      errors.push(`${where}: ${url} — относительная ссылка, нужен корневой путь`)
      continue
    }
    // Путь запроса: кириллицу и пробел браузер запишет процентами, сегменты `.` и `..` уберёт сам —
    // такая ссылка приходит на сервер канонической.
    const { pathname, search } = link
    if (pathname !== '/' && pathname.endsWith('/'))
      errors.push(`${where}: ${url} — хвостовой слеш (лишний редирект)`)
    else if (pathname.endsWith('.html')) errors.push(`${where}: ${url} — .html (дубль маршрута)`)
    // Двойной слеш в пути и буква, записанная процентами, дойдут до сервера как есть: процесс
    // ответит 301, а за edge, который приводит такой путь сам, это второй адрес той же страницы.
    else if (canonicalPath(pathname) !== pathname)
      errors.push(`${where}: ${url} — неканоническая форма адреса (лишний редирект или дубль)`)
    else if (redirects.find(pathname, search))
      errors.push(`${where}: ${url} — адрес из redirects.yaml, ведите на конечный`)
    else if (!onDemand.has(pathname) && !existsAsFileOrPage(pathname))
      errors.push(`${where}: ${url} — не существует`)
  }
}

if (errors.length > 0) {
  console.error(`check:links: ${errors.length} битых ссылок\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.info(`check:links: ${pages.length} страниц, ${checked} внутренних ссылок — ok`)
