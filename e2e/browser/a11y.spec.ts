import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { THEME } from '../../src/shared/config/site.ts'
import { t } from '../../src/shared/i18n/dict.ts'
import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES } from '../../src/shared/i18n/locale.ts'
import { prerenderedPaths } from '../site'
import { expect, test } from './csp'
import { bySite, SITE_THEMES, stored } from './themes'

// WCAG 2.2 AA целиком: без тегов axe не запускает, например, target-size (2.5.8).
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

const violations = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(RULES).analyze()).violations

// Проект задаёт профиль — десктоп или телефон: каждая страница проверяется на обоих.
for (const theme of SITE_THEMES) {
  test.describe(`axe, тема ${theme}`, () => {
    test.use({
      colorScheme: theme,
      storageState: ({ baseURL }, use) =>
        use(bySite(theme) ? undefined : stored(baseURL ?? '', theme)),
    })

    // Каждая страница сборки и служебные on-demand: /now и 404 на языке каждой локали.
    const notFound = SUPPORTED_LOCALES.map((locale) => localePath(locale, '/net-takogo-adresa'))
    for (const path of [...prerenderedPaths(), '/now', ...notFound]) {
      test(path, async ({ page }) => {
        await page.goto(path)
        expect(await violations(page)).toEqual([])
      })
    }

    // Ответ с ошибками открывается отказом: окно называет его, фокус — на сводке.
    test('ответ формы с ошибками: «Ошибка» в заголовке окна, фокус на сводке, нарушений нет', async ({
      page,
    }) => {
      await page.goto('/contacts')
      // Нативная проверка отключена: ошибки должен вернуть сервер.
      await page.locator('form[method="post"]').evaluate((form: HTMLFormElement) => {
        form.noValidate = true
      })
      await page.getByRole('button', { name: t(DEFAULT_LOCALE, 'form.submit') }).click()
      await expect(page).toHaveTitle(
        new RegExp(`^${t(DEFAULT_LOCALE, 'form.failed', { title: '' })}`),
      )
      await expect(page.getByRole('alert')).toBeFocused()
      expect(await violations(page)).toEqual([])
    })
  })
}

// Выбор против системы: тему и color-scheme даёт блок атрибута файла токенов, а не система.
test.describe('выбранная вручную тёмная тема', () => {
  test.skip(!THEME.switcher, 'кнопки выбора нет: тему задаёт поле THEME')
  test.use({
    colorScheme: 'light',
    storageState: ({ baseURL }, use) => use(stored(baseURL ?? '', 'dark')),
  })

  test('нарушений нет', async ({ page }) => {
    await page.goto('/contacts')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await violations(page)).toEqual([])
  })
})
