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
// Ответ на каждое поле набора — значения, которые не встречаются в строках лога сами по себе: по ним тест ищет утечку.
const ANSWERS = {
  name: 'Мария',
  email: 'maria@example.com',
  phone: '+7 900 123-45-67',
  'contact-channel': 'call',
  task: TASK,
}
const filled = { ...ANSWERS, consent: '1', form_id: LEAD_FORM.id, page_url: LEAD_FORM.page }
// Метка рекламы в query Referer: адрес страницы человека в лог не идёт, как и его ответы.
const MARK = 'utm-mark-7f3a9c'

// Заявка со страницы формы: Referer — её адрес с меткой рекламы, как у перехода из объявления.
const post = (fields: Record<string, string>, headers: Record<string, string> = {}): Request =>
  new Request(`${ORIGIN}/api/contact`, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      referer: `${ORIGIN}/contacts?utm_source=${MARK}`,
      'content-type': 'application/x-www-form-urlencoded',
      ...headers,
    },
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
  // Тело заявки — персональные данные, query Referer — метки человека: ни на одном исходе обработчика их нет в логе.
  for (const value of [...Object.values(ANSWERS), MARK]) expect(log).not.toContain(value)
})

describe('обработчик формы', () => {
  it('заявка уходит одним запросом: ответы набора, метки рекламы из Referer и запись согласия', async () => {
    const referer = `${ORIGIN}/contacts?utm_source=${MARK}&yclid=42&utm_term=&other=${MARK}`
    const outcome = await handleLeadRequest(post(filled, { referer }), context)
    expect(outcome).toEqual({ status: 'accepted', entry: ENTRY })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(BACKEND)
    const lead = delivered()
    // Заявка теста отвечает на каждое поле набора: лог проверяется на каждом.
    expect(Object.keys(ANSWERS)).toEqual(LEAD_FORM.fields.map(({ id }) => id))
    expect(lead.fields).toEqual(ANSWERS)
    expect(lead.hidden).toEqual({ utm_source: MARK, yclid: '42' })
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
    for (const referer of [undefined, 'not a url']) {
      fetchMock.mockClear()
      const request = new Request(`${ORIGIN}/api/contact`, {
        method: 'POST',
        headers: {
          origin: ORIGIN,
          ...(referer === undefined ? {} : { referer }),
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(filled),
      })
      await handleLeadRequest(request, context)
      expect(delivered().hidden, referer).toEqual({})
    }
  })

  // Метка — короткий ответ объявления, а не текст: Referer длиной в заголовок в заявку не уезжает.
  it('метка рекламы из Referer — не длиннее 200 знаков', async () => {
    const long = 'u'.repeat(201)
    await handleLeadRequest(
      post(filled, { referer: `${ORIGIN}/contacts?utm_source=${long}` }),
      context,
    )
    expect(delivered().hidden).toEqual({ utm_source: 'u'.repeat(200) })
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
      post({ ...filled, email: '', phone: '', task: '', consent: '' }),
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

  // Размер — до чтения тела: разбор формы буферизует тело в heap, поэтому тело с заявленной длиной больше лимита не
  // читается вовсе. Тело теста не читается — разбор до ступени размера дал бы 400, а не 413.
  it('тело больше лимита по Content-Length — 413, тело не читалось', async () => {
    const body = new ReadableStream(
      { pull: (controller) => controller.error(new Error('тело не читается')) },
      { highWaterMark: 0 },
    )
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': String(64 * 1024 + 1),
      },
      body,
      duplex: 'half',
    }
    const request = new Request(`${ORIGIN}/api/contact`, init)
    expect(await handleLeadRequest(request, context)).toEqual({ status: 'too-large' })
    expect(request.bodyUsed).toBe(false)
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
