// Политика сборки одним списком: что разрешено сверх строгого умолчания («индексируемая
// страница без noindex, без скриптов и без чужих ресурсов»), типы разметки и бюджеты сниппета
// выдачи. Держат её seo:check (каждая страница dist/client) и HTTP-набор (on-demand страницы).
// Список расширяется решением — служебная страница, остров, сторонний сервис, тип разметки, — а
// не по месту в скрипте.

// Служебные prerendered-маршруты без префикса локали: только им положен noindex.
export const NOINDEX_ROUTES = ['/contacts/spasibo', '/500']

// Острова: исполняемый <script> страницы — только инлайн в <head> и с data-island из списка.
export const ISLANDS = ['theme', 'metrika']

// Чужие origin, с которых страница может грузить ресурсы (скрипты, стили, шрифты, картинки,
// фреймы). Пусто: всё своё — и юридически (трансграничная передача), и по весу первого экрана.
export const RESOURCE_ORIGINS = []

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
    if (/type="application\/ld\+json"/.test(attrs)) {
      if (match.index > headEnd) problems.push('JSON-LD в <body>: разметка — только в <head>')
      continue
    }
    const island = /\bdata-island="([^"]*)"/.exec(attrs)?.[1]
    if (/\bsrc=/.test(attrs)) problems.push(`внешний <script${attrs}>: островов из файла нет`)
    else if (island === undefined || !ISLANDS.includes(island)) {
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
