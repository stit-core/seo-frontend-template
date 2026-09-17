import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Ключевые страницы reference-набора; slug записи заменяется вместе с контентом.
const PAGES = [
  { path: '/', name: 'главная' },
  { path: '/blog/chestnye-404-i-410', name: 'запись' },
  { path: '/contacts', name: 'контакты' },
  { path: '/about', name: 'о компании' },
  { path: '/legal/privacy', name: 'политика' },
  { path: '/xx', name: '404' },
]

// Обе темы: системная (prefers-color-scheme) и явный выбор через cookie острова.
const SCHEMES = ['light', 'dark'] as const

for (const scheme of SCHEMES) {
  test.describe(`тема ${scheme}`, () => {
    test.use({ colorScheme: scheme })

    for (const { path, name } of PAGES) {
      test(`axe: ${name} (${path})`, async ({ page }) => {
        await page.goto(path)
        const results = await new AxeBuilder({ page }).analyze()
        expect(results.violations).toEqual([])
      })
    }
  })
}

test.describe('явный выбор темы', () => {
  test('переключатель ставит data-scheme и cookie, выбор переживает перезагрузку', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-js', 'on')
    await expect(root).not.toHaveAttribute('data-scheme', /.*/)

    await page.getByRole('button', { name: 'Переключить тему' }).click()
    const chosen = await root.getAttribute('data-scheme')
    expect(chosen).toMatch(/^(light|dark)$/)
    const cookie = (await context.cookies()).find((item) => item.name === 'scheme')
    expect(cookie?.value).toBe(chosen)

    await page.reload()
    await expect(root).toHaveAttribute('data-scheme', chosen as string)
  })

  test('в выбранной вручную тёмной теме нарушений доступности нет', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'scheme', value: 'dark', url: baseURL as string }])
    await page.goto('/contacts')
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('без JavaScript переключателя нет — выбор негде сохранить', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Переключить тему' })).toBeHidden()
    await context.close()
  })
})
