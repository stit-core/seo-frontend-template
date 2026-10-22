import privacy from 'virtual:strategy/consent/privacy'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { FORM_DICTS, failedTitle } from '@/features/lead-form'
import { DEFAULT_LOCALE, type Locale, localePath } from '@/shared/i18n'
import { parseHtml } from '@/shared/lib/testing'
import { pageLocales, policyOf, strategyPage } from '@/shared/strategy'
import { leadForm } from '@/widgets/lead-form'
import Contacts from '../[...locale]/contacts/index.astro'
import Contact from '../api/contact.astro'
import { pageTexts, strayText } from './texts'

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

// Сводка ошибок подписана заголовком внутри раздела формы: первого уровня на странице ответа —
// один, уровни идут без пропуска.
const headingLevels = (doc: ReturnType<typeof parseHtml>) =>
  [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading) => Number(heading.tagName[1]))
const outlineFaults = (levels: number[]) => [
  ...(levels.filter((level) => level === 1).length === 1 ? [] : ['не один h1']),
  ...levels.flatMap((level, index) =>
    level - (levels[index - 1] ?? 0) > 1 ? [`пропуск уровня перед h${level}`] : [],
  ),
]

// Форма контактов на версии страницы: скрытые поля сборки — id формы и адрес страницы.
const formOn = (locale: Locale) =>
  leadForm.props(strategyPage('contacts', locale), 'lead-form').form
const hidden = (locale: Locale = DEFAULT_LOCALE) => ({
  form_id: formOn(locale).id,
  page_url: formOn(locale).page,
})
const filled = {
  name: 'Мария',
  email: 'maria@example.com',
  task: 'Нужен сайт с блогом и формой заявки.',
  consent: '1',
}
const failedPrefix = (locale: Locale) => failedTitle(locale, '')

describe('/api/contact', () => {
  // Форма стоит на версиях страницы контактов: локаль отправителя — одна из них.
  it('принятая заявка — 303 на подтверждение своей локали (PRG)', async () => {
    const locales = pageLocales('contacts')
    for (const locale of locales) {
      const response = await send(post({ ...filled, ...hidden(locale) }))
      // У 303 только Location: тело и кеш-заголовки редиректа не нужны — его никто не кеширует.
      expect([response.status, [...response.headers]], locale).toEqual([
        303,
        [['location', formOn(locale).thankYou.href]],
      ])
      expect(formOn(locale).thankYou.href, locale).toBe(localePath(locale, '/contacts/spasibo'))
    }
    expect(fetchMock).toHaveBeenCalledTimes(locales.length)
  })

  it('GET обработчика — 303 обратно на форму', async () => {
    const response = await send({ method: 'GET' })
    expect([response.status, response.headers.get('location')]).toEqual([303, '/contacts'])
  })

  it.each([
    ['чужой Origin', 403, post({ ...filled, ...hidden() }, { origin: 'https://evil.example' })],
    [
      'тело — не форма',
      400,
      {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: '{}',
      },
    ],
    [
      'тело больше лимита',
      413,
      post({ ...filled, ...hidden() }, { 'content-length': String(1024 * 1024) }),
    ],
    [
      'форма не из плана',
      400,
      post({ ...filled, form_id: 'contacts/other', page_url: '/contacts' }),
    ],
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

  it('ошибка валидации — 200 с той же формой и полями на языке отправителя; ответ персональный', async () => {
    for (const locale of pageLocales('contacts')) {
      const response = await send(post({ ...filled, ...hidden(locale), consent: '' }))
      expect(response.status, locale).toBe(200)
      expect(response.headers.get('cache-control'), locale).toBe('private, no-store')
      const html = await response.text()
      const doc = parseHtml(html)
      expect(doc.documentElement.getAttribute('lang'), locale).toBe(locale)
      expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content'), locale).toBe(
        'noindex',
      )
      expect(html, locale).toContain('role="alert"')
      expect(html, locale).toContain('value="Мария"')
      // Отказ — первое слово заголовка окна: вкладка и чтец экрана называют его раньше страницы.
      expect(doc.title.startsWith(failedPrefix(locale)), locale).toBe(true)
      expect(outlineFaults(headingLevels(doc)), locale).toEqual([])
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('сбой доставки — 500 с той же формой и текстом о сбое', async () => {
    vi.stubEnv('FORM_BACKEND_URL', '')
    const response = await send(post({ ...filled, ...hidden() }))
    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const html = await response.text()
    const doc = parseHtml(html)
    expect(html).toContain(FORM_DICTS[DEFAULT_LOCALE].delivery)
    expect(doc.title.startsWith(failedPrefix(DEFAULT_LOCALE))).toBe(true)
    expect(outlineFaults(headingLevels(doc))).toEqual([])
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
  })

  // Текст ответа — данные, как у каждой страницы (тест страниц «текст страницы — данные»): секции — copy deck, отказы и
  // подписи полей — словарь, в полях — присланное человеком.
  it('ответ с ошибками — весь текст страницы данные: отказ каждого поля, сбой доставки и присланное', async () => {
    for (const locale of pageLocales('contacts')) {
      // Каждое поле набора с отказом: пустое обязательное, почта и телефон не по форме, «хотя бы одно из».
      for (const fields of [
        {},
        { email: 'not-an-email', phone: '12', 'contact-channel': 'pigeon' },
      ]) {
        const answer = await (await send(post({ ...hidden(locale), ...fields }))).text()
        expect(answer, locale).toContain('role="alert"')
        expect(
          strayText(answer, (lang) => [...pageTexts(lang), ...Object.values(fields)]),
          locale,
        ).toEqual([])
      }
    }
    vi.stubEnv('FORM_BACKEND_URL', '')
    const failed = await (await send(post({ ...filled, ...hidden() }))).text()
    expect(failed).toContain(FORM_DICTS[DEFAULT_LOCALE].delivery)
    expect(strayText(failed, (lang) => [...pageTexts(lang), ...Object.values(filled)])).toEqual([])
  })

  // Согласие ссылается на политику плана контактов — её версию по карте: на языке без версии политики ссылка ведёт на
  // версию другого языка, называет его и подписана заголовком документа на нём.
  it('ссылка согласия — политика ПДн плана, её версия по карте с языком цели: страница и ответ формы', async () => {
    for (const locale of pageLocales('contacts')) {
      const policy = policyOf(strategyPage('contacts', locale), privacy)
      const page = await container.renderToString(Contacts, {
        props: { locale },
        request: new Request(`${ORIGIN}${localePath(locale, '/contacts')}`),
        partial: false,
      })
      const answer = await (await send(post({ ...filled, ...hidden(locale), consent: '' }))).text()
      for (const html of [page, answer]) {
        const link = parseHtml(html).querySelector('[id$="-policy"] a')
        expect(
          [
            link?.getAttribute('href'),
            link?.getAttribute('hreflang') ?? undefined,
            link?.getAttribute('lang') ?? undefined,
            link?.textContent?.trim(),
          ],
          locale,
        ).toEqual([policy.href, policy.hreflang, policy.hreflang, policy.title])
      }
    }
  })

  it('страница с формой до отправки — заголовок окна без слова об ошибке', async () => {
    const html = await container.renderToString(Contacts, {
      props: { locale: DEFAULT_LOCALE },
      request: new Request(`${ORIGIN}/contacts`),
      partial: false,
    })
    const { title } = parseHtml(html)
    expect(title).toBeTruthy()
    expect(title.startsWith(failedPrefix(DEFAULT_LOCALE))).toBe(false)
  })
})
