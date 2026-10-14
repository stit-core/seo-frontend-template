import type { GetStaticPathsResult } from 'astro'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import type * as AuthorSlice from '@/entities/author'
import { SITE_NAME } from '@/shared/config'
import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { parseHtml } from '@/shared/lib/testing'
import { headTags, jsonLdBlocks } from '../../../scripts/lib/html.mjs'
import * as About from '../[...locale]/about.astro'
import * as Post from '../[...locale]/blog/[slug].astro'
import * as Blog from '../[...locale]/blog/index.astro'
import * as List from '../[...locale]/blog/page/[page].astro'
import * as Tag from '../[...locale]/blog/tag/[tag].astro'
import * as Contacts from '../[...locale]/contacts/index.astro'
import * as Thanks from '../[...locale]/contacts/spasibo.astro'
import * as Home from '../[...locale]/index.astro'
import * as Privacy from '../[...locale]/legal/privacy.astro'
import NotFound from '../404.astro'
import ServerError from '../500.astro'
import Now from '../now.astro'

vi.mock('astro:content', () => import('./fixtures').then((fixtures) => fixtures.astroContent))
// Реестр авторов шаблона пуст: подпись и Person проверяются на фикстурных авторах.
vi.mock('@/entities/author', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthorSlice>()),
  AUTHORS: (await import('./fixtures')).AUTHORS,
}))

const ORIGIN = 'https://demo.example'

beforeEach(() => {
  vi.stubEnv('SITE_URL', ORIGIN)
  // Vitest работает в dev-режиме Vite; режим сборки, где черновиков нет, задаётся явно.
  vi.stubEnv('DEV', false)
})
afterEach(() => vi.unstubAllEnvs())

const container = await AstroContainer.create()

// Страницу собирают секции: ребёнок <main> — <section>, подписанный своим заголовком или текстом.
// Всё прочее — ширина, фон или отступ мимо примитива секции.
function outsideSections(html: string) {
  const main = parseHtml(html).querySelector('main')
  return [...(main?.children ?? [])]
    .filter((child) => {
      const title = child.querySelector(`[id="${child.getAttribute('aria-labelledby')}"]`)
      const named = /^H[1-6]$/.test(title?.tagName ?? '') || child.getAttribute('aria-label')
      return child.tagName !== 'SECTION' || !named
    })
    .map((child) => child.outerHTML.slice(0, 80))
}

// Страница целиком, как её отдаёт сборка: <head> разбирает тот же парсер, что seo:check и e2e.
async function render(
  page: AstroComponentFactory,
  path: string,
  props: Record<string, unknown> = {},
) {
  const html = await container.renderToString(page, {
    props,
    request: new Request(`${ORIGIN}${path}`),
    partial: false,
  })
  const tags = headTags(html)
  const blocks = jsonLdBlocks(html).map((json) => JSON.parse(json) as Record<string, unknown>)
  return {
    html,
    lang: /<html lang="([^"]+)"/.exec(html)?.[1],
    canonical: tags.find((tag) => tag.rel === 'canonical')?.href,
    robots: tags.find((tag) => tag.name === 'robots')?.content,
    hreflang: Object.fromEntries(
      tags.flatMap((tag) => (tag.hreflang ? [[tag.hreflang, tag.href]] : [])),
    ),
    blocks,
    jsonLd: blocks.map((block) => block['@type']),
    h1: html.match(/<h1\b/g)?.length ?? 0,
    outsideSections: outsideSections(html),
  }
}

// Плоский TS видит у модуля .astro только default (src/env.d.ts); маршрут страницы экспортирует ещё
// getStaticPaths — один файл на все локали, локаль — сегмент `[...locale]`.
interface Route {
  default: AstroComponentFactory
  getStaticPaths: () => GetStaticPathsResult | Promise<GetStaticPathsResult>
}

interface Built {
  path: string
  locale: string
  props: Record<string, unknown>
}

// Адреса маршрута — из его getStaticPaths: сегмент локали дефолтной локали пуст, параметр — своё значение.
async function built(route: string, module: { default: AstroComponentFactory }): Promise<Built[]> {
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

// hreflang страницы — её версии на языках, где маршрут её собирает, и x-default — версия первой локали дескриптора.
function versionsOf(pages: Built[]): Record<string, string | undefined> {
  if (pages.length < 2) return {}
  const ordered = SUPPORTED_LOCALES.flatMap((locale) =>
    pages
      .filter((page) => page.locale === locale)
      .map((page) => [locale, `${ORIGIN}${page.path}`] as const),
  )
  return { ...Object.fromEntries(ordered), 'x-default': ordered[0]?.[1] }
}

describe('индексируемые страницы', () => {
  it.each<[string, { default: AstroComponentFactory }, (path: string) => string[]]>([
    [
      '/[...locale]',
      Home,
      (path) => (path === '/' ? ['Organization', 'WebSite'] : ['Organization']),
    ],
    ['/[...locale]/about', About, () => ['LocalBusiness', 'BreadcrumbList']],
    ['/[...locale]/contacts', Contacts, () => ['BreadcrumbList']],
    ['/[...locale]/legal/privacy', Privacy, () => ['BreadcrumbList']],
    ['/[...locale]/blog', Blog, () => ['BreadcrumbList']],
  ])(
    '%s: на каждой локали страницы — её язык, self-canonical, hreflang версий, JSON-LD, один h1, страница из секций',
    async (route, module, jsonLd) => {
      const pages = await built(route, module)
      expect(pages.length, route).toBeGreaterThan(0)
      for (const { path, locale, props } of pages) {
        const head = await render(module.default, path, props)
        expect(head.lang, path).toBe(locale)
        expect(head.canonical, path).toBe(`${ORIGIN}${path}`)
        expect(head.robots, path).toBeUndefined()
        expect(head.hreflang, path).toEqual(versionsOf(pages))
        expect(head.jsonLd, path).toEqual(jsonLd(path))
        expect(head.h1, path).toBe(1)
        expect(head.outsideSections, path).toEqual([])
      }
    },
  )

  // Список локалей страницы — её строка карты: у политики обработки ПДн — только дефолтный язык.
  it('политика обработки ПДн — только на дефолтном языке', async () => {
    expect((await built('/[...locale]/legal/privacy', Privacy)).map(({ path }) => path)).toEqual([
      '/legal/privacy',
    ])
  })
})

describe('служебные страницы', () => {
  it('подтверждение заявки — на каждой локали страницы: только noindex, без canonical, hreflang и разметки', async () => {
    for (const { path, locale, props } of await built('/[...locale]/contacts/spasibo', Thanks)) {
      const head = await render(Thanks.default, path, props)
      expect(head.lang, path).toBe(locale)
      expect(head.robots, path).toBe('noindex')
      expect(head.canonical, path).toBeUndefined()
      expect(head.hreflang, path).toEqual({})
      expect(head.jsonLd, path).toEqual([])
      expect(head.h1, path).toBe(1)
      expect(head.outsideSections, path).toEqual([])
    }
  })

  it.each<[string, AstroComponentFactory]>([
    [localePath(DEFAULT_LOCALE, '/net-takoj-stranicy'), NotFound],
    ['/500', ServerError],
  ])(
    '%s: только noindex — без canonical, hreflang и разметки; страница — из секций',
    async (path, page) => {
      const head = await render(page, path)
      expect(head.lang).toBe(DEFAULT_LOCALE)
      expect(head.robots).toBe('noindex')
      expect(head.canonical).toBeUndefined()
      expect(head.hreflang).toEqual({})
      expect(head.jsonLd).toEqual([])
      expect(head.h1).toBe(1)
      expect(head.outsideSections).toEqual([])
    },
  )

  // Страница ошибки — на языке адреса и только на нём: второй язык в теле — шум и для человека,
  // и для определения языка страницы.
  it('404 — на языке префикса пути: текст и ссылка на главную своей локали, без второго языка', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const path = localePath(locale, '/net-takoj-stranicy')
      const { html, lang } = await render(NotFound, path)
      const document = parseHtml(html)
      expect(lang, path).toBe(locale)
      expect(document.querySelector('h1')?.textContent, path).toBe(t(locale, 'notFound.title'))
      const main = document.querySelector('main')
      expect(main?.textContent, path).toContain(t(locale, 'notFound.lead'))
      for (const other of SUPPORTED_LOCALES.filter((candidate) => candidate !== locale)) {
        expect(main?.textContent, path).not.toContain(t(other, 'notFound.lead'))
      }
      expect(main?.querySelector('[lang]'), path).toBeNull()
      expect(
        [...(main?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('href')),
        path,
      ).toEqual([localePath(locale, '/')])
    }
  })

  it('500 — дефолтная локаль и один язык: файл страницы запроса не знает', async () => {
    const { html, lang } = await render(ServerError, '/500')
    const main = parseHtml(html).querySelector('main')
    expect(lang).toBe(DEFAULT_LOCALE)
    expect(main?.textContent).toContain(t(DEFAULT_LOCALE, 'error.lead'))
    expect(main?.querySelector('[lang]')).toBeNull()
    for (const other of SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE)) {
      expect(main?.textContent, other).not.toContain(t(other, 'error.lead'))
    }
  })

  it('/now: время запроса, ответ не кешируется и не индексируется', async () => {
    const response = await container.renderToResponse(Now, {
      request: new Request(`${ORIGIN}/now`),
      partial: false,
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const html = await response.text()
    const time = /<time datetime="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(Math.abs(Date.parse(time) - Date.now())).toBeLessThan(60_000)
    expect(headTags(html).find((tag) => tag.name === 'robots')?.content).toBe('noindex')
    expect(outsideSections(html)).toEqual([])
  })
})

// Теги фикстур ниже порога трёх записей локали: тонкие страницы — только noindex.
const THIN_TAGS = ['/blog/tag/almost', '/blog/tag/astro', '/en/blog/tag/i18n']

describe('маршруты с параметрами', () => {
  it.each<[string, { default: AstroComponentFactory }, string[]]>([
    [
      '/[...locale]/blog/[slug]',
      Post,
      [
        '/blog/para',
        '/blog/odna',
        '/blog/zametka-4',
        '/blog/zametka-3',
        '/blog/zametka-2',
        '/blog/zametka-1',
        '/en/blog/pair',
        '/en/blog/note-2',
        '/en/blog/note-1',
      ],
    ],
    [
      '/[...locale]/blog/tag/[tag]',
      Tag,
      [
        '/blog/tag/almost',
        '/blog/tag/astro',
        '/blog/tag/i18n',
        '/blog/tag/seo',
        '/en/blog/tag/i18n',
        '/en/blog/tag/seo',
      ],
    ],
    ['/[...locale]/blog/page/[page]', List, ['/blog/page/2']],
  ])(
    '%s: адреса каждой локали без черновиков, каждый — своя страница из секций',
    async (route, module, expected) => {
      const pages = await built(route, module)
      expect(pages.map(({ path }) => path)).toEqual(expected)
      for (const { path, locale, props } of pages) {
        const head = await render(module.default, path, props)
        expect(head.lang, path).toBe(locale)
        expect(head.h1, path).toBe(1)
        expect(head.outsideSections, path).toEqual([])
        if (THIN_TAGS.includes(path)) {
          expect(head.robots, path).toBe('noindex')
          expect(head.canonical, path).toBeUndefined()
          expect(head.hreflang, path).toEqual({})
        } else {
          expect(head.robots, path).toBeUndefined()
          expect(head.canonical, path).toBe(`${ORIGIN}${path}`)
        }
      }
    },
  )

  const page = async (route: string, module: { default: AstroComponentFactory }, path: string) => {
    const found = (await built(route, module)).find((candidate) => candidate.path === path)
    return render(module.default, path, found?.props)
  }
  const pair = (ru: string, en: string) => ({
    ru: `${ORIGIN}${ru}`,
    en: `${ORIGIN}${en}`,
    'x-default': `${ORIGIN}${ru}`,
  })

  it('тег от трёх записей в обеих локалях — пара hreflang; перевод с тонкой страницей парой не считается', async () => {
    const tag = (path: string) => page('/[...locale]/blog/tag/[tag]', Tag, path)
    const seo = pair('/blog/tag/seo', '/en/blog/tag/seo')
    expect((await tag('/blog/tag/seo')).hreflang).toEqual(seo)
    expect((await tag('/en/blog/tag/seo')).hreflang).toEqual(seo)
    // Русская страница — от порога, английская — тонкая: hreflang на закрытую страницу не взаимен.
    expect((await tag('/blog/tag/i18n')).hreflang).toEqual({})
  })

  it('запись с переводом: hreflang пары, BlogPosting и тело записи', async () => {
    const head = await page('/[...locale]/blog/[slug]', Post, '/blog/para')
    expect(head.hreflang).toEqual(pair('/blog/para', '/en/blog/pair'))
    expect(head.jsonLd).toEqual(['BlogPosting', 'BreadcrumbList'])
    const paragraphs = [...parseHtml(head.html).querySelectorAll('article p')]
    expect(paragraphs.map((paragraph) => paragraph.textContent)).toContain('Тело записи.')
  })

  // Разметка = видимое: Person печатается только вместе с подписью, теми же строками.
  it('автор записи: подпись в шапке статьи и Person с тем же именем; @id один на обе локали', async () => {
    const post = async (path: string) => {
      const head = await page('/[...locale]/blog/[slug]', Post, path)
      const header = parseHtml(head.html).querySelector('article header')
      return {
        author: head.blocks.find((block) => block['@type'] === 'BlogPosting')?.author,
        header: header?.textContent?.replace(/\s+/g, ' ') ?? '',
      }
    }
    const id = `${ORIGIN}/#author-anna-smirnova`

    const ru = await post('/blog/para')
    expect(ru.author).toEqual({
      '@type': 'Person',
      '@id': id,
      name: 'Анна Смирнова',
      jobTitle: 'редактор блога',
    })
    expect(ru.header).toContain('Автор — Анна Смирнова, редактор блога')

    const en = await post('/en/blog/pair')
    expect(en.author).toEqual({
      '@type': 'Person',
      '@id': id,
      name: 'Anna Smirnova',
      jobTitle: 'blog editor',
    })
    expect(en.header).toContain('By Anna Smirnova, blog editor')

    const plain = await post('/blog/zametka-1')
    expect(plain.author).toEqual({
      '@type': 'Organization',
      '@id': `${ORIGIN}/#org`,
      name: SITE_NAME,
    })
    expect(plain.header).not.toContain('Автор')
  })
})
