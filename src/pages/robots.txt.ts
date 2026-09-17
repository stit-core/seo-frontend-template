export const prerender = false

import type { APIRoute } from 'astro'
import { getRuntimeConfig } from '@/shared/config'
import { absoluteUrl, buildRobotsTxt } from '@/shared/seo'

// On-demand: политика и origin — runtime env контейнера (staging закрыт `Disallow: /`,
// прод отдаёт абсолютную строку Sitemap).
export const GET: APIRoute = () => {
  const { ROBOTS_POLICY, AI_TRAINING } = getRuntimeConfig()
  const body = buildRobotsTxt({
    policy: ROBOTS_POLICY,
    aiTraining: AI_TRAINING,
    sitemapUrl: absoluteUrl('/sitemap.xml'),
  })
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Google и так кеширует robots.txt до суток; свой кеш — короткий.
      'cache-control': 'public, max-age=300',
      // Сам файл — не страница выдачи.
      'x-robots-tag': 'noindex',
    },
  })
}
