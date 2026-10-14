// Обёртка процесса — тоже рантайм образа: её пакеты ставит та же стадия prod-deps.
import { loadServerConfig } from '../dist/server/runtime-config.mjs'

const { default: pino } = await import('pino')
export const logger = pino(loadServerConfig())
