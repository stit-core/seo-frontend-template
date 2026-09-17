import {
  createError,
  defineEventHandler,
  getRequestHeader,
  readBody,
  sendRedirect,
  setResponseHeader,
} from 'h3'

interface ContactPayload {
  name?: string
  email?: string
  message?: string
  company?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ContactPayload>(event)
  // Нативная отправка формы (без JS) приходит как form-urlencoded — ей нужен 303, а не JSON.
  const isFormPost = (getRequestHeader(event, 'content-type') || '').includes('form-urlencoded')

  setResponseHeader(event, 'cache-control', 'no-store')

  // honeypot: заполненное скрытое поле — бот, отвечаем как будто всё хорошо
  if (body?.company) {
    return isFormPost ? sendRedirect(event, '/contact?sent=1', 303) : { ok: true }
  }

  if (!body?.name || !body?.email || !body?.message) {
    if (isFormPost) {
      return sendRedirect(event, '/contact?error=1', 303)
    }
    throw createError({ statusCode: 422, statusMessage: 'Missing fields' })
  }

  return isFormPost
    ? sendRedirect(event, '/contact?sent=1', 303)
    : { ok: true, received: { name: body.name } }
})
