import { SITE_NAME } from '@/shared/config'
import { DEFAULT_LOCALE } from '@/shared/i18n'
import { FORM_DICTS } from '../config/dict'
import { t } from '../lib/text'
import { deliverLead, type Lead } from './delivery'

// nodemailer подменён: письмо никуда не уходит, транспорт и вызовы видны тесту.
const smtp = vi.hoisted(() => {
  const sendMail = vi.fn()
  const close = vi.fn()
  return { sendMail, close, createTransport: vi.fn(() => ({ sendMail, close })) }
})
vi.mock('nodemailer', () => ({ createTransport: smtp.createTransport }))

const lead: Lead = {
  fields: {
    name: 'Мария',
    email: 'maria@example.com',
    'contact-channel': 'email',
    task: 'Нужен сайт с блогом.',
  },
  hidden: { utm_source: 'yandex' },
  consent: {
    consent_version: '10 октября 2026 года',
    consent_at: '2026-10-06T09:00:00.000Z',
    page_url: 'https://demo.example/contacts',
    form_id: 'contacts/lead-form',
    marketing_consent: false,
  },
}

// FORM_DELIVERY не задан — канал по умолчанию, smtp.
const SMTP = {
  SMTP_URL: 'smtp://mail.internal:25',
  FORM_TO: 'sales@example.com',
  FORM_FROM: 'site@example.com',
}

beforeEach(() => {
  for (const [key, value] of Object.entries(SMTP)) vi.stubEnv(key, value)
  smtp.sendMail.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('доставка заявки: канал smtp', () => {
  it('одно письмо оператору: ответ — отправителю, в тексте заявка и доказательство согласия', async () => {
    expect(await deliverLead(lead)).toEqual({
      channel: 'smtp',
      attempts: 1,
    })
    // Дефолты nodemailer — минуты; отправитель формы столько не ждёт.
    expect(smtp.createTransport).toHaveBeenCalledWith({
      url: SMTP.SMTP_URL,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    })
    expect(smtp.sendMail).toHaveBeenCalledOnce()
    const [mail] = smtp.sendMail.mock.calls[0] as [Record<string, string>]
    expect(mail).toMatchObject({
      from: 'site@example.com',
      to: 'sales@example.com',
      replyTo: 'maria@example.com',
      subject: t(DEFAULT_LOCALE, 'mail.subject', { site: SITE_NAME, form: 'contacts/lead-form' }),
    })
    // Поле и вариант — подписями словаря основного языка, метки рекламы и запись согласия — целиком.
    for (const part of [
      t(DEFAULT_LOCALE, 'mail.field', {
        label: FORM_DICTS[DEFAULT_LOCALE]['label.name'],
        value: 'Мария',
      }),
      t(DEFAULT_LOCALE, 'mail.field', {
        label: FORM_DICTS[DEFAULT_LOCALE]['label.contact-channel'],
        value: FORM_DICTS[DEFAULT_LOCALE]['option.contact-channel.email'],
      }),
      lead.fields.task ?? '',
      'utm_source: yandex',
      lead.consent.page_url,
      lead.consent.form_id,
      lead.consent.consent_version,
      lead.consent.consent_at,
    ]) {
      expect(mail.text).toContain(part)
    }
    expect(smtp.close).toHaveBeenCalledOnce()
  })

  it('без почты в заявке ответа отправителю нет: письмо уходит без reply-to', async () => {
    await deliverLead({ ...lead, fields: { phone: '+7 900 000-00-00' } })
    const [mail] = smtp.sendMail.mock.calls.at(-1) as [Record<string, string>]
    expect(mail).not.toHaveProperty('replyTo')
  })

  it('сбой сервера: три попытки, транспорт закрывается после каждой, ошибка — наружу', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    smtp.sendMail.mockRejectedValue(new Error('421 try again later'))
    const refused = expect(deliverLead(lead)).rejects.toThrow('421 try again later')
    await vi.runAllTimersAsync()
    await refused
    expect(smtp.sendMail).toHaveBeenCalledTimes(3)
    expect(smtp.close).toHaveBeenCalledTimes(3)
  })

  it('канал не настроен: отказ с именем переменной, без попыток', async () => {
    for (const key of ['SMTP_URL', 'FORM_TO', 'FORM_FROM'] as const) {
      vi.stubEnv(key, '')
      await expect(deliverLead(lead)).rejects.toThrow(key)
      vi.stubEnv(key, SMTP[key])
    }
    expect(smtp.createTransport).not.toHaveBeenCalled()
  })
})

describe('доставка заявки: повторы по умолчанию', () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 502 })))

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('FORM_DELIVERY', 'backend')
    vi.stubEnv('FORM_BACKEND_URL', 'http://backend.internal/leads')
  })

  it('вторая попытка — через 0,5 с, третья — ещё через 2 с, затем честный отказ', async () => {
    const delivery = deliverLead(lead)
    const refused = expect(delivery).rejects.toThrow('502')
    const attemptsAfter = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms)
      return fetchMock.mock.calls.length
    }
    expect(await attemptsAfter(0)).toBe(1)
    expect(await attemptsAfter(499)).toBe(1)
    expect(await attemptsAfter(1)).toBe(2)
    expect(await attemptsAfter(1999)).toBe(2)
    expect(await attemptsAfter(1)).toBe(3)
    await refused
  })
})
