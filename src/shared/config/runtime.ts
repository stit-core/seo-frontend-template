import { z } from 'zod'

// Значение `site` на сборке; entrypoint контейнера штампует его в реальный SITE_URL.
export const SITE_ORIGIN_PLACEHOLDER = 'https://__site_origin__'

// Ключ IndexNow (indexnow.org): 8–128 символов a-z, A-Z, 0-9 и дефис; подтверждается файлом /<ключ>.txt.
const INDEXNOW_KEY_RE = /^[a-zA-Z0-9-]{8,128}$/

const RuntimeConfigSchema = z.object({
  SITE_URL: z.url().transform((value) => value.replace(/\/+$/, '')),
  ROBOTS_POLICY: z.enum(['index', 'noindex']).default('index'),
  RELEASE: z.string().min(1).default('unknown'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  INDEXNOW_KEY: z
    .string()
    .regex(INDEXNOW_KEY_RE, '8–128 символов a-z, A-Z, 0-9 и дефис')
    .default(''),
  AI_TRAINING: z.enum(['allow', 'deny']).default('allow'),
  SENTRY_DSN: z.string().default(''),
  SENTRY_ENVIRONMENT: z.string().min(1).default('production'),
  // Доставка заявки: один канал. Адрес и учётные данные канала проверяются при отправке —
  // сайт без настроенной формы обязан подниматься и отдавать контент.
  FORM_DELIVERY: z.enum(['smtp', 'backend']).default('smtp'),
  FORM_BACKEND_URL: z.string().default(''),
  SMTP_URL: z.string().default(''),
  FORM_TO: z.string().default(''),
  FORM_FROM: z.string().default(''),
  // Шов капчи: реализаций провайдеров в шаблоне нет, ступени honeypot и origin-check от неё
  // не зависят. Провайдер добавляется вместе со значением enum (shared/antispam).
  CAPTCHA_PROVIDER: z.enum(['none']).default('none'),
  CAPTCHA_SECRET: z.string().default(''),
  CAPTCHA_FAIL_MODE: z.enum(['open', 'closed']).default('open'),
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
    INDEXNOW_KEY: unset(env.INDEXNOW_KEY),
    AI_TRAINING: unset(env.AI_TRAINING),
    SENTRY_DSN: unset(env.SENTRY_DSN),
    SENTRY_ENVIRONMENT: unset(env.SENTRY_ENVIRONMENT),
    FORM_DELIVERY: unset(env.FORM_DELIVERY),
    FORM_BACKEND_URL: unset(env.FORM_BACKEND_URL),
    SMTP_URL: unset(env.SMTP_URL),
    FORM_TO: unset(env.FORM_TO),
    FORM_FROM: unset(env.FORM_FROM),
    CAPTCHA_PROVIDER: unset(env.CAPTCHA_PROVIDER),
    CAPTCHA_SECRET: unset(env.CAPTCHA_SECRET),
    CAPTCHA_FAIL_MODE: unset(env.CAPTCHA_FAIL_MODE),
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
