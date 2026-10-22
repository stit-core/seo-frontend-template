import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { DEFAULT_LOCALE, localeOf, localePath } from '../../src/shared/i18n/locale.ts'
import {
  leadFieldsOf,
  leadForms,
  originOf,
  type PlanForm,
  pagePathOf,
  pageTitle,
  sectionText,
} from '../site'
import { expect, test } from './csp'

// Формы планов: поля набора, страница «спасибо» и подпись кнопки — из плана, каталога и copy deck; путь проходит каждая.
const PLANS = leadForms()

const address = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

const delivered = async (request: APIRequestContext) =>
  (await (await request.get(`${originOf('stub')}/received`)).json()) as string[]

// Форма плана на её странице — по своему `form_id`: на странице их может быть несколько.
const formOn = (page: Page, plan: PlanForm): Locator =>
  page.locator('form').filter({ has: page.locator(`input[name="form_id"][value="${plan.id}"]`) })

// Поля набора формы — по их именам каталога: обязательные и способ ответа, метка заявки — в одном из них.
async function fill(form: Locator, plan: PlanForm, marker: string) {
  for (const [name, value] of Object.entries(leadFieldsOf(plan, marker))) {
    await form.locator(`[name="${name}"]`).fill(value)
  }
}

test.describe('форма обратной связи в браузере без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('заявка уходит, PRG приводит на страницу «спасибо» плана', async ({ page, request }) => {
    for (const plan of PLANS) {
      const locale = plan.locales[0] ?? DEFAULT_LOCALE
      const marker = address('browser')
      await page.goto(localePath(locale, plan.url))
      const form = formOn(page, plan)
      await fill(form, plan, marker)
      await form.locator('[name="consent"]').check()
      await form
        .getByRole('button', { name: sectionText(plan.page, plan.section, 'cta-label', locale) })
        .click()

      // «Спасибо» — версия языка страницы формы, без неё — другого языка, как ссылка с этой страницы.
      const thanks = pagePathOf(plan.thankYou, locale)
      await expect(page, plan.id).toHaveURL(thanks)
      await expect(page.getByRole('heading', { level: 1 }), plan.id).toHaveText(
        pageTitle(plan.thankYou, localeOf(thanks)),
      )
      await expect.poll(() => delivered(request), plan.id).toContain(marker)
    }
  })

  test('без галочки согласия браузер форму не отправляет', async ({ page, request }) => {
    for (const plan of PLANS) {
      const locale = plan.locales[0] ?? DEFAULT_LOCALE
      const marker = address('no-consent')
      const url = localePath(locale, plan.url)
      await page.goto(url)
      const form = formOn(page, plan)
      await fill(form, plan, marker)
      await form
        .getByRole('button', { name: sectionText(plan.page, plan.section, 'cta-label', locale) })
        .click()

      // Нативная валидация required работает и без скриптов: страница та же, заявки нет.
      await expect(page, plan.id).toHaveURL(url)
      await expect(form.locator('[name="consent"]'), plan.id).not.toBeChecked()
      expect(await delivered(request), plan.id).not.toContain(marker)
    }
  })
})
