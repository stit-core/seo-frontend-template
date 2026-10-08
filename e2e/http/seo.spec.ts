import { expect, test } from '@playwright/test'
import { SITE_ORIGIN_PLACEHOLDER } from '../../src/shared/config/runtime.ts'
import { AI_BOTS_POLICY } from '../../src/shared/config/site.ts'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../src/shared/i18n/locale.ts'
import { E2E_INDEXNOW_KEY, entries, feedPaths, indexablePaths } from '../site'

const PLACEHOLDER = new URL(SITE_ORIGIN_PLACEHOLDER).hostname

const localeOf = (path: string) =>
  SUPPORTED_LOCALES.find((locale) => path === `/${locale}` || path.startsWith(`/${locale}/`)) ??
  DEFAULT_LOCALE

test.describe('robots.txt, sitemap.xml, фиды, IndexNow', () => {
  test('robots.txt прод-профиля: группа `*` открыта, абсолютный Sitemap, без мёртвых директив', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')
    expect(response.headers()['cache-control']).toBe('public, max-age=300')
    const body = await response.text()
    // Политика ИИ-ботов сайта закрывает только свою именную группу — между `*` и картой.
    expect(body.startsWith('User-agent: *\nAllow: /\n\n'), body).toBe(true)
    expect(body.endsWith(`\nSitemap: ${baseURL}/sitemap.xml\n`), body).toBe(true)
    if (AI_BOTS_POLICY === 'allow-all') expect(body).not.toContain('Disallow')
    expect(body).not.toMatch(/Host:|Crawl-delay:/)
  })

  // Карта и фиды — файлы сборки с плейсхолдером origin: сервер отдаёт их проштампованными, как
  // страницы, — со своим Cache-Control, ETag и без X-Robots-Tag.
  test('sitemap.xml: проштампованный файл сборки — ровно индексируемые страницы, все 200, lastmod — дата последнего изменения записи', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/xml')
    expect(response.headers()['cache-control']).toBe('public, max-age=0')
    expect(response.headers().etag).toBeTruthy()
    expect(response.headers()['x-robots-tag']).toBeUndefined()
    const xml = await response.text()
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).not.toMatch(/changefreq|priority/)
    expect(xml).not.toContain(PLACEHOLDER)

    const urls = [
      ...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g),
    ].map(([, loc = '', lastmod]) => ({ loc, lastmod }))
    for (const { loc } of urls) expect(loc.startsWith(`${baseURL}/`), loc).toBe(true)
    const paths = urls.map(({ loc }) => new URL(loc).pathname)
    expect([...paths].sort()).toEqual(indexablePaths())
    // lastmod — у каждой записи: дата правки, без правки — публикации; у остальных страниц его нет.
    const lastmod = Object.fromEntries(
      entries()
        .filter((entry) => !entry.draft)
        .map((entry) => [entry.path, entry.updated ?? entry.published]),
    )
    expect(
      Object.fromEntries(
        urls.filter((url) => url.lastmod).map((url) => [new URL(url.loc).pathname, url.lastmod]),
      ),
    ).toEqual(lastmod)
    for (const path of paths) expect((await request.get(path)).status(), path).toBe(200)
  })

  for (const path of feedPaths()) {
    test(`${path}: проштампованный файл сборки — RSS 2.0 с self-ссылкой, языком и живыми абсолютными ссылками`, async ({
      request,
      baseURL,
    }) => {
      const response = await request.get(path)
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('xml')
      expect(response.headers()['cache-control']).toBe('public, max-age=0')
      expect(response.headers().etag).toBeTruthy()
      expect(response.headers()['x-robots-tag']).toBeUndefined()
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
