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
// система, заданную полем THEME ставит разметка, остальные — выбор (хранилище острова).
type Theme = 'light' | 'dark'
const SITE_THEMES: readonly Theme[] =
  THEME.default === 'system' || THEME.switcher ? ['light', 'dark'] : [THEME.default]

// Выбор прошлого визита — хранилище острова предпочтений на origin сайта, до загрузки страницы.
const stored = (origin: string, theme: Theme) => ({
  cookies: [],
  origins: [{ origin, localStorage: [{ name: 'theme', value: theme }] }],
})

for (const theme of SITE_THEMES) {
  test.describe(`axe, тема ${theme}`, () => {
    const bySite = THEME.default === 'system' || THEME.default === theme
    test.use({
      colorScheme: theme,
      storageState: ({ baseURL }, use) => use(bySite ? undefined : stored(baseURL ?? '', theme)),
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

  test('кнопка ставит data-theme, объявляет состояние и запоминает выбор для всего сайта', async ({
    page,
  }) => {
    await page.goto('/')
    const root = page.locator('html')
    const toggle = page.getByRole('button', { name: t('ru', 'theme.dark') })
    // До выбора тема — из разметки: атрибут стоит только у темы по умолчанию.
    const before = await root.getAttribute('data-theme')
    expect(before).toBe(THEME.default === 'system' ? null : THEME.default)
    const canvas = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const system = await canvas()
    const wasDark = (await toggle.getAttribute('aria-pressed')) === 'true'

    await toggle.click()
    const chosen = wasDark ? 'light' : 'dark'
    await expect(root).toHaveAttribute('data-theme', chosen)
    await expect(toggle).toHaveAttribute('aria-pressed', String(!wasDark))
    // Атрибут включает блок темы файла токенов: фон страницы — уже роль выбранной темы.
    expect(await canvas()).not.toBe(system)
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(chosen)

    // Выбор действует на весь сайт и переживает перезагрузку.
    await page.goto(prerenderedPaths().find((path) => path.split('/').length > 2) ?? '/')
    await expect(root).toHaveAttribute('data-theme', chosen)
    await page.reload()
    await expect(root).toHaveAttribute('data-theme', chosen)
    await expect(toggle).toHaveAttribute('aria-pressed', String(!wasDark))
  })

  // Выбор и система включают один блок темы файла токенов: кнопка против системы даёт тот же фон
  // страницы, что система без выбора, — в обе стороны.
  test('выбор побеждает систему: фон страницы — роль выбранной темы', async ({ browser }) => {
    test.skip(THEME.default !== 'system', 'тему без выбора задаёт поле THEME, а не система')
    const canvasOf = async (system: Theme, choose: boolean) => {
      const context = await browser.newContext({ colorScheme: system })
      const page = await context.newPage()
      await page.goto('/')
      if (choose) await page.getByRole('button', { name: t('ru', 'theme.dark') }).click()
      const color = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      await context.close()
      return color
    }
    const [light, dark] = [await canvasOf('light', false), await canvasOf('dark', false)]
    expect(light).not.toBe(dark)
    expect(await canvasOf('light', true)).toBe(dark)
    expect(await canvasOf('dark', true)).toBe(light)
  })

  test.describe('выбранная вручную тёмная тема', () => {
    test.use({ storageState: ({ baseURL }, use) => use(stored(baseURL ?? '', 'dark')) })

    test('нарушений нет', async ({ page }) => {
      await page.goto('/contacts')
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      expect(await violations(page)).toEqual([])
    })
  })

  test('без JavaScript кнопки темы нет — выбор не применить и не сохранить', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('[data-preference="theme"]')).toBeHidden()
    await context.close()
  })
})
