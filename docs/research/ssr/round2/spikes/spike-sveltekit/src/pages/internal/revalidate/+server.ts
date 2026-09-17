import { createHmac, timingSafeEqual } from 'node:crypto'
import { error, json } from '@sveltejs/kit'
import { htmlCache } from '@/app/hooks.server'
import { env } from '$env/dynamic/private'
import type { RequestHandler } from './$types'

export const prerender = false

// Вебхук инвалидации: тело подписано HMAC-SHA256 общим секретом.
export const POST: RequestHandler = async ({ request }) => {
  const secret = env.REVALIDATE_SECRET
  if (!secret) error(503, 'REVALIDATE_SECRET не задан')

  const body = await request.text()
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  const got = request.headers.get('x-signature') ?? ''
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  if (a.length !== b.length || !timingSafeEqual(a, b)) error(401, 'Плохая подпись')

  const payload = body ? (JSON.parse(body) as { key?: string }) : {}
  const purged = htmlCache.invalidate(payload.key)
  return json({ purged, key: payload.key ?? '*' }, { headers: { 'cache-control': 'no-store' } })
}
