import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { t } from '../../src/shared/i18n/dict.ts'
import { prerenderedPaths } from '../site'
import { expect, test } from './csp'

// WCAG 2.2 AA целиком: без тегов axe не запускает, например, target-size (2.5.8).
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

const violations = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(RULES).analyze()).violations

// Обе темы: системная (prefers-color-scheme) и явный выбор через cookie острова.
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, тема ${scheme}`, () => {
    test.use({ colorScheme: scheme })

    // Каждая страница сборки и служебные on-demand: 404 и /now.
    for (const path of [...prerenderedPaths(), '/now', '/net-takogo-adresa']) {
      test(path, async ({ page }) => {
        await page.goto(path)
        expect(await violations(page)).toEqual([])
      })
    }

    test('ответ формы с ошибками без нарушений', async ({ page }) => {
      await page.goto('/contacts')
      // Нативная проверка отключена: ошибки должен вернуть сервер.
      await page.locator('form[method="post"]').evaluate((form: HTMLFormElement) => {
        form.noValidate = true
      })
      await page.getByRole('button', { name: t('ru', 'form.submit') }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      expect(await violations(page)).toEqual([])
    })
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

    await page.getByRole('button', { name: t('ru', 'theme.toggle') }).click()
    const chosen = await root.getAttribute('data-scheme')
    expect(chosen).toMatch(/^(light|dark)$/)
    const cookie = (await context.cookies()).find((item) => item.name === 'scheme')
    expect(cookie?.value).toBe(chosen)

    // Выбор действует на весь сайт, а не только на раздел, где сделан.
    await page.goto(prerenderedPaths().find((path) => path.split('/').length > 2) ?? '/')
    await expect(root).toHaveAttribute('data-scheme', chosen ?? '')
  })

  test('в выбранной вручную тёмной теме нарушений нет', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'scheme', value: 'dark', url: baseURL ?? '' }])
    await page.goto('/contacts')
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark')
    expect(await violations(page)).toEqual([])
  })

  test('без JavaScript переключателя нет — выбор негде сохранить', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('button', { name: t('ru', 'theme.toggle') })).toBeHidden()
    await context.close()
  })
})
