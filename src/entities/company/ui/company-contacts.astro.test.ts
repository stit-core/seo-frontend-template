import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '@/shared/i18n'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import { COMPANY } from '../model/company'
import CompanyContacts from './company-contacts.astro'

const render = async (locale: Locale) => {
  const container = await AstroContainer.create()
  return container.renderToString(CompanyContacts, { props: { locale } })
}

describe('CompanyContacts', () => {
  it('печатает контакты оператора списком определений и ссылками', async () => {
    const html = await render(DEFAULT_LOCALE)
    expect(html).toContain(`href="mailto:${COMPANY.email}"`)
    expect(html).toContain(`href="tel:${COMPANY.phoneHref}"`)
    expect(html).toContain(COMPANY.address[DEFAULT_LOCALE].locality)
    expect(html).toContain(COMPANY.hours[DEFAULT_LOCALE])
    expect(html).toContain('<address')
  })

  it('адрес и часы работы — на языке страницы', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const html = await render(locale)
      expect(html, locale).toContain(COMPANY.address[locale].locality)
      expect(html, locale).toContain(COMPANY.hours[locale])
    }
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render(DEFAULT_LOCALE))
  })
})
