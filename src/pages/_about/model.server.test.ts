import type { FactValue, Section, StrategyPage } from '@/shared/strategy'
import { businessOf } from './model'

const fact = (id: string, machine: FactValue['machine']): FactValue => ({
  id,
  text: id,
  machine,
  binds: [],
})
const ADDRESS = fact('company-address', {
  type: 'postal-address',
  country: 'RU',
  locality: 'Москва',
  street: 'ул. Тестовая, 1',
  postal_code: '101000',
})
const hours = (...rows: Array<[string[], string, string]>) =>
  fact('company-hours', {
    type: 'opening-hours',
    hours: rows.map(([days, opens, closes]) => ({ days, opens, closes })),
  })
const WEEKDAYS = ['mo', 'tu', 'we', 'th', 'fr']

// «О компании» теста: первый экран и контакты — как их отдаёт чтение страницы; правка — в слоты контактов.
const page = (
  contacts: Section['slots'] = {},
  change: Partial<StrategyPage> = {},
): StrategyPage => ({
  id: 'about',
  url: '/about',
  parents: [],
  meta: {
    title: 'О студии',
    description: 'Студия теста',
    ogTitle: undefined,
    ogDescription: undefined,
    ogImageAlt: undefined,
  },
  sections: [
    {
      id: 'hero',
      role: 'hero',
      block: 'hero-text',
      variant: 'statement-cta',
      slots: {
        headline: 'О студии',
        subheadline: 'Студия делает сайты, которые видно в поиске.',
        cta: { href: '/contacts' },
        'cta-label': 'Оставить заявку',
      },
      groups: {},
    },
    {
      id: 'contacts',
      role: 'contacts',
      block: 'contact-details',
      variant: 'compact',
      slots: {
        title: 'Контакты',
        info: ['101000, Москва, ул. Тестовая, 1', 'Пн–Пт, 10:00–19:00'],
        phone: { href: 'tel:+70000000000' },
        email: { href: 'mailto:test@example.com' },
        company: [ADDRESS, hours([WEEKDAYS, '10:00', '19:00'])],
        ...contacts,
      },
      groups: {},
    },
  ],
  policy: undefined,
  operator: fact('ООО «Тест»', undefined),
  ...change,
})

describe('businessOf', () => {
  it('LocalBusiness — то, что показывает секция контактов: ссылки, факты адреса и часов, оператор плана', () => {
    expect(businessOf(page())).toEqual({
      legalName: 'ООО «Тест»',
      description: 'Студия делает сайты, которые видно в поиске.',
      email: 'test@example.com',
      telephone: '+70000000000',
      address: {
        country: 'RU',
        postalCode: '101000',
        locality: 'Москва',
        street: 'ул. Тестовая, 1',
      },
      openingHours: 'Mo,Tu,We,Th,Fr 10:00-19:00',
    })
  })

  it('часы — ряд факта на ряд строки Schema.org', () => {
    const company = [ADDRESS, hours([WEEKDAYS, '10:00', '19:00'], [['sa'], '11:00', '16:00'])]
    expect(businessOf(page({ company })).openingHours).toBe(
      'Mo,Tu,We,Th,Fr 10:00-19:00, Sa 11:00-16:00',
    )
  })

  it('чего-то, что размечает организация, на странице нет — ошибка называет ключ', () => {
    const { postal_code: _, ...noIndex } = ADDRESS.machine as { postal_code: string }
    const cases: Array<[string, StrategyPage]> = [
      ['strategy: about/legal/operator_ref — нет оператора', page({}, { operator: undefined })],
      ['strategy: about/contacts/phone — нет телефона', page({ phone: undefined })],
      ['strategy: about/contacts/email — нет почты', page({ email: undefined })],
      [
        'strategy: about/contacts — нет факта адреса (machine postal-address)',
        page({ company: [hours([WEEKDAYS, '10:00', '19:00'])] }),
      ],
      [
        'strategy: about/contacts — нет факта часов работы (machine opening-hours)',
        page({ company: [ADDRESS, fact('company-name', undefined)] }),
      ],
      [
        'strategy: about/contacts — у адреса нет индекса',
        page({
          company: [
            fact('company-address', noIndex as FactValue['machine']),
            hours([WEEKDAYS, '10:00', '19:00']),
          ],
        }),
      ],
    ]
    for (const [message, about] of cases) expect(() => businessOf(about), message).toThrow(message)
  })
})
