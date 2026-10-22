import { defineMiddleware } from 'astro:middleware'
import { localeOf } from '@/shared/i18n'
import { captureServerError, type LogLevel, log } from '@/shared/observability'
import { goneResponse } from './gone'
import { resolveRequest } from './redirects'

// Только on-demand маршруты: prerendered-страницы отдаёт статик-хендлер адаптера раньше приложения — заголовки
// staging у них ставит обёртка процесса (docker/server.mjs).
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next()

  const startedAt = performance.now()
  const rid = context.request.headers.get('x-request-id') ?? crypto.randomUUID()
  // Маршрут кладёт этот же rid в свои события (форма), и они сходятся со строкой запроса.
  context.locals.rid = rid
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
    // Адреса — данные (content/redirects.yaml) и канон пути, до роутинга. В образе переезд и
    // неканоническую форму обёртка процесса отдаёт той же таблицей раньше статик-хендлера, сюда
    // доходит удалённый адрес. В `astro dev` обёртки нет: middleware отвечает на адрес без
    // страницы, а путь prerendered-страницы (и правило с query на нём) вышел выше. Адрес — из
    // запроса, как его видела обёртка: `context.url` Astro нормализует по-своему (раскодирует путь),
    // и канон по нему разошёлся бы с её ответом — петлёй редиректов.
    const { pathname, search } = new URL(context.request.url)
    const answer = resolveRequest(context.request.method, pathname + search)
    if (answer?.status === 410) response = goneResponse(localeOf(pathname))
    else if (answer && 'location' in answer) {
      response = new Response(null, {
        status: answer.status,
        headers: { location: answer.location },
      })
    } else response = await next()
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
