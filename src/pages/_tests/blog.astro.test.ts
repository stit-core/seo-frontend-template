import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import type * as AuthorSlice from '@/entities/author'
import { SITE_NAME } from '@/shared/config'
import { t } from '@/shared/i18n'
import { parseHtml, testLocale } from '@/shared/lib/testing'
import { breadcrumbsOn } from '@/shared/strategy'
import { headTags, jsonLdBlocks } from '../../../scripts/lib/html.mjs'
import * as Post from '../[...locale]/blog/[slug].astro'
import * as List from '../[...locale]/blog/page/[page].astro'
import * as Tag from '../[...locale]/blog/tag/[tag].astro'
import { GET as feed, getStaticPaths as feedPaths } from '../[...locale]/rss.xml.ts'
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
    expect(crumbsOf(head.html, head.blocks).visible).toEqual([
      [t(RU, 'nav.home'), '/'],
      [t(RU, 'blog.title'), '/blog'],
      ['Запись с переводом', undefined],
    ])
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
    expect(ru.header).toContain(`${t(RU, 'author.by')} Анна Смирнова, редактор блога`)

    const en = await post('/en/blog/pair')
    expect(en.author).toEqual({
      '@type': 'Person',
      '@id': id,
      name: 'Anna Smirnova',
      jobTitle: 'blog editor',
    })
    expect(en.header).toContain(`${t(EN, 'author.by')} Anna Smirnova, blog editor`)

    const plain = await post('/blog/zametka-1')
    expect(plain.author).toEqual({
      '@type': 'Organization',
      '@id': `${ORIGIN}/#org`,
      name: SITE_NAME,
    })
    expect(plain.header).not.toContain(t(RU, 'author.by'))
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
