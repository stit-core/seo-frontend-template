// Обёртка над standalone-сервером @astrojs/node: адаптер не даёт ни graceful shutdown,
// ни keep-alive таймаутов. Без первого `make bump` рвёт запросы в полёте, без второго
// Traefik ловит спорадические 502 (Node закрывает idle keep-alive на 5-й секунде,
// прокси его переиспользует).
const PLACEHOLDER = 'https://__site_origin__'

// `new URL('localhost:3000')` парсится как схема `localhost:` — проверяем и протокол.
function isHttpUrl(value) {
  try {
    return /^https?:$/.test(new URL(value).protocol)
  } catch {
    return false
  }
}

// Пусто — дефолт; мусор — предупреждение и дефолт: NaN Node трактует как «без таймаута».
function positiveMs(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (Number.isFinite(value) && value > 0) return value
  console.warn(`[server] ${name}='${raw}' is not a positive number, using ${fallback}`)
  return fallback
}

const siteUrl = (process.env.SITE_URL ?? '').replace(/\/+$/, '')

// Fail-fast: без реального origin prerendered-выход остаётся со значением сборки —
// такой контейнер не должен подняться и попасть под трафик.
if (siteUrl === '' || siteUrl === PLACEHOLDER) {
  console.error('[server] SITE_URL is required and must not be the build placeholder')
  process.exit(1)
}
if (!isHttpUrl(siteUrl)) {
  console.error(`[server] SITE_URL must be an absolute http(s) URL, got '${siteUrl}'`)
  process.exit(1)
}

const keepAliveMs = positiveMs('KEEP_ALIVE_TIMEOUT_MS', 65_000)
const graceMs = positiveMs('SHUTDOWN_TIMEOUT_MS', 15_000)

process.env.ASTRO_NODE_AUTOSTART = 'disabled'

const { startServer } = await import('../dist/server/entry.mjs')
const { server, done } = startServer()
const http = server.server

// `done` отклоняется ошибкой слушателя (занятый порт): без обработчика это
// unhandled rejection со стеком вместо внятного сообщения.
done.catch((err) => {
  console.error('[server] listen failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})

// Traefik/nginx держат idle-соединение дольше, чем дефолтные 5 с Node.
http.keepAliveTimeout = keepAliveMs
http.headersTimeout = keepAliveMs + 5_000

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
