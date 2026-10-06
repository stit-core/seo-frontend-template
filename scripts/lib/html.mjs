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

/**
 * Видимый текст фрагмента — то, что читает человек: без скриптов, стилей и aria-hidden,
 * сущности раскодированы, пробелы нормализованы.
 * @param {string} fragment
 */
export const textOf = (fragment) =>
  normalizeSpace(
    decode(
      fragment
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
        .replace(/<(\w+)\b[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  )
