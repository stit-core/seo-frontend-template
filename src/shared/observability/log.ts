import { getRuntimeConfig, type RuntimeEnv } from '@/shared/config'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFields = Record<string, string | number>

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

// Единственный вывод в лог процесса: одна JSON-строка на событие, без PII — без IP (он в
// access-log прокси), без cookie, query и тел запросов. Порог — `LOG_LEVEL` контейнера,
// поэтому debug-события не стоят проду ничего.
export function log(level: LogLevel, fields: LogFields, env?: RuntimeEnv): void {
  if (LEVELS[level] < LEVELS[getRuntimeConfig(env).LOG_LEVEL]) return
  const line = JSON.stringify({ ts: new Date().toISOString(), lvl: level, ...fields })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}
