import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import { DEFAULT_LOCALE, type Locale, localePath, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { parseHtml } from '@/shared/lib/testing'
import { breadcrumbsOn, type FactValue, pageLocales, strategyPage } from '@/shared/strategy'
import { notFound } from '@/widgets/not-found'
import { headTags, jsonLdBlocks } from '../../../scripts/lib/html.mjs'
import * as About from '../[...locale]/about.astro'
import * as Blog from '../[...locale]/blog/index.astro'
import * as Contacts from '../[...locale]/contacts/index.astro'
import * as Thanks from '../[...locale]/contacts/spasibo.astro'
import * as Home from '../[...locale]/index.astro'
import * as Privacy from '../[...locale]/legal/privacy.astro'
import NotFound from '../404.astro'
import ServerError from '../500.astro'
import Now from '../now.astro'
import { type Built, built, crumbsOf, outsideSections } from './routes'

// Страницы — на данных сайта: его локалях, карте и текстах; записи — фикстуры. Маршруты записей, тегов и страниц
// списка — на локалях и карте теста (blog.astro.test.ts).
vi.mock('astro:content', () => import('./fixtures').then((fixtures) => fixtures.astroContent))

const ORIGIN = 'https://demo.example'

beforeEach(() => {
  vi.stubEnv('SITE_URL', ORIGIN)
  // Vitest работает в dev-режиме Vite; режим сборки, где черновиков нет, задаётся явно.
  vi.stubEnv('DEV', false)
})
afterEach(() => vi.unstubAllEnvs())

const container = await AstroContainer.create()

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
    crumbs: crumbsOf(html, blocks),
  }
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
  it.each<[string, { default: AstroComponentFactory }, string, (path: string) => string[]]>([
    [
      '/[...locale]',
      Home,
      'home',
      (path) => (path === '/' ? ['Organization', 'WebSite'] : ['Organization']),
    ],
    ['/[...locale]/about', About, 'about', () => ['LocalBusiness']],
    ['/[...locale]/contacts', Contacts, 'contacts', () => []],
    ['/[...locale]/legal/privacy', Privacy, 'privacy', () => []],
    ['/[...locale]/blog', Blog, 'blog', () => []],
  ])(
    '%s: локали — её строка карты; на каждой — её язык, self-canonical, hreflang версий, JSON-LD, один h1, страница из секций, крошки по карте',
    async (route, module, id, jsonLd) => {
      const pages = await built(route, module)
      expect(pages.length, route).toBeGreaterThan(0)
      expect(
        pages.map(({ locale }) => locale),
        route,
      ).toEqual(pageLocales(id))
      for (const { path, locale, props } of pages) {
        const head = await render(module.default, path, props)
        expect(head.lang, path).toBe(locale)
        expect(head.canonical, path).toBe(`${ORIGIN}${path}`)
        expect(head.robots, path).toBeUndefined()
        expect(head.hreflang, path).toEqual(versionsOf(pages))
        expect(head.jsonLd, path).toEqual(jsonLd(path))
        expect(head.h1, path).toBe(1)
        expect(head.outsideSections, path).toEqual([])
        // Крошки — у шаблона карты с крошками и с глубины 2; страницы первого уровня — без них.
        expect(head.crumbs.visible !== undefined, path).toBe(breadcrumbsOn(id))
        expect(head.crumbs.structured, path).toEqual(head.crumbs.visible)
      }
    },
  )
})

// Каркас — секции шапки и подвала плана страницы, у страницы без своего плана — главной. Тексты секции — строки слотов
// и экземпляров её групп на языке страницы.
function chromeOf(page: string, locale: Locale, block: string) {
  const section = strategyPage(page, locale).sections.find((candidate) => candidate.block === block)
  const instances = Object.values(section?.groups ?? {}).flat()
  const values = [
    ...Object.values(section?.slots ?? {}),
    ...instances.flatMap((instance) => Object.values(instance)),
  ]
  return {
    slots: section?.slots ?? {},
    texts: values.flat().filter((value): value is string => typeof value === 'string'),
  }
}

// Содержимое 404 на языке — пропсы блока его плана.
const notFoundOf = (locale: Locale) =>
  notFound.props(strategyPage('not-found', locale), 'not-found')

describe('каркас страниц — план страницы', () => {
  // Своих текстов и пунктов у оболочки нет: меню — подписи пунктов плана, ссылки подвала — подписи его разделов и
  // документов, реквизиты — текст copy deck, который показывает факт оператора.
  it('меню и ссылки подвала — подписи плана, реквизиты подвала — copy deck и факт: страница сборки и on-demand', async () => {
    const pages = SUPPORTED_LOCALES.flatMap((locale) => [
      { page: Home.default, id: 'home', path: localePath(locale, '/'), props: { locale }, locale },
      {
        page: NotFound,
        id: 'not-found',
        path: localePath(locale, '/net-takoj-stranicy'),
        props: {},
        locale,
      },
    ])
    for (const { page, id, path, props, locale } of pages) {
      const doc = parseHtml((await render(page, path, props)).html)
      const header = chromeOf(id, locale, 'header')
      const footer = chromeOf(id, locale, 'footer')
      const menu = [...doc.querySelectorAll('header nav a:not([hreflang])')]
      expect(menu.length, path).toBeGreaterThan(0)
      for (const link of menu) expect(header.texts, path).toContain(link.textContent)
      for (const link of doc.querySelectorAll('footer nav a')) {
        expect(footer.texts, path).toContain(link.textContent)
      }
      const legal = doc.querySelector('footer p')?.textContent
      // Видимый текст — тот же: неразрывный пробел реквизита — пробел.
      expect(legal?.replace(/\s/g, ' '), path).toBe(footer.slots.legal)
      expect(legal, path).toContain((footer.slots.company as FactValue).text)
    }
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
  // и для определения языка страницы. Пути — главная своей локали и главные разделы из плана.
  it('404 — на языке префикса пути: текст плана, главная своей локали и пути к разделам, без второго языка', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const path = localePath(locale, '/net-takoj-stranicy')
      const { html, lang } = await render(NotFound, path)
      const document = parseHtml(html)
      const section = notFoundOf(locale)
      expect(lang, path).toBe(locale)
      expect(document.querySelector('h1')?.textContent, path).toBe(section.title)
      const main = document.querySelector('main')
      expect(main?.textContent, path).toContain(section.body)
      // Другие локали — filter с явным boolean: вывод предиката TS при одной локали сузил бы список до never.
      for (const other of SUPPORTED_LOCALES.filter((candidate): boolean => candidate !== locale)) {
        expect(main?.textContent, path).not.toContain(notFoundOf(other).body)
      }
      expect(main?.querySelector('[lang]'), path).toBeNull()
      const routes = section.route.map((route) => route.link.href)
      expect(routes.length, path).toBeGreaterThanOrEqual(2)
      expect(
        [...(main?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('href')),
        path,
      ).toEqual([localePath(locale, '/'), ...routes])
    }
  })

  it('500 — дефолтная локаль и один язык: файл страницы запроса не знает', async () => {
    const { html, lang } = await render(ServerError, '/500')
    const main = parseHtml(html).querySelector('main')
    expect(lang).toBe(DEFAULT_LOCALE)
    expect(main?.textContent).toContain(t(DEFAULT_LOCALE, 'error.lead'))
    expect(main?.querySelector('[lang]')).toBeNull()
    for (const other of SUPPORTED_LOCALES.filter((locale): boolean => locale !== DEFAULT_LOCALE)) {
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
