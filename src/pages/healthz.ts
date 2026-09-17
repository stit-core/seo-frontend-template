export const prerender = false

import type { APIRoute } from 'astro'

// Liveness без зависимостей и без версии: релиз наружу не раскрывается.
export const GET: APIRoute = () =>
  new Response('ok', {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
