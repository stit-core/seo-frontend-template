// Политика сборки одним списком: что разрешено сверх строгого умолчания («индексируемая
// страница без noindex, без скриптов и без чужих ресурсов»), типы разметки и бюджеты сниппета
// выдачи. Держат её seo:check (каждая страница dist/client), HTTP-набор (on-demand страницы и
// заголовки) и браузер — CSP строится отсюда же. Список расширяется решением — служебная
// страница, остров, сторонний сервис, тип разметки, — а не по месту в скрипте.
import { createHash } from 'node:crypto'
import { METRIKA_ID } from '../../src/shared/config/site.ts'
import { isJsonLd } from './html.mjs'

// Служебные prerendered-маршруты без префикса локали: только им положен noindex.
export const NOINDEX_ROUTES = ['/contacts/spasibo', '/500']

// Страница тега индексируется от стольких опубликованных записей локали; ниже порога она почти
// повторяет список — тонкая страница обязана быть с noindex (и только она: право на него тегу даёт
// число записей в источнике, а не NOINDEX_ROUTES). Число здесь и в коллекции — одно и то же.
export const TAG_INDEX_MIN_POSTS = 3

// Острова: исполняемый <script> страницы — только инлайн в <head> и с data-island из списка. CSP
// пропускает тело острова по хешу: правка тела — новый `hash` здесь (тест острова печатает его),
// и изменение исполняемого кода сайта видно в диффе политики. `on` — печатает ли остров сайт
// (по умолчанию — да), `sources` — чужие origin острова по директивам CSP.
export const ISLANDS = {
  theme: { hash: 'sha256-6PP0q6y6JDJx8gwgskZkXliPGb4JSQLN9q1UUOcqu6Q=' },
  // Счётчик — только с идентификатором; tag.js, хиты и пиксель — с его origin. Вебвизору, карте
  // кликов и региональным доменам нужно больше — список Яндекса:
  // https://yandex.ru/support/metrica/code/install-counter-csp.html
  metrika: {
    hash: 'sha256-tkhj0JcGzL7QaX6wrVvp3zLdoPOwBUgKraRdnuJTdrU=',
    on: METRIKA_ID !== '',
    sources: {
      'script-src': ['https://mc.yandex.ru'],
      'connect-src': ['https://mc.yandex.ru'],
      'img-src': ['https://mc.yandex.ru'],
    },
  },
}

// Реестр ботов src/shared/seo/crawlers.yaml — копия файла базы strategy байт в байт: политика
// ИИ-ботов сайта читает из него закрытые группы robots.txt и мету. Версия копии закреплена: файл
// меняется только заменой на новую версию базы вместе с этим sha256 (его печатает тест реестра) —
// правка копии руками краснеет, а смена версии видна в диффе политики.
export const CRAWLERS_SHA256 = '1ca0e662f76d556e20efc6f5f20b2b0bb2fe0bd6932bf3a5655b00ca2bfa4189'

// Чужие origin, с которых страница может грузить ресурсы (стили, шрифты, картинки, фреймы;
// скрипт — только инлайн-остров). Пусто: всё своё — и юридически (трансграничная передача), и по
// весу первого экрана.
/** @type {string[]} */
export const RESOURCE_ORIGINS = []

/**
 * Хеш инлайн-скрипта или стиля в форме CSP.
 * @param {string} body
 */
export const cspHash = (body) => `sha256-${createHash('sha256').update(body).digest('base64')}`

// Защитные директивы CSP — значения без источников островов: остров не открывает плагины, чужой
// <base>, отправку форм наружу и встраивание сайта во фрейм.
const PROTECTED_DIRECTIVES = {
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
  'frame-ancestors': "'none'",
}

/**
 * CSP сайта — значение `security.csp` Astro: всё своё, чужой origin — из RESOURCE_ORIGINS и у
 * острова, который его грузит, исполняемый инлайн — тела островов по хешу. Хеши стилей и файлов
 * сборки Astro добавляет сам. Каждая директива печатается один раз: браузер действует по первому
 * вхождению и молча отбрасывает дубль.
 * @returns {Exclude<NonNullable<import('astro').AstroUserConfig['security']>['csp'], boolean | undefined>}
 */
export function contentSecurityPolicy() {
  for (const [name, island] of Object.entries(ISLANDS)) {
    for (const directive of Object.keys(island.sources ?? {})) {
      if (Object.hasOwn(PROTECTED_DIRECTIVES, directive)) {
        throw new Error(`ISLANDS.${name}: источники острова в защитной директиве ${directive}`)
      }
    }
  }
  const islands = Object.values(ISLANDS).filter((island) => island.on !== false)
  const sources = (directive) => islands.flatMap((island) => island.sources?.[directive] ?? [])
  // Явная директива перекрывает default-src: своё и чужие origin ресурсов — в каждой.
  const allow = (directive) => [...new Set(["'self'", ...RESOURCE_ORIGINS, ...sources(directive)])]
  // script-src и style-src Astro собирает сам — из scriptDirective и styleDirective.
  const fetchDirectives = new Set([
    'default-src',
    ...islands.flatMap((island) => Object.keys(island.sources ?? {})),
  ])
  fetchDirectives.delete('script-src')
  fetchDirectives.delete('style-src')
  return {
    directives: [
      ...[...fetchDirectives].map((directive) => `${directive} ${allow(directive).join(' ')}`),
      ...Object.entries(PROTECTED_DIRECTIVES).map(([directive, value]) => `${directive} ${value}`),
    ],
    // Внешних скриптов у сайта нет: чужой origin скрипта — только у острова, который его грузит.
    scriptDirective: {
      resources: ["'self'", ...sources('script-src')],
      hashes: islands.map((island) => island.hash),
    },
    styleDirective: { resources: allow('style-src') },
  }
}

// Типы JSON-LD, которые печатает сайт; остальные — ошибка. FAQPage, HowTo и SearchAction не
// размечаются вовсе (rich results сняты) — ни типом блока, ни вложенно.
export const JSON_LD_TYPES = [
  'Organization',
  'WebSite',
  'LocalBusiness',
  'BreadcrumbList',
  'BlogPosting',
]
export const JSON_LD_FORBIDDEN = ['FAQPage', 'HowTo', 'SearchAction']

// Типы узла организации сайта: у него сверяются @id, имя и видимые факты. Подтип LocalBusiness
// (Dentist, AutoRepair) — строкой и здесь, и в JSON_LD_TYPES: иначе правила сущности его не видят.
export const ORG_TYPES = ['Organization', 'LocalBusiness']

// Сниппет выдачи индексируемой страницы: title без суффикса сайта — не меньше трёх слов и не
// длиннее ширины строки выдачи, description — от «не из нескольких слов» до границы обрезки.
export const TITLE_BUDGET = { minWords: 3, maxChars: 65 }
export const DESCRIPTION_BUDGET = { minChars: 70, maxChars: 170 }

// Общий title, который поисковик заменит сам (порт meta-title-generic базы strategy).
export const GENERIC_TITLE =
  /^\s*(?:главная(?:\s+страница)?|домашняя\s+страница|home(?:\s*page)?|untitled(?:\s+document)?|без\s+названия|новая\s+страница|страница|page\s+title|app\s+title|site\s+title|document|react\s+app|vite\s*\+\s*react|my\s*app|website|сайт|добро\s+пожаловать!?|welcome!?|контакты|contacts?|contact\s+us|услуги|services|о\s+(?:нас|компании)|about(?:\s+us)?|блог|blog|каталог|catalog|профиль|profile|новости|news)\s*$/iu

// Атрибут тега: имя и значение — в кавычках или без них.
const ATTRIBUTE = /\s([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/g
// Атрибуты-адреса, по которым браузер переходит или грузит: javascript: в них исполняется.
const URL_ATTRIBUTE = /^(href|src|action|formaction|xlink:href|data)$/i

/**
 * Нарушения правила островов в документе: скрипт вне списка, внешний, в <body> или дубль;
 * исполняемый код мимо <script> — обработчик в атрибуте или javascript:-адрес.
 * @param {string} html
 * @returns {string[]}
 */
export function scriptViolations(html) {
  const headEnd = html.indexOf('</head>')
  const problems = []
  const seen = new Set()
  for (const match of html.matchAll(/<script\b([^>]*)>/g)) {
    const attrs = match[1] ?? ''
    if (isJsonLd(attrs)) {
      if (match.index > headEnd) problems.push('JSON-LD в <body>: разметка — только в <head>')
      continue
    }
    const island = /\bdata-island="([^"]*)"/.exec(attrs)?.[1]
    if (/\bsrc=/.test(attrs)) problems.push(`внешний <script${attrs}>: островов из файла нет`)
    else if (island === undefined || !Object.hasOwn(ISLANDS, island)) {
      problems.push(`<script${attrs}> вне списка островов ISLANDS (scripts/lib/site-policy.mjs)`)
    } else if (seen.has(island)) problems.push(`остров ${island} дважды`)
    if (match.index > headEnd) problems.push(`<script${attrs}> в <body>: остров живёт в <head>`)
    if (island !== undefined) seen.add(island)
  }
  // Обработчик on*= и javascript:-адрес исполняют код без <script> — острову так не объявиться.
  // Смотрятся имена атрибутов и значения адресных: текст «JavaScript: …» в title или content — не код.
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, '')
  for (const [tag] of markup.matchAll(/<[a-z][^>]*>/gi)) {
    for (const [, name = '', value = ''] of tag.matchAll(ATTRIBUTE)) {
      if (/^on[a-z]+$/i.test(name)) {
        problems.push(
          `обработчик ${name} в разметке: скрипт вне островов ISLANDS (scripts/lib/site-policy.mjs)`,
        )
      } else if (URL_ATTRIBUTE.test(name) && /^["']?\s*javascript:/i.test(value)) {
        problems.push(
          'javascript:-адрес в разметке: скрипт вне островов ISLANDS (scripts/lib/site-policy.mjs)',
        )
      }
    }
  }
  return problems
}
