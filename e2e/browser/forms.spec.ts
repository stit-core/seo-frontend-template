import type { APIRequestContext } from '@playwright/test'
import { DEFAULT_LOCALE } from '../../src/shared/i18n/locale.ts'
import { originOf, pageText } from '../site'
import { expect, test } from './csp'

const TASK = 'Нужен сайт с блогом, формой заявки и картой сайта. Бюджет обсудим.'

const address = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

const delivered = async (request: APIRequestContext) =>
  (await (await request.get(`${originOf('stub')}/received`)).json()) as string[]

// Поля набора формы контактов — по их именам каталога: обязательная задача и почта для ответа.
test.describe('форма обратной связи в браузере без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('заявка уходит, PRG приводит на страницу подтверждения', async ({ page, request }) => {
    const email = address('browser')
    await page.goto('/contacts')
    await page.locator('[name="email"]').fill(email)
    await page.locator('[name="task"]').fill(TASK)
    await page.locator('[name="consent"]').check()
    await page
      .getByRole('button', { name: pageText('contacts', 'lead-form', 'cta-label', DEFAULT_LOCALE) })
      .click()

    await expect(page).toHaveURL('/contacts/spasibo')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      pageText('thank-you', 'thank-you', 'title', DEFAULT_LOCALE),
    )
    await expect.poll(() => delivered(request)).toContain(email)
  })

  test('без галочки согласия браузер форму не отправляет', async ({ page, request }) => {
    const email = address('no-consent')
    await page.goto('/contacts')
    await page.locator('[name="email"]').fill(email)
    await page.locator('[name="task"]').fill(TASK)
    await page
      .getByRole('button', { name: pageText('contacts', 'lead-form', 'cta-label', DEFAULT_LOCALE) })
      .click()

    // Нативная валидация required работает и без скриптов: страница та же, заявки нет.
    await expect(page).toHaveURL('/contacts')
    await expect(page.locator('[name="consent"]')).not.toBeChecked()
    expect(await delivered(request)).not.toContain(email)
  })
})
