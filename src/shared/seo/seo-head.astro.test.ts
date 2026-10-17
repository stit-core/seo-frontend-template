import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as SharedConfig from '@/shared/config'
import { SITE_NAME, type SITE_VERIFICATION } from '@/shared/config'
import { t } from '@/shared/i18n'
import { parseHtml, testLocale } from '@/shared/lib/testing'
import SeoHead from './seo-head.astro'

// Локали теста — ru, en и de: версия страницы может быть на каждой.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)

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

// Мета страницы — copy deck как есть: заголовок strategy уже с брендом, суффикса оболочка не ставит.
const meta = { title: 'Запись о сниппете — Бренд', description: 'Описание записи для сниппета.' }
const base = { meta, locale: 'ru' }

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

  it('индексируемая страница: title и description — мета как есть, self-canonical, OG с дефолтной картинкой, twitter:card', async () => {
    const doc = await render('/blog/x', base)
    expect(doc.title).toBe('Запись о сниппете — Бренд')
    expect(content(doc, 'name="description"')).toBe('Описание записи для сниппета.')
    expect(href(doc, 'rel="canonical"')).toBe(`${ORIGIN}/blog/x`)
    expect(doc.querySelector('meta[name="robots"]')).toBeNull()
    expect(hreflang(doc)).toEqual([])
    expect(og(doc)).toMatchObject({
      'og:type': 'website',
      'og:title': 'Запись о сниппете — Бренд',
      'og:description': 'Описание записи для сниппета.',
      'og:url': `${ORIGIN}/blog/x`,
      'og:site_name': SITE_NAME,
      'og:locale': 'ru_RU',
      'og:image': `${ORIGIN}/og-default.png`,
      'og:image:width': '1200',
      'og:image:height': '630',
    })
    expect(og(doc)['og:image:alt']).toBeTruthy()
    expect(og(doc)).not.toHaveProperty('og:locale:alternate')
    expect(content(doc, 'name="twitter:card"')).toBe('summary_large_image')
    expect(doc.querySelector('link[type="application/rss+xml"]')).toBeNull()
    expect(doc.querySelector('meta[name="keywords"]')).toBeNull()
  })

  it('тексты превью ссылки — свои у copy deck: og:title и og:description, а <title> и description — мета', async () => {
    const doc = await render('/blog/x', {
      ...base,
      meta: {
        ...meta,
        ogTitle: 'Запись о сниппете',
        ogDescription: 'Что получит читатель по ссылке.',
      },
    })
    expect(doc.title).toBe('Запись о сниппете — Бренд')
    expect(content(doc, 'name="description"')).toBe('Описание записи для сниппета.')
    expect(og(doc)).toMatchObject({
      'og:title': 'Запись о сниппете',
      'og:description': 'Что получит читатель по ссылке.',
    })
  })

  it('фид языка страницы: автообнаружение — его абсолютный адрес и имя блога с брендом', async () => {
    const doc = await render('/en/blog/x', { ...base, locale: 'en', feed: '/en/rss.xml' })
    const feed = doc.querySelector('link[type="application/rss+xml"]')
    expect(['rel', 'title', 'href'].map((name) => feed?.getAttribute(name))).toEqual([
      'alternate',
      t(testLocale('en'), 'blog.feed', { site: SITE_NAME }),
      `${ORIGIN}/en/rss.xml`,
    ])
  })

  it('переводы есть: hreflang по карте переводов с self и x-default, og:locale:alternate каждой другой версии', async () => {
    const doc = await render('/en/blog/x', {
      ...base,
      locale: 'en',
      translations: { ru: '/blog/y', en: '/en/blog/x', de: '/de/blog/z' },
    })
    expect(hreflang(doc)).toEqual([
      ['ru', `${ORIGIN}/blog/y`],
      ['en', `${ORIGIN}/en/blog/x`],
      ['de', `${ORIGIN}/de/blog/z`],
      ['x-default', `${ORIGIN}/blog/y`],
    ])
    expect(og(doc)['og:locale']).toBe('en_US')
    expect(
      [...doc.querySelectorAll('meta[property="og:locale:alternate"]')].map((meta) =>
        meta.getAttribute('content'),
      ),
    ).toEqual(['ru_RU', 'de_DE'])
  })

  it('корень: canonical со слешем', async () => {
    const doc = await render('/', { ...base, translations: { ru: '/', en: '/en' } })
    expect(href(doc, 'rel="canonical"')).toBe(`${ORIGIN}/`)
    expect(hreflang(doc)).toEqual([
      ['ru', `${ORIGIN}/`],
      ['en', `${ORIGIN}/en`],
      ['x-default', `${ORIGIN}/`],
    ])
  })

  // Тип OG — от типа страницы: даты записи коллекции делают её статьёй, отдельного пропа типа нет.
  it('запись: og:type article по датам записи, обложка и даты', async () => {
    const doc = await render('/blog/x', {
      ...base,
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
    const doc = await render('/xx', {
      ...base,
      noindex: true,
      translations: { ru: '/', en: '/en' },
    })
    expect(content(doc, 'name="robots"')).toBe('noindex')
    expect(doc.querySelector('link[rel="canonical"], link[hreflang]')).toBeNull()
    expect(og(doc)).toEqual({})
    expect(doc.querySelector('meta[name="twitter:card"]')).toBeNull()
    expect(doc.title).toBe('Запись о сниппете — Бренд')
  })
})
