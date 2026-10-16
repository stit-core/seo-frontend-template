import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { t } from '@/shared/i18n'
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

const RU = testLocale('ru')
const LOCALES = [RU, testLocale('en'), testLocale('de')]
const details = (locale = RU) => ({
  ...contactDetails.props(strategyPage('about', locale), 'details'),
  locale,
})

const render = async (props: Record<string, unknown>) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(ContactDetails, { props })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('ContactDetails', () => {
  it('секция плана — в разметке на каждом языке страницы: тексты, телефон и почта ссылками', async () => {
    for (const locale of LOCALES) {
      const { html } = await render(details(locale))
      expect(
        sectionFaults(html, strategyPage('about', locale), 'details', contactDetails),
        locale,
      ).toEqual([])
    }
  })

  it('контакты — в <address>: строки по порядку, ссылки канала показывают свой адрес; реквизиты — после', async () => {
    const { section } = await render(details())
    const title = section?.querySelector('h1, h2, h3')
    expect([title?.tagName, title?.id]).toEqual(['H2', 'details'])
    const address = section?.querySelector('address')
    expect(
      [...(address?.querySelectorAll(':scope > p') ?? [])].map((p) => p.textContent?.trim()),
    ).toEqual(['101000, Москва, ул. Тестовая, 1', '+70000000000', 'test@example.com'])
    expect(
      [...(address?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('href')),
    ).toEqual(['tel:+70000000000', 'mailto:test@example.com'])
    expect(section?.querySelector('address + p')?.textContent).toBe(
      'ООО «Тест», ОГРН\u00a01000000000002',
    )
  })

  // Часы — пара «термин — описание» (html каталога): строка copy deck, которая их называет, с временем факта в <time>.
  it('часы работы — <dl> на месте своей строки: подпись словаря, строка плана, время факта в <time>', async () => {
    const { section } = await render(details())
    const list = section?.querySelector('address > dl')
    expect(list?.previousElementSibling?.textContent).toBe('101000, Москва, ул. Тестовая, 1')
    expect(list?.querySelector('dt')?.textContent).toBe(t(RU, 'company.hours'))
    expect(list?.querySelector('dd')?.textContent?.trim()).toBe('Пн–Пт, 10:00–19:00')
    expect(
      [...(list?.querySelectorAll('time') ?? [])].map((time) => [
        time.getAttribute('datetime'),
        time.textContent,
      ]),
    ).toEqual([
      ['10:00', '10:00'],
      ['19:00', '19:00'],
    ])
  })

  it('факт часов есть, а строки контактов с его временем нет — ошибка называет ключ', async () => {
    await expect(render({ ...details(), info: ['Москва'] })).rejects.toThrow(
      'strategy: details/info — часы факта company-hours (mo, tu, we, th, fr 10:00–19:00) — нет строки контактов с ними',
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
    await expectNoA11yViolations((await render(details())).html)
  })
})
