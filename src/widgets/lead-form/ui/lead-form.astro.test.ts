import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import {
  expectNoA11yViolations,
  parseHtml,
  sectionFaults,
  TEST_SITE,
  testLocale,
} from '@/shared/lib/testing'
import { policyOf, strategyPage } from '@/shared/strategy'
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
const privacy = Object.fromEntries(
  Object.entries(TEST_SITE).filter(([path]) =>
    /\/(?:plans|copy)\/privacy(?:\.\w+)?\.yaml$/.test(path),
  ),
)

const render = async (locale = RU) => {
  const page = strategyPage('contacts', locale)
  const container = await AstroContainer.create()
  const html = await container.renderToString(LeadForm, {
    props: {
      ...leadForm.props(page, 'request'),
      action: '/api/contact',
      policy: policyOf(page, privacy),
      locale,
    },
  })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('LeadForm', () => {
  it('секция плана — в разметке на каждом языке страницы: заголовок, ценность, форма, согласие, что дальше, мессенджер', async () => {
    for (const locale of [RU, EN]) {
      const { html } = await render(locale)
      expect(
        sectionFaults(html, strategyPage('contacts', locale), 'request', leadForm),
        locale,
      ).toEqual([])
    }
  })

  it('форма плана под заголовком h2: поля набора, подпись кнопки и согласие — тексты плана', async () => {
    const { section } = await render()
    const title = section?.querySelector('h1, h2')
    expect([title?.tagName, title?.id, title?.textContent]).toEqual(['H2', 'request', 'Заявка'])
    const form = section?.querySelector('form')
    expect(form?.querySelector('input[name="form_id"]')?.getAttribute('value')).toBe(
      'contacts/request',
    )
    expect(form?.querySelector('#request-task')).not.toBeNull()
    expect(form?.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Получить ответ')
    expect(form?.querySelector('label[for="request-consent"]')?.textContent?.trim()).toBe(
      'Согласен на обработку персональных данных',
    )
    expect(form?.querySelector('#request-policy a')?.textContent?.trim()).toBe('Политика теста')
  })

  // Успех формы без JS — страница «спасибо» плана: текста успеха на месте формы нет; готовое сообщение несёт ссылка.
  it('текст успеха и готовое сообщение мессенджера блок принимает и не показывает', async () => {
    const { html, section } = await render()
    expect(html).not.toContain('Заявка у нас.')
    expect(html).not.toContain('Хочу обсудить сайт.')
    expect(section?.querySelector('a[href^="https://t.me/test?text="]')?.textContent?.trim()).toBe(
      't.me/test',
    )
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
