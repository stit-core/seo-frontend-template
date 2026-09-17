// Обёртка над standalone-сервером @astrojs/node: адаптер не ставит ни
// graceful shutdown, ни keep-alive таймауты. Без первого `make bump` рвёт
// запросы в полёте, без второго Traefik ловит спорадические 502
// (Node закрывает keep-alive соединение на 5-й секунде, прокси его переиспользует).
process.env.ASTRO_NODE_AUTOSTART = 'disabled'

const { startServer } = await import('../dist/server/entry.mjs')
const { server } = startServer()
const http = server.server

// Traefik/nginx держат idle-соединение дольше, чем дефолтные 5 с Node.
http.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS ?? 65_000)
http.headersTimeout = http.keepAliveTimeout + 5_000

let closing = false
const graceMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 15_000)

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
    const sweep = setInterval(() => http.closeIdleConnections(), 200)
    sweep.unref()
    setTimeout(() => {
      console.warn('[server] drain timeout, forcing exit')
      process.exit(1)
    }, graceMs).unref()
  })
}
