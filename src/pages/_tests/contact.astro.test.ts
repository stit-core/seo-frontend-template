import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { t } from '@/shared/i18n'
import Contact from '../api/contact.astro'

const ORIGIN = 'https://demo.example'

// Канал доставки — backend со стабом fetch: наружу тест не ходит.
const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv('SITE_URL', ORIGIN)
  vi.stubEnv('FORM_DELIVERY', 'backend')
  vi.stubEnv('FORM_BACKEND_URL', 'http://backend.internal/leads')
  fetchMock.mockResolvedValue(new Response(null, { status: 202 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const container = await AstroContainer.create()

const send = (init: RequestInit): Promise<Response> =>
  container.renderToResponse(Contact, {
    request: new Request(`${ORIGIN}/api/contact`, init),
    locals: { rid: 'test-rid' },
    partial: false,
  })

const post = (fields: Record<string, string>, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded', ...headers },
  body: new URLSearchParams(fields),
})

const filled = {
  name: 'Мария',
  email: 'maria@example.com',
  message: 'Нужен сайт с блогом и формой заявки.',
  consent: '1',
}

describe('/api/contact', () => {
  it('принятая заявка — 303 на подтверждение своей локали (PRG)', async () => {
    const ru = await send(post({ ...filled, locale: 'ru' }))
    expect([ru.status, ru.headers.get('location')]).toEqual([303, '/contacts/spasibo'])
    const en = await send(post({ ...filled, locale: 'en' }))
    expect([en.status, en.headers.get('location')]).toEqual([303, '/en/contacts/spasibo'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('GET обработчика — 303 обратно на форму', async () => {
    const response = await send({ method: 'GET' })
    expect([response.status, response.headers.get('location')]).toEqual([303, '/contacts'])
  })

  it.each([
    ['чужой Origin', 403, post(filled, { origin: 'https://evil.example' })],
    [
      'тело — не форма',
      400,
      {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: '{}',
      },
    ],
    ['тело больше лимита', 413, post(filled, { 'content-length': String(1024 * 1024) })],
  ])(
    'отказ до разбора (%s) — %i коротким текстом вне кеша и индекса',
    async (_case, status, init) => {
      const response = await send(init)
      expect(response.status).toBe(status)
      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('x-robots-tag')).toBe('noindex')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('ошибка валидации — 200 с той же формой и полями; ответ персональный', async () => {
    const response = await send(post({ ...filled, consent: '', locale: 'en' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const html = await response.text()
    expect(html).toContain('<html lang="en"')
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).toContain('role="alert"')
    expect(html).toContain('value="Мария"')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('сбой доставки — 500 с той же формой и текстом о сбое', async () => {
    vi.stubEnv('FORM_BACKEND_URL', '')
    const response = await send(post(filled))
    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).toContain(t('ru', 'form.error.delivery'))
  })
})
