import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { THEME } from '../../src/shared/config/site.ts'
import { t } from '../../src/shared/i18n/dict.ts'
import { localePath, SUPPORTED_LOCALES } from '../../src/shared/i18n/locale.ts'
import { prerenderedPaths } from '../site'
import { expect, test } from './csp'

// WCAG 2.2 AA целиком: без тегов axe не запускает, например, target-size (2.5.8).
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

const violations = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(RULES).analyze()).violations

// Темы, которые сайт показывает, и путь посетителя к каждой: без темы по умолчанию её даёт
// система, заданную полем THEME ставит разметка, остальные — выбор (cookie острова).
const SITE_THEMES: ReadonlyArray<'light' | 'dark'> =
  THEME.default === 'system' || THEME.switcher ? ['light', 'dark'] : [THEME.default]

for (const theme of SITE_THEMES) {
  test.describe(`axe, тема ${theme}`, () => {
    test.use({ colorScheme: theme })
    test.beforeEach(async ({ context, baseURL }) => {
      if (THEME.default === 'system' || THEME.default === theme) return
      await context.addCookies([{ name: 'scheme', value: theme, url: baseURL ?? '' }])
    })

    // Каждая страница сборки и служебные on-demand: /now и 404 на языке каждой локали.
    const notFound = SUPPORTED_LOCALES.map((locale) => localePath(locale, '/net-takogo-adresa'))
    for (const path of [...prerenderedPaths(), '/now', ...notFound]) {
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
  test.skip(!THEME.switcher, 'кнопки выбора нет: тему задаёт поле THEME')

  test('переключатель ставит data-theme и cookie, выбор переживает перезагрузку', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-js', 'on')
    // До выбора тема — из разметки: атрибут стоит только у темы по умолчанию.
    expect(await root.getAttribute('data-theme')).toBe(
      THEME.default === 'system' ? null : THEME.default,
    )
    const canvas = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const system = await canvas()

    await page.getByRole('button', { name: t('ru', 'theme.toggle') }).click()
    const chosen = await root.getAttribute('data-theme')
    expect(chosen).toMatch(/^(light|dark)$/)
    // Атрибут включает блок темы файла токенов: фон страницы — уже роль выбранной темы.
    expect(await canvas()).not.toBe(system)
    const cookie = (await context.cookies()).find((item) => item.name === 'scheme')
    expect(cookie?.value).toBe(chosen)

    // Выбор действует на весь сайт, а не только на раздел, где сделан.
    await page.goto(prerenderedPaths().find((path) => path.split('/').length > 2) ?? '/')
    await expect(root).toHaveAttribute('data-theme', chosen ?? '')
  })

  test('в выбранной вручную тёмной теме нарушений нет', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'scheme', value: 'dark', url: baseURL ?? '' }])
    await page.goto('/contacts')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
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
