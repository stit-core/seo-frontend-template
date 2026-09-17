import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import { COMPANY } from '../model/company'
import CompanyContacts from './company-contacts.astro'

const render = async (locale: 'ru' | 'en') => {
  const container = await AstroContainer.create()
  return container.renderToString(CompanyContacts, { props: { locale } })
}

describe('CompanyContacts', () => {
  it('печатает контакты оператора списком определений и ссылками', async () => {
    const html = await render('ru')
    expect(html).toContain(`href="mailto:${COMPANY.email}"`)
    expect(html).toContain(`href="tel:${COMPANY.phoneHref}"`)
    expect(html).toContain('Москва')
    expect(html).toContain(COMPANY.hours.ru)
    expect(html).toContain('<address')
  })

  it('адрес и часы работы переводятся', async () => {
    const html = await render('en')
    expect(html).toContain('Moscow')
    expect(html).toContain(COMPANY.hours.en)
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render('ru'))
  })
})
