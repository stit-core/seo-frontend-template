import type { RequestHandler } from './$types'

export const prerender = false

export const GET: RequestHandler = () =>
  new Response('ok', {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
