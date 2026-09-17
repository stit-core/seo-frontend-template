import { allPosts } from '@/entities/post'
import { buildRss } from '@/shared/seo'
import type { RequestHandler } from './$types'

export const prerender = false

export const GET: RequestHandler = ({ locals }) =>
  new Response(
    buildRss(
      locals.origin,
      allPosts().map((p) => ({
        path: `/blog/${p.slug}`,
        title: p.title,
        description: p.description,
        pubDate: p.pubDate,
        updatedDate: p.updatedDate,
      })),
    ),
    {
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    },
  )
