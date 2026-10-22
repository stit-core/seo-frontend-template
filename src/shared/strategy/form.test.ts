import { TEST_SITE, testLocale } from '@/shared/lib/testing'
import { consentOf, projectOf } from './contract'
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

  // Поля и «спасибо» — те, что называет план, а не набор и адрес шаблона: у callback телефон обязателен, время — варианты
  // каталога.
  it('поля набора form.ref и страница «спасибо» плана: callback — телефон обязателен, «хотя бы одного из» нет', () => {
    const form = formOf(
      withForm({ ref: 'lead-forms.yaml#callback', thank_you_page: '/about' }).strategyPage(
        'contacts',
        RU,
      ),
    )
    expect([form.set, form.oneOf, form.thankYou]).toEqual(['callback', [], { href: '/about' }])
    expect(form.fields.map(({ id, required, options }) => [id, required, options])).toEqual([
      ['phone', true, []],
      ['name', false, []],
      ['preferred-time', false, ['now-working-hours', 'morning', 'afternoon', 'evening']],
    ])
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

  // Ответ формы с ошибками печатает h1 страницы — текст слота `seo.h1` её плана.
  it('страница с формой — с заголовком плана на её языке; без `seo.h1` — ошибка сборки с ключом', () => {
    expect([site.strategyPage('contacts', RU).h1, site.strategyPage('contacts', EN).h1]).toEqual([
      'Заявка',
      'Заявка (en)',
    ])
    const plan: Plan = TEST_SITE[PLAN]
    const untitled = siteOf(
      projectOf({ ...TEST_SITE, [PLAN]: { ...plan, page: { ...plan.page, seo: undefined } } }),
    )
    expect(() => untitled.strategyPage('contacts', RU)).toThrow(
      'strategy: contacts/seo/h1 — у страницы с формой нет заголовка',
    )
  })

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
  const project = projectOf(TEST_SITE)
  const consent = consentOf(project, 'privacy')

  // Ссылка согласия читает проекцию документа: адрес, заголовок на языке каждого copy deck и факт даты редакции.
  it('проекция политики — адрес по карте, заголовок документа по языкам и факт, который план связывает с датой', () => {
    expect(consent).toEqual({
      id: 'privacy',
      url: '/legal/privacy',
      titles: { ru: 'Политика теста' },
      revision: 'fact:policy-revision',
    })
  })

  it('версия политики по карте, заголовок документа и дата редакции — формулировка факта на языке версии', () => {
    for (const locale of [RU, EN]) {
      const page = site.strategyPage('contacts', locale)
      expect(site.policyOf(page, consent), locale).toEqual({
        ...page.policy,
        title: 'Политика теста',
        revision: '1 октября 2026 года',
      })
    }
  })

  // План политики с другой формой: без заголовка, с заголовком не текстом секции, без факта даты редакции.
  const PRIVACY = 'site/test/plans/privacy.yaml'
  const withPolicy = (page: Record<string, unknown>, data: unknown[]) => {
    const plan = TEST_SITE[PRIVACY]
    const sections = plan.sections.map((section) => ({
      ...section,
      slots: { ...section.slots, data },
    }))
    return projectOf({
      ...TEST_SITE,
      [PRIVACY]: { ...plan, page: { ...plan.page, ...page }, sections },
    })
  }

  // Проект теста с copy deck политики без текста слота; без карты — лендинг (адрес документа — его план).
  const deckWithout = (slot: string) => ({
    ...project,
    decks: project.decks.map(({ copy_deck }) => ({
      copy_deck: {
        ...copy_deck,
        pages: copy_deck.pages.map((page) => ({
          ...page,
          sections: page.sections.map((section) => ({
            ...section,
            slots: section.slots.filter((candidate) => candidate.slot_id !== slot),
          })),
        })),
      },
    })),
  })
  const landing = (url?: string) => ({
    ...project,
    map: undefined,
    plans: project.plans.map((plan) => ({ ...plan, page: { ...plan.page, url } })),
  })

  it.each([
    [withPolicy({ seo: {} }, []), 'privacy/seo/h1 — у документа нет заголовка'],
    [
      withPolicy({ seo: { h1: 'policy.nope' } }, []),
      'privacy/policy/nope — заголовок страницы — не текст секции',
    ],
    [withPolicy({}, []), 'privacy/policy/date — у даты редакции документа нет факта'],
    [projectOf({}), 'privacy — нет плана'],
    [deckWithout('title'), 'privacy/policy/title — нет текста в copy deck ru'],
    [landing(), 'privacy — у страницы без карты нет page.url в плане'],
  ])('документ, по которому согласию нечего назвать, — ошибка сборки с ключом', (files, why) => {
    expect(() => consentOf(files, 'privacy')).toThrow(`strategy: ${why}`)
  })

  it('у лендинга без карты адрес документа — page.url его плана', () => {
    expect(consentOf(landing('/policy'), 'privacy').url).toBe('/policy')
  })

  it.each([
    [{}, 'contacts/legal/privacy_policy — модуль согласия — не проекция политики consentOf'],
    [
      { ...consent, id: 'about', url: '/about' },
      'contacts/legal/privacy_policy — проекция страницы about — не политика плана /legal/privacy',
    ],
    [{ ...consent, titles: {} }, 'privacy/seo/h1 — нет заголовка документа на ru'],
    [
      { ...consent, revision: 'missing:policy-revision' },
      'privacy/revision — missing:policy-revision нет в фактах ru',
    ],
  ])(
    'проекция, которая не та политика или без её данных на языке версии, — ошибка с ключом',
    (data, why) => {
      expect(() => site.policyOf(site.strategyPage('contacts', RU), data)).toThrow(
        `strategy: ${why}`,
      )
    },
  )
})
