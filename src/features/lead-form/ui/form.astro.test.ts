import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { DEFAULT_LOCALE } from '@/shared/i18n'
import { CALLBACK_FORM, expectNoA11yViolations, LEAD_FORM, parseHtml } from '@/shared/lib/testing'
import { FORM_DICTS } from '../config/dict'
import { t } from '../lib/text'
import { CONSENT_FIELD, submissionOf } from '../model/schema'
import Form from './form.astro'

const dict: Readonly<Record<string, string>> = FORM_DICTS[DEFAULT_LOCALE]
const props = {
  id: 'request',
  locale: DEFAULT_LOCALE,
  action: '/api/contact',
  form: LEAD_FORM,
  policy: {
    href: '/legal/privacy',
    hreflang: 'ru',
    title: 'Политика обработки данных',
    revision: '10 октября 2026 года',
  },
  submitLabel: 'Получить ответ',
  consentLabel: 'Согласен на обработку персональных данных',
}

const render = async (extra: Record<string, unknown> = {}) => {
  const container = await AstroContainer.create()
  return container.renderToString(Form, { props: { ...props, ...extra } })
}

const answer = {
  submission: {
    values: { name: 'М', email: 'not-an-email', phone: '', 'contact-channel': 'call', task: '' },
    consent: false,
  },
  faults: { email: 'email', task: 'required', consent: 'consent' },
  failed: false,
}

describe('Form — форма-движок по набору плана', () => {
  it('нативная форма: POST, скрытые form_id и page_url сборки, поля набора по порядку с подписями словаря', async () => {
    const html = await render()
    const form = parseHtml(html).querySelector('form')
    expect([form?.getAttribute('method'), form?.getAttribute('action')]).toEqual([
      'post',
      '/api/contact',
    ])
    const hidden: Record<string, string | null> = {}
    for (const input of form?.querySelectorAll('input[type="hidden"]') ?? []) {
      hidden[input.getAttribute('name') ?? ''] = input.getAttribute('value')
    }
    expect(hidden).toEqual({ form_id: 'contacts/lead-form', page_url: '/contacts' })
    const named = [...(form?.querySelectorAll('[name]') ?? [])].map((field) =>
      field.getAttribute('name'),
    )
    expect([...new Set(named)]).toEqual([
      'form_id',
      'page_url',
      'name',
      'email',
      'phone',
      'contact-channel',
      'task',
      'company-website',
      'consent',
    ])
    // Обязательность отмечает меньшая группа: у contact-message обязательна одна задача.
    expect(form?.querySelector('label[for="request-task"]')?.textContent?.trim()).toBe(
      t(DEFAULT_LOCALE, 'required', { label: dict['label.task'] ?? '' }),
    )
    expect(form?.querySelector('label[for="request-name"]')?.textContent?.trim()).toBe(
      dict['label.name'],
    )
    expect(form?.querySelector('#request-task')?.hasAttribute('required')).toBe(true)
    expect(form?.querySelector('#request-email')?.getAttribute('autocomplete')).toBe('email')
    expect(form?.querySelector('#request-email')?.getAttribute('spellcheck')).toBe('false')
    expect(form?.querySelector('#request-phone')?.getAttribute('inputmode')).toBe('tel')
    // Выбор — группа с подписью и вариантами словаря; «хотя бы одно из» — пояснение у полей группы.
    expect(form?.querySelector('fieldset legend')?.textContent?.trim()).toBe(
      dict['label.contact-channel'],
    )
    expect(
      [...(form?.querySelectorAll('fieldset label') ?? [])].map((label) =>
        label.textContent?.trim(),
      ),
    ).toEqual([dict['option.contact-channel.call'], dict['option.contact-channel.email']])
    expect(form?.querySelector('#request-email')?.getAttribute('aria-describedby')).toBe(
      'request-one-of',
    )
    expect(form?.querySelector('#request-one-of')?.textContent?.trim()).toBe(
      dict['oneOf.email+phone'],
    )
    // Ловушка — поле каталога, скрыто от человека; согласие — галочка с текстом секции, политика — её заголовком на её языке.
    expect(form?.querySelector('.honeypot input')?.getAttribute('name')).toBe('company-website')
    expect(form?.querySelector('label[for="request-consent"]')?.textContent?.trim()).toBe(
      props.consentLabel,
    )
    const policy = form?.querySelector('#request-policy a')
    expect([
      policy?.getAttribute('href'),
      policy?.getAttribute('hreflang'),
      policy?.getAttribute('lang'),
      policy?.textContent?.trim(),
    ]).toEqual(['/legal/privacy', 'ru', 'ru', props.policy.title])
    expect(form?.querySelector('button[type="submit"]')?.textContent?.trim()).toBe(
      props.submitLabel,
    )
    // Форма работает без JS; пустая форма фокус не забирает.
    expect(html).not.toContain('<script')
    expect(parseHtml(html).querySelector('[role="alert"], [autofocus]')).toBeNull()
  })

  // Ловушка — для бота: чтец экрана её не объявляет, с клавиатуры её не встретить, автозаполнение браузера в неё не
  // пишет; не видна она классом слоя (тест токен-слоя).
  it('ловушка набора скрыта от человека: вне чтеца, вне порядка Tab, без автозаполнения', async () => {
    const trap = parseHtml(await render()).querySelector(`[name="${LEAD_FORM.honeypot}"]`)
    const box = trap?.closest('.honeypot')
    expect(box?.getAttribute('aria-hidden')).toBe('true')
    expect([
      trap?.getAttribute('type'),
      trap?.getAttribute('tabindex'),
      trap?.getAttribute('autocomplete'),
      trap?.hasAttribute('required'),
    ]).toEqual(['text', '-1', 'off', false])
  })

  // Отмеченная галочка шлёт своё значение (без атрибута — «on»): согласием сервер считает именно его. Обязательна и не
  // отмечена заранее: одна цель — одна галочка.
  it('галочка согласия: обязательна, не отмечена, её значение — согласие для сервера', async () => {
    const consent = parseHtml(await render()).querySelector(`[name="${CONSENT_FIELD}"]`)
    expect([
      consent?.getAttribute('type'),
      consent?.hasAttribute('required'),
      consent?.hasAttribute('checked'),
    ]).toEqual(['checkbox', true, false])
    const sent = new FormData()
    sent.set(CONSENT_FIELD, consent?.getAttribute('value') ?? 'on')
    expect(submissionOf(LEAD_FORM, sent).consent).toBe(true)
  })

  it('ответ с отказами: сводка с заголовком и фокусом, ссылки на поля по порядку, присланное — в полях', async () => {
    const doc = parseHtml(await render({ answer }))
    const box = doc.querySelector('[role="alert"]')
    expect([
      box?.getAttribute('aria-labelledby'),
      box?.getAttribute('tabindex'),
      box?.hasAttribute('autofocus'),
    ]).toEqual(['request-summary', '-1', true])
    expect(doc.querySelector('#request-summary')?.textContent?.trim()).toBe(dict.summary)
    expect(
      [...(box?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('href')),
    ).toEqual(['#request-email', '#request-task', '#request-consent'])
    expect(doc.querySelector('#request-email')?.getAttribute('aria-invalid')).toBe('true')
    expect(doc.querySelector('#request-email')?.getAttribute('aria-describedby')).toBe(
      'request-email-error request-one-of',
    )
    expect(doc.querySelector('#request-email-error')?.textContent?.trim()).toBe(
      t(DEFAULT_LOCALE, 'error.email', { label: dict['label.email'] ?? '' }),
    )
    expect(doc.querySelector('#request-name')?.getAttribute('value')).toBe('М')
    expect(doc.querySelector('input[value="call"]')?.hasAttribute('checked')).toBe(true)
    expect(doc.querySelector('#request-consent-error')?.textContent?.trim()).toBe(
      dict['error.consent'],
    )
  })

  it('отказ «хотя бы одно из» и вариант не из списка — тексты словаря у полей; сбой доставки — сводкой без ссылок', async () => {
    const doc = parseHtml(
      await render({
        answer: {
          ...answer,
          faults: { email: 'oneOf', phone: 'oneOf', 'contact-channel': 'option' },
        },
      }),
    )
    expect(doc.querySelector('#request-phone-error')?.textContent?.trim()).toBe(
      dict['oneOf.email+phone'],
    )
    expect(doc.querySelector('#request-contact-channel-error')?.textContent?.trim()).toBe(
      t(DEFAULT_LOCALE, 'error.option', { label: dict['label.contact-channel'] ?? '' }),
    )
    const failed = parseHtml(
      await render({ answer: { ...answer, faults: {}, failed: true } }),
    ).querySelector('[role="alert"]')
    expect(failed?.textContent).toContain(dict.delivery)
    expect(failed?.querySelectorAll('a')).toHaveLength(0)
  })

  // У callback обязательны телефон и имя — больше половины: метку несёт необязательное; «хотя бы одного из» нет.
  it('обязательных больше — отмечено необязательное поле; без группы — без пояснения', async () => {
    const [phone, name] = CALLBACK_FORM.fields
    const form = {
      ...CALLBACK_FORM,
      fields: [phone, { ...name, required: true }, { ...name, id: 'city', required: false }],
    }
    const doc = parseHtml(await render({ form }))
    expect(doc.querySelector('label[for="request-city"]')?.textContent?.trim()).toBe(
      t(DEFAULT_LOCALE, 'optional', { label: dict['label.city'] ?? '' }),
    )
    expect(doc.querySelector('label[for="request-phone"]')?.textContent?.trim()).toBe(
      dict['label.phone'],
    )
    expect(doc.querySelector('#request-one-of')).toBeNull()
  })

  it('поле без подписи на языке страницы — ошибка сборки с ключом формы', async () => {
    const form = { ...LEAD_FORM, fields: [{ ...LEAD_FORM.fields[0], id: 'nickname' }] }
    await expect(render({ form })).rejects.toThrow(
      'strategy: contacts/lead-form/form — нет строки label.nickname',
    )
  })

  // Две формы на странице — секции плана: id полей, сводки и согласия — от секции.
  it('две формы на странице: id без дублей', async () => {
    const second = await render({ id: 'callback', form: CALLBACK_FORM })
    const html = `<main>${await render()}${second}</main>`
    const ids = [...parseHtml(html).querySelectorAll('[id]')].map((element) => element.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([])
    await expectNoA11yViolations(html)
  })

  it('не имеет нарушений доступности — и пустая, и с отказами', async () => {
    await expectNoA11yViolations(await render())
    await expectNoA11yViolations(await render({ answer }))
  })
})
