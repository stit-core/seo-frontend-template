import { readFileSync } from 'node:fs'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { createServer } from 'node:net'
import { relative, resolve, sep } from 'node:path'
import { load } from 'js-yaml'
import { collections, splitFrontmatter } from '../scripts/lib/content.mjs'
import { headTags, isJsonLd, isNoindex } from '../scripts/lib/html.mjs'
import { pageRoutes, walk } from '../scripts/lib/routes.mjs'
import { cspHash, ISLANDS, RESOURCE_ORIGINS } from '../scripts/lib/site-policy.mjs'
import { type Locale, localePath } from '../src/shared/i18n/locale.ts'
import { buildRedirectTable, type RedirectRule } from '../src/shared/redirects/table.ts'

const root = resolve(import.meta.dirname, '..')
const clientDir = resolve(root, 'dist/client')

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
export function prerenderedPaths(): string[] {
  return walk(clientDir)
    .map((file) => relative(clientDir, file).split(sep).join('/'))
    .filter((file) => file.endsWith('index.html'))
    .map((file) => `/${file.replace(/\/?index\.html$/, '')}`)
    .sort()
}

// Индексируемые страницы сборки: prerendered минус закрытые noindex. Ровно их называет карта сайта.
export function indexablePaths(): string[] {
  return prerenderedPaths().filter((path) => {
    const file = resolve(clientDir, `.${path === '/' ? '' : path}/index.html`)
    return !isNoindex(headTags(readFileSync(file, 'utf8')))
  })
}

// Шаблоны страниц — по одной странице сборки на prerendered-маршрут src/pages: у маршрута с
// параметром (`/blog/[slug]`) — первый собранный адрес. Ответ боту зависит от сервера и шаблона, а
// не от записи, поэтому матрица ботов ходит по шаблонам, а не по всей сборке.
export function pageTemplates(): string[] {
  const built = prerenderedPaths()
  const matches = (route: string, path: string) => {
    const pattern = route.split('/')
    const segments = path.split('/')
    return (
      pattern.length === segments.length &&
      pattern.every((segment, index) => segment.startsWith('[') || segment === segments[index])
    )
  }
  return pageRoutes(resolve(root, 'src/pages'))
    .filter((page) => page.prerender)
    .flatMap((page) => built.filter((path) => matches(page.route, path)).slice(0, 1))
}

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

// Фиды блога — по одному на локаль: маршруты `rss.xml` в src/pages. Режим не спрашивается: фид
// обязан быть файлом сборки, и это проверяет спек, а не отбор целей.
export const feedPaths = (): string[] =>
  pageRoutes(resolve(root, 'src/pages'))
    .map((page) => page.route)
    .filter((route) => route.endsWith('/rss.xml'))

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

// Острова политики, как их читает CSP: включён ли остров на этой сборке и его чужие origin.
const islands: { hash: string; on?: boolean; sources?: Partial<Record<string, string[]>> }[] =
  Object.values(ISLANDS)

// Чужие origin, которые политика разрешает директиве: ресурсы сайта (скрипту — нет, внешних
// скриптов у сайта нет) и источники включённых островов.
const policyOrigins = (directive: string): string[] => [
  ...(directive === 'script-src' ? [] : RESOURCE_ORIGINS),
  ...islands
    .filter((island) => island.on !== false)
    .flatMap((island) => island.sources?.[directive] ?? []),
]

// CSP страницы так, как её применяет браузер: директива действует по первому вхождению (дубль он
// отбрасывает), защитные — ровно литералы, источник сверх своего и хеша — только из политики, и
// каждый инлайн-скрипт и инлайн-стиль документа разрешён хешем.
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
      if (!directives.get(name)?.includes(`'${cspHash(body)}'`)) {
        problems.push(`<${element}${attrs}>: ${name} не пропускает ${cspHash(body)}`)
      }
    }
  }
  return problems
}

// Заголовки безопасности поделены (docs/reference/infra-handoff.md § 1.3): HSTS, nosniff,
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

// Правила content/redirects.yaml.
export function redirects(): readonly RedirectRule[] {
  const data = load(readFileSync(resolve(root, 'content/redirects.yaml'), 'utf8'))
  return buildRedirectTable(data).rules
}

// Адрес правила, каким его пришлёт клиент: буквы вне ASCII — процентами, уже закодированное и
// форма пути (слеши, регистр) — как в файле.
export const requestTarget = (rule: RedirectRule): string =>
  rule.from.replace(/[^ -~]+/g, encodeURIComponent)

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
