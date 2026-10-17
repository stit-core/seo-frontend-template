// Разбор прод-HTML для гейтов и e2e: значения атрибутов раскодированы из HTML-сущностей,
// <meta>/<link> из <head> — объекты атрибутов (порядок атрибутов в разметке не важен).

// Именованные сущности, которые печатает Astro и пишут руками: служебные HTML и типографика —
// пробелы, кавычки, тире. Числовые (`&#160;`, `&#x202F;`) раскодируются все.
/** @type {Record<string, string>} */
const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  thinsp: ' ',
  ensp: ' ',
  emsp: ' ',
  laquo: '«',
  raquo: '»',
  bdquo: '„',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  mdash: '—',
  ndash: '–',
  minus: '−',
  hellip: '…',
  middot: '·',
  times: '×',
  copy: '©',
  numero: '№',
}

// Один проход: `&amp;lt;` — это литерал `&lt;`, а не `<`; незнакомая сущность остаётся как есть.
/** @param {string} value */
export const decode = (value) =>
  value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (entity, dec, hex, name) => {
    if (name !== undefined) return ENTITIES[name] ?? entity
    const code = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16)
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity
  })

/** @typedef {Record<string, string>} HeadTag */

/**
 * @param {string} html
 * @returns {HeadTag[]}
 */
export function headTags(html) {
  const head = html.slice(0, html.indexOf('</head>'))
  return [...head.matchAll(/<(meta|link)\b([^>]*)>/g)].map(([, tag, attrs]) => {
    /** @type {HeadTag} */
    const item = { tag: tag ?? '' }
    for (const [, name, value] of (attrs ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)) {
      item[name ?? ''] = decode(value ?? '')
    }
    return item
  })
}

/**
 * Страница закрыта от индекса метатегом: общим robots или адресным поисковику (googlebot,
 * yandex, bingbot); имя и значение — без учёта регистра, none = noindex + nofollow.
 * @param {HeadTag[]} tags
 */
export const isNoindex = (tags) =>
  tags.some(
    (tag) =>
      tag.tag === 'meta' &&
      /^(robots|googlebot|yandex|bingbot)$/i.test(tag.name ?? '') &&
      /\b(noindex|none)\b/i.test(tag.content ?? ''),
  )

/**
 * Атрибуты тега по именам: значение — в двойных или одинарных кавычках или без них, у булева
 * атрибута (`hidden`) — пустая строка; имена — в нижнем регистре.
 * @param {string} attrs
 * @returns {Map<string, string>}
 */
export const attributesOf = (attrs) =>
  new Map(
    [...attrs.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)].map(
      ([, name = '', double, single, bare]) => [name.toLowerCase(), double ?? single ?? bare ?? ''],
    ),
  )

/**
 * Тег `<script>` — блок JSON-LD: тип data block, какие бы ещё атрибуты у тега ни стояли. Один
 * признак для политики скриптов (блок — не код) и для разбора разметки (блок читается).
 * @param {string} attrs
 */
export const isJsonLd = (attrs) =>
  attributesOf(attrs).get('type')?.trim().toLowerCase() === 'application/ld+json'

/**
 * Тела всех блоков JSON-LD документа — как в разметке, без разбора.
 * @param {string} html
 * @returns {string[]}
 */
export const jsonLdBlocks = (html) =>
  [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].flatMap(
    ([, attrs = '', body = '']) => (isJsonLd(attrs) ? [body] : []),
  )

/**
 * Тело документа: от `<body` до `</body>`.
 * @param {string} html
 */
export const bodyOf = (html) => html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'))

/**
 * Текст в нормализации для сравнения: любой пробельный символ — переводы строк, неразрывный
 * U+00A0 и узкие U+2009, U+202F типографики («+64 %», «ООО «Пример»») — один обычный пробел,
 * по краям — ничего. Видимый текст и строки разметки сравниваются только в ней.
 * @param {string} text
 */
export const normalizeSpace = (text) => text.replace(/\s+/g, ' ').trim()

// Элементы без содержимого: скрытый тег такого вида ничего под собой не прячет.
const VOID = new Set('area base br col embed hr img input link meta source track wbr'.split(' '))

/**
 * Фрагмент без скрытых поддеревьев: элемент с атрибутом `hidden` (в любой форме) или
 * `aria-hidden="true"` человек не читает — вместе со всем, что в него вложено. Класс `hidden` и
 * `type="hidden"` — значения других атрибутов, а не признак.
 * @param {string} fragment
 */
export function withoutHidden(fragment) {
  let visible = ''
  let from = 0
  // Скрытый элемент, по содержимому которого идёт разбор: глубина считает вложенные теги его имени.
  /** @type {{ name: string, depth: number } | undefined} */
  let hidden
  for (const match of fragment.matchAll(/<(\/?)([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const [tag, closing, tagName = '', attrs = ''] = match
    const name = tagName.toLowerCase()
    const container = !VOID.has(name) && !attrs.trimEnd().endsWith('/')
    if (hidden) {
      if (name === hidden.name && container) hidden.depth += closing ? -1 : 1
      if (hidden.depth === 0) {
        from = match.index + tag.length
        hidden = undefined
      }
      continue
    }
    const attributes = closing ? undefined : attributesOf(attrs)
    if (attributes?.has('hidden') || attributes?.get('aria-hidden') === 'true') {
      visible += `${fragment.slice(from, match.index)} `
      from = match.index + tag.length
      if (container) hidden = { name, depth: 1 }
    }
  }
  // Незакрытый скрытый элемент прячет всё до конца фрагмента.
  return hidden ? visible : visible + fragment.slice(from)
}

/**
 * Видимый текст фрагмента — то, что читает человек: без скриптов, стилей и скрытых поддеревьев
 * (`hidden`, `aria-hidden="true"`), сущности раскодированы, пробелы нормализованы.
 * @param {string} fragment
 */
export const textOf = (fragment) =>
  normalizeSpace(
    decode(
      withoutHidden(fragment.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')).replace(
        /<[^>]+>/g,
        ' ',
      ),
    ),
  )
