import { expect, test } from '@playwright/test'

test.describe('без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('главная содержит h1 и абсолютный canonical', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText(/JavaScript/)
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /^https?:\/\//)
  })

  test('пост содержит текст тела и Article JSON-LD', async ({ page }) => {
    await page.goto('/blog/kanon-canonical')
    await expect(page.locator('h1')).toHaveText('Канон canonical')
    await expect(page.locator('main')).toContainText('первый HTML содержит весь значимый текст')
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
    expect(ld).toContain('"@type":"Article"')
  })

  test('несуществующий пост отдаёт 404', async ({ page }) => {
    const response = await page.goto('/blog/net-takogo')
    expect(response?.status()).toBe(404)
  })

  test('неизвестная локаль отдаёт 404', async ({ page }) => {
    const response = await page.goto('/xx')
    expect(response?.status()).toBe(404)
  })

  test('форма контактов работает без JS: нативный POST → 303 → /contact/thanks', async ({
    page,
  }) => {
    await page.goto('/contact')
    await page.fill('input[name=name]', 'Иван')
    await page.fill('input[name=email]', 'ivan@example.com')
    await page.fill('textarea[name=message]', 'Сообщение длиннее десяти символов')
    await page.click('button[type=submit]')
    await page.waitForURL('**/contact/thanks')
    await expect(page.getByRole('status')).toContainText('Спасибо')
  })
})

test('в теле документа нет абсолютных URL своего origin', async ({ page }) => {
  await page.goto('/blog/kanon-canonical')
  const body = await page.locator('body').innerHTML()
  expect(body).not.toMatch(/https?:\/\/(localhost|127\.0\.0\.1)/)
})
