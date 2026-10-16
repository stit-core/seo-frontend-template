import type { GetStaticPathsResult } from 'astro'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import { parseHtml } from '@/shared/lib/testing'

// Страницу собирают секции: ребёнок <main> — <section>, подписанный своим заголовком или текстом.
// Всё прочее — ширина, фон или отступ мимо примитива секции.
export function outsideSections(html: string) {
  const main = parseHtml(html).querySelector('main')
  return [...(main?.children ?? [])]
    .filter((child) => {
      const title = child.querySelector(`[id="${child.getAttribute('aria-labelledby')}"]`)
      const named = /^H[1-6]$/.test(title?.tagName ?? '') || child.getAttribute('aria-label')
      return child.tagName !== 'SECTION' || !named
    })
    .map((child) => child.outerHTML.slice(0, 80))
}

// Крошки страницы — видимые (`<nav>` с `<ol>`: ступени ссылками, последняя — текущая страница) и BreadcrumbList в
// <head>: имя и путь каждой ступени по порядку. Нет крошек — undefined у обеих сторон.
export function crumbsOf(html: string, blocks: ReadonlyArray<Record<string, unknown>>) {
  const list = parseHtml(html).querySelector('nav > ol')
  const visible = list
    ? [...list.querySelectorAll(':scope > li')].map((item) => {
        const link = item.querySelector('a')
        const name = (link ?? item.querySelector('[aria-current="page"]'))?.textContent
        return [name, link?.getAttribute('href')]
      })
    : undefined
  const data = blocks.find((block) => block['@type'] === 'BreadcrumbList') as
    | { itemListElement: Array<{ name: string; item?: string }> }
    | undefined
  const structured = data?.itemListElement.map(({ name, item }) => [
    name,
    item === undefined ? undefined : new URL(item).pathname,
  ])
  return { visible, structured }
}

// Плоский TS видит у модуля .astro только default (src/env.d.ts); маршрут страницы экспортирует ещё
// getStaticPaths — один файл на все локали, локаль — сегмент `[...locale]`.
interface Route {
  default: AstroComponentFactory
  getStaticPaths: () => GetStaticPathsResult | Promise<GetStaticPathsResult>
}

export interface Built {
  path: string
  locale: string
  props: Record<string, unknown>
}

// Адреса маршрута — из его getStaticPaths: сегмент локали дефолтной локали пуст, параметр — своё значение.
export async function built(
  route: string,
  module: { default: AstroComponentFactory },
): Promise<Built[]> {
  return (await (module as Route).getStaticPaths()).map(({ params, props = {} }) => {
    const record: Record<string, unknown> = props
    // Локаль страницы — проп маршрута, у записи — её поле.
    const owner = (record.post ?? record) as { locale: string }
    const path = route
      .split('/')
      .map((segment) =>
        segment.replace(/^\[(?:\.\.\.)?(\w+)\]$/, (_, key: string) => String(params[key] ?? '')),
      )
      .filter(Boolean)
      .map((segment) => `/${segment}`)
      .join('')
    return { path: path || '/', locale: owner.locale, props: record }
  })
}

// Адрес маршрута и адрес карты в одной форме: параметр `[x]` файла и `{x}` карты — `*`.
const shapeOf = (url: string) => url.replace(/\[[^\]]+\]|\{[^}]+\}/g, '*')

// Маршруты страниц — файлы `.astro` из src/pages вне каталогов `_*` (их Astro не маршрутизирует): маршрут — путь файла
// для `built`, адрес — без сегмента локали `[...locale]`, модуль — по запросу теста.
const routeFiles = import.meta.glob<{ default: AstroComponentFactory }>([
  '../**/*.astro',
  '!../**/_*/**',
])
export const pageRoutes = Object.entries(routeFiles).map(([file, load]) => {
  const route = `/${file.slice('../'.length, -'.astro'.length)}`.replace(/\/index$/, '') || '/'
  const url = route.replace(/^\/\[\.\.\.locale\]/, '') || '/'
  return { route, url: shapeOf(url), load }
})

// Маршрут страницы карты — по её адресу.
export const routeOf = (url: string) =>
  pageRoutes.find((candidate) => candidate.url === shapeOf(url))
