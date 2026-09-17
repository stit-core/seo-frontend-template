import { createFileRoute } from '@tanstack/react-router'
import { mockPosts } from '@/shared/api/mock/posts'
import { absoluteUrl } from '@/shared/seo'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const urls = [
          { loc: absoluteUrl('/'), lastmod: undefined },
          ...mockPosts.map((p) => ({ loc: absoluteUrl(`/posts/${p.slug}`), lastmod: p.publishedAt })),
        ]
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`
        return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
      },
    },
  },
})
