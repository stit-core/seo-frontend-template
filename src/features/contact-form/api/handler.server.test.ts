import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/shared/i18n'
import { HONEYPOT_FIELD, LOCALE_FIELD } from '../model/schema'
import { handleContactRequest } from './handler'

const ORIGIN = 'http://localhost:3000'
const BACKEND = 'http://backend.internal/leads'
const context = { rid: 'test-rid' }

const MESSAGE = 'Нужен сайт с блогом, формой заявки и картой сайта.'

const post = (fields: Record<string, string>, headers: Record<string, string> = {}): Request => {
  const body = new URLSearchParams(fields)
  return new Request(`${ORIGIN}/api/contact`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body,
  })
}

const filled = {
  name: 'Мария',
  email: 'maria@example.com',
  message: MESSAGE,
  consent: '1',
  [LOCALE_FIELD]: DEFAULT_LOCALE,
}

const fetchMock = vi.fn()
const logged = () =>
  [
    ...vi.mocked(console.info).mock.calls,
    ...vi.mocked(console.warn).mock.calls,
    ...vi.mocked(console.error).mock.calls,
  ]
    .map(([line]) => String(line))
    .join('\n')

// Канал доставки в тесте — backend со стабом fetch: наружу тест не ходит. Порог лога — debug: проверка PII в
// afterEach видит события любого уровня, а не только с порога info по умолчанию.
beforeEach(() => {
  vi.stubEnv('FORM_DELIVERY', 'backend')
  vi.stubEnv('FORM_BACKEND_URL', BACKEND)
  vi.stubEnv('LOG_LEVEL', 'debug')
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response(null, { status: 202 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  const log = logged()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // Тело заявки — персональные данные: ни на одном исходе обработчика его нет в логе.
  for (const value of [filled.name, filled.email, MESSAGE]) expect(log).not.toContain(value)
})

describe('обработчик формы', () => {
  it('заполненная заявка уходит в канал доставки одним запросом', async () => {
    const outcome = await handleContactRequest(post(filled), context)
    expect(outcome).toEqual({ status: 'accepted', locale: DEFAULT_LOCALE })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    expect(url).toBe(BACKEND)
    const lead = JSON.parse(init.body) as Record<string, unknown>
    expect(lead).toMatchObject({ name: 'Мария', email: 'maria@example.com', consent: true })
    // Доказательство согласия уезжает вместе с заявкой.
    expect(lead.consentVersion).toBeTruthy()
    expect(String(lead.consentedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('локаль отправителя приезжает из скрытого поля', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const outcome = await handleContactRequest(
        post({ ...filled, [LOCALE_FIELD]: locale }),
        context,
      )
      expect(outcome, locale).toEqual({ status: 'accepted', locale })
    }
  })

  it('ловушка: ответ как у человека, доставки нет', async () => {
    const outcome = await handleContactRequest(
      post({ ...filled, [HONEYPOT_FIELD]: 'spam-bot' }),
      context,
    )
    expect(outcome).toEqual({ status: 'accepted', locale: DEFAULT_LOCALE })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logged()).toContain('honeypot')
  })

  it('без согласия заявка не принимается и никуда не уходит', async () => {
    const outcome = await handleContactRequest(
      post({ ...filled, consent: '' }, { origin: ORIGIN }),
      context,
    )
    expect(outcome.status).toBe('invalid')
    if (outcome.status !== 'invalid') return
    expect(outcome.errors).toEqual({ consent: 'form.error.consent' })
    expect(outcome.values.message).toBe(MESSAGE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('чужой Origin — отказ до чтения тела', async () => {
    const outcome = await handleContactRequest(
      post(filled, { origin: 'https://evil.example' }),
      context,
    )
    expect(outcome).toEqual({ status: 'forbidden' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('без Origin и Referer — отказ: браузер шлёт Origin на POST формы всегда', async () => {
    const request = new Request(`${ORIGIN}/api/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(filled),
    })
    expect(await handleContactRequest(request, context)).toEqual({ status: 'forbidden' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('за прокси: Origin совпал с SITE_URL, а URL запроса — чужой, заявка принимается', async () => {
    // Ровно то, что видит контейнер за TLS-терминирующим Traefik: URL запроса собран из Host
    // по схеме http, а браузер прислал https-origin сайта.
    const request = new Request('http://demo.example/api/contact', {
      method: 'POST',
      headers: {
        origin: 'https://demo.example',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(filled),
    })
    vi.stubEnv('SITE_URL', 'https://demo.example')
    expect(await handleContactRequest(request, context)).toEqual({
      status: 'accepted',
      locale: DEFAULT_LOCALE,
    })
  })

  it('Referer подходит, когда Origin не прислан', async () => {
    const outcome = await handleContactRequest(
      new Request(`${ORIGIN}/api/contact`, {
        method: 'POST',
        headers: {
          referer: `${ORIGIN}/contacts`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(filled),
      }),
      context,
    )
    expect(outcome).toEqual({ status: 'accepted', locale: DEFAULT_LOCALE })
  })

  it('лимит тела — 64 КБ по Content-Length: байт сверх — отказ без чтения', async () => {
    const sized = (length: number) => post(filled, { 'content-length': String(length) })
    expect(await handleContactRequest(sized(64 * 1024), context)).toEqual({
      status: 'accepted',
      locale: DEFAULT_LOCALE,
    })
    expect(await handleContactRequest(sized(64 * 1024 + 1), context)).toEqual({
      status: 'too-large',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(logged()).toContain('too-large')
  })

  it('не форма, тело без типа и битое тело — 400 без исключения', async () => {
    const json = new Request(`${ORIGIN}/api/contact`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: '{"name":"бот"}',
    })
    expect(await handleContactRequest(json, context)).toEqual({ status: 'bad-request' })

    const broken = new Request(`${ORIGIN}/api/contact`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'multipart/form-data' },
      body: 'без границы',
    })
    expect(await handleContactRequest(broken, context)).toEqual({ status: 'bad-request' })

    // Тело байтами без Content-Type: тип формы не назван — не форма.
    const untyped = new Request(`${ORIGIN}/api/contact`, {
      method: 'POST',
      headers: { origin: ORIGIN },
      body: new TextEncoder().encode('name=бот'),
    })
    expect(untyped.headers.get('content-type')).toBeNull()
    expect(await handleContactRequest(untyped, context)).toEqual({ status: 'bad-request' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('сбой канала: три попытки, честный отказ и ни строчки заявки в логе', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    fetchMock.mockResolvedValue(new Response(null, { status: 502 }))
    const pending = handleContactRequest(post(filled), context)
    await vi.runAllTimersAsync()
    const outcome = await pending
    expect(outcome.status).toBe('failed')
    if (outcome.status !== 'failed') return
    expect(outcome.notice).toBe('form.error.delivery')
    expect(outcome.values.email).toBe('maria@example.com')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(logged()).toContain('failed')
  })

  it('канал не настроен: отказ без попыток отправки', async () => {
    vi.stubEnv('FORM_BACKEND_URL', '')
    const outcome = await handleContactRequest(post(filled), context)
    expect(outcome.status).toBe('failed')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logged()).toContain('FORM_BACKEND_URL')
  })

  it('LOG_LEVEL контейнера действует и на события формы', async () => {
    vi.stubEnv('LOG_LEVEL', 'error')
    await handleContactRequest(post(filled), context)
    expect(console.info).not.toHaveBeenCalled()

    vi.stubEnv('FORM_BACKEND_URL', '')
    await handleContactRequest(post(filled), context)
    expect(console.error).toHaveBeenCalledOnce()
  })
})
