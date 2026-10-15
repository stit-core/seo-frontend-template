import { THEME } from '../../src/shared/config/site.ts'
import { t } from '../../src/shared/i18n/dict.ts'
import { DEFAULT_LOCALE } from '../../src/shared/i18n/locale.ts'
import { prerenderedPaths } from '../site'
import { expect, test } from './csp'
import type { Theme } from './themes'

test.describe('явный выбор темы', () => {
  test.skip(!THEME.switcher, 'кнопки выбора нет: тему задаёт поле THEME')

  test('кнопка ставит data-theme, объявляет состояние и запоминает выбор для всего сайта', async ({
    page,
  }) => {
    await page.goto('/')
    const root = page.locator('html')
    const toggle = page.getByRole('button', { name: t(DEFAULT_LOCALE, 'theme.dark') })
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
      if (choose) await page.getByRole('button', { name: t(DEFAULT_LOCALE, 'theme.dark') }).click()
      const color = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      await context.close()
      return color
    }
    const [light, dark] = [await canvasOf('light', false), await canvasOf('dark', false)]
    expect(light).not.toBe(dark)
    expect(await canvasOf('light', true)).toBe(dark)
    expect(await canvasOf('dark', true)).toBe(light)
  })

  test('без JavaScript кнопки темы нет — выбор не применить и не сохранить', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('[data-theme-toggle]')).toBeHidden()
    await context.close()
  })
})
