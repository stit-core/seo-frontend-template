import type { APIRequestContext, Page } from '@playwright/test'
import { DEFAULT_LOCALE } from '../../src/shared/i18n/locale.ts'
import { leadFieldsOf, leadFormOf, originOf, pagePathOf, pageText } from '../site'
import { expect, test } from './csp'

// Форма плана контактов: поля набора и страница «спасибо» — из плана и каталога.
const PLAN = leadFormOf('contacts')
const [PAGE, SECTION] = PLAN.id.split('/') as [string, string]

const address = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

const delivered = async (request: APIRequestContext) =>
  (await (await request.get(`${originOf('stub')}/received`)).json()) as string[]

// Поля набора формы — по их именам каталога: обязательные и способ ответа, метка заявки — в одном из них.
async function fill(page: Page, marker: string) {
  for (const [name, value] of Object.entries(leadFieldsOf(PLAN, marker))) {
    await page.locator(`[name="${name}"]`).fill(value)
  }
}

test.describe('форма обратной связи в браузере без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('заявка уходит, PRG приводит на страницу «спасибо» плана', async ({ page, request }) => {
    const marker = address('browser')
    await page.goto(PLAN.url)
    await fill(page, marker)
    await page.locator('[name="consent"]').check()
    await page
      .getByRole('button', { name: pageText(PAGE, 'lead-form', 'cta-label', DEFAULT_LOCALE) })
      .click()

    await expect(page).toHaveURL(pagePathOf(PLAN.thankYou, DEFAULT_LOCALE))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      pageText('thank-you', 'thank-you', 'title', DEFAULT_LOCALE),
    )
    await expect.poll(() => delivered(request)).toContain(marker)
  })

  test('без галочки согласия браузер форму не отправляет', async ({ page, request }) => {
    const marker = address('no-consent')
    await page.goto(PLAN.url)
    await fill(page, marker)
    await page
      .getByRole('button', { name: pageText(PAGE, 'lead-form', 'cta-label', DEFAULT_LOCALE) })
      .click()

    // Нативная валидация required работает и без скриптов: страница та же, заявки нет.
    await expect(page).toHaveURL(PLAN.url)
    await expect(page.locator(`#${SECTION}-consent`)).not.toBeChecked()
    expect(await delivered(request)).not.toContain(marker)
  })
})
