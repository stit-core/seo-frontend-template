import { defineMiddleware } from 'astro:middleware'
import { getRuntimeConfig } from '@/shared/config'
import { captureServerError, type LogLevel, log } from '@/shared/observability'
import { matchRedirect, redirectResponse } from './redirects'

// Всё ниже действует только на on-demand маршрутах: prerendered-страницы отдаёт
// статик-хендлер адаптера раньше приложения (со своими `Cache-Control: public, max-age=0`
// и ETag), и middleware их не видит. Поэтому staging закрывается ещё и на Traefik
// (basicAuth + X-Robots-Tag). Путь без файла (в т.ч. любой из redirects.yaml) до
// приложения доходит — 404-страница on-demand.
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next()

  const startedAt = performance.now()
  const rid = context.request.headers.get('x-request-id') ?? crypto.randomUUID()
  // Маршрут кладёт этот же rid в свои события (форма), и они сходятся со строкой запроса.
  context.locals.rid = rid
  const { ROBOTS_POLICY } = getRuntimeConfig()
  const logRequest = (status: number) =>
    log(levelOf(status, context.url.pathname), {
      method: context.request.method,
      path: context.url.pathname,
      status,
      dur_ms: Math.round((performance.now() - startedAt) * 10) / 10,
      rid,
    })

  let response: Response
  try {
    // Редиректы — данные (content/redirects.yaml): один хоп, до роутинга.
    const redirect = matchRedirect(context.url.pathname)
    response = redirect ? redirectResponse(redirect, context.url.search) : await next()
  } catch (err) {
    // Ответ 500 строит Astro сам и сюда не возвращает: фиксируем rid для корреляции с трассой.
    logRequest(500)
    await captureServerError(err, { rid, path: context.url.pathname })
    throw err
  }

  response.headers.set('x-request-id', rid)
  // Публичный on-demand HTML (404/410 включительно) без CDN: `no-cache` — «спроси сервер»,
  // `max-age` оставил бы у пользователей старую страницу после релиза. Роут важнее:
  // живой/персональный ответ ставит `private, no-store` сам, и он не перебивается.
  if (isHtml(response) && !response.headers.has('cache-control')) {
    response.headers.set('cache-control', 'no-cache')
  }
  if (ROBOTS_POLICY === 'noindex') {
    response.headers.set('x-robots-tag', 'noindex, nofollow')
  }
  logRequest(response.status)
  return response
})

function isHtml(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').startsWith('text/html')
}

// Успешный /healthz (docker HEALTHCHECK каждые 30 с) — только на debug: иначе он один и
// заполняет лог. Порог уровня и формат строки — `shared/observability`.
function levelOf(status: number, path: string): LogLevel {
  if (status >= 500) return 'error'
  if (status >= 400) return 'warn'
  return path === '/healthz' ? 'debug' : 'info'
}
