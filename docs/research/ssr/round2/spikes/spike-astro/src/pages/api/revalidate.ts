export const prerender = false

import type { APIRoute } from 'astro'

// Инвалидация кеша по тегам/пути — вебхук публикации из CMS.
// В шаблоне сюда добавляется HMAC-проверка подписи тела.
export const POST: APIRoute = async (context) => {
  const body = (await context.request.json().catch(() => ({}))) as {
    tags?: string[]
    path?: string
  }
  if (body.tags?.length) await context.cache.invalidate({ tags: body.tags })
  if (body.path) await context.cache.invalidate({ path: body.path })
  return new Response(null, { status: 202 })
}
