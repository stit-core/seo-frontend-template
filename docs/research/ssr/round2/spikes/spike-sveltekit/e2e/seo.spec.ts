import { expect, test } from '@playwright/test'

test.describe('контент без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('главная содержит h1 и абсолютный canonical', async ({ page, baseURL }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toHaveText(/Индексируемый контент-сайт/)
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `${baseURL}/`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })

  test('пост содержит текст, Article JSON-LD и picture с AVIF', async ({ page }) => {
    await page.goto('/blog/ssr-i-indeksatsiya')
    await expect(page.locator('h1')).toContainText('SSR и индексация')
    await expect(page.locator('.prose')).toContainText('Техническое SEO')
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(ld.some((t) => t.includes('"@type":"Article"'))).toBe(true)
    await expect(page.locator('picture source[type="image/avif"]')).toHaveCount(1)
  })

  test('на контентной странице нет ни одного <script src>', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('script[src]')).toHaveCount(0)
  })

  test('форма работает без JS: POST даёт 303 на страницу спасибо', async ({ page }) => {
    await page.goto('/contact')
    await page.fill('#name', 'Иван Иванов')
    await page.fill('#email', 'ivan@example.com')
    await page.fill('#message', 'Проверка отправки формы без JavaScript.')
    await page.waitForTimeout(3200)
    await page.click('button[type=submit]')
    await expect(page).toHaveURL(/\/contact\/spasibo$/)
    await expect(page.locator('h1')).toContainText('Спасибо')
  })
})

test.describe('статусы и служебные ресурсы', () => {
  test('честные коды ответов', async ({ request }) => {
    expect((await request.get('/blog/net-takogo', { maxRedirects: 0 })).status()).toBe(404)
    expect((await request.get('/xx/', { maxRedirects: 0 })).status()).toBe(404)
    expect((await request.get('/ru/about', { maxRedirects: 0 })).status()).toBe(404)
    expect((await request.get('/old', { maxRedirects: 0 })).status()).toBe(301)
    expect((await request.get('/about/', { maxRedirects: 0 })).status()).toBe(308)
    expect((await request.get('/healthz')).status()).toBe(200)
  })

  test('robots и sitemap знают рантайм-origin', async ({ request, baseURL }) => {
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`)
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain(`<loc>${baseURL}/blog/ssr-i-indeksatsiya</loc>`)
    expect(sitemap).not.toContain('__SITE_ORIGIN__')
  })

  test('в теле документа нет абсолютных ссылок на свой же origin', async ({ request, baseURL }) => {
    const html = await (await request.get('/blog/ssr-i-indeksatsiya')).text()
    const body = html.slice(html.indexOf('<body'))
    expect(body).not.toContain(String(baseURL))
    expect(html).not.toContain('__SITE_ORIGIN__')
  })
})

test('контент виден Googlebot до любой гидрации', async ({ request }) => {
  const res = await request.get('/blog/ssr-i-indeksatsiya', {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
  })
  const html = await res.text()
  expect(html).toContain('<h1>SSR и индексация')
  expect(html).toContain('rel="canonical"')
})
