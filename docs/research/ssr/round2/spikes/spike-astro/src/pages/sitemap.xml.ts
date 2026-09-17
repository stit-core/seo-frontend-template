export const prerender = false

import type { APIRoute } from 'astro'
import { lastmod, listPosts } from '@/entities/post'
import { SUPPORTED_LOCALES } from '@/shared/i18n'
import { absoluteUrl, localePath } from '@/shared/seo'

interface Entry {
  loc: string
  lastmod?: string
}

export const GET: APIRoute = async () => {
  const posts = await listPosts()
  const entries: Entry[] = []

  const lastPage = Math.max(1, Math.ceil(posts.length / 5))
  for (const locale of SUPPORTED_LOCALES) {
    for (const path of ['/', '/blog', '/about', '/contact']) {
      entries.push({ loc: absoluteUrl(localePath(locale, path)) })
    }
    for (let n = 2; n <= lastPage; n++) {
      entries.push({ loc: absoluteUrl(localePath(locale, `/blog/page/${n}`)) })
    }
  }
  for (const post of posts) {
    entries.push({
      loc: absoluteUrl(`/blog/${post.id}`),
      lastmod: lastmod(post).toISOString().slice(0, 10),
    })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) =>
      `  <url><loc>${entry.loc}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=600',
    },
  })
}
