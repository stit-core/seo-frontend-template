import type { GetStaticPathsResult } from 'astro'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import type * as AuthorSlice from '@/entities/author'
import { SITE_NAME } from '@/shared/config'
import { parseHtml } from '@/shared/lib/testing'
import { headTags } from '../../../scripts/lib/html.mjs'
import NotFound from '../404.astro'
import ServerError from '../500.astro'
import About from '../about.astro'
import * as PostRu from '../blog/[slug].astro'
import Blog from '../blog/index.astro'
import * as ListRu from '../blog/page/[page].astro'
import * as TagRu from '../blog/tag/[tag].astro'
import Contacts from '../contacts/index.astro'
import Thanks from '../contacts/spasibo.astro'
import AboutEn from '../en/about.astro'
import * as PostEn from '../en/blog/[slug].astro'
import BlogEn from '../en/blog/index.astro'
import * as ListEn from '../en/blog/page/[page].astro'
import * as TagEn from '../en/blog/tag/[tag].astro'
import ContactsEn from '../en/contacts/index.astro'
import ThanksEn from '../en/contacts/spasibo.astro'
import HomeEn from '../en/index.astro'
import Home from '../index.astro'
import Privacy from '../legal/privacy.astro'
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
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(
    ([, json]) => JSON.parse(json ?? '') as Record<string, unknown>,
  )
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
  }
}

const localeOf = (path: string) => (/^\/en(\/|$)/.test(path) ? 'en' : 'ru')
const pair = (ru: string, en: string) => ({
  ru: `${ORIGIN}${ru}`,
  en: `${ORIGIN}${en}`,
  'x-default': `${ORIGIN}${ru}`,
})

describe('индексируемые страницы', () => {
  it.each<[string, AstroComponentFactory, Record<string, string>, string[]]>([
    ['/', Home, pair('/', '/en'), ['Organization', 'WebSite']],
    ['/en', HomeEn, pair('/', '/en'), ['Organization']],
    ['/about', About, pair('/about', '/en/about'), ['LocalBusiness', 'BreadcrumbList']],
    ['/en/about', AboutEn, pair('/about', '/en/about'), ['LocalBusiness', 'BreadcrumbList']],
    ['/contacts', Contacts, pair('/contacts', '/en/contacts'), ['BreadcrumbList']],
    ['/en/contacts', ContactsEn, pair('/contacts', '/en/contacts'), ['BreadcrumbList']],
    ['/legal/privacy', Privacy, {}, ['BreadcrumbList']],
    ['/blog', Blog, pair('/blog', '/en/blog'), ['BreadcrumbList']],
    ['/en/blog', BlogEn, pair('/blog', '/en/blog'), ['BreadcrumbList']],
  ])(
    '%s: язык, self-canonical, hreflang пары, JSON-LD и один h1',
    async (path, page, hreflang, jsonLd) => {
      const head = await render(page, path)
      expect(head.lang).toBe(localeOf(path))
      expect(head.canonical).toBe(`${ORIGIN}${path}`)
      expect(head.robots).toBeUndefined()
      expect(head.hreflang).toEqual(hreflang)
      expect(head.jsonLd).toEqual(jsonLd)
      expect(head.h1).toBe(1)
    },
  )
})

describe('служебные страницы', () => {
  it.each<[string, AstroComponentFactory]>([
    ['/contacts/spasibo', Thanks],
    ['/en/contacts/spasibo', ThanksEn],
    ['/net-takoj-stranicy', NotFound],
    ['/500', ServerError],
  ])('%s: только noindex — без canonical, hreflang и разметки', async (path, page) => {
    const head = await render(page, path)
    expect(head.lang).toBe(localeOf(path))
    expect(head.robots).toBe('noindex')
    expect(head.canonical).toBeUndefined()
    expect(head.hreflang).toEqual({})
    expect(head.jsonLd).toEqual([])
    expect(head.h1).toBe(1)
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
  })
})

// Плоский TS видит у модуля .astro только default (src/env.d.ts); маршрут с параметрами
// экспортирует ещё getStaticPaths.
interface DynamicRoute {
  default: AstroComponentFactory
  getStaticPaths: () => Promise<GetStaticPathsResult>
}

describe('маршруты с параметрами', () => {
  it.each<[string, { default: AstroComponentFactory }, string[]]>([
    [
      '/blog/[slug]',
      PostRu,
      [
        '/blog/para',
        '/blog/odna',
        '/blog/zametka-4',
        '/blog/zametka-3',
        '/blog/zametka-2',
        '/blog/zametka-1',
      ],
    ],
    ['/en/blog/[slug]', PostEn, ['/en/blog/pair']],
    ['/blog/tag/[tag]', TagRu, ['/blog/tag/astro', '/blog/tag/seo']],
    ['/en/blog/tag/[tag]', TagEn, ['/en/blog/tag/seo']],
    ['/blog/page/[page]', ListRu, ['/blog/page/2']],
    ['/en/blog/page/[page]', ListEn, []],
  ])(
    '%s: адреса своей локали без черновиков, каждый — своя страница',
    async (route, module, expected) => {
      const { default: page, getStaticPaths } = module as DynamicRoute
      const pages = (await getStaticPaths()).map(({ params, props }) => ({
        path: route.replace(/\[(\w+)\]/, (_, key: string) => params[key] ?? ''),
        props: props ?? {},
      }))
      expect(pages.map(({ path }) => path)).toEqual(expected)
      for (const { path, props } of pages) {
        const head = await render(page, path, props)
        expect(head.lang, path).toBe(localeOf(path))
        expect(head.canonical, path).toBe(`${ORIGIN}${path}`)
        expect(head.h1, path).toBe(1)
      }
    },
  )

  it('запись с переводом: hreflang пары, BlogPosting и тело записи', async () => {
    const [first] = await (PostRu as DynamicRoute).getStaticPaths()
    const head = await render(PostRu.default, '/blog/para', first?.props)
    expect(head.hreflang).toEqual(pair('/blog/para', '/en/blog/pair'))
    expect(head.jsonLd).toEqual(['BlogPosting', 'BreadcrumbList'])
    const paragraphs = [...parseHtml(head.html).querySelectorAll('article p')]
    expect(paragraphs.map((paragraph) => paragraph.textContent)).toContain('Тело записи.')
  })

  // Разметка = видимое: Person печатается только вместе с подписью, теми же строками.
  it('автор записи: подпись в шапке статьи и Person с тем же именем; @id один на обе локали', async () => {
    const page = async (module: { default: AstroComponentFactory }, path: string) => {
      const paths = await (module as DynamicRoute).getStaticPaths()
      const found = paths.find(({ params }) => path.endsWith(`/${params.slug ?? ''}`))
      const head = await render(module.default, path, found?.props)
      const header = parseHtml(head.html).querySelector('article header')
      return {
        author: head.blocks.find((block) => block['@type'] === 'BlogPosting')?.author,
        header: header?.textContent?.replace(/\s+/g, ' ') ?? '',
      }
    }
    const id = `${ORIGIN}/#author-anna-smirnova`

    const ru = await page(PostRu, '/blog/para')
    expect(ru.author).toEqual({
      '@type': 'Person',
      '@id': id,
      name: 'Анна Смирнова',
      jobTitle: 'редактор блога',
    })
    expect(ru.header).toContain('Автор — Анна Смирнова, редактор блога')

    const en = await page(PostEn, '/en/blog/pair')
    expect(en.author).toEqual({
      '@type': 'Person',
      '@id': id,
      name: 'Anna Smirnova',
      jobTitle: 'blog editor',
    })
    expect(en.header).toContain('By Anna Smirnova, blog editor')

    const plain = await page(PostRu, '/blog/zametka-1')
    expect(plain.author).toEqual({
      '@type': 'Organization',
      '@id': `${ORIGIN}/#org`,
      name: SITE_NAME,
    })
    expect(plain.header).not.toContain('Автор')
  })
})
