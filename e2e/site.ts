import { readdirSync, readFileSync } from 'node:fs'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { createServer } from 'node:net'
import { relative, resolve, sep } from 'node:path'
import { load } from 'js-yaml'
import { collections, splitFrontmatter } from '../scripts/lib/content.mjs'
import { headTags, isJsonLd, isNoindex } from '../scripts/lib/html.mjs'
import {
  builtPages,
  pageRoutes,
  routePattern,
  pageTemplates as templatesOf,
  walk,
} from '../scripts/lib/routes.mjs'
import { cspHash, ISLANDS, RESOURCE_ORIGINS } from '../scripts/lib/site-policy.mjs'
import {
  type Locale,
  localeParam,
  localePath,
  SUPPORTED_LOCALES,
} from '../src/shared/i18n/locale.ts'
import { buildRedirectTable, type RedirectRule } from '../src/shared/redirects/table.ts'
import {
  CopyDeckSchema,
  chosenText,
  elementOf,
  LeadFormsSchema,
  langOf,
  PlanSchema,
  pageLanguages,
  parseFile,
  SiteMapSchema,
} from '../src/shared/strategy/contract.ts'

const root = resolve(import.meta.dirname, '..')
const clientDir = resolve(root, 'dist/client')
// Сегменты `[...locale]` маршрутов — коды локалей с префиксом адреса (все, кроме дефолтной).
const LOCALE_PREFIXES = SUPPORTED_LOCALES.flatMap((locale) => localeParam(locale) ?? [])

// Демо-ключ IndexNow прод-профиля: сервер поднимается с ним, спек ждёт файл /<ключ>.txt.
export const E2E_INDEXNOW_KEY = 'e2e-indexnow-key-0123456789'

// Процессы прогона и env с их портами: порты выбирает конфиг, воркеры Playwright наследуют env.
export const PORT_ENV = {
  site: 'E2E_SITE_PORT',
  staging: 'E2E_STAGING_PORT',
  stub: 'E2E_STUB_PORT',
} as const

export const originOf = (name: keyof typeof PORT_ENV): string =>
  `http://127.0.0.1:${process.env[PORT_ENV[name]] ?? ''}`

// Свободный порт на loopback: у прогона свои порты, чужой сервер за свой не примешь.
export function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer()
    probe.on('error', fail)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close(() => {
        if (typeof address === 'object' && address !== null) done(address.port)
        else fail(new Error('loopback не выдал порт'))
      })
    })
  })
}

// Цели тестов — из сборки и контента, а не из демо-slug'ов: набор переживает /de-template.
// Сборка готова до старта Playwright (шаг build гейта, `pnpm test:e2e`).

// Все prerendered-страницы — ровно то, что статик-хендлер отдаёт в контейнере.
export const prerenderedPaths = (): string[] => builtPages(clientDir)

// CSP prerendered-страниц, которую сборка оставляет статик-хендлеру: запись `dist/_headers.json` на путь.
export function staticCsp(): Map<string, string | undefined> {
  const records = JSON.parse(readFileSync(resolve(root, 'dist/_headers.json'), 'utf8')) as {
    pathname: string
    headers: { key: string; value: string }[]
  }[]
  return new Map(
    records.map(({ pathname, headers }) => [
      pathname,
      headers.find(({ key }) => key.toLowerCase() === 'content-security-policy')?.value,
    ]),
  )
}

// Индексируемые страницы сборки: prerendered минус закрытые noindex. Ровно их называет карта сайта.
export function indexablePaths(): string[] {
  return prerenderedPaths().filter((path) => {
    const file = resolve(clientDir, `.${path === '/' ? '' : path}/index.html`)
    return !isNoindex(headTags(readFileSync(file, 'utf8')))
  })
}

// Шаблоны страниц — по одной странице сборки на prerendered-маршрут src/pages: по ним ходит
// матрица ботов.
export const pageTemplates = (): string[] =>
  templatesOf(resolve(root, 'src/pages'), clientDir, LOCALE_PREFIXES)

interface Crawler {
  user_agent_token: string
  ua_substring: string | null
  kind: string
}

// Боты реестра (src/shared/seo/crawlers.yaml), которые приходят по сети: поисковые, загрузки по
// запросу человека, обучающие, рекламные, превью — все записи, кроме токенов без своих запросов
// (control-token: ими управляют только в robots.txt). Строка User-Agent — как у бота:
// «compatible; <токен/версия>».
export function botUserAgents(): Record<string, string> {
  const registry = readFileSync(resolve(root, 'src/shared/seo/crawlers.yaml'), 'utf8')
  const { bots } = load(registry) as { bots: Crawler[] }
  return Object.fromEntries(
    bots
      .filter((bot) => bot.kind !== 'control-token')
      .map((bot) => {
        const product = bot.ua_substring ?? bot.user_agent_token
        const version = product.endsWith('/') ? '1.0' : ''
        return [
          bot.user_agent_token,
          `Mozilla/5.0 (compatible; ${product}${version}; +https://example.com/bot)`,
        ]
      }),
  )
}

// On-demand маршруты без параметров (src/pages с `prerender = false`): их отдаёт приложение.
export function onDemandRoutes(): string[] {
  return pageRoutes(resolve(root, 'src/pages'))
    .filter((page) => page.mode === 'dynamic' && !page.parametrized)
    .map((page) => page.route)
}

// Фиды блога — файлы сборки маршрутов `rss.xml` src/pages: по одному на локаль, где есть блог. Фид on-demand файла в
// сборке не оставил бы, а такой маршрут без строки в карте режимов не пропускает check:content.
export function feedPaths(): string[] {
  const feeds = pageRoutes(resolve(root, 'src/pages'))
    .filter((page) => page.route.endsWith('/rss.xml'))
    .map((page) => routePattern(page.route, LOCALE_PREFIXES))
  return walk(clientDir)
    .map((file) => `/${relative(clientDir, file).split(sep).join('/')}`)
    .filter((path) => feeds.some((feed) => feed.test(path)))
}

// Файлы сборки для краулеров и читалок: карта сайта, которую пишет интеграция сборки, и фиды. Их,
// как и страницы, отдаёт статик-хендлер.
export const crawlerFiles = (): string[] => ['/sitemap.xml', ...feedPaths()]

export interface Entry {
  locale: Locale
  // Маршрут записи без префикса локали и её адрес.
  route: string
  path: string
  translationKey: string
  draft: boolean
  // Календарные даты frontmatter (YYYY-MM-DD).
  published: string
  updated: string | undefined
}

interface Frontmatter {
  pubDate: Date
  updatedDate?: Date
  draft?: boolean
  translationKey: string
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

// Записи коллекций — по реестру гейтов (scripts/lib/content.mjs), черновики включительно.
export function entries(): Entry[] {
  return collections.flatMap((collection) => {
    const dir = resolve(root, collection.dir)
    return walk(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => {
        const [locale, name] = relative(dir, file).split(sep) as [Locale, string]
        const source = splitFrontmatter(readFileSync(file, 'utf8'))?.frontmatter ?? ''
        const data = load(source) as Frontmatter
        const route = collection.entryRoute(name.replace(/\.md$/, ''))
        return {
          locale,
          route,
          path: localePath(locale, route),
          translationKey: `${collection.name}:${data.translationKey}`,
          draft: data.draft === true,
          published: isoDate(data.pubDate),
          updated: data.updatedDate ? isoDate(data.updatedDate) : undefined,
        }
      })
  })
}

// Защита CSP — литералами, а не политикой сборки: ослабленная политика краснеет здесь.
const CSP_PROTECTED: Record<string, string> = {
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
  'frame-ancestors': "'none'",
}
// Источник, который пропускает чужое без разбора, — запрещён в любой директиве, даже в политике.
const CSP_ANY = /\*|^'unsafe-/
const CSP_HASH = /^'sha(256|384|512)-[\w+/]+={0,2}'$/

// Острова политики, как их читает CSP: стоит ли остров хоть на одной странице и его чужие origin.
const islands: { pages: string[]; sources?: Partial<Record<string, string[]>> }[] =
  Object.values(ISLANDS)

// Чужие origin, которые политика разрешает директиве: ресурсы сайта (скрипту — нет, внешних
// скриптов у сайта нет) и источники включённых островов.
const policyOrigins = (directive: string): string[] => [
  ...(directive === 'script-src' ? [] : RESOURCE_ORIGINS),
  ...islands
    .filter((island) => island.pages.length > 0)
    .flatMap((island) => island.sources?.[directive] ?? []),
]

// CSP страницы так, как её применяет браузер: директива действует по первому вхождению (дубль он
// отбрасывает), защитные — ровно литералы, источник сверх своего и хеша — только из политики,
// каждый инлайн-скрипт и инлайн-стиль документа разрешён хешем, а скрипт из файла — своим адресом.
export function cspProblems(html: string, header: string | undefined): string[] {
  if (!header) return ['нет заголовка Content-Security-Policy']
  const problems: string[] = []
  const directives = new Map<string, string[]>()
  for (const directive of header.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/)
    if (!name) continue
    if (directives.has(name.toLowerCase())) {
      problems.push(`${name} дважды: браузер берёт первое вхождение`)
    } else directives.set(name.toLowerCase(), sources)
  }
  for (const [name, value] of Object.entries(CSP_PROTECTED)) {
    const sources = directives.get(name)?.join(' ')
    if (sources !== value) problems.push(`${name} ${sources ?? '—'} вместо ${value}`)
  }
  for (const name of ['default-src', 'script-src', 'style-src']) {
    if (!directives.has(name)) problems.push(`нет ${name}`)
  }
  for (const [name, sources] of directives) {
    if (Object.hasOwn(CSP_PROTECTED, name)) continue
    const allowed = new Set(["'self'", ...policyOrigins(name)])
    const hashed = name === 'script-src' || name === 'style-src'
    for (const source of sources) {
      if (CSP_ANY.test(source)) problems.push(`${name} пропускает всё: ${source}`)
      else if (!allowed.has(source) && !(hashed && CSP_HASH.test(source))) {
        problems.push(`${name} пропускает ${source} — его нет в политике`)
      }
    }
  }
  for (const [element, name] of [
    ['script', 'script-src'],
    ['style', 'style-src'],
  ] as const) {
    const pattern = new RegExp(`<${element}\\b([^>]*)>([\\s\\S]*?)</${element}>`, 'g')
    for (const [, attrs = '', body = ''] of html.matchAll(pattern)) {
      // JSON-LD — данные, а не код: CSP его не исполняет и не блокирует.
      if (isJsonLd(attrs)) continue
      // Скрипт из файла (остров-файл) CSP сверяет по адресу, а не по хешу тела: свой путь — 'self'.
      const src = element === 'script' ? /\bsrc="([^"]*)"/.exec(attrs)?.[1] : undefined
      if (src !== undefined) {
        const source = /^\/(?!\/)/.test(src) ? "'self'" : new URL(src, 'https://x.invalid').origin
        if (!directives.get(name)?.includes(source)) {
          problems.push(`<${element}${attrs}>: ${name} не пропускает ${source}`)
        }
        continue
      }
      if (!directives.get(name)?.includes(`'${cspHash(body)}'`)) {
        problems.push(`<${element}${attrs}>: ${name} не пропускает ${cspHash(body)}`)
      }
    }
  }
  return problems
}

// Заголовки безопасности поделены (docs/reference/infra-handoff.md § Edge): HSTS, nosniff,
// Referrer-Policy и Permissions-Policy ставит edge, X-Frame-Options и X-XSS-Protection — никто.
// Приложение ставит из них только CSP: второй источник дал бы дубль заголовка.
const EDGE_HEADERS = [
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-frame-options',
  'x-xss-protection',
]

export const edgeHeadersIn = (headers: Record<string, string>): string[] =>
  EDGE_HEADERS.filter((name) => name in headers)

// Запросы, на которых слушатель адаптера бросает исключение: статик-хендлер строит Request на
// каждый запрос, а его конструктор не принимает метод TRACE и userinfo в Host. Цели — все пути
// слушателя: страница сборки, on-demand маршрут, закрытый /_image.
export const THROWING_REQUESTS: {
  name: string
  path: string
  method?: string
  headers?: Record<string, string>
}[] = [
  { name: 'TRACE страницы сборки', path: '/', method: 'TRACE' },
  { name: 'TRACE on-demand маршрута', path: '/healthz', method: 'TRACE' },
  { name: 'TRACE /_image', path: '/_image', method: 'TRACE' },
  { name: 'userinfo в Host', path: '/', headers: { host: 'user@site.example' } },
]

// Файлы снимка strategy одной поверхности — планы или copy deck, разобранные схемой чтения сайта (листовой contract.ts).
function strategyFiles<T>(kind: 'plans' | 'copy', parse: (data: unknown, path: string) => T): T[] {
  const dir = resolve(root, 'strategy/site')
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.split(sep).at(-2) === kind && path.endsWith('.yaml'))
    .map((path) => parse(load(readFileSync(resolve(dir, path), 'utf8')), `site/${path}`))
}

// Текст элемента блока страницы на языке — из copy deck этого языка по плану страницы: секция блока, слот с этим
// элементом анатомии (заголовок 404, подпись кнопки формы, подтверждение заявки). Нет его — отказ: страница ответила бы
// без этого текста.
export function pageText(page: string, block: string, element: string, locale: Locale): string {
  const plan = strategyFiles('plans', (data, path) => parseFile(PlanSchema, data, path)).find(
    (candidate) => candidate.page.id === page,
  )
  const section = plan?.sections.find((candidate) => candidate.block === block)
  const slot = section?.slots.text.find(
    (candidate) => elementOf(candidate, 'text')?.element === element,
  )
  const found = strategyFiles('copy', (data, path) => parseFile(CopyDeckSchema, data, path))
    .filter(({ copy_deck: deck }) => langOf(deck.lang) === locale)
    .flatMap(({ copy_deck: deck }) => deck.pages)
    .find(({ page_id: id }) => id === page)
    ?.sections.find(({ section_id: id }) => id === section?.id)
    ?.slots.find(({ slot_id: id }) => id === slot?.id)
  const key = `${page}/${section?.id ?? block}/${slot?.id ?? element}`
  if (found === undefined) throw new Error(`strategy: ${key} — нет текста на ${locale}`)
  return chosenText(found, key)
}

// Форма заявки страницы по плану: form_id — `<страница>/<секция>`, адрес страницы (`page.url` плана, без языка),
// страница «спасибо» (`form.thank_you_page`), ловушка каталога и поля набора `form.ref` — вид, обязательность, «хотя бы
// одно из».
export interface PlanForm {
  id: string
  url: string
  // Языки страницы формы по карте: на каждом — своя версия формы.
  locales: Locale[]
  thankYou: string
  honeypot: string
  fields: { id: string; type: string; required: boolean }[]
  oneOf: string[]
}

export function leadFormOf(page: string): PlanForm {
  const plan = strategyFiles('plans', (data, path) => parseFile(PlanSchema, data, path)).find(
    (candidate) => candidate.page.id === page,
  )
  const [section, form] =
    plan?.sections.flatMap((candidate) =>
      candidate.slots.action.flatMap((slot) =>
        slot.form ? [[candidate, slot.form] as const] : [],
      ),
    )[0] ?? []
  if (plan?.page.url === undefined || section === undefined || form?.thank_you_page === undefined)
    throw new Error(`e2e: у страницы ${page} нет формы`)
  const path = 'kb/site/05-conversion-funnels/lead-forms.yaml'
  const catalog = parseFile(
    LeadFormsSchema,
    load(readFileSync(resolve(root, 'strategy', path), 'utf8')),
    path,
  )
  const set = catalog.form_sets.find((candidate) => `lead-forms.yaml#${candidate.id}` === form.ref)
  if (set === undefined) throw new Error(`e2e: набора ${form.ref} нет в каталоге`)
  return {
    id: `${page}/${section.id}`,
    url: plan.page.url,
    locales: SUPPORTED_LOCALES.filter((locale) => pageLanguages(siteMap(), page).includes(locale)),
    thankYou: form.thank_you_page,
    honeypot: catalog.defaults.antispam.honeypot.field,
    fields: set.fields.map(({ field, required }) => ({
      id: field,
      type: catalog.fields[field]?.type ?? '',
      required,
    })),
    oneOf: set.one_of_required,
  }
}

// Поля заявки, которую примет форма плана: обязательные и первое поле «хотя бы одного из» — значениями своего вида;
// метка заявки — в первом поле почты или текста (приёмник узнаёт заявку по любому значению её полей). Обязательный
// выбор варианта набору без JS не заполнить вслепую — отказ.
export function leadFieldsOf(form: PlanForm, marker: string): Record<string, string> {
  const answered = form.fields.filter((field) => field.required || field.id === form.oneOf[0])
  const carrier = form.fields.find((field) => ['email', 'text', 'textarea'].includes(field.type))
  const values: Record<string, string> = {
    text: 'Мария',
    email: 'maria@example.com',
    tel: '+7 900 000-00-00',
    textarea: 'Нужен сайт с блогом, формой заявки и картой сайта. Бюджет обсудим.',
  }
  return Object.fromEntries(
    [...new Set([...answered, ...(carrier ? [carrier] : [])])].map((field) => {
      const value = field === carrier ? marker : values[field.type]
      if (value === undefined)
        throw new Error(`e2e: поле ${field.id} вида ${field.type} не заполнить`)
      return [field.id, value]
    }),
  )
}

// Карта сайта снимка strategy — одна поверхность.
function siteMap() {
  const dir = resolve(root, 'strategy/site')
  const [surface] = readdirSync(dir)
  const path = `site/${surface}/site-map.yaml`
  return parseFile(SiteMapSchema, load(readFileSync(resolve(root, 'strategy', path), 'utf8')), path)
}

// Адрес страницы карты в ссылке с языка — как его ставит сайт: версия на этом языке, без неё — основного, без неё —
// первая версия страницы.
export function pagePathOf(route: string, locale: Locale): string {
  const map = siteMap()
  const page = map.pages.find((candidate) => candidate.url === route)
  const langs = page === undefined ? [locale] : pageLanguages(map, page.id)
  const target = [locale, langOf(map.languages.primary), ...langs].find((lang) =>
    langs.includes(lang),
  )
  return localePath(SUPPORTED_LOCALES.find((candidate) => candidate === target) ?? locale, route)
}

// Правила content/redirects.yaml.
export function redirects(): readonly RedirectRule[] {
  const data = load(readFileSync(resolve(root, 'content/redirects.yaml'), 'utf8'))
  return buildRedirectTable(data).rules
}

// Адрес правила, каким его пришлёт клиент: буквы вне ASCII — процентами, уже закодированное и
// форма пути (слеши, регистр) — как в файле.
export const requestTarget = (rule: RedirectRule): string =>
  rule.from.replace(/[^ -~]+/g, encodeURIComponent)

// Адреса, на которые обёртка процесса отвечает сама, не доходя до адаптера: 301 с неканонической
// формы страницы и 404 на спрятанный разделитель.
export function wrapperAnswers(): string[] {
  const page = prerenderedPaths().find((path) => path !== '/') ?? ''
  return [`${page}/`, `${page}/index.html`, `${page}%2Fx`]
}

export interface RawResponse {
  status: number
  headers: IncomingHttpHeaders
  body: string
}

// Запрос с адресом как есть, без перехода по редиректу: клиенты HTTP сами приводят путь к
// каноническому виду (`//`, точки), а проверяется ответ сервера именно на неканоническую форму.
// origin — `baseURL` проекта Playwright.
export function rawGet(origin: string | undefined, target: string): Promise<RawResponse> {
  const { hostname, port } = new URL(origin ?? '')
  return new Promise((done, fail) => {
    httpRequest({ hostname, port, path: target }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () =>
        done({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      )
    })
      .on('error', fail)
      .end()
  })
}
