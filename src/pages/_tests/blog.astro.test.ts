import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import type * as AuthorSlice from '@/entities/author'
import { SITE_NAME } from '@/shared/config'
import type { Locale } from '@/shared/i18n'
import { parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { breadcrumbsOn, strategyPage } from '@/shared/strategy'
import { headTags, jsonLdBlocks } from '../../../scripts/lib/html.mjs'
import * as Post from '../[...locale]/blog/[slug].astro'
import * as Blog from '../[...locale]/blog/index.astro'
import * as List from '../[...locale]/blog/page/[page].astro'
import * as Tag from '../[...locale]/blog/tag/[tag].astro'
import { GET as feed, getStaticPaths as feedPaths } from '../[...locale]/rss.xml.ts'
import { blocks, catalog } from './catalog'
import { built, crumbsOf, outsideSections } from './routes'

// Блог — на локалях и карте теста: записи фикстур на ru и en, блог, записи и теги — в версиях обеих. Так маршруты,
// пары переводов и фиды судятся при любом наборе локалей сайта.
vi.mock('astro:content', () => import('./fixtures').then((fixtures) => fixtures.astroContent))
// Реестр авторов шаблона пуст: подпись и Person проверяются на фикстурных авторах.
vi.mock('@/entities/author', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthorSlice>()),
  AUTHORS: (await import('./fixtures')).AUTHORS,
}))
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const ORIGIN = 'https://demo.example'
const RU = testLocale('ru')
const EN = testLocale('en')

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
  }
}

// Теги фикстур ниже порога трёх записей локали: тонкие страницы — только noindex.
const THIN_TAGS = ['/blog/tag/almost', '/blog/tag/astro', '/en/blog/tag/i18n']

describe('маршруты блога с параметрами', () => {
  it.each<[string, { default: AstroComponentFactory }, string, string[]]>([
    [
      '/[...locale]/blog/[slug]',
      Post,
      'post',
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
      'tag',
      [
        '/blog/tag/almost',
        '/blog/tag/astro',
        '/blog/tag/i18n',
        '/blog/tag/seo',
        '/en/blog/tag/i18n',
        '/en/blog/tag/seo',
      ],
    ],
    ['/[...locale]/blog/page/[page]', List, 'blog', ['/blog/page/2']],
  ])(
    '%s: адреса каждой локали без черновиков, каждый — своя страница из секций, крошки — по карте',
    async (route, module, id, expected) => {
      const pages = await built(route, module)
      expect(pages.map(({ path }) => path)).toEqual(expected)
      for (const { path, locale, props } of pages) {
        const head = await render(module.default, path, props)
        expect(head.lang, path).toBe(locale)
        expect(head.h1, path).toBe(1)
        expect(head.outsideSections, path).toEqual([])
        // Крошки — у шаблона карты с крошками: видимые и BreadcrumbList — один путь.
        const crumbs = crumbsOf(head.html, head.blocks)
        expect(crumbs.visible !== undefined, path).toBe(breadcrumbsOn(id))
        expect(crumbs.structured, path).toEqual(crumbs.visible)
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

  // Крошки — секция плана шаблона: подписи ступеней — copy deck, адреса — родители страницы по карте, последняя ступень —
  // сама запись или тег.
  it('крошки записи и тега — секция breadcrumbs плана: ступени — родители по карте, текущая — страница', async () => {
    const cases: Array<[string, { default: AstroComponentFactory }, string, Locale, string]> = [
      ['/[...locale]/blog/[slug]', Post, '/blog/para', RU, 'Запись с переводом'],
      ['/[...locale]/blog/[slug]', Post, '/en/blog/pair', EN, 'Post with a translation'],
      ['/[...locale]/blog/tag/[tag]', Tag, '/blog/tag/seo', RU, '#seo'],
    ]
    for (const [route, module, path, locale, current] of cases) {
      const head = await page(route, module, path)
      const plan = strategyPage(route.includes('tag') ? 'tag' : 'post', locale)
      const steps = plan.sections.find((section) => section.block === 'breadcrumbs')?.groups.crumb
      expect(crumbsOf(head.html, head.blocks).visible, path).toEqual([
        ...plan.parents.map((parent, index) => [steps?.[index]?.label, parent.url]),
        [current, undefined],
      ])
    }
  })

  // Разметка = видимое: Person печатается только вместе с подписью, теми же строками; подпись — ссылка на профиль.
  it('автор записи: подпись — ссылка rel="author" на профиль и Person с тем же именем; @id один на обе локали', async () => {
    const post = async (path: string) => {
      const head = await page('/[...locale]/blog/[slug]', Post, path)
      const link = parseHtml(head.html).querySelector('article header a[rel="author"]')
      return {
        author: head.blocks.find((block) => block['@type'] === 'BlogPosting')?.author,
        link: link && [link.getAttribute('href'), link.textContent?.trim()],
        signature: link?.parentElement?.textContent?.replace(/\s+/g, ' ').trim(),
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
    expect(ru.link).toEqual(['/avtory/anna-smirnova', 'Анна Смирнова'])
    expect(ru.signature).toBe('Анна Смирнова, редактор блога')

    const en = await post('/en/blog/pair')
    expect(en.author).toEqual({
      '@type': 'Person',
      '@id': id,
      name: 'Anna Smirnova',
      jobTitle: 'blog editor',
    })
    expect(en.link).toEqual(['/avtory/anna-smirnova', 'Anna Smirnova'])

    expect((await post('/blog/odna')).link).toEqual(['https://petr-ivanov.example', 'Пётр Иванов'])

    const plain = await post('/blog/zametka-1')
    expect(plain.author).toEqual({
      '@type': 'Organization',
      '@id': `${ORIGIN}/#org`,
      name: SITE_NAME,
    })
    expect(plain.link).toBeNull()
  })

  // «Связанные» — путь дальше по сайту: записи той же локали с общим тегом; нет таких — секции нет, а не пустой список.
  it('связанные записи: секция со ссылками на записи с общим тегом той же локали; без них секции нет', async () => {
    const related = async (path: string) => {
      const { html } = await page('/[...locale]/blog/[slug]', Post, path)
      const section = parseHtml(html).querySelector('main [aria-labelledby="related"]')
      return (
        section &&
        [...section.querySelectorAll('nav li a')].map((link) => link.getAttribute('href'))
      )
    }
    expect(await related('/blog/para')).toEqual(['/blog/zametka-2', '/blog/zametka-1'])
    expect(await related('/en/blog/pair')).toEqual(['/en/blog/note-2', '/en/blog/note-1'])
    expect(await related('/blog/odna')).toBeNull()
  })
})

// Страница блога — секции своего плана: список и шаблоны записи и тега на локалях и карте теста. Страницы 2…N списка —
// та же композиция с номером страницы в заголовке.
describe('страницы блога из блоков: план страницы', () => {
  it('секции = план, слот — на странице: список, тег и запись; связанные — когда они есть', async () => {
    const routes: Array<[string, { default: AstroComponentFactory }, string]> = [
      ['/[...locale]/blog', Blog, 'blog'],
      ['/[...locale]/blog/tag/[tag]', Tag, 'tag'],
      ['/[...locale]/blog/[slug]', Post, 'post'],
    ]
    const faults: string[] = []
    for (const [route, module, id] of routes) {
      for (const { path, locale, props } of await built(route, module)) {
        const { html } = await render(module.default, path, props)
        const plan = strategyPage(id, locale as Locale)
        const shown = [...(parseHtml(html).querySelector('main')?.children ?? [])].map((child) =>
          child.getAttribute('aria-labelledby'),
        )
        const expected = plan.sections
          .filter((section) => catalog[section.block]?.flow !== 'chrome')
          .filter((section) => section.block !== 'related-links' || shown.includes(section.id))
        expect(shown, path).toEqual(expected.map((section) => section.id))
        for (const section of expected) {
          const block = blocks.find((candidate) => candidate.block.id === section.block)?.block
          if (block === undefined) faults.push(`${path} ${id}/${section.id}: блока нет`)
          else
            faults.push(
              ...sectionFaults(html, plan, section.id, block).map((fault) => `${path} ${fault}`),
            )
        }
      }
    }
    expect(faults).toEqual([])
  })
})

// Маршрутам из контекста запроса нужны только параметры пути и пропсы getStaticPaths.
const get = (props: Record<string, unknown>) =>
  Promise.resolve(feed({ params: {}, props } as unknown as Parameters<typeof feed>[0]))

describe('фиды', () => {
  const links = (xml: string) =>
    [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map(([, link]) => link)

  it('фид — у каждой локали блога в карте: свои записи без черновика, свой язык и self-ссылка', async () => {
    const feeds = feedPaths()
    expect(feeds.map(({ params }) => params.locale)).toEqual([undefined, 'en'])
    const [ru, en] = await Promise.all(feeds.map(({ props }) => get(props)))
    const ruXml = (await ru?.text()) ?? ''
    expect(links(ruXml)).toEqual([
      `${ORIGIN}/blog/para`,
      `${ORIGIN}/blog/odna`,
      `${ORIGIN}/blog/zametka-4`,
      `${ORIGIN}/blog/zametka-3`,
      `${ORIGIN}/blog/zametka-2`,
      `${ORIGIN}/blog/zametka-1`,
    ])
    expect(ruXml).toContain('<language>ru</language>')
    expect(ruXml).toContain(`<atom:link href="${ORIGIN}/rss.xml" rel="self"`)

    const enXml = (await en?.text()) ?? ''
    expect(links(enXml)).toEqual([
      `${ORIGIN}/en/blog/pair`,
      `${ORIGIN}/en/blog/note-2`,
      `${ORIGIN}/en/blog/note-1`,
    ])
    expect(enXml).toContain('<language>en</language>')
    expect(enXml).toContain(`<atom:link href="${ORIGIN}/en/rss.xml" rel="self"`)

    expect(ru?.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
  })
})
