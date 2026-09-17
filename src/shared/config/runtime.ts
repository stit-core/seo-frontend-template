import { z } from 'zod'

// Значение `site` на сборке; entrypoint контейнера штампует его в реальный SITE_URL.
export const SITE_ORIGIN_PLACEHOLDER = 'https://__site_origin__'

const RuntimeConfigSchema = z.object({
  SITE_URL: z.url().transform((value) => value.replace(/\/+$/, '')),
  ROBOTS_POLICY: z.enum(['index', 'noindex']).default('index'),
  RELEASE: z.string().min(1).default('unknown'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>
export type RuntimeEnv = Partial<Record<keyof RuntimeConfig, string | undefined>>

// Пустая строка в env (`SITE_URL=` в compose/.env) — то же, что отсутствие ключа:
// иначе она проходит в Zod и валит enum/url вместо дефолта.
const unset = (value: string | undefined): string | undefined => (value === '' ? undefined : value)

// На on-demand маршрутах process.env живой (Node-процесс контейнера); при prerender
// сюда попадает значение сборки — плейсхолдер origin. Отказ от плейсхолдера в рантайме —
// в docker/server.mjs (fail-fast при старте).
export function getRuntimeConfig(env: RuntimeEnv = process.env): RuntimeConfig {
  return RuntimeConfigSchema.parse({
    SITE_URL: unset(env.SITE_URL) ?? SITE_ORIGIN_PLACEHOLDER,
    ROBOTS_POLICY: unset(env.ROBOTS_POLICY),
    RELEASE: unset(env.RELEASE),
    LOG_LEVEL: unset(env.LOG_LEVEL),
  })
}

// Явный whitelist того, что может попасть в HTML; остальное из process.env
// в разметку не сериализуется.
export const PUBLIC_CONFIG_KEYS = ['SITE_URL', 'ROBOTS_POLICY'] as const
export type PublicConfig = Pick<RuntimeConfig, (typeof PUBLIC_CONFIG_KEYS)[number]>

export function getPublicConfig(env?: RuntimeEnv): PublicConfig {
  const { SITE_URL, ROBOTS_POLICY } = getRuntimeConfig(env)
  return { SITE_URL, ROBOTS_POLICY }
}
