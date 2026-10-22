import privacy from 'virtual:strategy/consent/privacy'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { FORM_DICTS, failedTitle } from '@/features/lead-form'
import { DEFAULT_LOCALE, type Locale, localePath, SUPPORTED_LOCALES } from '@/shared/i18n'
import { filledFormOf, parseHtml } from '@/shared/lib/testing'
import {
  form as formSlot,
  type LeadForm,
  pageLocales,
  policyOf,
  snapshot,
  strategyPage,
} from '@/shared/strategy'
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

// Формы планов снимка на каждом языке своей страницы — белый список, который обязан знать обработчик.
const FORMS = snapshot().plans.flatMap(({ page }) =>
  pageLocales(page.id).flatMap((locale) =>
    strategyPage(page.id, locale).sections.flatMap((section) =>
      Object.values(section.slots)
        .filter((value): value is LeadForm => formSlot.safeParse(value).success)
        .map((form) => ({ form, locale, page: page.id, section: section.id })),
    ),
  ),
)
const [FIRST] = FORMS
if (FIRST === undefined) throw new Error('у планов снимка нет формы')
// Форма контактов на версии страницы: заявка, которую она примет, и страница, с которой она пришла.
const formOn = (locale: Locale) =>
  FORMS.find((entry) => entry.page === FIRST.page && entry.locale === locale)?.form ?? FIRST.form
const filled = (locale: Locale = DEFAULT_LOCALE) => filledFormOf(formOn(locale))
// Запрос со страницы сайта: язык ответа без разобранной формы — префикс её пути.
const from = (path: string) => ({ referer: `${ORIGIN}${path}` })
const failedPrefix = (locale: Locale) => failedTitle(locale, '')
// Присланное в поле ответа — у формы со своим `form_id`: значение ввода или текст многострочного поля.
const sentBack = (doc: ReturnType<typeof parseHtml>, formId: string, name: string) => {
  const form = [...doc.querySelectorAll('form')].find(
    (candidate) => candidate.querySelector('[name="form_id"]')?.getAttribute('value') === formId,
  )
  const control = form?.querySelector(`[name="${name}"]`)
  return control?.tagName === 'TEXTAREA' ? control.textContent : control?.getAttribute('value')
}

describe('/api/contact', () => {
  // Обработчик знает каждую форму плана: заявка формы любой страницы на любом её языке — PRG на «спасибо» её плана.
  it('принятая заявка каждой формы плана — 303 на «спасибо» своего плана на языке страницы (PRG)', async () => {
    for (const { form, locale } of FORMS) {
      const response = await send(post(filledFormOf(form)))
      // У 303 только Location: тело и кеш-заголовки редиректа не нужны — его никто не кеширует.
      expect([response.status, [...response.headers]], `${form.id} ${locale}`).toEqual([
        303,
        [['location', form.thankYou.href]],
      ])
    }
    expect(fetchMock).toHaveBeenCalledTimes(FORMS.length)
  })

  // Адрес обработчика в адресной строке — не страница: GET ведёт на страницу формы того языка, с которого пришёл.
  it('GET обработчика — 303 на страницу формы на языке Referer, без него — основного языка', async () => {
    const pagesOn = (locale: Locale) =>
      FORMS.filter((entry) => entry.locale === locale).map((entry) => entry.form.page)
    for (const locale of pageLocales(FIRST.page)) {
      const response = await send({ method: 'GET', headers: from(formOn(locale).page) })
      expect(response.status, locale).toBe(303)
      expect(pagesOn(locale), locale).toContain(response.headers.get('location'))
    }
    const anonymous = await send({ method: 'GET' })
    expect(pagesOn(DEFAULT_LOCALE)).toContain(anonymous.headers.get('location'))
  })

  it.each([
    ['чужой Origin', 403, 'forbidden', { origin: 'https://evil.example' }, undefined],
    ['тело — не форма', 400, 'bad-request', { 'content-type': 'application/json' }, '{}'],
    ['тело больше лимита', 413, 'too-large', { 'content-length': String(1024 * 1024) }, undefined],
    ['форма не из плана', 400, 'bad-request', {}, { form_id: `${FIRST.form.id}-x` }],
  ] as const)(
    'отказ до разбора (%s) — %i текстом словаря на языке страницы формы, вне кеша и индекса',
    async (_case, status, refusal, headers, body) => {
      for (const locale of SUPPORTED_LOCALES) {
        const fields = { ...filled(locale), ...(typeof body === 'object' ? body : {}) }
        const init = post(fields, { ...from(localePath(locale, '/')), ...headers })
        const response = await send(typeof body === 'string' ? { ...init, body } : init)
        expect([response.status, await response.text()], locale).toEqual([
          status,
          FORM_DICTS[locale][`refusal.${refusal}`],
        ])
        expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toBe('noindex')
      }
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  // Ответ с ошибками — страница формы: её заголовок окна с отказом, её h1 и секция своей формы с полями и сводкой; другие
  // секции страницы ответ не рисует.
  it('ошибка валидации каждой формы плана — 200: страница формы, её h1 и своя форма с полями; ответ персональный', async () => {
    for (const { form, locale, page, section } of FORMS) {
      const fields = filledFormOf(form)
      const response = await send(post({ ...fields, consent: '' }))
      const where = `${form.id} ${locale}`
      expect(response.status, where).toBe(200)
      expect(response.headers.get('cache-control'), where).toBe('private, no-store')
      const html = await response.text()
      const doc = parseHtml(html)
      expect(doc.documentElement.getAttribute('lang'), where).toBe(locale)
      expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content'), where).toBe(
        'noindex',
      )
      // Отказ — первое слово заголовка окна: вкладка и чтец экрана называют его раньше страницы.
      expect(doc.title, where).toBe(
        failedTitle(locale, strategyPage(page, locale).meta?.title ?? ''),
      )
      expect(doc.querySelector('h1')?.textContent?.trim(), where).toBe(
        strategyPage(page, locale).h1,
      )
      expect(
        [...doc.querySelectorAll('main > section')].map((child) =>
          child.getAttribute('aria-labelledby'),
        ),
        where,
      ).toEqual(['page-title', section])
      expect(doc.querySelectorAll('[role="alert"]'), where).toHaveLength(1)
      for (const field of form.fields.filter(({ id }) => id in fields)) {
        expect(sentBack(doc, form.id, field.id), `${where} ${field.id}`).toBe(fields[field.id])
      }
      expect(outlineFaults(headingLevels(doc)), where).toEqual([])
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('сбой доставки — 500 с той же формой и текстом о сбое', async () => {
    vi.stubEnv('FORM_BACKEND_URL', '')
    const response = await send(post(filled()))
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
    for (const locale of pageLocales(FIRST.page)) {
      const hidden = { form_id: formOn(locale).id, page_url: formOn(locale).page }
      // Каждое поле набора с отказом: пустое обязательное, почта и телефон не по форме, «хотя бы одно из».
      for (const fields of [
        {},
        { email: 'not-an-email', phone: '12', 'contact-channel': 'pigeon' },
      ]) {
        const answer = await (await send(post({ ...hidden, ...fields }))).text()
        expect(answer, locale).toContain('role="alert"')
        expect(
          strayText(answer, (lang) => [...pageTexts(lang), ...Object.values(fields)]),
          locale,
        ).toEqual([])
      }
    }
    vi.stubEnv('FORM_BACKEND_URL', '')
    const failed = await (await send(post(filled()))).text()
    expect(failed).toContain(FORM_DICTS[DEFAULT_LOCALE].delivery)
    expect(strayText(failed, (lang) => [...pageTexts(lang), ...Object.values(filled())])).toEqual(
      [],
    )
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
      const answer = await (await send(post({ ...filled(locale), consent: '' }))).text()
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
