import { expect, test } from '@playwright/test'
import { type HeadTag, headTags } from '../scripts/lib/html.mjs'
import { E2E_INDEXNOW_KEY, prerenderedPaths } from './site'

// Slug'и reference-контента (src/entities/post/content). /de-template заменит вместе с ним.
const POST = { ru: '/blog/chestnye-404-i-410', en: '/en/blog/honest-404-and-410' }
const UNTRANSLATED = '/blog/kartinki-avif-webp'
const NO_COVER = '/blog/prerender-po-umolchaniyu'
const UPDATED = { path: '/blog/odin-obraz-na-vse-sredy', lastmod: '2026-09-10' }
const DRAFT = 'redirekty-kak-dannye'
const NOT_IN_SITEMAP = ['/now', '/healthz', '/old', '/blog/staraya-zametka', '/rss.xml', DRAFT]
// Googlebot качает первые 2 МБ и молча обрезает остальное; потолок шаблона сильно ниже.
const HTML_SIZE_LIMIT = 300_000

const GOOGLEBOT = {
  'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}

const meta = (tags: HeadTag[], name: string) => tags.find((tag) => tag.name === name)?.content
const og = (tags: HeadTag[], property: string) =>
  tags.find((tag) => tag.property === property)?.content
const canonical = (tags: HeadTag[]) => tags.find((tag) => tag.rel === 'canonical')?.href
const hreflang = (tags: HeadTag[]): Record<string, string> =>
  Object.fromEntries(
    tags
      .filter((tag) => tag.rel === 'alternate' && tag.hreflang !== undefined)
      .map((tag): [string, string] => [tag.hreflang ?? '', tag.href ?? '']),
  )
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1] ?? '') as Record<string, unknown>,
  )
const bodyOf = (html: string) => html.slice(html.indexOf('<body'))

test.describe('SEO: сырой HTML, как его видит краулер', () => {
  test('главная: title, description, self-canonical, hreflang взаимный с /en, OG, Organization + WebSite', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get('/', { headers: GOOGLEBOT })
    expect(response.status()).toBe(200)
    const html = await response.text()
    const tags = headTags(html)
    expect(html).toMatch(/<title>[^<]{10,}<\/title>/)
    expect(meta(tags, 'description')).toBeTruthy()
    expect(canonical(tags)).toBe(`${baseURL}/`)
    const expectedAlternates = {
      ru: `${baseURL}/`,
      en: `${baseURL}/en`,
      'x-default': `${baseURL}/`,
    }
    expect(hreflang(tags)).toEqual(expectedAlternates)
    const en = headTags(await (await request.get('/en')).text())
    expect(canonical(en)).toBe(`${baseURL}/en`)
    expect(hreflang(en)).toEqual(expectedAlternates)

    expect(og(tags, 'og:type')).toBe('website')
    expect(og(tags, 'og:title')).toBe(/<title>([^<]*)<\/title>/.exec(html)?.[1])
    expect(og(tags, 'og:url')).toBe(`${baseURL}/`)
    expect(og(tags, 'og:locale')).toBe('ru_RU')
    expect(og(tags, 'og:locale:alternate')).toBe('en_US')
    expect(og(tags, 'og:image')).toBe(`${baseURL}/og-default.png`)
    expect(og(tags, 'og:image:width')).toBe('1200')
    expect(og(tags, 'og:image:height')).toBe('630')
    expect(og(tags, 'og:image:alt')).toBeTruthy()
    expect(meta(tags, 'twitter:card')).toBe('summary_large_image')
    const image = await request.get('/og-default.png')
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toContain('image/png')

    const blocks = jsonLd(html)
    expect(blocks.map((block) => block['@type'])).toEqual(['Organization', 'WebSite'])
    for (const block of blocks) {
      expect(block['@context']).toBe('https://schema.org')
      expect(block.url).toBe(`${baseURL}/`)
    }
    expect(jsonLd(await (await request.get('/en')).text()).map((block) => block['@type'])).toEqual([
      'Organization',
    ])
    // Бот получает полный документ: h1 в первом HTML, документ закрыт.
    expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/)
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
  })

  test('запись с переводом: hreflang взаимный, og:type article, BlogPosting + BreadcrumbList в <head>', async ({
    request,
    baseURL,
  }) => {
    const html = await (await request.get(POST.ru, { headers: GOOGLEBOT })).text()
    const tags = headTags(html)
    const expectedAlternates = {
      ru: `${baseURL}${POST.ru}`,
      en: `${baseURL}${POST.en}`,
      'x-default': `${baseURL}${POST.ru}`,
    }
    expect(canonical(tags)).toBe(`${baseURL}${POST.ru}`)
    expect(hreflang(tags)).toEqual(expectedAlternates)
    const en = headTags(await (await request.get(POST.en)).text())
    expect(canonical(en)).toBe(`${baseURL}${POST.en}`)
    expect(hreflang(en)).toEqual(expectedAlternates)
    expect(og(en, 'og:locale')).toBe('en_US')

    expect(og(tags, 'og:type')).toBe('article')
    expect(og(tags, 'article:published_time')).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const blocks = jsonLd(html)
    expect(blocks.map((block) => block['@type'])).toEqual(['BlogPosting', 'BreadcrumbList'])
    const posting = blocks[0] ?? {}
    expect(posting.headline).toBe(/<h1[^>]*>([^<]+)<\/h1>/.exec(html)?.[1])
    expect(posting.mainEntityOfPage).toEqual({ '@type': 'WebPage', '@id': `${baseURL}${POST.ru}` })
    const crumbs = (blocks[1]?.itemListElement ?? []) as Array<Record<string, unknown>>
    expect(crumbs.map((crumb) => crumb.item)).toEqual([`${baseURL}/`, `${baseURL}/blog`, undefined])
    // Видимые крошки — из того же массива; data block только в <head>: в <body> ни одного <script>.
    expect(html).toContain('<a href="/blog">Блог</a>')
    expect(html).toMatch(/<span aria-current="page">[^<]+<\/span>/)
    expect(bodyOf(html)).not.toContain('<script')
  })

  test('запись с обложкой: og:image — исходный PNG обложки с её размерами, immutable, он же image в BlogPosting', async ({
    request,
    baseURL,
  }) => {
    const html = await (await request.get(POST.ru)).text()
    const tags = headTags(html)
    const cover = og(tags, 'og:image') ?? ''
    expect(cover).toMatch(new RegExp(`^${baseURL}/_astro/.+\\.png$`))
    expect(og(tags, 'og:image:width')).toBe('1600')
    expect(og(tags, 'og:image:height')).toBe('900')
    const image = await request.get(cover)
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toContain('image/png')
    expect(image.headers()['cache-control']).toContain('immutable')
    expect(jsonLd(html)[0]?.image).toBe(cover)
  })

  test('запись без обложки: og:image — дефолт сайта 1200×630, в BlogPosting нет image', async ({
    request,
    baseURL,
  }) => {
    const html = await (await request.get(NO_COVER)).text()
    const tags = headTags(html)
    expect(og(tags, 'og:image')).toBe(`${baseURL}/og-default.png`)
    expect(og(tags, 'og:image:width')).toBe('1200')
    expect(og(tags, 'og:image:height')).toBe('630')
    expect(og(tags, 'og:image:alt')).toBeTruthy()
    expect(jsonLd(html)[0]).not.toHaveProperty('image')
  })

  test('непереведённая запись: без hreflang и og:locale:alternate, dateModified нет', async ({
    request,
    baseURL,
  }) => {
    const html = await (await request.get(UNTRANSLATED)).text()
    const tags = headTags(html)
    expect(canonical(tags)).toBe(`${baseURL}${UNTRANSLATED}`)
    expect(hreflang(tags)).toEqual({})
    expect(og(tags, 'og:locale:alternate')).toBeUndefined()
    expect(jsonLd(html)[0]).not.toHaveProperty('dateModified')
  })

  test('списки и теги: BreadcrumbList в <head>, self-canonical у страницы 2', async ({
    request,
    baseURL,
  }) => {
    for (const path of ['/blog', '/blog/page/2', '/blog/tag/seo', '/en/blog']) {
      const html = await (await request.get(path)).text()
      expect(canonical(headTags(html)), path).toBe(`${baseURL}${path}`)
      expect(
        jsonLd(html).map((block) => block['@type']),
        path,
      ).toEqual(['BreadcrumbList'])
      expect(bodyOf(html), path).not.toContain('<script')
    }
  })

  test('служебные страницы 404 и /now: noindex, без canonical, OG и hreflang', async ({
    request,
  }) => {
    for (const [path, status] of [
      ['/xx', 404],
      ['/now', 200],
    ] as const) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(status)
      const html = await response.text()
      const tags = headTags(html)
      expect(meta(tags, 'robots'), path).toBe('noindex')
      expect(canonical(tags), path).toBeUndefined()
      expect(hreflang(tags), path).toEqual({})
      expect(
        tags.some((tag) => tag.property?.startsWith('og:')),
        path,
      ).toBe(false)
      expect(jsonLd(html), path).toEqual([])
    }
  })

  test('прод-профиль: индексируемые страницы без noindex и keywords', async ({ request }) => {
    for (const path of ['/', '/blog', POST.ru, '/en']) {
      const response = await request.get(path)
      expect(response.headers()['x-robots-tag'], path).toBeUndefined()
      const tags = headTags(await response.text())
      expect(meta(tags, 'robots'), path).toBeUndefined()
      expect(meta(tags, 'keywords'), path).toBeUndefined()
    }
  })

  test('размер HTML: каждая страница меньше потолка Googlebot с запасом', async ({ request }) => {
    for (const path of [...prerenderedPaths(), '/now', '/xx']) {
      const html = await (await request.get(path)).text()
      expect(Buffer.byteLength(html, 'utf8'), path).toBeLessThan(HTML_SIZE_LIMIT)
    }
  })
})

test.describe('robots.txt, sitemap.xml, фиды, IndexNow', () => {
  test('robots.txt: всё разрешено, абсолютный Sitemap, без AI-блока и мёртвых директив', async ({
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
    expect(body).not.toMatch(/Host:|Crawl-delay:|GPTBot|ClaudeBot|__site_origin__/)
  })

  test('sitemap.xml: ровно prerendered-страницы сборки, все отвечают 200, lastmod только из updatedDate', async ({
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

    const entries = [
      ...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g),
    ].map(([, loc, lastmod]) => ({ loc: loc ?? '', lastmod }))
    expect(entries.length).toBeGreaterThan(0)
    for (const { loc } of entries) expect(loc.startsWith(`${baseURL}/`), loc).toBe(true)
    const paths = entries
      .map(({ loc }) => new URL(loc).pathname)
      .map((path) => (path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path))
      .sort()
    expect(paths).toEqual(prerenderedPaths())
    for (const excluded of NOT_IN_SITEMAP) expect(xml, excluded).not.toContain(excluded)
    expect(
      entries
        .filter((entry) => entry.lastmod)
        .map((entry) => [new URL(entry.loc).pathname, entry.lastmod]),
    ).toEqual([[UPDATED.path, UPDATED.lastmod]])
    for (const { loc } of entries) expect((await request.get(loc)).status(), loc).toBe(200)
  })

  for (const [path, language, home] of [
    ['/rss.xml', 'ru', ''],
    ['/en/rss.xml', 'en', '/en'],
  ] as const) {
    test(`${path}: RSS 2.0 с self-ссылкой, языком и абсолютными постоянными ссылками`, async ({
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
      expect(xml).toContain(`<language>${language}</language>`)
      expect(xml).toContain(`<link>${baseURL}${home}</link>`)
      const links = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => m[1] ?? '')
      expect(links.length).toBeGreaterThan(0)
      expect(links.length).toBeLessThanOrEqual(20)
      for (const link of links) expect(link.startsWith(`${baseURL}${home}/blog/`), link).toBe(true)
      expect(xml).toContain('<guid isPermaLink="true">')
      expect(xml).not.toContain(DRAFT)
      expect(xml).not.toContain('__site_origin__')
      expect((await request.get(links[0] ?? '')).status()).toBe(200)
    })
  }

  test('ключ IndexNow: файл /<ключ>.txt с ключом внутри; чужое имя — plain-text 404 с noindex; robots.txt не задет', async ({
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
