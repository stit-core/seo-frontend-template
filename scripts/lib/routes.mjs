// Маршруты из файлов src/pages и страницы сборки — общая основа гейтов, HTTP-набора и таблицы
// режимов.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Все файлы каталога рекурсивно, в стабильном порядке.
 * @param {string} dir
 * @returns {string[]}
 */
export function walk(dir) {
  const files = []
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) files.push(...walk(path))
    else files.push(path)
  }
  return files
}

const PAGE_EXT = /\.(astro|ts|js|mjs)$/
// Объявление — с начала строки: упоминание в тексте или комментарии режим не меняет.
const ON_DEMAND = /^\s*export\s+const\s+prerender\s*=\s*false\b/m

// Файлы и каталоги с префиксом `_` Astro из роутинга исключает (секции страниц).
// Режим маршрута: `static` — prerender на сборке (файл в dist/client), `dynamic` — on-demand
// (`export const prerender = false`, рендер на запрос); `parametrized` — маршрут с `[param]`,
// его конкретные пути порождает контент. Таблица — docs/reference/rendering.md.
/**
 * @typedef {{ file: string, route: string, parametrized: boolean, prerender: boolean, mode: 'static' | 'dynamic' }} PageRoute
 * @param {string} pagesDir
 * @returns {PageRoute[]}
 */
export function pageRoutes(pagesDir) {
  return walk(pagesDir)
    .filter((file) => PAGE_EXT.test(file))
    .map((file) => ({ file, segments: relative(pagesDir, file).split(sep) }))
    .filter(({ segments }) => !segments.some((segment) => segment.startsWith('_')))
    .map(({ file, segments }) => {
      const route = `/${segments.join('/').replace(PAGE_EXT, '')}`.replace(/\/index$/, '') || '/'
      const prerender = !ON_DEMAND.test(readFileSync(file, 'utf8'))
      return {
        file,
        route,
        parametrized: route.includes('['),
        prerender,
        mode: prerender ? 'static' : 'dynamic',
      }
    })
}

/**
 * Страницы сборки — ровно то, что статик-хендлер отдаёт в контейнере: путь каталога с index.html.
 * @param {string} clientDir
 * @returns {string[]}
 */
export function builtPages(clientDir) {
  return walk(clientDir)
    .map((file) => relative(clientDir, file).split(sep).join('/'))
    .filter((file) => file.endsWith('index.html'))
    .map((file) => `/${file.replace(/\/?index\.html$/, '')}`)
    .sort()
}

/** @param {string} text */
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Сегмент маршрута в регулярном выражении пути: `[x]` — один сегмент, `[...locale]` — ни одного (дефолтная локаль) или
// код локали с префиксом, `[...x]` — ноль и больше сегментов.
/**
 * @param {string} segment
 * @param {readonly string[]} prefixes
 */
const segmentSource = (segment, prefixes) => {
  if (segment === '[...locale]') {
    return prefixes.length === 0 ? '' : `(?:/(?:${prefixes.map(escapeRegExp).join('|')}))?`
  }
  if (/^\[\.\.\.\w+\]$/.test(segment)) return '(?:/[^/]+)*'
  return `/${segment
    .split(/(\[\w+\])/)
    .map((part) => (/^\[\w+\]$/.test(part) ? '[^/]+' : escapeRegExp(part)))
    .join('')}`
}

/**
 * Пути, которые порождает маршрут: `/[...locale]/about` — `/about` и `/en/about`, где `prefixes` — коды локалей с
 * префиксом адреса (все, кроме дефолтной) проверяемого проекта.
 * @param {string} route
 * @param {readonly string[]} [prefixes]
 * @returns {RegExp}
 */
export function routePattern(route, prefixes = []) {
  const source = route
    .split('/')
    .filter(Boolean)
    .map((segment) => segmentSource(segment, prefixes))
    .join('')
  return new RegExp(`^${source}/?$`)
}

/**
 * Маршрут без сегмента локали `[...locale]`, если он у маршрута первый: адрес страницы на дефолтной локали.
 * @param {string} route
 * @returns {string | undefined}
 */
export function localizedRoute(route) {
  const match = /^\/\[\.\.\.locale\](\/.*)?$/.exec(route)
  return match ? (match[1] ?? '/') : undefined
}

/**
 * Шаблоны страниц — по одной странице сборки на prerendered-маршрут src/pages: у маршрута с
 * параметром (`/[...locale]/blog/[slug]`) — первый собранный адрес. Ответ боту зависит от сервера и
 * шаблона, а не от записи: матрица ботов и GEO-проба ходят по шаблонам, а не по всей сборке.
 * @param {string} pagesDir
 * @param {string} clientDir
 * @param {readonly string[]} [prefixes] коды локалей с префиксом адреса — как у `routePattern`
 * @returns {string[]}
 */
export function pageTemplates(pagesDir, clientDir, prefixes = []) {
  const built = builtPages(clientDir)
  return pageRoutes(pagesDir)
    .filter((page) => page.prerender)
    .flatMap((page) =>
      built.filter((path) => routePattern(page.route, prefixes).test(path)).slice(0, 1),
    )
}
