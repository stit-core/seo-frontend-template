import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Slug'и reference-контента (src/entities/post/content). /de-template заменит вместе с ним.
const POST = {
  slug: 'chestnye-404-i-410',
  title: 'Честные 404 и 410 вместо soft-404',
  en: 'honest-404-and-410',
}
const NEWEST = 'odin-obraz-na-vse-sredy'
const UNTRANSLATED = 'kartinki-avif-webp'
const DRAFT = 'redirekty-kak-dannye'

test.describe('блог: сырой HTML', () => {
  test('/blog — 200, один h1, записи без черновика, пагинация и перевод в шапке', async ({
    request,
  }) => {
    const response = await request.get('/blog', { headers: { 'user-agent': 'Googlebot' } })
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('<html lang="ru"')
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).toContain(`href="/blog/${NEWEST}"`)
    expect(html).not.toContain(DRAFT)
    expect(html).toContain('href="/blog/page/2"')
    expect(html).not.toContain('href="/blog/page/1"')
    expect(html).toContain('href="/en/blog"')
    expect(html).toContain('<title>Блог — ')
    expect(html).not.toContain('— страница')
  })

  test('/blog/page/2 — 200 со старыми записями; страниц 1 и 3 не существует', async ({
    request,
  }) => {
    const page2 = await request.get('/blog/page/2')
    expect(page2.status()).toBe(200)
    const html = await page2.text()
    expect(html).toContain(`href="/blog/${POST.slug}"`)
    expect(html).not.toContain(DRAFT)
    expect(html).toContain('href="/blog" rel="prev"')
    expect(html).toContain('<title>Блог — страница 2 — ')
    expect(html).toMatch(/<meta name="description" content="[^"]+ — страница 2"/)
    expect((await request.get('/blog/page/1')).status()).toBe(404)
    expect((await request.get('/blog/page/3')).status()).toBe(404)
  })

  test('/blog/<slug> — 200, h1 = title, lang="ru", ссылка на перевод', async ({ request }) => {
    const response = await request.get(`/blog/${POST.slug}`, {
      headers: { 'user-agent': 'Googlebot' },
    })
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('<html lang="ru"')
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).toMatch(new RegExp(`<h1[^>]*>${POST.title}</h1>`))
    expect(html).toContain(`<title>${POST.title} — `)
    expect(html).toContain(`href="/en/blog/${POST.en}"`)
    expect(html).toContain('href="/blog/tag/seo"')
  })

  test('непереведённая запись: без ссылки на перевод, под /en/ — 404', async ({ request }) => {
    const html = await (await request.get(`/blog/${UNTRANSLATED}`)).text()
    expect(html).not.toContain('hreflang="en"')
    expect((await request.get(`/en/blog/${UNTRANSLATED}`)).status()).toBe(404)
    expect((await request.get(`/en/blog/${POST.slug}`)).status()).toBe(404)
  })

  test('/blog/net-takogo — честный 404 с разметкой', async ({ request }) => {
    const response = await request.get('/blog/net-takogo')
    expect(response.status()).toBe(404)
    expect(await response.text()).toContain('Страница не найдена')
  })

  test('черновик: нет в списках, его URL — 404', async ({ request }) => {
    expect((await request.get(`/blog/${DRAFT}`)).status()).toBe(404)
    expect(await (await request.get('/blog/tag/seo')).text()).not.toContain(DRAFT)
  })

  test('/blog/tag/seo — 200, один h1, только записи с тегом', async ({ request }) => {
    const response = await request.get('/blog/tag/seo')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).toContain(`href="/blog/${POST.slug}"`)
    expect(html).not.toContain(`href="/blog/${UNTRANSLATED}"`)
    expect((await request.get('/blog/tag/net-takogo')).status()).toBe(404)
  })

  test('/en/blog — 200, lang="en"; перевод открывается; второй страницы нет', async ({
    request,
  }) => {
    const list = await request.get('/en/blog')
    expect(list.status()).toBe(200)
    const html = await list.text()
    expect(html).toContain('<html lang="en"')
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).toContain(`href="/en/blog/${POST.en}"`)
    expect(html).toContain('href="/blog"')
    const post = await request.get(`/en/blog/${POST.en}`)
    expect(post.status()).toBe(200)
    expect(await post.text()).toContain(`href="/blog/${POST.slug}"`)
    expect((await request.get('/en/blog/page/2')).status()).toBe(404)
  })
})

test.describe('редиректы как данные (content/redirects.yaml)', () => {
  test('/old → 301 /blog одним хопом', async ({ request }) => {
    const response = await request.get('/old', { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    expect(response.headers().location).toBe('/blog')
    expect((await request.get('/blog')).status()).toBe(200)
  })

  test('/old?x=1 → 301 /blog?x=1: query переезжает в Location', async ({ request }) => {
    const response = await request.get('/old?x=1&y=2', { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    expect(response.headers().location).toBe('/blog?x=1&y=2')
  })

  test('/old/ → 301 /old: слеш срезает Astro до middleware, правило — вторым хопом', async ({
    request,
  }) => {
    const slash = await request.get('/old/?x=1', { maxRedirects: 0 })
    expect(slash.status()).toBe(301)
    expect(slash.headers().location).toBe('/old?x=1')
    const rule = await request.get(slash.headers().location as string, { maxRedirects: 0 })
    expect(rule.status()).toBe(301)
    expect(rule.headers().location).toBe('/blog?x=1')
  })

  test('удалённый адрес → 410 с телом и noindex', async ({ request }) => {
    const response = await request.get('/blog/staraya-zametka', { maxRedirects: 0 })
    expect(response.status()).toBe(410)
    expect(response.headers()['x-robots-tag']).toContain('noindex')
    expect(response.headers()['x-request-id']).toBeTruthy()
    expect(await response.text()).toContain('Страница удалена')
  })
})

for (const path of ['/blog', `/blog/${POST.slug}`, '/en/blog']) {
  test(`${path} не грузит ни одного script-ресурса`, async ({ page }) => {
    const scripts: string[] = []
    page.on('response', (response) => {
      if (response.request().resourceType() === 'script') scripts.push(response.url())
    })
    await page.goto(path, { waitUntil: 'networkidle' })
    await expect(page.locator('h1')).toHaveCount(1)
    expect(scripts).toEqual([])
  })
}

for (const path of ['/blog', `/blog/${POST.slug}`, '/blog/tag/seo']) {
  test(`axe: ${path} без нарушений`, async ({ page }) => {
    await page.goto(path)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
}
