import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { relative, resolve, sep } from 'node:path'
import { load } from 'js-yaml'
import { collections, splitFrontmatter } from '../scripts/lib/content.mjs'
import { headTags, isNoindex } from '../scripts/lib/html.mjs'
import { pageRoutes, walk } from '../scripts/lib/routes.mjs'
import { cspHash } from '../scripts/lib/site-policy.mjs'
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

// Индексируемые страницы сборки: prerendered минус служебные, закрытые noindex. Это и есть
// содержимое карты сайта.
export function indexablePaths(): string[] {
  return prerenderedPaths().filter((path) => {
    const file = resolve(clientDir, `.${path === '/' ? '' : path}/index.html`)
    return !isNoindex(headTags(readFileSync(file, 'utf8')))
  })
}

// On-demand маршруты без параметров (src/pages с `prerender = false`): их отдаёт приложение.
export function onDemandRoutes(): string[] {
  return pageRoutes(resolve(root, 'src/pages'))
    .filter((page) => page.mode === 'dynamic' && !page.parametrized)
    .map((page) => page.route)
}

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
const CSP_EXACT = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
// Источник, который пропускает чужой код или стиль целиком: подстановка, схема, инлайн без хеша.
const CSP_WILDCARD = /^(\*|[a-z][a-z\d+.-]*:|'unsafe-inline'|'unsafe-eval'|'unsafe-hashes')$/

// CSP страницы так, как её видит браузер: заголовок есть, защитные директивы на месте, загрузка —
// своё и перечисленные origin без подстановок, каждый инлайн-скрипт и инлайн-стиль документа
// разрешён хешем.
export function cspProblems(html: string, header: string | undefined): string[] {
  if (!header) return ['нет заголовка Content-Security-Policy']
  const directives = header
    .split(';')
    .map((directive) => directive.trim().split(/\s+/).join(' '))
    .filter(Boolean)
  const sourcesOf = (name: string) =>
    directives
      .find((directive) => directive.startsWith(`${name} `))
      ?.split(' ')
      .slice(1)
  const problems = CSP_EXACT.filter((required) => !directives.includes(required)).map(
    (required) => `нет «${required}»`,
  )
  for (const name of ['default-src', 'script-src', 'style-src']) {
    const sources = sourcesOf(name)
    if (!sources) problems.push(`нет ${name}`)
    for (const source of sources?.filter((value) => CSP_WILDCARD.test(value)) ?? []) {
      problems.push(`${name} пропускает всё: ${source}`)
    }
  }
  for (const [element, name] of [
    ['script', 'script-src'],
    ['style', 'style-src'],
  ] as const) {
    const pattern = new RegExp(`<${element}\\b([^>]*)>([\\s\\S]*?)</${element}>`, 'g')
    for (const [, attrs = '', body = ''] of html.matchAll(pattern)) {
      // JSON-LD — данные, а не код: CSP его не исполняет и не блокирует.
      if (attrs.includes('type="application/ld+json"')) continue
      if (!sourcesOf(name)?.includes(`'${cspHash(body)}'`)) {
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

// Правила content/redirects.yaml.
export function redirects(): RedirectRule[] {
  const data = load(readFileSync(resolve(root, 'content/redirects.yaml'), 'utf8'))
  return [...buildRedirectTable(data).values()]
}
