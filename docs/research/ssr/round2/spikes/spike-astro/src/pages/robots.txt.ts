export const prerender = false

import type { APIRoute } from 'astro'
import { getRuntimeConfig } from '@/shared/config'
import { absoluteUrl } from '@/shared/seo'

export const GET: APIRoute = () => {
  const { ROBOTS_POLICY } = getRuntimeConfig()
  const body =
    ROBOTS_POLICY === 'noindex'
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}
