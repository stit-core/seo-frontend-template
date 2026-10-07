import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { SITE_VERIFICATION } from '@/shared/config'
import SeoHead from './seo-head.astro'

const ORIGIN = 'https://demo.example'

// Теги <head> — по имени/свойству, чтобы не зависеть от порядка атрибутов в разметке.
const tag = (html: string, needle: string) =>
  html.match(new RegExp(`<(?:meta|link)\\b[^>]*\\b${needle}[^>]*>`, 'g')) ?? []

async function render(path: string, props: Record<string, unknown>): Promise<string> {
  vi.stubEnv('SITE_URL', ORIGIN)
  const container = await AstroContainer.create()
  return container.renderToString(SeoHead, { props, request: new Request(`${ORIGIN}${path}`) })
}

const base = { title: 'Запись', description: 'Описание записи для сниппета.', locale: 'ru' }

describe('SeoHead', () => {
  afterEach(() => vi.unstubAllEnvs())

  // /de-template ставит токены в site.ts: теги с ними проходят typecheck, только если поля — string.
  it('токены подтверждения домена — строки, а не литералы умолчания', () => {
    expectTypeOf<typeof SITE_VERIFICATION>().toEqualTypeOf<{
      readonly google: string
      readonly yandex: string
    }>()
  })

  it('индексируемая страница: title-шаблон, self-canonical, OG с дефолтной картинкой, twitter:card', async () => {
    const html = await render('/blog/x', base)
    expect(html).toContain('<title>Запись — ssr-frontend-template</title>')
    expect(html).toContain('<meta name="description" content="Описание записи для сниппета.">')
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/blog/x">`)
    expect(html).not.toContain('name="robots"')
    expect(html).not.toContain('hreflang=')
    expect(html).toContain('<meta property="og:type" content="website">')
    expect(html).toContain('<meta property="og:title" content="Запись — ssr-frontend-template">')
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/blog/x">`)
    expect(html).toContain('<meta property="og:site_name" content="ssr-frontend-template">')
    expect(html).toContain('<meta property="og:locale" content="ru_RU">')
    expect(html).not.toContain('og:locale:alternate')
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/og-default.png">`)
    expect(html).toContain('<meta property="og:image:width" content="1200">')
    expect(html).toContain('<meta property="og:image:height" content="630">')
    expect(tag(html, 'property="og:image:alt"')).toHaveLength(1)
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).toContain(
      `<link rel="alternate" type="application/rss+xml" title="Блог — ssr-frontend-template" href="${ORIGIN}/rss.xml">`,
    )
    expect(html).not.toContain('keywords')
  })

  it('перевод есть: hreflang взаимный с self и x-default, og:locale:alternate', async () => {
    const html = await render('/en/blog/x', { ...base, locale: 'en', alternatePath: '/blog/y' })
    expect(tag(html, 'hreflang=')).toEqual([
      `<link rel="alternate" hreflang="ru" href="${ORIGIN}/blog/y">`,
      `<link rel="alternate" hreflang="en" href="${ORIGIN}/en/blog/x">`,
      `<link rel="alternate" hreflang="x-default" href="${ORIGIN}/blog/y">`,
    ])
    expect(html).toContain('<meta property="og:locale" content="en_US">')
    expect(html).toContain('<meta property="og:locale:alternate" content="ru_RU">')
    expect(html).toContain(`href="${ORIGIN}/en/rss.xml"`)
  })

  it('корень: canonical со слешем', async () => {
    const html = await render('/', { ...base, alternatePath: '/' })
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/">`)
    expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">`)
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${ORIGIN}/en">`)
  })

  it('запись: og:type article, обложка и даты', async () => {
    const html = await render('/blog/x', {
      ...base,
      ogType: 'article',
      ogImage: { path: '/_astro/cover.abc.png', width: 1600, height: 900, alt: 'Обложка' },
      article: { published: new Date('2026-09-08'), modified: new Date('2026-09-10') },
    })
    expect(html).toContain('<meta property="og:type" content="article">')
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/_astro/cover.abc.png">`)
    expect(html).toContain('<meta property="og:image:width" content="1600">')
    expect(html).toContain('<meta property="og:image:alt" content="Обложка">')
    expect(html).toContain('<meta property="article:published_time" content="2026-09-08">')
    expect(html).toContain('<meta property="article:modified_time" content="2026-09-10">')
  })

  it('служебная страница: только noindex — без canonical, OG и hreflang', async () => {
    const html = await render('/xx', { ...base, noindex: true, alternatePath: '/' })
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).not.toMatch(/canonical|og:|hreflang=|twitter:card/)
    expect(html).toContain('<title>Запись — ssr-frontend-template</title>')
  })
})
