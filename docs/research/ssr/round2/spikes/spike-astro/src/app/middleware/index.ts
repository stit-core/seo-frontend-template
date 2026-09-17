import { defineMiddleware } from 'astro:middleware'
import { getRuntimeConfig } from '@/shared/config'

// Staging-контур: заголовок ставится на всё, что реально проходит через процесс.
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next()
  if (getRuntimeConfig().ROBOTS_POLICY === 'noindex') {
    response.headers.set('x-robots-tag', 'noindex, nofollow')
  }
  return response
})
