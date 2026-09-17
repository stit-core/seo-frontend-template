import { defineMiddleware } from 'astro:middleware'
import { getRuntimeConfig } from '@/shared/config'
import { matchRedirect, redirectResponse } from './redirects'

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const
type Level = keyof typeof LEVELS

interface RequestLog {
  method: string
  path: string
  status: number
  dur_ms: number
  rid: string
}

// Всё ниже действует только на on-demand маршрутах: prerendered-страницы отдаёт
// статик-хендлер адаптера раньше приложения (со своими `Cache-Control: public, max-age=0`
// и ETag), и middleware их не видит. Поэтому staging закрывается ещё и на Traefik
// (basicAuth + X-Robots-Tag). Путь без файла (в т.ч. любой из redirects.yaml) до
// приложения доходит — 404-страница on-demand.
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next()

  const startedAt = performance.now()
  const rid = context.request.headers.get('x-request-id') ?? crypto.randomUUID()
  const { ROBOTS_POLICY, LOG_LEVEL } = getRuntimeConfig()
  const log = (status: number) =>
    logRequest(LOG_LEVEL, {
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
    log(500)
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
  log(response.status)
  return response
})

function isHtml(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').startsWith('text/html')
}

// Одна JSON-строка на запрос, без PII: без IP (он в access-log Traefik), без cookie,
// без query-строки. Успешный /healthz (docker HEALTHCHECK каждые 30 с) — только на debug.
function logRequest(minLevel: Level, entry: RequestLog): void {
  const lvl: Level =
    entry.status >= 500
      ? 'error'
      : entry.status >= 400
        ? 'warn'
        : entry.path === '/healthz'
          ? 'debug'
          : 'info'
  if (LEVELS[lvl] < LEVELS[minLevel]) return
  const line = JSON.stringify({ ts: new Date().toISOString(), lvl, ...entry })
  if (lvl === 'error') console.error(line)
  else if (lvl === 'warn') console.warn(line)
  else console.info(line)
}
