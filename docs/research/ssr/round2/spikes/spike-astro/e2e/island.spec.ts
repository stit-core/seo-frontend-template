import { expect, test } from '@playwright/test'

test('остров контактов гидрируется и отправляет форму без навигации', async ({ page }) => {
  await page.goto('/contact')
  await page.fill('input[name=name]', 'Иван')
  await page.fill('input[name=email]', 'ivan@example.com')
  await page.fill('textarea[name=message]', 'Сообщение длиннее десяти символов')
  // time-trap: остров ставит ts при монтировании, поэтому ждём порог
  await page.waitForTimeout(3100)
  await page.click('button[type=submit]')
  await expect(page.getByRole('status')).toContainText('Спасибо')
  expect(new URL(page.url()).pathname).toBe('/contact')
})

test('страницы без островов не грузят ни байта JS', async ({ page }) => {
  const scripts: Array<{ url: string; bytes: number }> = []
  page.on('response', async (response) => {
    const type = response.request().resourceType()
    if (type === 'script') {
      const body = await response.body().catch(() => Buffer.alloc(0))
      scripts.push({ url: response.url(), bytes: body.length })
    }
  })
  for (const path of ['/', '/blog', '/blog/kanon-canonical', '/about', '/en']) {
    await page.goto(path, { waitUntil: 'networkidle' })
  }
  expect(scripts, JSON.stringify(scripts)).toHaveLength(0)
})
