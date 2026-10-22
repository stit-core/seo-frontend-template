import { TEST_SITE, testLocale } from '@/shared/lib/testing'
import { consentOf, policyOf, projectOf, strategyPage } from '@/shared/strategy'
import { formPageOf, formsOf } from './forms'

// Белый список — на локалях и проекте теста: форма — у контактов (ru и en), у «О студии» формы нет.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')
const DE = testLocale('de')
const filesOf = (id: string) =>
  Object.fromEntries(
    Object.entries(TEST_SITE).filter(([path]) =>
      new RegExp(`/(?:plans|copy)/${id}(?:\\.\\w+)?\\.yaml$`).test(path),
    ),
  )
const consent = consentOf(projectOf(TEST_SITE), 'privacy')
const forms = formsOf([
  { files: filesOf('about'), consent, page: 'about' },
  { files: filesOf('contacts'), consent, page: 'contacts' },
])

describe('белый список обработчика формы', () => {
  // Форма — на второй странице реестра: её запись называет свою страницу, а не первую.
  it('формы плана страниц на каждом языке страницы — со своей страницей и политикой согласия', () => {
    expect(forms.map(({ form, locale, page }) => [form.id, form.page, locale, page])).toEqual([
      ['contacts/request', '/contacts', RU, 'contacts'],
      ['contacts/request', '/en/contacts', EN, 'contacts'],
    ])
    for (const { locale, policy } of forms) {
      expect(policy, locale).toEqual(policyOf(strategyPage('contacts', locale), consent))
    }
  })

  it('модуль без плана — ошибка сборки', () => {
    expect(() => formsOf([{ files: {}, consent, page: 'none' }])).toThrow('страницы нет в карте')
  })

  it('GET обработчика — страница первой формы на языке запроса, без версии на нём — первой формы', () => {
    expect([formPageOf(forms, EN), formPageOf(forms, DE), formPageOf([], RU)]).toEqual([
      '/en/contacts',
      '/contacts',
      '/',
    ])
  })
})
