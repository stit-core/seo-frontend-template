// Политика сборки одним списком: что разрешено сверх строгого умолчания («индексируемая
// страница без noindex, без скриптов и без чужих ресурсов»), типы разметки и бюджеты сниппета
// выдачи. Держат её seo:check (каждая страница dist/client), HTTP-набор (on-demand страницы и
// заголовки) и браузер — CSP строится отсюда же. Список расширяется решением — служебная
// страница, остров, сторонний сервис, тип разметки, — а не по месту в скрипте.
import { createHash } from 'node:crypto'
import { brotliCompressSync, constants } from 'node:zlib'
import { ISLANDS, standsOn } from '../../src/shared/config/islands.ts'
import { routeOf } from '../../src/shared/i18n/locale.ts'
import { isJsonLd } from './html.mjs'

/** @typedef {import('../../src/shared/config/islands.ts').Island} Island */

// Реестр островов — данные приложения (src/shared/config/islands.ts): по нему оболочка печатает
// острова, а политика сборки строит CSP и сверяет страницы.
export { ISLANDS }

// Служебные prerendered-маршруты без префикса локали: только им положен noindex.
export const NOINDEX_ROUTES = ['/contacts/spasibo', '/500']

// Страница тега индексируется от стольких опубликованных записей локали; ниже порога она почти
// повторяет список — тонкая страница обязана быть с noindex (и только она: право на него тегу даёт
// число записей в источнике, а не NOINDEX_ROUTES). Число здесь и в коллекции — одно и то же.
export const TAG_INDEX_MIN_POSTS = 3

/**
 * Вес в brotli — мера бюджетов: так свои байты отдаёт edge.
 * @param {string | Uint8Array} content
 */
export const brotliBytes = (content) =>
  brotliCompressSync(content, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length

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
  const islands = Object.values(ISLANDS).filter((island) => island.pages.length > 0)
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
      hashes: islands.flatMap((island) => island.hash ?? []),
    },
    styleDirective: { resources: allow('style-src') },
  }
}

// Иконку сайта для выдачи поисковик берёт с главной страницы. Google принимает растр (SVG в списке
// его форматов нет) от 8×8 и советует крупнее 48×48: первая иконка страницы — не мельче этого.
export const ICON_MIN_SIDE = 48

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

// Модуль, в который Astro собирает <script> компонента: имя компонента — в имени файла сборки.
const COMPONENT_SCRIPT = /^\/_astro\/([\w.-]+\.astro)_astro_type_script_index_\d+_lang\.[\w-]+\.js$/

/**
 * Скрипты документа: тег целиком, его место и остров реестра, которому он принадлежит, — инлайн
 * по `data-island`, файл по имени компонента в `src`.
 * @param {string} html
 * @param {Record<string, Island>} [islands]
 */
export function scriptsOf(html, islands = ISLANDS) {
  const headEnd = html.indexOf('</head>')
  return Array.from(html.matchAll(/<script\b([^>]*)>(?:[\s\S]*?<\/script>)?/g), (match) => {
    const [tag, attrs = ''] = match
    const src = /\bsrc="([^"]*)"/.exec(attrs)?.[1]
    const component = COMPONENT_SCRIPT.exec(src ?? '')?.[1]
    const island =
      src === undefined
        ? /\bdata-island="([^"]*)"/.exec(attrs)?.[1]
        : Object.keys(islands).find((name) => islands[name]?.file?.split('/').at(-1) === component)
    // Инлайн под именем острова-файла и наоборот — не тот остров, что в реестре.
    const known =
      island !== undefined &&
      Object.hasOwn(islands, island) &&
      (src === undefined) === (islands[island]?.hash !== undefined)
    return {
      tag,
      attrs,
      src,
      jsonLd: isJsonLd(attrs),
      inBody: match.index > headEnd,
      island: known ? island : undefined,
    }
  })
}

/**
 * Нарушения правила островов в документе: скрипт вне реестра, не на своей странице, инлайн в
 * <body> или дубль; разметка острова без него; исполняемый код мимо <script> — обработчик в
 * атрибуте или javascript:-адрес.
 * @param {string} html
 * @param {string} path — путь страницы
 * @param {Record<string, Island>} [islands]
 * @returns {string[]}
 */
export function scriptViolations(html, path, islands = ISLANDS) {
  const problems = []
  const seen = new Set()
  for (const { attrs, src, jsonLd, inBody, island } of scriptsOf(html, islands)) {
    if (jsonLd) {
      if (inBody) problems.push('JSON-LD в <body>: разметка — только в <head>')
      continue
    }
    const row = island === undefined ? undefined : islands[island]
    if (row === undefined) {
      problems.push(
        src === undefined
          ? `<script${attrs}> вне списка островов ISLANDS (src/shared/config/islands.ts)`
          : `внешний <script${attrs}>: файла-острова нет в списке ISLANDS (src/shared/config/islands.ts)`,
      )
    } else if (seen.has(island)) problems.push(`остров ${island} дважды`)
    else if (!standsOn(row, routeOf(path))) {
      problems.push(
        `остров ${island} вне своих страниц (${row.pages.join(', ') || 'их нет'}): где он стоит, решает его строка ISLANDS (src/shared/config/islands.ts)`,
      )
    }
    // Модуль исполняется после разбора документа, где бы ни стоял; инлайн — на месте, до отрисовки.
    if (src === undefined && inBody) {
      problems.push(`<script${attrs}> в <body>: остров живёт в <head>`)
    }
    if (island !== undefined) seen.add(island)
  }
  // Обработчик on*= и javascript:-адрес исполняют код без <script> — острову так не объявиться.
  // Смотрятся имена атрибутов и значения адресных: текст «JavaScript: …» в title или content — не код.
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, '')
  for (const [tag] of markup.matchAll(/<[a-z][^>]*>/gi)) {
    for (const [, name = '', value = ''] of tag.matchAll(ATTRIBUTE)) {
      if (/^on[a-z]+$/i.test(name)) {
        problems.push(
          `обработчик ${name} в разметке: скрипт вне островов ISLANDS (src/shared/config/islands.ts)`,
        )
      } else if (URL_ATTRIBUTE.test(name) && /^["']?\s*javascript:/i.test(value)) {
        problems.push(
          'javascript:-адрес в разметке: скрипт вне островов ISLANDS (src/shared/config/islands.ts)',
        )
      }
    }
  }
  // Кнопку острова без него некому показать и обслужить: посетитель её не увидит.
  for (const [name, { markup: attribute }] of Object.entries(islands)) {
    if (attribute === undefined || seen.has(name)) continue
    if (new RegExp(`<[a-z][^>]*\\s${attribute}(?:[\\s=>]|/>)`, 'i').test(markup)) {
      problems.push(`разметка острова ${name} (${attribute}) на странице без него`)
    }
  }
  return problems
}
