export interface SitemapEntry {
  // Абсолютный URL страницы, отвечающей 200.
  loc: string
  // Календарная дата последнего значимого изменения (`2026-09-10`); без неё элемент не выводится.
  lastmod?: string | undefined
}

// Лимит одного файла (Google, Яндекс): дальше — sitemap index с шардами по типу и локали.
export const SITEMAP_URL_LIMIT = 50_000

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

// changefreq/priority не выводятся: Google их игнорирует, для остальных это шум.
export function buildSitemap(entries: readonly SitemapEntry[]): string {
  if (entries.length > SITEMAP_URL_LIMIT) {
    throw new Error(
      `sitemap: ${entries.length} URL больше лимита ${SITEMAP_URL_LIMIT} — нужен sitemap index с шардами`,
    )
  }
  const urls = entries.map(
    ({ loc, lastmod }) =>
      `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''}</url>`,
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
