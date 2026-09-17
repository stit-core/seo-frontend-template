import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const PLACEHOLDER = '__site_origin__'

test.describe('сырой HTML (без браузера, как его видит бот)', () => {
  test('/ — 200, полный HTML с одним h1, без плейсхолдера origin', async ({ request }) => {
    const response = await request.get('/', { headers: { 'user-agent': 'Googlebot' } })
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('<html lang="ru"')
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).toContain('Шаблон индексируемого сайта')
    expect(html).not.toContain(PLACEHOLDER)
  })

  test('/en — 200 и lang="en"', async ({ request }) => {
    const response = await request.get('/en')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('<html lang="en"')
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
  })

  test('/xx — честный 404 с разметкой', async ({ request }) => {
    const response = await request.get('/xx')
    expect(response.status()).toBe(404)
    expect(await response.text()).toContain('Страница не найдена')
  })

  test('/404 — без ссылки на несуществующий перевод', async ({ request }) => {
    const html = await (await request.get('/404')).text()
    expect(html).not.toContain('/en/404')
    expect(html).toContain('href="/en"')
  })

  test('/en/ → 301 на /en (нормализация слеша)', async ({ request }) => {
    const response = await request.get('/en/', { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    expect(response.headers().location).toBe('/en')
  })

  test('/healthz — 200 ok, no-store, X-Request-Id из middleware', async ({ request }) => {
    const response = await request.get('/healthz', { headers: { 'x-request-id': 'e2e-rid' } })
    expect(response.status()).toBe(200)
    expect(await response.text()).toBe('ok')
    expect(response.headers()['cache-control']).toBe('no-store')
    expect(response.headers()['x-request-id']).toBe('e2e-rid')
  })
})

test('/ не грузит ни одного script-ресурса', async ({ page }) => {
  const scripts: string[] = []
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') scripts.push(response.url())
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('h1')).toHaveCount(1)
  expect(scripts).toEqual([])
})

test.describe('без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('главная читается целиком', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Шаблон')
    await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en')
  })
})

for (const path of ['/', '/404']) {
  test(`axe: ${path} без нарушений`, async ({ page }) => {
    await page.goto(path)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
}
