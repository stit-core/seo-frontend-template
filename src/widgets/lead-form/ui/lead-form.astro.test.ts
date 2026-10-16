import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { strategyPage } from '@/shared/strategy'
import { leadForm } from '../model/block'
import LeadForm from './lead-form.astro'

// Секция — форма контактов проекта теста на его локалях.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')
const page = { action: '/api/contact', policyHref: '/legal/privacy' }

const render = async (locale = RU, extra: Record<string, unknown> = {}) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(LeadForm, {
    props: {
      ...leadForm.props(strategyPage('contacts', locale), 'request'),
      ...page,
      locale,
      ...extra,
    },
  })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('LeadForm', () => {
  it('секция плана — в разметке на каждом языке страницы: заголовок, ценность, кнопка, согласие, что дальше', async () => {
    for (const locale of [RU, EN]) {
      const { html } = await render(locale)
      expect(
        sectionFaults(html, strategyPage('contacts', locale), 'request', leadForm),
        locale,
      ).toEqual([])
    }
  })

  it('форма — в секции под заголовком h2: обработчик страницы, подпись кнопки и согласие — тексты плана', async () => {
    const { section } = await render()
    const title = section?.querySelector('h1, h2')
    expect([title?.tagName, title?.id, title?.textContent]).toEqual(['H2', 'request', 'Заявка'])
    const form = section?.querySelector('form')
    expect([form?.getAttribute('method'), form?.getAttribute('action')]).toEqual([
      'post',
      '/api/contact',
    ])
    expect(form?.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Получить ответ')
    expect(form?.querySelector('label[for="contact-consent"] span span')?.textContent).toBe(
      'Согласен на обработку персональных данных',
    )
    expect(form?.querySelector('a[href="/legal/privacy"]')).not.toBeNull()
    // Что будет дальше — под формой.
    expect(section?.querySelector('form')?.parentElement?.nextElementSibling?.textContent).toBe(
      'Ответим в течение рабочего дня.',
    )
  })

  // Успех формы без JS — страница «спасибо» плана: текста успеха на месте формы нет.
  it('текст успеха блок принимает и не показывает', async () => {
    const { html } = await render()
    expect(html).not.toContain('Заявка у нас.')
  })

  it('ответ с ошибками — поля и сводка той же формы', async () => {
    const { section } = await render(RU, {
      values: { name: 'М', email: 'test@example.com', message: 'коротко', consent: false },
      errors: { name: 'form.error.name' },
    })
    expect(section?.querySelector('[role="alert"] a')?.getAttribute('href')).toBe('#contact-name')
    expect(section?.querySelector('#contact-name')?.getAttribute('aria-invalid')).toBe('true')
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
