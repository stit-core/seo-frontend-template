import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES } from '@/shared/i18n'
import { LEAD_FORM } from '@/shared/lib/testing'
import { FORM_DICTS } from '../config/dict'
import type { FormEntry } from './forms'
import { handleLeadRequest, refererLocale, refusalOf } from './handler'

const ORIGIN = 'http://localhost:3000'
const BACKEND = 'http://backend.internal/leads'
const POLICY = { href: '/legal/privacy', title: 'Политика', revision: '10 октября 2026 года' }
const ENTRY: FormEntry<string> = {
  form: LEAD_FORM,
  policy: POLICY,
  locale: DEFAULT_LOCALE,
  page: 'contacts',
}
// Белый список — форма контактов на своей странице: другая форма или страница — формы нет.
const context = { rid: 'test-rid', forms: [ENTRY] }

const TASK = 'Нужен сайт с блогом, формой заявки и картой сайта.'
const filled = {
  name: 'Мария',
  email: 'maria@example.com',
  task: TASK,
  consent: '1',
  form_id: LEAD_FORM.id,
  page_url: LEAD_FORM.page,
}

const post = (fields: Record<string, string>, headers: Record<string, string> = {}): Request =>
  new Request(`${ORIGIN}/api/contact`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields),
  })

const fetchMock = vi.fn()
const logged = () =>
  [
    ...vi.mocked(console.info).mock.calls,
    ...vi.mocked(console.warn).mock.calls,
    ...vi.mocked(console.error).mock.calls,
  ]
    .map(([line]) => String(line))
    .join('\n')
const delivered = () =>
  JSON.parse((fetchMock.mock.calls[0] as [string, { body: string }])[1].body) as Record<
    string,
    unknown
  >

// Канал доставки в тесте — backend со стабом fetch: наружу тест не ходит. Порог лога — debug: проверка PII в
// afterEach видит события любого уровня.
beforeEach(() => {
  vi.stubEnv('SITE_URL', 'https://demo.example')
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
  for (const value of [filled.name, filled.email, TASK]) expect(log).not.toContain(value)
})

describe('обработчик формы', () => {
  it('заявка уходит одним запросом: ответы набора, метки рекламы из Referer и запись согласия', async () => {
    const outcome = await handleLeadRequest(
      post(filled, { referer: `${ORIGIN}/contacts?utm_source=yandex&yclid=42&utm_term=&other=1` }),
      context,
    )
    expect(outcome).toEqual({ status: 'accepted', entry: ENTRY })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(BACKEND)
    const lead = delivered()
    expect(lead.fields).toEqual({ name: 'Мария', email: 'maria@example.com', task: TASK })
    expect(lead.hidden).toEqual({ utm_source: 'yandex', yclid: '42' })
    // Редакция — дата политики, на которую ссылается согласие формы; страница и форма — откуда пришла заявка.
    const consent = lead.consent as Record<string, unknown>
    expect(String(consent.consent_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect({ ...consent, consent_at: undefined }).toEqual({
      consent_version: POLICY.revision,
      consent_at: undefined,
      page_url: 'https://demo.example/contacts',
      form_id: 'contacts/lead-form',
      marketing_consent: false,
    })
  })

  it('без Referer меток рекламы нет; Referer не адрес — тоже', async () => {
    await handleLeadRequest(post(filled), context)
    expect(delivered().hidden).toEqual({})
    fetchMock.mockClear()
    const request = new Request(`${ORIGIN}/api/contact`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        referer: 'not a url',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(filled),
    })
    await handleLeadRequest(request, context)
    expect(delivered().hidden).toEqual({})
  })

  it('форма не из плана или страница не её — 400 до разбора ответов', async () => {
    for (const fields of [{ form_id: 'contacts/other' }, { page_url: '/about' }, { form_id: '' }]) {
      expect(await handleLeadRequest(post({ ...filled, ...fields }), context)).toEqual({
        status: 'bad-request',
      })
    }
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logged()).toContain('bad-request')
  })

  it('скрытое поле файлом, а не строкой, — формы нет: 400', async () => {
    const body = new FormData()
    for (const [key, value] of Object.entries(filled)) body.append(key, value)
    body.set('form_id', new Blob([LEAD_FORM.id]))
    const request = new Request(`${ORIGIN}/api/contact`, {
      method: 'POST',
      headers: { origin: ORIGIN },
      body,
    })
    expect(await handleLeadRequest(request, context)).toEqual({ status: 'bad-request' })
  })

  it('отказ канала не исключением — в логе причина «unknown»', async () => {
    fetchMock.mockRejectedValue('сеть')
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const pending = handleLeadRequest(post(filled), context)
    await vi.runAllTimersAsync()
    expect((await pending).status).toBe('failed')
    expect(logged()).toContain('"reason":"unknown"')
  })

  it('ловушка набора — поле каталога company-website: ответ как у человека, доставки нет', async () => {
    const outcome = await handleLeadRequest(post({ ...filled, 'company-website': 'spam' }), context)
    expect(outcome).toEqual({ status: 'accepted', entry: ENTRY })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logged()).toContain('honeypot')
  })

  it('правила набора: отказ называет поля, присланное возвращается в форму, доставки нет', async () => {
    const outcome = await handleLeadRequest(
      post({ ...filled, email: '', task: '', consent: '' }),
      context,
    )
    expect(outcome).toMatchObject({
      status: 'invalid',
      faults: { email: 'oneOf', phone: 'oneOf', task: 'required', consent: 'consent' },
      submission: { values: { name: 'Мария' }, consent: false },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Отказ правил набора пишет имена полей, а не присланное: адрес и имя отправителя в лог не попадают и здесь.
  it('отказ правил с присланными именем и адресом — в логе только имена полей', async () => {
    const outcome = await handleLeadRequest(post({ ...filled, task: '' }), context)
    expect(outcome).toMatchObject({ status: 'invalid', faults: { task: 'required' } })
    expect(logged()).toContain('"fields":"task"')
  })

  it.each([
    ['чужой Origin', post(filled, { origin: 'https://evil.example' }), 'forbidden'],
    ['тело больше лимита', post(filled, { 'content-length': String(64 * 1024 + 1) }), 'too-large'],
    [
      'не форма',
      new Request(`${ORIGIN}/api/contact`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: '{}',
      }),
      'bad-request',
    ],
  ])('ступень лестницы (%s) — отказ без доставки', async (_case, request, status) => {
    expect(await handleLeadRequest(request, context)).toEqual({ status })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logged()).toContain(status)
  })

  it('сбой канала: три попытки, честный отказ с присланным', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    fetchMock.mockResolvedValue(new Response(null, { status: 502 }))
    const pending = handleLeadRequest(post(filled), context)
    await vi.runAllTimersAsync()
    expect(await pending).toMatchObject({
      status: 'failed',
      entry: ENTRY,
      submission: { values: { email: filled.email } },
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(logged()).toContain('failed')
  })

  it('канал не настроен: отказ без попыток отправки', async () => {
    vi.stubEnv('FORM_BACKEND_URL', '')
    expect((await handleLeadRequest(post(filled), context)).status).toBe('failed')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logged()).toContain('FORM_BACKEND_URL')
  })

  it('LOG_LEVEL контейнера действует и на события формы', async () => {
    vi.stubEnv('LOG_LEVEL', 'error')
    await handleLeadRequest(post(filled), context)
    expect(console.info).not.toHaveBeenCalled()
    vi.stubEnv('FORM_BACKEND_URL', '')
    await handleLeadRequest(post(filled), context)
    expect(console.error).toHaveBeenCalledOnce()
  })
})

describe('ответ без разобранной формы', () => {
  const from = (referer?: string) =>
    new Request(`${ORIGIN}/api/contact`, referer === undefined ? {} : { headers: { referer } })

  it('язык — префикс пути Referer; без Referer или не адресом — основной', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(refererLocale(from(`${ORIGIN}${localePath(locale, '/contacts')}?utm_source=x`))).toBe(
        locale,
      )
    }
    expect([refererLocale(from()), refererLocale(from('not a url'))]).toEqual([
      DEFAULT_LOCALE,
      DEFAULT_LOCALE,
    ])
  })

  it.each([
    ['forbidden', 403],
    ['bad-request', 400],
    ['too-large', 413],
  ] as const)(
    'отказ %s — %i текстом словаря языка, вне кеша и индекса',
    async (refusal, status) => {
      for (const locale of SUPPORTED_LOCALES) {
        const response = refusalOf(refusal, locale)
        expect([response.status, await response.text()], locale).toEqual([
          status,
          FORM_DICTS[locale][`refusal.${refusal}`],
        ])
        expect(Object.fromEntries(response.headers), locale).toEqual({
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'private, no-store',
          'x-robots-tag': 'noindex',
        })
      }
    },
  )
})
