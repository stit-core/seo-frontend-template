import { expect, test } from '@playwright/test'
import { type HeadTag, headTags } from '../../scripts/lib/html.mjs'
import { SITE_ORIGIN_PLACEHOLDER } from '../../src/shared/config/runtime.ts'
import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES } from '../../src/shared/i18n/locale.ts'
import { entries, onDemandRoutes, prerenderedPaths, redirects } from '../site'

const PLACEHOLDER = new URL(SITE_ORIGIN_PLACEHOLDER).hostname
const UNKNOWN = '/net-takogo-adresa'

const bodyOf = (html: string) => html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'))
const jsonLd = (html: string) => html.match(/<script type="application\/ld\+json">/g) ?? []
const serverTime = (html: string) => /<time datetime="([^"]+)"/.exec(html)?.[1]

// Служебная страница: только noindex, без canonical, OG, hreflang и разметки.
function expectServicePage(html: string, path: string) {
  const tags = headTags(html)
  const has = (match: (tag: HeadTag) => boolean) => tags.some(match)
  expect(tags.find((tag) => tag.name === 'robots')?.content, path).toBe('noindex')
  expect(
    has((tag) => tag.rel === 'canonical'),
    path,
  ).toBe(false)
  expect(
    has((tag) => tag.hreflang !== undefined),
    path,
  ).toBe(false)
  expect(
    has((tag) => tag.property?.startsWith('og:') === true),
    path,
  ).toBe(false)
  expect(jsonLd(html), path).toEqual([])
  expect(html.match(/<h1[\s>]/g), path).toHaveLength(1)
}

test.describe('on-demand: ответы приложения', () => {
  test('каждый маршрут prerender = false отвечает из приложения: X-Request-Id, без плейсхолдера и своего origin в теле', async ({
    request,
    baseURL,
  }) => {
    for (const path of onDemandRoutes()) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.headers()['x-request-id'], path).toBeTruthy()
      const body = await response.text()
      expect(body, path).not.toContain(PLACEHOLDER)
      if (body.includes('<body')) expect(bodyOf(body), path).not.toContain(baseURL)
    }
  })

  test('адрес вне сборки — честный 404 служебной страницей: no-cache, ссылки страницы живые', async ({
    request,
  }) => {
    const published = entries().filter((entry) => !entry.draft)
    const paths = new Set(published.map((entry) => entry.path))
    // Черновик в сборку не попадает: его адрес — 404, а не страница.
    const draft = entries().find((entry) => entry.draft)?.path
    // Непереведённая запись под чужим префиксом — 404, а не копия.
    const foreign = published
      .flatMap((entry) => SUPPORTED_LOCALES.map((locale) => localePath(locale, entry.route)))
      .find((path) => !paths.has(path))
    for (const path of [UNKNOWN, draft, foreign].filter((path) => path !== undefined)) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(404)
      expect(response.headers()['cache-control'], path).toBe('no-cache')
      expect(response.headers()['x-request-id'], path).toBeTruthy()
    }

    const html = await (await request.get(UNKNOWN)).text()
    expectServicePage(html, UNKNOWN)
    // check:links видит только dist/client — ссылки on-demand страницы проверяются здесь.
    for (const [, href] of html.matchAll(/<a[^>]* href="(\/[^"]*)"/g)) {
      expect((await request.get(href ?? '')).status(), href).toBe(200)
    }
  })

  test('хвостовой слеш — один 301 на адрес без слеша', async ({ request }) => {
    const path = prerenderedPaths().find((candidate) => candidate !== '/') ?? '/'
    const response = await request.get(`${path}/`, { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    expect(response.headers().location).toBe(path)
  })

  test('/healthz — 200 ok, no-store, X-Request-Id из запроса', async ({ request }) => {
    const response = await request.get('/healthz', { headers: { 'x-request-id': 'e2e-rid' } })
    expect(response.status()).toBe(200)
    expect(await response.text()).toBe('ok')
    expect(response.headers()['cache-control']).toBe('no-store')
    expect(response.headers()['x-request-id']).toBe('e2e-rid')
  })

  test('/now — рендер на каждый запрос: private, no-store, noindex, время меняется', async ({
    request,
  }) => {
    const first = await request.get('/now', { headers: { 'x-request-id': 'e2e-now' } })
    expect(first.status()).toBe(200)
    expect(first.headers()['cache-control']).toBe('private, no-store')
    expect(first.headers()['x-request-id']).toBe('e2e-now')
    expect(first.headers()['x-robots-tag']).toBeUndefined()
    const html = await first.text()
    expect(html).toContain(`<html lang="${DEFAULT_LOCALE}"`)
    expectServicePage(html, '/now')
    expect(serverTime(html)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    // Разрешение метки — миллисекунда: пауза гарантирует разное время у двух рендеров.
    await new Promise((done) => setTimeout(done, 10))
    expect(serverTime(await (await request.get('/now')).text())).not.toBe(serverTime(html))
  })
})

test.describe('редиректы как данные (content/redirects.yaml)', () => {
  const moved = redirects().find((rule) => rule.status !== 410 && rule.to.startsWith('/'))
  const gone = redirects().find((rule) => rule.status === 410)

  test('переезд: один хоп на конечный адрес, query переезжает в Location', async ({ request }) => {
    test.skip(!moved || moved.status === 410, 'в redirects.yaml нет внутреннего переезда')
    if (!moved || moved.status === 410) return
    const response = await request.get(moved.from, { maxRedirects: 0 })
    expect(response.status()).toBe(moved.status)
    expect(response.headers().location).toBe(moved.to)
    expect((await request.get(moved.to, { maxRedirects: 0 })).status()).toBe(200)

    const query = await request.get(`${moved.from}?x=1&y=2`, { maxRedirects: 0 })
    expect(query.headers().location).toBe(`${moved.to}?x=1&y=2`)

    // Хвостовой слеш срезает Astro до middleware, правило срабатывает вторым хопом.
    const slash = await request.get(`${moved.from}/?x=1`, { maxRedirects: 0 })
    expect(slash.status()).toBe(301)
    expect(slash.headers().location).toBe(`${moved.from}?x=1`)
  })

  test('удалённый адрес — 410 с телом, noindex и no-cache', async ({ request }) => {
    test.skip(!gone, 'в redirects.yaml нет 410')
    const response = await request.get(gone?.from ?? '', { maxRedirects: 0 })
    expect(response.status()).toBe(410)
    expect(response.headers()['x-robots-tag']).toContain('noindex')
    expect(response.headers()['cache-control']).toBe('no-cache')
    expect(response.headers()['x-request-id']).toBeTruthy()
    expect(await response.text()).toMatch(/<h1>[^<]+<\/h1>/)
  })
})
