import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as SharedConfig from '@/shared/config'
import type { SITE_VERIFICATION } from '@/shared/config'
import { parseHtml } from '@/shared/lib/testing'
import SeoHead from './seo-head.astro'

const ORIGIN = 'https://demo.example'

// Политика ИИ-ботов — поле сборки: значение проекта подставляет /de-template, тест — здесь.
const { site } = vi.hoisted(() => ({ site: { aiBots: 'allow-all' } }))

vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedConfig>()),
  get AI_BOTS_POLICY() {
    return site.aiBots
  },
}))

async function render(path: string, props: Record<string, unknown>) {
  vi.stubEnv('SITE_URL', ORIGIN)
  const container = await AstroContainer.create()
  return parseHtml(
    await container.renderToString(SeoHead, { props, request: new Request(`${ORIGIN}${path}`) }),
  )
}

type Doc = Awaited<ReturnType<typeof render>>

// Теги <head> — элементами, а не строками: порядок и состав атрибутов разметки не важны.
const content = (doc: Doc, key: string) =>
  doc.querySelector(`meta[${key}]`)?.getAttribute('content')
const href = (doc: Doc, key: string) => doc.querySelector(`link[${key}]`)?.getAttribute('href')
const og = (doc: Doc) =>
  Object.fromEntries(
    [...doc.querySelectorAll('meta[property^="og:"]')].map((meta): [string, string | null] => [
      meta.getAttribute('property') ?? '',
      meta.getAttribute('content'),
    ]),
  )
const hreflang = (doc: Doc) =>
  [...doc.querySelectorAll('link[hreflang]')].map((link) => [
    link.getAttribute('hreflang'),
    link.getAttribute('href'),
  ])

const base = { title: 'Запись', description: 'Описание записи для сниппета.', locale: 'ru' }

describe('SeoHead', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    site.aiBots = 'allow-all'
  })

  // /de-template ставит токены в site.ts: теги с ними проходят typecheck, только если поля — string.
  it('токены подтверждения домена — строки, а не литералы умолчания', () => {
    expectTypeOf<typeof SITE_VERIFICATION>().toEqualTypeOf<{
      readonly google: string
      readonly yandex: string
    }>()
  })

  it('индексируемая страница: title-шаблон, self-canonical, OG с дефолтной картинкой, twitter:card', async () => {
    const doc = await render('/blog/x', base)
    expect(doc.title).toBe('Запись — ssr-frontend-template')
    expect(content(doc, 'name="description"')).toBe('Описание записи для сниппета.')
    expect(href(doc, 'rel="canonical"')).toBe(`${ORIGIN}/blog/x`)
    expect(doc.querySelector('meta[name="robots"]')).toBeNull()
    expect(hreflang(doc)).toEqual([])
    expect(og(doc)).toMatchObject({
      'og:type': 'website',
      'og:title': 'Запись — ssr-frontend-template',
      'og:url': `${ORIGIN}/blog/x`,
      'og:site_name': 'ssr-frontend-template',
      'og:locale': 'ru_RU',
      'og:image': `${ORIGIN}/og-default.png`,
      'og:image:width': '1200',
      'og:image:height': '630',
    })
    expect(og(doc)['og:image:alt']).toBeTruthy()
    expect(og(doc)).not.toHaveProperty('og:locale:alternate')
    expect(content(doc, 'name="twitter:card"')).toBe('summary_large_image')
    const feed = doc.querySelector('link[type="application/rss+xml"]')
    expect(['rel', 'title', 'href'].map((name) => feed?.getAttribute(name))).toEqual([
      'alternate',
      'Блог — ssr-frontend-template',
      `${ORIGIN}/rss.xml`,
    ])
    expect(doc.querySelector('meta[name="keywords"]')).toBeNull()
  })

  it('перевод есть: hreflang взаимный с self и x-default, og:locale:alternate', async () => {
    const doc = await render('/en/blog/x', { ...base, locale: 'en', alternatePath: '/blog/y' })
    expect(hreflang(doc)).toEqual([
      ['ru', `${ORIGIN}/blog/y`],
      ['en', `${ORIGIN}/en/blog/x`],
      ['x-default', `${ORIGIN}/blog/y`],
    ])
    expect(og(doc)).toMatchObject({ 'og:locale': 'en_US', 'og:locale:alternate': 'ru_RU' })
    expect(href(doc, 'type="application/rss+xml"')).toBe(`${ORIGIN}/en/rss.xml`)
  })

  it('корень: canonical со слешем', async () => {
    const doc = await render('/', { ...base, alternatePath: '/' })
    expect(href(doc, 'rel="canonical"')).toBe(`${ORIGIN}/`)
    expect(hreflang(doc)).toEqual([
      ['ru', `${ORIGIN}/`],
      ['en', `${ORIGIN}/en`],
      ['x-default', `${ORIGIN}/`],
    ])
  })

  it('запись: og:type article, обложка и даты', async () => {
    const doc = await render('/blog/x', {
      ...base,
      ogType: 'article',
      ogImage: { path: '/_astro/cover.abc_og.jpg', width: 1200, height: 630, alt: 'Обложка' },
      article: { published: new Date('2026-09-08'), modified: new Date('2026-09-10') },
    })
    expect(og(doc)).toMatchObject({
      'og:type': 'article',
      'og:image': `${ORIGIN}/_astro/cover.abc_og.jpg`,
      'og:image:width': '1200',
      'og:image:alt': 'Обложка',
    })
    expect(content(doc, 'property="article:published_time"')).toBe('2026-09-08')
    expect(content(doc, 'property="article:modified_time"')).toBe('2026-09-10')
  })

  // Мета политики — про индексируемую страницу: служебную целиком закрывает noindex.
  it('политика ИИ-ботов deny-all: мета bingbot и applebot — только на индексируемой странице', async () => {
    const aiMeta = (doc: Doc) =>
      [...doc.querySelectorAll('meta[name="bingbot"], meta[name="applebot"]')].map((meta) => [
        meta.getAttribute('name'),
        meta.getAttribute('content'),
      ])
    site.aiBots = 'deny-all'
    const doc = await render('/blog/x', base)
    expect(aiMeta(doc)).toEqual([
      ['bingbot', 'noarchive'],
      ['applebot', 'nosnippet'],
    ])
    expect(doc.querySelector('meta[name="robots"]')).toBeNull()
    expect(aiMeta(await render('/xx', { ...base, noindex: true }))).toEqual([])

    for (const policy of ['allow-all', 'allow-search-deny-training']) {
      site.aiBots = policy
      expect(aiMeta(await render('/blog/x', base)), policy).toEqual([])
    }
  })

  it('служебная страница: только noindex — без canonical, OG и hreflang', async () => {
    const doc = await render('/xx', { ...base, noindex: true, alternatePath: '/' })
    expect(content(doc, 'name="robots"')).toBe('noindex')
    expect(doc.querySelector('link[rel="canonical"], link[hreflang]')).toBeNull()
    expect(og(doc)).toEqual({})
    expect(doc.querySelector('meta[name="twitter:card"]')).toBeNull()
    expect(doc.title).toBe('Запись — ssr-frontend-template')
  })
})
