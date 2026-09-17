// Маршруты из файлов src/pages — общая основа обоих контентных гейтов.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

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

// Файлы и каталоги с префиксом `_` Astro из роутинга исключает (секции страниц).
export function pageRoutes(pagesDir) {
  return walk(pagesDir)
    .filter((file) => PAGE_EXT.test(file))
    .map((file) => ({ file, segments: relative(pagesDir, file).split(sep) }))
    .filter(({ segments }) => !segments.some((segment) => segment.startsWith('_')))
    .map(({ file, segments }) => {
      const route = `/${segments.join('/').replace(PAGE_EXT, '')}`.replace(/\/index$/, '') || '/'
      return {
        file,
        route,
        dynamic: route.includes('['),
        prerender: !/export\s+const\s+prerender\s*=\s*false/.test(readFileSync(file, 'utf8')),
      }
    })
}
