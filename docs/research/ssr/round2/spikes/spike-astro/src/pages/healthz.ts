export const prerender = false

import type { APIRoute } from 'astro'
import { getRuntimeConfig } from '@/shared/config'

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ status: 'ok', release: getRuntimeConfig().RELEASE }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
