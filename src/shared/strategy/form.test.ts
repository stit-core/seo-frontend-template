import { TEST_SITE, testLocale } from '@/shared/lib/testing'
import { projectOf } from './contract'
import { type LeadForm, siteOf } from './page'

// Механика — на локалях и проекте теста.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')

const site = siteOf(projectOf(TEST_SITE))
const PLAN = 'site/test/plans/contacts.yaml'
type Plan = (typeof TEST_SITE)[typeof PLAN]

// Контакты проекта теста с другой формой действия секции формы.
const withForm = (form: Record<string, unknown>) => {
  const plan: Plan = TEST_SITE[PLAN]
  const [section] = plan.sections
  const action = section?.slots.action.map((slot) =>
    slot.id === 'form' ? { id: 'form', form } : slot,
  )
  return siteOf(
    projectOf({
      ...TEST_SITE,
      [PLAN]: { ...plan, sections: [{ ...section, slots: { ...section?.slots, action } }] },
    }),
  )
}
const formOf = (page = site.strategyPage('contacts', RU)) =>
  page.sections.find((section) => section.id === 'request')?.slots.form as LeadForm

describe('форма действия плана — набор каталога lead-forms.yaml', () => {
  it('поля набора по порядку, «хотя бы одно из», ловушка и скрытые поля каталога, «спасибо» и страница — на языке', () => {
    const form = formOf()
    expect([form.id, form.set, form.page, form.thankYou]).toEqual([
      'contacts/request',
      'contact-message',
      '/contacts',
      { href: '/contacts/spasibo' },
    ])
    expect(form.fields.map(({ id, type, required }) => [id, type, required])).toEqual([
      ['name', 'text', false],
      ['email', 'email', false],
      ['phone', 'tel', false],
      ['contact-channel', 'radio', false],
      ['task', 'textarea', true],
    ])
    expect([form.oneOf, form.honeypot, form.marketingConsent]).toEqual([
      ['email', 'phone'],
      'company-website',
      false,
    ])
    expect(form.server).toEqual([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'yclid',
      'gclid',
    ])
    const en = formOf(site.strategyPage('contacts', EN))
    expect([en.page, en.thankYou.href]).toEqual(['/en/contacts', '/en/contacts/spasibo'])
  })

  // Канал связи — только каналы, которые бизнес ведёт: у проекта теста — мессенджер Telegram.
  it('варианты канала связи — каналы фактов: телефона и почты у проекта теста нет', () => {
    expect(formOf().fields.find((field) => field.id === 'contact-channel')?.options).toEqual([
      'telegram',
    ])
  })

  it.each([
    [
      { ref: 'lead-forms.yaml#nope', thank_you_page: '/contacts/spasibo' },
      'lead-forms.yaml#nope — набора нет в каталоге',
    ],
    [{ ref: 'lead-forms.yaml#contact-message', success: 'inline' }, 'form.success: inline'],
    [{ ref: 'lead-forms.yaml#contact-message', consent: 'link-only' }, 'form.consent: link-only'],
    [{ ref: 'lead-forms.yaml#contact-message', marketing_consent: true }, 'form.marketing_consent'],
    [
      { ref: 'lead-forms.yaml#booking', thank_you_page: '/contacts/spasibo' },
      'шагов больше одного',
    ],
    [
      { ref: 'lead-forms.yaml#quote-request', thank_you_page: '/contacts/spasibo' },
      'поле file вида file',
    ],
    [
      { ref: 'lead-forms.yaml#event-registration', thank_you_page: '/contacts/spasibo' },
      'варианты поля event-session — by-event-facts, а не список',
    ],
    [{ ref: 'lead-forms.yaml#contact-message' }, 'нет form.thank_you_page'],
  ])(
    'форма без JS, которую план описать не может, — ошибка сборки с ключом действия: %o',
    (form, why) => {
      expect(() => withForm(form).strategyPage('contacts', RU)).toThrow(
        `strategy: contacts/request/form — `,
      )
      expect(() => withForm(form).strategyPage('contacts', RU)).toThrow(why)
    },
  )

  it('мессенджер с готовым сообщением — ссылка с текстом слота messenger-prefill своей секции', () => {
    const request = site
      .strategyPage('contacts', RU)
      .sections.find((section) => section.id === 'request')
    const text = request?.slots['messenger-prefill']
    if (typeof text !== 'string') throw new Error('нет текста готового сообщения')
    expect(request?.slots.messenger).toEqual({
      href: `https://t.me/test?text=${encodeURIComponent(text)}`,
    })
  })
})

describe('политика согласия формы', () => {
  const privacy: Record<string, unknown> = Object.fromEntries(
    Object.entries(TEST_SITE).filter(([path]) =>
      /\/(?:plans|copy)\/privacy(?:\.\w+)?\.yaml$/.test(path),
    ),
  )

  it('версия политики по карте, заголовок документа и дата редакции — факт, который план связывает с датой', () => {
    for (const locale of [RU, EN]) {
      const page = site.strategyPage('contacts', locale)
      const policy = site.policyOf(page, privacy)
      expect(policy, locale).toEqual({
        ...page.policy,
        title: 'Политика теста',
        revision: '1 октября 2026 года',
      })
    }
  })

  // План политики в модуле — с другой формой: без заголовка, с заголовком не текстом секции, без факта даты редакции.
  const privacyWith = (page: Record<string, unknown>, data: unknown[] | undefined) =>
    Object.fromEntries(
      Object.entries(privacy).map(([path, file]) => {
        if (!path.includes('/plans/')) return [path, file]
        const plan = file as {
          page: Record<string, unknown>
          sections: Array<{ slots: Record<string, unknown> }>
        }
        const sections = plan.sections.map((section) => ({
          ...section,
          slots: { ...section.slots, data },
        }))
        return [path, { ...plan, page: { ...plan.page, ...page }, sections }]
      }),
    )

  it.each([
    [{}, 'в модуле политики планов 0'],
    [privacyWith({ seo: {} }, []), 'privacy/seo/h1 — у документа нет заголовка'],
    [
      privacyWith({ seo: { h1: 'policy.nope' } }, []),
      'privacy/policy/nope — заголовок документа — не текст секции',
    ],
    [privacyWith({}, []), 'privacy/policy/date — у даты редакции документа нет факта'],
  ])('модуль политики, по которому согласию нечего назвать, — ошибка с ключом', (files, why) => {
    expect(() => site.policyOf(site.strategyPage('contacts', RU), files as never)).toThrow(why)
  })

  it('модуль другой страницы вместо политики плана — ошибка с ключом', () => {
    const about = Object.fromEntries(
      Object.entries(TEST_SITE).filter(([path]) =>
        /\/(?:plans|copy)\/about(?:\.\w+)?\.yaml$/.test(path),
      ),
    )
    expect(() => site.policyOf(site.strategyPage('contacts', RU), about)).toThrow(
      'strategy: contacts/legal/privacy_policy — модуль страницы about — не политика плана /legal/privacy',
    )
  })
})
