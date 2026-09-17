import { z } from 'zod'

const RuntimeConfigSchema = z.object({
  SITE_URL: z.string().default('http://localhost:3100'),
  API_MODE: z.enum(['mock', 'real']).default('mock'),
  INDEXABLE: z.boolean().default(false),
  RELEASE: z.string().default('dev'),
})

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>

declare global {
  interface Window {
    __APP_CONFIG__?: unknown
  }
}

// SSR-вариант runtime config: на сервере источник — process.env (контейнер),
// на клиенте — сериализованный снимок в window.__APP_CONFIG__.
function readConfig(): RuntimeConfig {
  if (import.meta.env.SSR) {
    return RuntimeConfigSchema.parse({
      SITE_URL: process.env.SITE_URL,
      API_MODE: process.env.API_MODE,
      INDEXABLE: process.env.INDEXABLE === '1',
      RELEASE: process.env.RELEASE,
    })
  }
  const fromWindow: object =
    typeof window !== 'undefined' &&
    typeof window.__APP_CONFIG__ === 'object' &&
    window.__APP_CONFIG__ !== null
      ? window.__APP_CONFIG__
      : {}
  return RuntimeConfigSchema.parse(fromWindow)
}

export const runtimeConfig = readConfig()
