import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import type * as AuthorSlice from '@/entities/author'
import { DEFAULT_LOCALE, type Locale, localePath, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { parseHtml, sectionFaults } from '@/shared/lib/testing'
import {
  type Action,
  breadcrumbsOn,
  type FactValue,
  pageLocales,
  snapshot,
  strategyPage,
} from '@/shared/strategy'
import { breadcrumbs } from '@/widgets/breadcrumbs'
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
import { blocks, catalog, chromeOf } from './catalog'
import {
  type Built,
  built,
  crumbsOf,
  outsideSections,
  pageRoutes,
  routeOf,
  shapeOf,
} from './routes'
import { pageTexts, strayText } from './texts'

// Страницы — на данных сайта: его локалях, карте и текстах; записи и их авторы — фикстуры (реестр авторов шаблона
// пуст). Маршруты записей, тегов и страниц списка — на локалях и карте теста (blog.astro.test.ts).
vi.mock('astro:content', () => import('./fixtures').then((fixtures) => fixtures.astroContent))
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
function chromeTextsOf(page: string, locale: Locale, block: string) {
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
      const header = chromeTextsOf(id, locale, 'header')
      const footer = chromeTextsOf(id, locale, 'footer')
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

// Маршрут = страница карты: адрес файла маршрута без сегмента локали — `url` строки карты. Не страницы карты — только
// служебные маршруты: страница сбоя адаптера (500), обработчики (`api/*`) и страницы 2…N списка страницы карты.
describe('маршруты — страницы карты', () => {
  it('у каждой страницы карты — маршрут её адреса, у каждого маршрута страницы — строка карты', () => {
    const urls = snapshot().map?.pages.map(({ url }) => url) ?? []
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.filter((url) => routeOf(url) === undefined)).toEqual([])
    const lists = new Set(urls.map((url) => `${url === '/' ? '' : shapeOf(url)}/page/*`))
    const service = (url: string) => url === '/500' || url.startsWith('/api/') || lists.has(url)
    expect(
      pageRoutes
        .filter(({ url }) => !urls.some((own) => shapeOf(own) === url) && !service(url))
        .map(({ route }) => route),
    ).toEqual([])
  })
})

// Страница снимка с планом — на каждом языке своей строки карты: тест на страницу и язык.
const planPages = snapshot().plans.flatMap(({ page: { id } }) =>
  pageLocales(id).map((locale) => [id, locale] as const),
)

// Страница — секции своего плана: план — источник порядка и полноты, композиция страницы их только ставит.
describe('страница из блоков: план страницы', () => {
  it.each(planPages)(
    '%s (%s): секции = план — дети <main> — секции плана по порядку (каркас ставит оболочка); слот — на странице: каждая секция целиком',
    async (id, locale) => {
      const project = snapshot()
      const url = project.map?.pages.find((page) => page.id === id)?.url ?? ''
      const route = routeOf(url)
      expect(route, `${id}: маршрута ${url} нет`).toBeDefined()
      if (route === undefined) return
      const module = await route.load()
      // Страница сборки — адреса её getStaticPaths на этом языке; on-demand (404) — адрес страницы карты.
      const pages =
        'getStaticPaths' in module
          ? (await built(route.route, module)).filter((page) => page.locale === locale)
          : [{ path: localePath(locale, url), props: {} }]
      expect(pages.length, `${id} (${locale})`).toBeGreaterThan(0)
      const faults: string[] = []
      for (const { path, props } of pages) {
        const { html } = await render(module.default, path, props)
        const page = strategyPage(id, locale)
        const main = parseHtml(html).querySelector('main')
        const shown = [...(main?.children ?? [])].map((child) =>
          child.getAttribute('aria-labelledby'),
        )
        // «Связанные» — только когда есть что связать: без них секции нет (запись без общих тегов).
        const sections = page.sections.filter(
          (section) => section.block !== 'related-links' || shown.includes(section.id),
        )
        expect(shown, path).toEqual(
          sections
            .filter((section) => catalog[section.block]?.flow !== 'chrome')
            .map((section) => section.id),
        )
        for (const section of sections) {
          const block = blocks.find((candidate) => candidate.block.id === section.block)?.block
          if (block === undefined) {
            faults.push(`${path} ${id}/${section.id}: блока ${section.block} нет`)
            continue
          }
          faults.push(
            ...sectionFaults(html, page, section.id, block, chromeOf(section, locale, project)).map(
              (fault) => `${path} ${fault}`,
            ),
          )
        }
      }
      expect(faults).toEqual([])
    },
  )
})

// Весь текст страницы — данные (R08): слово мимо copy deck, фактов, словаря, самоназваний языков, имени сайта и записей
// коллекции — текст, которого нет в пакете strategy, и его не видят ни её валидаторы, ни проверка секций. Страница —
// каждая сборки (адреса getStaticPaths) и on-demand страница карты на её языках; 500 — дефолтной локали. Ответ формы с
// ошибками — contact.astro.test.ts.
const textRoutes = pageRoutes
  .filter(({ url }) => !url.startsWith('/api/'))
  .map((entry) => [entry.route, entry] as const)

describe('текст страницы — данные', () => {
  it.each(textRoutes)(
    '%s: на каждом языке весь текст страницы — copy deck, факты, словарь, самоназвания языков, имя сайта и записи коллекции',
    async (route, entry) => {
      const module = await entry.load()
      const own = snapshot().map?.pages.find((page) => shapeOf(page.url) === entry.url)
      const pages =
        'getStaticPaths' in module
          ? await built(route, module)
          : own === undefined
            ? [{ path: route, locale: DEFAULT_LOCALE, props: {} }]
            : pageLocales(own.id).map((locale) => ({
                path: localePath(locale, own.url),
                locale,
                props: {},
              }))
      expect(pages.length, route).toBeGreaterThan(0)
      const faults: string[] = []
      for (const { path, locale, props } of pages) {
        const { html } = await render(module.default, path, props)
        faults.push(
          ...strayText(html, pageTexts(locale as Locale)).map(
            (fault) => `${path} (${locale}): ${fault}`,
          ),
        )
      }
      expect(faults).toEqual([])
    },
  )
})

// Крошки — секция плана у страницы шаблона карты с крошками и глубиной от 2: ступени ведут на её родителей по карте,
// подписи — copy deck.
describe('крошки по карте', () => {
  it('секция крошек — у страницы с крошками по карте; ступени — родители страницы по карте', () => {
    let checked = 0
    for (const { page } of snapshot().plans) {
      for (const locale of pageLocales(page.id)) {
        const read = strategyPage(page.id, locale)
        const crumbs = read.sections.find((section) => section.block === breadcrumbs.id)
        expect(crumbs !== undefined, page.id).toBe(breadcrumbsOn(page.id))
        if (crumbs === undefined) continue
        expect(
          crumbs.groups.crumb?.map((step) => (step.link as Action).href),
          `${page.id} (${locale})`,
        ).toEqual(read.parents.map((parent) => parent.url))
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(0)
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

  // Страница ошибки — на языке адреса и только на нём: тело — версия 404 этого языка из данных целиком, без вставок с
  // другим языком (одинаковый текст двух версий — законные данные, а не второй язык). Пути — главная своей локали и
  // главные разделы из плана.
  it('404 — на языке префикса пути: версия этого языка из данных целиком, главная своей локали и пути к разделам', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const path = localePath(locale, '/net-takoj-stranicy')
      const { html, lang } = await render(NotFound, path)
      const document = parseHtml(html)
      const section = notFoundOf(locale)
      expect(lang, path).toBe(locale)
      expect(document.querySelector('h1')?.textContent, path).toBe(section.title)
      expect(
        sectionFaults(html, strategyPage('not-found', locale), 'not-found', notFound),
        path,
      ).toEqual([])
      const main = document.querySelector('main')
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
})
