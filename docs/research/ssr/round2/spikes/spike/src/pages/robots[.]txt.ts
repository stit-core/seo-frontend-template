import { createFileRoute } from '@tanstack/react-router'
import { runtimeConfig } from '@/shared/config'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        const body = runtimeConfig.INDEXABLE
          ? `User-agent: *\nAllow: /\nDisallow: /login\nDisallow: /account\nDisallow: /profile\nSitemap: ${runtimeConfig.SITE_URL}/sitemap.xml\nHost: ${runtimeConfig.SITE_URL}\n`
          : 'User-agent: *\nDisallow: /\n'
        return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      },
    },
  },
})
