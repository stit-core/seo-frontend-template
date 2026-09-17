import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { prerenderedPaths } from './site'

const PLACEHOLDER = '__site_origin__'
// Slug reference-контента (src/entities/post/content). /de-template заменит вместе с ним.
const POST = '/blog/chestnye-404-i-410'
const ON_DEMAND = [
  { path: '/now', status: 200 },
  { path: '/healthz', status: 200 },
  { path: '/xx', status: 404 },
  { path: '/blog/staraya-zametka', status: 410 },
  { path: '/robots.txt', status: 200 },
  { path: '/sitemap.xml', status: 200 },
  { path: '/rss.xml', status: 200 },
  { path: '/en/rss.xml', status: 200 },
]

const root = resolve(import.meta.dirname, '..')

// Абсолютные URL допустимы только в <head> (canonical, og:*, hreflang, JSON-LD), фидах и sitemap.
const bodyOf = (html: string) => {
  const start = html.indexOf('<body')
  const end = html.lastIndexOf('</body>')
  expect(start, 'в документе есть <body>').toBeGreaterThan(-1)
  return html.slice(start, end)
}

const serverTime = (html: string) => html.match(/<time datetime="([^"]+)"/)?.[1]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test.describe('один образ на все среды: штамповка и относительные URL', () => {
  test('ни одна prerendered-страница не содержит плейсхолдера origin и абсолютных URL своего origin в <body>', async ({
    request,
    baseURL,
  }) => {
    const paths = prerenderedPaths()
    expect(paths).toContain('/')
    expect(paths).toContain('/en')
    expect(paths).toContain(POST)
    const ownOrigin = new RegExp(escapeRegExp(baseURL as string))
    for (const path of paths) {
      await test.step(path, async () => {
        const response = await request.get(path)
        expect(response.status(), path).toBe(200)
        const html = await response.text()
        expect(html, path).not.toContain(PLACEHOLDER)
        // Абсолютные URL — только в <head> (canonical, og:url, hreflang); в теле — корневые.
        expect(bodyOf(html), path).not.toMatch(ownOrigin)
      })
    }
  })

  test('on-demand ответы не содержат плейсхолдера: origin берётся из runtime SITE_URL', async ({
    request,
    baseURL,
  }) => {
    const ownOrigin = new RegExp(escapeRegExp(baseURL as string))
    for (const { path, status } of ON_DEMAND) {
      await test.step(path, async () => {
        const response = await request.get(path)
        expect(response.status(), path).toBe(status)
        const html = await response.text()
        expect(html, path).not.toContain(PLACEHOLDER)
        if (html.includes('<body')) expect(bodyOf(html), path).not.toMatch(ownOrigin)
      })
    }
  })
})

test.describe('режимы рендера', () => {
  test('/now — dynamic: 200, private/no-store, noindex, X-Request-Id, время меняется', async ({
    request,
  }) => {
    const first = await request.get('/now', { headers: { 'x-request-id': 'e2e-now' } })
    expect(first.status()).toBe(200)
    expect(first.headers()['cache-control']).toBe('private, no-store')
    expect(first.headers()['x-request-id']).toBe('e2e-now')
    // Прод-профиль (ROBOTS_POLICY=index): заголовка staging нет.
    expect(first.headers()['x-robots-tag']).toBeUndefined()
    const html = await first.text()
    expect(html).toContain('<html lang="ru"')
    expect(html).toContain('<meta name="robots" content="noindex"')
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(serverTime(html)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

    // Разрешение метки — миллисекунда: пауза гарантирует разное время у двух рендеров.
    await new Promise((done) => setTimeout(done, 10))
    const second = await (await request.get('/now')).text()
    expect(serverTime(second)).not.toBe(serverTime(html))
  })

  test('404 и 410 — публичный on-demand HTML с no-cache', async ({ request }) => {
    const notFound = await request.get('/xx')
    expect(notFound.status()).toBe(404)
    expect(notFound.headers()['cache-control']).toBe('no-cache')
    expect(notFound.headers()['x-request-id']).toBeTruthy()

    const gone = await request.get('/blog/staraya-zametka')
    expect(gone.status()).toBe(410)
    expect(gone.headers()['cache-control']).toBe('no-cache')
  })

  test('prerendered — заголовки статик-хендлера адаптера: public, max-age=0 + ETag', async ({
    request,
  }) => {
    for (const path of ['/', POST]) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
      expect(response.headers()['cache-control'], path).toBe('public, max-age=0')
      expect(response.headers().etag, path).toBeTruthy()
      // Prerendered отдаётся до приложения: middleware до него не дотягивается.
      expect(response.headers()['x-request-id'], path).toBeUndefined()
    }
  })

  test('скрипты страницы: ни одного внешнего, инлайн — только остров темы в <head>', async ({
    request,
  }) => {
    for (const path of ['/', POST, '/contacts', '/about', '/now']) {
      const html = await (await request.get(path)).text()
      const head = html.slice(0, html.indexOf('</head>'))
      const executable = [...html.matchAll(/<script[^>]*>/g)]
        .map((match) => match[0])
        .filter((tag) => !tag.includes('application/ld+json'))
      expect(executable, path).toHaveLength(1)
      expect(executable[0], path).not.toContain('src=')
      // Единственный скрипт — применение темы и делегированный обработчик переключателя.
      expect(head, path).toContain('data-theme-toggle')
      expect(bodyOf(html), path).not.toContain('<script')
    }
  })

  test('/now не грузит ни одного script-ресурса', async ({ page }) => {
    const scripts: string[] = []
    page.on('response', (response) => {
      if (response.request().resourceType() === 'script') scripts.push(response.url())
    })
    await page.goto('/now', { waitUntil: 'networkidle' })
    await expect(page.locator('h1')).toHaveCount(1)
    expect(scripts).toEqual([])
  })

  test('axe: /now без нарушений', async ({ page }) => {
    await page.goto('/now')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('TTFB prerendered-страниц: медиана 20 запросов', ({ baseURL }) => {
    const result = spawnSync(
      process.execPath,
      [resolve(root, 'scripts/ttfb.mjs'), '--json', baseURL as string, '/', POST],
      { encoding: 'utf8' },
    )
    expect(result.status, result.stderr).toBe(0)
    const rows = JSON.parse(result.stdout) as Array<{
      path: string
      status: number
      median: number
    }>
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      test
        .info()
        .annotations.push({ type: 'ttfb', description: `${row.path} median ${row.median} ms` })
      expect(row.status, row.path).toBe(200)
      // Локально медиана ≈ 1 мс; порог мягкий — шум CI и параллельных воркеров, не бюджет.
      expect(row.median, row.path).toBeLessThanOrEqual(25)
    }
  })
})
