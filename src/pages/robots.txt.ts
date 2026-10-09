export const prerender = false

import type { APIRoute } from 'astro'
import { AI_BOTS_POLICY, CLEAN_PARAMS, getRuntimeConfig } from '@/shared/config'
import { absoluteUrl, buildRobotsTxt } from '@/shared/seo'

// On-demand: контур и origin — runtime env контейнера (staging закрыт `Disallow: /`, прод отдаёт
// абсолютную строку Sitemap); политика ИИ-ботов и служебные параметры адреса — поля сборки, одни на
// все среды.
export const GET: APIRoute = () => {
  const { ROBOTS_POLICY } = getRuntimeConfig()
  const body = buildRobotsTxt({
    policy: ROBOTS_POLICY,
    aiBots: AI_BOTS_POLICY,
    cleanParams: CLEAN_PARAMS,
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
