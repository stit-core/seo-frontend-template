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
