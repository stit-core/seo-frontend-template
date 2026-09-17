export const prerender = false

import type { APIRoute } from 'astro'
import { ContactInputSchema, formToObject, handleContact } from '@/features/contact-form'

const THANKS = '/contact/thanks'

// Один эндпоинт на оба пути: нативный POST формы (без JS) и fetch из острова.
// Без JS отвечаем PRG-303, чтобы F5 не переотправлял заявку.
export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? ''
  const wantsJson = contentType.includes('application/json')

  const payload = wantsJson
    ? await request.json().catch(() => null)
    : formToObject(await request.formData())

  // CSRF: браузер обязан прислать Origin на любой не-GET из формы или fetch.
  const origin = request.headers.get('origin')
  if (origin !== null && new URL(request.url).origin !== origin) {
    return new Response('forbidden', { status: 403 })
  }

  const parsed = ContactInputSchema.safeParse(payload)
  if (!parsed.success) {
    if (wantsJson) return Response.json({ error: 'invalid' }, { status: 422 })
    return new Response(null, { status: 303, headers: { location: '/contact?error=1' } })
  }

  const result = handleContact(parsed.data)
  if (wantsJson) {
    return Response.json(result, { headers: { 'cache-control': 'no-store' } })
  }
  return new Response(null, { status: 303, headers: { location: THANKS } })
}
