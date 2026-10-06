import { expect, test } from '@playwright/test'
import { decode, type HeadTag, headTags } from '../../scripts/lib/html.mjs'
import { SITE_ORIGIN_PLACEHOLDER } from '../../src/shared/config/runtime.ts'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../src/shared/i18n/locale.ts'
import { E2E_INDEXNOW_KEY, entries, indexablePaths, onDemandRoutes } from '../site'

const PLACEHOLDER = new URL(SITE_ORIGIN_PLACEHOLDER).hostname

const meta = (tags: HeadTag[], property: string) =>
  tags.find((tag) => tag.property === property || tag.name === property)?.content
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    ([, json]) => JSON.parse(json ?? '') as Record<string, unknown>,
  )
const localeOf = (path: string) =>
  SUPPORTED_LOCALES.find((locale) => path === `/${locale}` || path.startsWith(`/${locale}/`)) ??
  DEFAULT_LOCALE

test.describe('robots.txt, sitemap.xml, фиды, IndexNow', () => {
  test('robots.txt прод-профиля: всё разрешено, абсолютный Sitemap, без мёртвых директив', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')
    expect(response.headers()['cache-control']).toBe('public, max-age=300')
    const body = await response.text()
    expect(body).toContain('User-agent: *\nAllow: /')
    expect(body).toContain(`Sitemap: ${baseURL}/sitemap.xml`)
    expect(body).not.toContain('Disallow: /')
    expect(body).not.toMatch(/Host:|Crawl-delay:|GPTBot|ClaudeBot/)
  })

  test('sitemap.xml: ровно индексируемые страницы сборки, все 200, lastmod только у правленых записей', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/xml')
    expect(response.headers()['x-robots-tag']).toBe('noindex')
    const xml = await response.text()
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).not.toMatch(/changefreq|priority/)

    const urls = [
      ...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g),
    ].map(([, loc = '', lastmod]) => ({ loc, lastmod }))
    for (const { loc } of urls) expect(loc.startsWith(`${baseURL}/`), loc).toBe(true)
    const paths = urls.map(({ loc }) => new URL(loc).pathname)
    expect([...paths].sort()).toEqual(indexablePaths())
    // lastmod — только честная дата правки записи (updatedDate), у остальных его нет.
    const lastmod = Object.fromEntries(
      entries()
        .filter((entry) => !entry.draft && entry.updated !== undefined)
        .map((entry) => [entry.path, entry.updated]),
    )
    expect(
      Object.fromEntries(
        urls.filter((url) => url.lastmod).map((url) => [new URL(url.loc).pathname, url.lastmod]),
      ),
    ).toEqual(lastmod)
    for (const path of paths) expect((await request.get(path)).status(), path).toBe(200)
  })

  for (const path of onDemandRoutes().filter((route) => route.endsWith('/rss.xml'))) {
    test(`${path}: RSS 2.0 с self-ссылкой, языком и живыми абсолютными ссылками`, async ({
      request,
      baseURL,
    }) => {
      const response = await request.get(path)
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('application/rss+xml')
      expect(response.headers()['cache-control']).toBe('public, max-age=600')
      const xml = await response.text()
      expect(xml).toContain('<rss version="2.0"')
      expect(xml).toContain(
        `<atom:link href="${baseURL}${path}" rel="self" type="application/rss+xml"/>`,
      )
      expect(xml).toContain(`<language>${localeOf(path)}</language>`)
      expect(xml).toContain('<guid isPermaLink="true">')
      expect(xml).not.toContain(PLACEHOLDER)
      const links = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map(
        ([, link]) => link,
      )
      expect(links.length).toBeGreaterThan(0)
      expect(links.length).toBeLessThanOrEqual(20)
      const drafts = new Set(
        entries()
          .filter((entry) => entry.draft)
          .map((entry) => entry.path),
      )
      for (const link of links) {
        const linkPath = new URL(link ?? '').pathname
        expect(link?.startsWith(`${baseURL}/`), link).toBe(true)
        expect(localeOf(linkPath), link).toBe(localeOf(path))
        expect(drafts.has(linkPath), link).toBe(false)
        expect((await request.get(linkPath)).status(), link).toBe(200)
      }
    })
  }

  test('ключ IndexNow: /<ключ>.txt с ключом внутри; чужое имя — plain-text 404 с noindex', async ({
    request,
  }) => {
    const key = await request.get(`/${E2E_INDEXNOW_KEY}.txt`)
    expect(key.status()).toBe(200)
    expect(key.headers()['content-type']).toContain('text/plain')
    expect(key.headers()['x-robots-tag']).toBe('noindex')
    expect(await key.text()).toBe(E2E_INDEXNOW_KEY)
    const missing = await request.get('/another-key-0123456789.txt')
    expect(missing.status()).toBe(404)
    expect(missing.headers()['content-type']).toContain('text/plain')
    expect(missing.headers()['x-robots-tag']).toBe('noindex')
    expect((await request.get('/robots.txt')).status()).toBe(200)
  })
})

test.describe('запись с переводом: разметка соответствует видимому', () => {
  const published = entries().filter((entry) => !entry.draft)
  const twins = published.filter(
    (entry) =>
      published.filter((other) => other.translationKey === entry.translationKey).length > 1,
  )

  test('hreflang взаимный, даты статьи, BlogPosting про эту страницу, крошки = BreadcrumbList', async ({
    request,
    baseURL,
  }) => {
    test.skip(twins.length === 0, 'в контенте нет записи с переводом')
    const [entry] = twins
    if (!entry) return
    const html = await (await request.get(entry.path)).text()
    const tags = headTags(html)
    const canonical = `${baseURL}${entry.path}`
    expect(tags.find((tag) => tag.rel === 'canonical')?.href).toBe(canonical)
    const pair = twins.filter((twin) => twin.translationKey === entry.translationKey)
    expect(
      Object.fromEntries(
        tags
          .filter((tag) => tag.rel === 'alternate' && tag.hreflang !== undefined)
          .map((tag) => [tag.hreflang, tag.href]),
      ),
    ).toEqual({
      ...Object.fromEntries(pair.map((twin) => [twin.locale, `${baseURL}${twin.path}`])),
      'x-default': `${baseURL}${pair.find((twin) => twin.locale === DEFAULT_LOCALE)?.path}`,
    })

    expect(meta(tags, 'og:type')).toBe('article')
    expect(meta(tags, 'article:published_time')).toBe(entry.published)
    expect(meta(tags, 'article:modified_time')).toBe(entry.updated)

    const [posting, crumbs] = jsonLd(html)
    expect(posting?.['@type']).toBe('BlogPosting')
    expect(posting?.headline).toBe(decode(/<h1[^>]*>([^<]+)<\/h1>/.exec(html)?.[1] ?? ''))
    expect(posting?.datePublished).toBe(entry.published)
    expect(posting?.mainEntityOfPage).toEqual({ '@type': 'WebPage', '@id': canonical })
    if (posting?.image !== undefined) expect(posting.image).toBe(meta(tags, 'og:image'))

    // Видимые крошки и BreadcrumbList — один массив: имена и адреса совпадают.
    const items = (crumbs?.itemListElement ?? []) as Array<{ name: string; item?: string }>
    const nav = /<nav[^>]*>\s*<ol[\s\S]*?<\/ol>/.exec(html)?.[0] ?? ''
    const visible = [...nav.matchAll(/<(a href="([^"]+)"|span aria-current="page")>([^<]+)</g)].map(
      ([, , href, name = '']) => ({
        name: decode(name),
        ...(href ? { item: `${baseURL}${href}` } : {}),
      }),
    )
    expect(items.map(({ name, item }) => ({ name, ...(item ? { item } : {}) }))).toEqual(visible)
  })
})
