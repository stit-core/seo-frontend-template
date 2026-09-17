import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import ContactForm from './contact-form.astro'

const props = { locale: 'ru' as const, action: '/api/contact', policyHref: '/legal/privacy' }

const render = async (extra: Record<string, unknown> = {}) => {
  const container = await AstroContainer.create()
  return container.renderToString(ContactForm, { props: { ...props, ...extra } })
}

describe('ContactForm', () => {
  it('нативная форма: POST, подписанные поля, ловушка и согласие со ссылкой на политику', async () => {
    const html = await render()
    expect(html).toContain('<form method="post" action="/api/contact"')
    expect(html).toContain('<label class="block text-body-sm font-medium" for="contact-name"')
    expect(html).toContain('id="contact-email"')
    expect(html).toContain('id="contact-message"')
    expect(html).toContain('name="locale" value="ru"')
    expect(html).toContain('name="company"')
    expect(html).toContain('href="/legal/privacy"')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('required')
    // Форма работает без JS: ни одного скрипта в разметке.
    expect(html).not.toContain('<script')
  })

  it('с ошибками: сводка, разметка полей и сохранённые значения', async () => {
    const html = await render({
      values: { name: 'М', email: 'not-an-email', message: 'коротко', consent: false },
      errors: {
        name: 'form.error.name',
        email: 'form.error.email',
        consent: 'form.error.consent',
      },
    })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Заявка не отправлена')
    expect(html).toContain('href="#contact-name"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="contact-email-error"')
    expect(html).toContain('id="contact-consent-error"')
    expect(html).toContain('value="not-an-email"')
    expect(html).toContain('>коротко</textarea>')
  })

  it('сбой доставки показывается сводкой вместо ошибок полей', async () => {
    const html = await render({ notice: 'form.error.delivery' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('сбой доставки')
    expect(html).not.toContain('href="#contact-name"')
  })

  it('не имеет нарушений доступности — и пустая, и с ошибками', async () => {
    await expectNoA11yViolations(await render())
    await expectNoA11yViolations(
      await render({ errors: { name: 'form.error.name' }, notice: 'form.error.delivery' }),
    )
  })
})
