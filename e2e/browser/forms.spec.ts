import type { APIRequestContext } from '@playwright/test'
import { t } from '../../src/shared/i18n/dict.ts'
import { originOf } from '../site'
import { expect, test } from './csp'

const MESSAGE = 'Нужен сайт с блогом, формой заявки и картой сайта. Бюджет обсудим.'

const address = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

const delivered = async (request: APIRequestContext) =>
  (await (await request.get(`${originOf('stub')}/received`)).json()) as string[]

test.describe('форма обратной связи в браузере без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('заявка уходит, PRG приводит на страницу подтверждения', async ({ page, request }) => {
    const email = address('browser')
    await page.goto('/contacts')
    await page.getByLabel(t('ru', 'form.name')).fill('Мария')
    await page.getByLabel(t('ru', 'form.email')).fill(email)
    await page.getByLabel(t('ru', 'form.message')).fill(MESSAGE)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: t('ru', 'form.submit') }).click()

    await expect(page).toHaveURL('/contacts/spasibo')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('ru', 'thanks.title'))
    await expect.poll(() => delivered(request)).toContain(email)
  })

  test('без галочки согласия браузер форму не отправляет', async ({ page, request }) => {
    const email = address('no-consent')
    await page.goto('/contacts')
    await page.getByLabel(t('ru', 'form.name')).fill('Мария')
    await page.getByLabel(t('ru', 'form.email')).fill(email)
    await page.getByLabel(t('ru', 'form.message')).fill(MESSAGE)
    await page.getByRole('button', { name: t('ru', 'form.submit') }).click()

    // Нативная валидация required работает и без скриптов: страница та же, заявки нет.
    await expect(page).toHaveURL('/contacts')
    await expect(page.getByRole('checkbox')).not.toBeChecked()
    expect(await delivered(request)).not.toContain(email)
  })
})
