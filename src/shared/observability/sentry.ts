import type * as Sentry from '@sentry/node'
import { getRuntimeConfig } from '@/shared/config'

type SentryModule = typeof Sentry

export interface ErrorContext {
  // X-Request-Id ответа: по нему исключение сходится со строкой JSON-лога.
  rid: string
  path: string
}

// Клиент — состояние модуля по необходимости: init() ставит процессные хуки и должен
// случиться один раз. Пакет грузится динамически и только при заданном SENTRY_DSN, поэтому
// сайт без Sentry не платит за него ни временем старта, ни памятью.
let client: Promise<SentryModule | undefined> | undefined

async function loadSentry(): Promise<SentryModule | undefined> {
  const { SENTRY_DSN, SENTRY_ENVIRONMENT, RELEASE } = getRuntimeConfig()
  if (!SENTRY_DSN) return undefined
  const sentry = await import('@sentry/node')
  sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: RELEASE,
    // Только доставка исключений: авто-инструментирование и трассировка требуют init до
    // импорта приложения (то есть правки обёртки процесса) и контентному сайту не нужны.
    tracesSampleRate: 0,
    defaultIntegrations: false,
  })
  return sentry
}

// Тело запроса и заявки сюда не попадает — только статус, путь и rid.
export async function captureServerError(error: unknown, context: ErrorContext): Promise<void> {
  try {
    client ??= loadSentry()
    const sentry = await client
    sentry?.captureException(error, { tags: { rid: context.rid, path: context.path } })
  } catch {
    // Наблюдаемость не имеет права ронять ответ: сбой отправки остаётся внутри.
  }
}
