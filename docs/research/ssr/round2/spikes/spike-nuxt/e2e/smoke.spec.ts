import { expect, test } from '@playwright/test'

test('главная без JS содержит h1 и абсолютный canonical', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)

  const html = await page.content()
  expect(html).toContain('<h1')
  await expect(page.locator('h1')).toBeVisible()

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  expect([`${baseURL}/`, String(baseURL)]).toContain(canonical)
  await context.close()
})

test('несуществующий пост отдаёт 404', async ({ request }) => {
  const response = await request.get('/blog/net-takogo')
  expect(response.status()).toBe(404)
})

test('невалидный префикс локали отдаёт 404', async ({ request }) => {
  const response = await request.get('/xx/')
  expect(response.status()).toBe(404)
})

test('/old редиректит 301 на /', async ({ request }) => {
  const response = await request.get('/old', { maxRedirects: 0 })
  expect(response.status()).toBe(301)
  expect(response.headers().location).toBe('/')
})

test('разметка тела не содержит абсолютных ссылок на свой origin', async ({ page, baseURL }) => {
  await page.goto('/blog/ssr-bez-cdn')
  // JSON-LD и гидрационные <script> обязаны быть абсолютными — проверяем только разметку.
  const markup = (await page.locator('body').innerHTML()).replace(/<script[\s\S]*?<\/script>/g, '')
  expect(markup).not.toContain(String(baseURL))
})

const JS_BUDGET_KB: Record<string, number> = {
  '/': 150,
  '/about': 1,
  '/blog/ssr-bez-cdn': 165,
}

for (const [path, budget] of Object.entries(JS_BUDGET_KB)) {
  test(`бюджет JS на ${path} — не больше ${budget} КБ`, async ({ page }) => {
    let bytes = 0
    page.on('response', async (response) => {
      if (response.request().resourceType() !== 'script') return
      bytes += Number(response.headers()['content-length'] || 0)
    })
    await page.goto(path, { waitUntil: 'load' })
    expect(bytes / 1024).toBeLessThanOrEqual(budget)
  })
}
