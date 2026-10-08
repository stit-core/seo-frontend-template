// Обёртка над standalone-сервером @astrojs/node: адаптер не даёт ни graceful shutdown,
// ни keep-alive таймаутов. Без первого `make bump` рвёт запросы в полёте, без второго
// Traefik ловит спорадические 502 (Node закрывает idle keep-alive на 5-й секунде,
// прокси его переиспользует).
import { loadServerConfig } from '../dist/server/runtime-config.mjs'

// Fail-fast: env проверяется целиком до загрузки приложения — той же схемой, что его читает
// (shared/config). Иначе значение вне формата поднимает полуживой контейнер: статика 200, а
// каждый on-demand ответ, включая /healthz и robots.txt, — 500.
let config
try {
  config = loadServerConfig()
} catch (error) {
  console.error(`[server] ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

process.env.ASTRO_NODE_AUTOSTART = 'disabled'

const { startServer } = await import('../dist/server/entry.mjs')
// Таблица адресов — тот же модуль серверной сборки, что читает middleware приложения.
const { resolveRequest } = await import('../dist/server/redirects.mjs')
const { server, done } = startServer()
const http = server.server

// `done` отклоняется ошибкой слушателя (занятый порт): без обработчика это
// unhandled rejection со стеком вместо внятного сообщения.
done.catch((err) => {
  console.error('[server] listen failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})

// Один адрес — одна форма, и отвечает на неё обёртка — раньше статик-хендлера: тот отдаёт страницу
// и по `<путь>/index.html`, `//путь` и пути с точками (дубли с ответом 200), а хвостовой слеш
// срезает своим 301 — лишним хопом перед правилом redirects.yaml. Переезд по таблице и
// неканоническая форма — один 301 сразу на конечный адрес, путь со спрятанным разделителем
// (`%2F`) — 404. Остальное, включая удалённый адрес (410 — страница приложения), идёт адаптеру.
function answered(request, response) {
  const answer = resolveRequest(request.method, request.url ?? '')
  if (answer === undefined || answer.status === 410) return false
  if (answer.status === 404) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found')
  } else response.writeHead(answer.status, { location: answer.location }).end()
  return true
}

// Статик-хендлер адаптера при staticHeaders строит Request на каждый запрос вне try/catch, а его
// конструктор бросает на методе TRACE и на userinfo в Host: без перехвата один анонимный запрос —
// uncaught exception и выход процесса. Без строки лога, как у 400 парсера Node: причина — в самом
// запросе, а текст ошибки несёт его URL.
const [handle] = http.listeners('request')
http.off('request', handle)
http.on('request', (request, response) => {
  try {
    if (!answered(request, response)) handle(request, response)
  } catch {
    // Заголовки уже ушли — ответ не исправить, а writeHead бросил бы сам: соединение рвётся.
    if (response.headersSent) response.destroy()
    else response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Bad request')
  }
})

// Traefik/nginx держат idle-соединение дольше, чем дефолтные 5 с Node.
http.keepAliveTimeout = config.KEEP_ALIVE_TIMEOUT_MS
http.headersTimeout = config.KEEP_ALIVE_TIMEOUT_MS + 5_000

// Staging закрыт на каждом ответе процесса: prerendered и public/* статик-хендлер адаптера отдаёт
// раньше приложения, поэтому заголовок ставит обёртка. Ставит в writeHead, последним: заголовки
// маршрута (служебные файлы и 410 со своим noindex) адаптер передаёт туда же, и они перекрыли бы
// политику процесса.
if (config.ROBOTS_POLICY === 'noindex') {
  http.prependListener('request', (_request, response) => {
    const writeHead = response.writeHead
    response.writeHead = (...args) => {
      const headers = args.find((arg) => typeof arg === 'object' && arg !== null)
      for (const name of Object.keys(headers ?? {})) {
        if (name.toLowerCase() === 'x-robots-tag') delete headers[name]
      }
      response.setHeader('x-robots-tag', 'noindex, nofollow')
      return writeHead.apply(response, args)
    }
  })
}

const graceMs = config.SHUTDOWN_TIMEOUT_MS
let closing = false

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (closing) return
    closing = true
    console.info(`[server] ${signal}: drain up to ${graceMs} ms`)
    http.close(() => {
      console.info('[server] closed')
      process.exit(0)
    })
    // Без этого close() ждёт простаивающие keep-alive сокеты до таймаута;
    // повторяем, потому что сокет становится idle сразу после своего ответа.
    http.closeIdleConnections()
    setInterval(() => http.closeIdleConnections(), 200).unref()
    setTimeout(() => {
      console.warn('[server] drain timeout, forcing exit')
      process.exit(1)
    }, graceMs).unref()
  })
}
