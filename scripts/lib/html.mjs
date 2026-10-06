// Разбор прод-HTML для гейтов и e2e: значения атрибутов раскодированы из HTML-сущностей,
// <meta>/<link> из <head> — объекты атрибутов (порядок атрибутов в разметке не важен).
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

// Один проход: `&amp;lt;` — это литерал `&lt;`, а не `<`.
/** @param {string} value */
export const decode = (value) =>
  value.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])

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
