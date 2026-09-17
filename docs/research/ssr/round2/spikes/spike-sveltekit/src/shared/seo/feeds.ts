import { SITE_NAME } from '@/shared/config'
import { absoluteUrl, LOCALES, type Locale } from './meta'

export interface FeedItem {
  path: string
  title: string
  description: string
  pubDate: string
  updatedDate: string
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Полный набор URL сайта: один <url> на путь, внутри — xhtml:link на все локали. */
export function buildSitemap(
  origin: string,
  entries: Array<{ path: string; lastmod?: string }>,
): string {
  const urls = entries
    .flatMap((entry) =>
      LOCALES.map((locale) => {
        const alternates = LOCALES.map(
          (l) =>
            `    <xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(absoluteUrl(origin, entry.path, l))}"/>`,
        ).join('\n')
        return [
          '  <url>',
          `    <loc>${escapeXml(absoluteUrl(origin, entry.path, locale))}</loc>`,
          alternates,
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(absoluteUrl(origin, entry.path))}"/>`,
          entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : '',
          '  </url>',
        ]
          .filter(Boolean)
          .join('\n')
      }),
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`
}

export function buildRobots(origin: string, policy: 'index' | 'noindex'): string {
  if (policy === 'noindex') {
    return `User-agent: *\nDisallow: /\n`
  }
  return [
    'User-agent: *',
    'Disallow: /internal/',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

export function buildRss(origin: string, items: FeedItem[], locale: Locale = 'ru'): string {
  const entries = items
    .map((item) => {
      const link = absoluteUrl(origin, item.path, locale)
      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <description>${escapeXml(item.description)}</description>`,
        `      <pubDate>${new Date(`${item.pubDate}T00:00:00Z`).toUTCString()}</pubDate>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(`${origin}/`)}</link>
    <description>${escapeXml(SITE_NAME)}</description>
    <language>${locale === 'en' ? 'en-GB' : 'ru-RU'}</language>
    <atom:link href="${escapeXml(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml"/>
${entries}
  </channel>
</rss>
`
}
