import { allPosts, lastModified } from '@/entities/post'
import { POSTS_PER_PAGE } from '@/shared/config'
import { buildSitemap } from '@/shared/seo'
import type { RequestHandler } from './$types'

export const prerender = false

export const GET: RequestHandler = ({ locals }) => {
  const pages = Math.max(1, Math.ceil(allPosts().length / POSTS_PER_PAGE))
  const entries = [
    { path: '/', lastmod: lastModified() },
    { path: '/blog', lastmod: lastModified() },
    ...Array.from({ length: pages - 1 }, (_, i) => ({ path: `/blog/page/${i + 2}` })),
    ...allPosts().map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.updatedDate })),
    { path: '/about' },
    { path: '/contact' },
  ]

  return new Response(buildSitemap(locals.origin, entries), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
