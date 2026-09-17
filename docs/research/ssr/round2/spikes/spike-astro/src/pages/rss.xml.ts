export const prerender = false

import rss from '@astrojs/rss'
import type { APIRoute } from 'astro'
import { lastmod, listPosts } from '@/entities/post'
import { SITE_NAME } from '@/shared/config'
import { absoluteUrl } from '@/shared/seo'

export const GET: APIRoute = async (context) => {
  const posts = await listPosts()
  return rss({
    title: SITE_NAME,
    description: 'Заметки о рендеринге, индексируемости и производительности.',
    site: absoluteUrl('/'),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: lastmod(post),
      link: `/blog/${post.id}`,
    })),
    trailingSlash: false,
    ...(context.locals ? {} : {}),
  })
}
