import type { MetadataRoute } from 'next'
import { getSiteUrl, isIndexable } from '@/shared/config'

// force-dynamic: robots.txt обязан читать env контейнера, иначе политика
// staging/prod запекается на билде.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  if (!isIndexable()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/now', '/api/'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
