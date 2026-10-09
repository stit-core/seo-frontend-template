import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import ContactForm from './contact-form.astro'

const props = { locale: 'ru' as const, action: '/api/contact', policyHref: '/legal/privacy' }

const render = async (extra: Record<string, unknown> = {}) => {
  const container = await AstroContainer.create()
  return container.renderToString(ContactForm, { props: { ...props, ...extra } })
}

// Сводка ошибок — объявление, подписанное своим заголовком, с фокусом при загрузке: без JS его
// даёт `autofocus` на элементе с `tabindex="-1"`.
function summaryOf(html: string) {
  const box = parseHtml(html).querySelector('[role="alert"]')
  const title = box?.querySelector('h1, h2, h3, h4')
  return {
    box,
    title:
      title?.id === box?.getAttribute('aria-labelledby') ? title?.textContent?.trim() : undefined,
    focused: box?.getAttribute('tabindex') === '-1' && box.hasAttribute('autofocus'),
    links: [...(box?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('href')),
  }
}

describe('ContactForm', () => {
  it('нативная форма: POST, подписанные поля, ловушка и согласие со ссылкой на политику', async () => {
    const html = await render()
    const form = parseHtml(html).querySelector('form')
    expect([form?.getAttribute('method'), form?.getAttribute('action')]).toEqual([
      'post',
      '/api/contact',
    ])
    expect(form?.querySelector('label[for="contact-name"]')).not.toBeNull()
    expect(html).toContain('id="contact-email"')
    expect(html).toContain('id="contact-message"')
    const locale = form?.querySelector('input[type="hidden"][name="locale"]')
    expect(locale?.getAttribute('value')).toBe('ru')
    expect(html).toContain('name="company"')
    expect(html).toContain('href="/legal/privacy"')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('required')
    // Форма работает без JS: ни одного скрипта в разметке.
    expect(html).not.toContain('<script')
    // Пустая форма фокус не забирает: сводки нет, автофокуса — ни у одного элемента.
    expect(summaryOf(html).box).toBeNull()
    expect(parseHtml(html).querySelector('[autofocus]')).toBeNull()
  })

  it('с ошибками: сводка с заголовком и фокусом, ссылки на поля, разметка полей и значения', async () => {
    const html = await render({
      values: { name: 'М', email: 'not-an-email', message: 'коротко', consent: false },
      errors: {
        name: 'form.error.name',
        email: 'form.error.email',
        consent: 'form.error.consent',
      },
    })
    const summary = summaryOf(html)
    expect(summary.title).toBe('Заявка не отправлена')
    expect(summary.focused).toBe(true)
    expect(summary.links).toEqual(['#contact-name', '#contact-email', '#contact-consent'])
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="contact-email-error"')
    expect(html).toContain('id="contact-consent-error"')
    expect(html).toContain('value="not-an-email"')
    expect(html).toContain('>коротко</textarea>')
  })

  it('сбой доставки показывается той же сводкой — с заголовком и фокусом, без ссылок на поля', async () => {
    const summary = summaryOf(await render({ notice: 'form.error.delivery' }))
    expect(summary.title).toBe('Заявка не отправлена')
    expect(summary.focused).toBe(true)
    expect(summary.box?.textContent).toContain('сбой доставки')
    expect(summary.links).toEqual([])
  })

  it('не имеет нарушений доступности — и пустая, и с ошибками', async () => {
    await expectNoA11yViolations(await render())
    await expectNoA11yViolations(
      await render({ errors: { name: 'form.error.name' }, notice: 'form.error.delivery' }),
    )
  })
})
