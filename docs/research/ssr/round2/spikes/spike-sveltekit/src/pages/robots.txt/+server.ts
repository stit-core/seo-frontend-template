import { buildRobots } from '@/shared/seo'
import type { RequestHandler } from './$types'

// Всегда рантайм: знает и актуальный origin, и политику индексации среды.
export const prerender = false

export const GET: RequestHandler = ({ locals }) =>
  new Response(buildRobots(locals.origin, locals.robotsPolicy), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
