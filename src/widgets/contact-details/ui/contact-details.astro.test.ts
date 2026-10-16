import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { strategyPage } from '@/shared/strategy'
import { contactDetails } from '../model/block'
import ContactDetails from './contact-details.astro'

// Секция — контакты «О компании» проекта теста на его локалях.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const LOCALES = [testLocale('ru'), testLocale('en'), testLocale('de')]

const render = async (props: Record<string, unknown>) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(ContactDetails, { props })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('ContactDetails', () => {
  it('секция плана — в разметке на каждом языке страницы: тексты, телефон и почта ссылками', async () => {
    for (const locale of LOCALES) {
      const page = strategyPage('about', locale)
      const { html } = await render(contactDetails.props(page, 'details'))
      expect(sectionFaults(html, page, 'details', contactDetails), locale).toEqual([])
    }
  })

  it('контакты — в <address>: строки по порядку, ссылки канала показывают свой адрес; реквизиты — после', async () => {
    const { section } = await render(
      contactDetails.props(strategyPage('about', testLocale('ru')), 'details'),
    )
    const title = section?.querySelector('h1, h2, h3')
    expect([title?.tagName, title?.id]).toEqual(['H2', 'details'])
    const address = section?.querySelector('address')
    expect([...(address?.querySelectorAll('p') ?? [])].map((p) => p.textContent?.trim())).toEqual([
      '101000, Москва, ул. Тестовая, 1',
      'Пн–Пт, 10:00–19:00',
      '+70000000000',
      'test@example.com',
    ])
    expect(
      [...(address?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('href')),
    ).toEqual(['tel:+70000000000', 'mailto:test@example.com'])
    expect(section?.querySelector('address + p')?.textContent).toBe(
      'ООО «Тест», ОГРН\u00a01000000000002',
    )
  })

  it('без телефона, почты и реквизитов — только контакты текстом', async () => {
    const { section } = await render({
      id: 'details',
      variant: 'compact',
      title: 'Контакты',
      info: ['Москва'],
    })
    expect(section?.querySelectorAll('a')).toHaveLength(0)
    expect(section?.querySelector('address + p')).toBeNull()
  })

  it('не имеет нарушений доступности', async () => {
    const { html } = await render(
      contactDetails.props(strategyPage('about', testLocale('ru')), 'details'),
    )
    await expectNoA11yViolations(html)
  })
})
