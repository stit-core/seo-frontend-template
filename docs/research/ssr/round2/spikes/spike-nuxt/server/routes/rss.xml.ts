import { queryCollection } from '@nuxt/content/server'
import { defineEventHandler, setResponseHeader } from 'h3'
// nuxt typecheck резолвит #imports для server/** по APP-импортам — берём алиас модуля напрямую.
import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string,
  )
}

export default defineEventHandler(async (event) => {
  const site = getSiteConfig(event)
  const origin = String(site.url).replace(/\/+$/, '')

  const posts = await queryCollection(event, 'postsRu')
    .select('path', 'title', 'description', 'pubDate')
    .order('pubDate', 'DESC')
    .limit(20)
    .all()

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${origin}${post.path}</link>
      <guid isPermaLink="true">${origin}${post.path}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(`${post.pubDate}T00:00:00Z`).toUTCString()}</pubDate>
    </item>`,
    )
    .join('\n')

  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=600')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(String(site.name ?? 'stit demo'))}</title>
    <link>${origin}/</link>
    <description>stit demo — блог</description>
    <language>ru</language>
    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
})
