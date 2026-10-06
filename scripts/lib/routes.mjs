// Маршруты из файлов src/pages — общая основа контентных гейтов и таблицы режимов.
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
// Объявление — с начала строки: упоминание в тексте разметки (`/now`) режим не меняет.
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
