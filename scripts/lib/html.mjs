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
 * Видимый текст фрагмента — то, что читает человек: без скриптов, стилей и aria-hidden,
 * сущности раскодированы, пробелы схлопнуты.
 * @param {string} fragment
 */
export const textOf = (fragment) =>
  decode(
    fragment
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
      .replace(/<(\w+)\b[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
