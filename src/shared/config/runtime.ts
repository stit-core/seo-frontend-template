import { z } from 'zod'

// Значение `site` на сборке; entrypoint контейнера штампует его в реальный SITE_URL.
export const SITE_ORIGIN_PLACEHOLDER = 'https://__site_origin__'

// Origin уходит дословно в canonical, карту сайта и штамповку prerendered-выхода, поэтому —
// ровно схема http(s), хост в нижнем регистре (IDN — punycode) и порт: ни пути, ни query, ни
// userinfo, ни пробелов и спецсимволов. Одно правило для старта сервера и для штамповки.
const ORIGIN_RE = /^https?:\/\/[a-z\d]([a-z\d.-]*[a-z\d])?(:\d{1,5})?$/

// Ключ IndexNow (indexnow.org): 8–128 символов a-z, A-Z, 0-9 и дефис; подтверждается файлом /<ключ>.txt.
const INDEXNOW_KEY_RE = /^[a-zA-Z0-9-]{8,128}$/

// Таймаут обёртки сервера: NaN или 0 Node понял бы как «без таймаута».
const milliseconds = (fallback: number) => z.coerce.number().int().positive().default(fallback)

const RuntimeConfigSchema = z.object({
  // Плейсхолдер — значение сборки; процесс, который отдаёт сайт, его не принимает (loadServerConfig).
  SITE_URL: z
    .string()
    .transform((value) => value.replace(/\/+$/, ''))
    .refine(
      (value) => value === SITE_ORIGIN_PLACEHOLDER || ORIGIN_RE.test(value),
      'expected an origin like https://example.com: http(s), lowercase host, optional port; no path, query or credentials',
    )
    .default(SITE_ORIGIN_PLACEHOLDER),
  ROBOTS_POLICY: z.enum(['index', 'noindex']).default('index'),
  RELEASE: z.string().min(1).default('unknown'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  INDEXNOW_KEY: z
    .string()
    .regex(INDEXNOW_KEY_RE, '8-128 characters a-z, A-Z, 0-9 and hyphen')
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
  // Обёртка сервера (docker/server.mjs): keep-alive дольше idle-таймаута прокси, дренаж на SIGTERM.
  KEEP_ALIVE_TIMEOUT_MS: milliseconds(65_000),
  SHUTDOWN_TIMEOUT_MS: milliseconds(15_000),
})

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>
export type RuntimeEnv = Partial<Record<keyof RuntimeConfig, string | undefined>>

const KEYS = Object.keys(RuntimeConfigSchema.shape) as (keyof RuntimeConfig)[]

// Пустая строка в env (`SITE_URL=` в compose/.env) — то же, что отсутствие ключа:
// иначе она проходит в Zod и валит enum/url вместо дефолта.
const unset = (value: string | undefined): string | undefined => (value === '' ? undefined : value)

// Разбор — один на набор значений env: процесс сервера проверяет env при старте
// (`loadServerConfig`), запросы читают готовый объект и Zod не гоняют.
let parsed: { input: string; config: RuntimeConfig } | undefined

// На on-demand маршрутах process.env живой (Node-процесс контейнера); при prerender
// сюда попадает значение сборки — плейсхолдер origin.
export function getRuntimeConfig(env: RuntimeEnv = process.env): RuntimeConfig {
  const values = Object.fromEntries(KEYS.map((key) => [key, unset(env[key])]))
  const input = JSON.stringify(values)
  if (parsed?.input !== input) parsed = { input, config: parse(values) }
  return parsed.config
}

function parse(values: Record<string, string | undefined>): RuntimeConfig {
  const result = RuntimeConfigSchema.safeParse(values)
  if (result.success) return result.data
  // Только ключ и правило: значение в сообщение не попадает — среди ключей есть секреты.
  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
  throw new Error(`invalid env — ${problems.join('; ')}`)
}

// Процесс, который отдаёт сайт (docker/*), проверяет env целиком до старта; без настоящего
// origin — пустого или плейсхолдера сборки — он не поднимается: prerendered-выход остался бы со
// значением сборки.
export function loadServerConfig(env: RuntimeEnv = process.env): RuntimeConfig {
  const config = getRuntimeConfig(env)
  if (config.SITE_URL === SITE_ORIGIN_PLACEHOLDER) {
    throw new Error('invalid env — SITE_URL: required, must not be the build placeholder')
  }
  return config
}
