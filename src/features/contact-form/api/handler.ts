import { getCaptchaVerifier } from '@/shared/antispam'
import { getRuntimeConfig, PRIVACY_POLICY_VERSION } from '@/shared/config'
import { DEFAULT_LOCALE, type DictKey, type Locale, SUPPORTED_LOCALES } from '@/shared/i18n'
import { captureServerError, type LogFields, type LogLevel, log } from '@/shared/observability'
import {
  type ContactErrors,
  type ContactValues,
  HONEYPOT_FIELD,
  LOCALE_FIELD,
  toContactValues,
  validateContact,
} from '../model/schema'
import { type DeliveryOptions, deliverLead } from './delivery'

export type ContactOutcome =
  | { status: 'accepted'; locale: Locale }
  | {
      status: 'invalid'
      locale: Locale
      values: ContactValues
      errors: ContactErrors
      notice?: DictKey
    }
  | { status: 'failed'; locale: Locale; values: ContactValues; notice: DictKey }
  | { status: 'forbidden' }
  | { status: 'bad-request' }
  | { status: 'too-large' }

export interface ContactContext extends DeliveryOptions {
  // X-Request-Id ответа: по нему событие формы сходится со строкой лога запроса.
  rid: string
}

// Четыре коротких поля с потолками схемы не дают и 3 КБ. Тело больше лимита не читается
// вовсе: formData() буферизует его в heap процесса, у которого свой потолок.
const MAX_BODY_BYTES = 64 * 1024

const FORM_CONTENT_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data']

// Тело заявки — персональные данные: в лог уходит только факт, канал и число попыток.
function logContact(level: LogLevel, fields: LogFields, env: DeliveryOptions['env']): void {
  log(level, { evt: 'contact', ...fields }, env)
}

// Проверка origin целиком наша: встроенный `security.checkOrigin` Astro выключен, потому что
// за TLS-терминирующим прокси адаптер строит URL запроса как `http://<Host>` и браузерный
// `https://…` ему никогда не равен. Канонический origin — runtime SITE_URL; origin запроса
// остаётся для прямого обращения к контейнеру. Заголовка нет вовсе — отказ: браузер всегда
// шлёт Origin на POST формы.
function isTrustedOrigin(request: Request, env: DeliveryOptions['env']): boolean {
  const header = request.headers.get('origin') ?? request.headers.get('referer')
  if (header === null || header === '') return false
  try {
    const allowed = [new URL(getRuntimeConfig(env).SITE_URL).origin, new URL(request.url).origin]
    return allowed.includes(new URL(header).origin)
  } catch {
    return false
  }
}

// Заявленная длина больше лимита — отказ до чтения тела. Запрос без Content-Length (chunked)
// упрётся в лимит адаптера, и разбор тела отвалится как битый.
function isTooLarge(request: Request): boolean {
  const length = Number(request.headers.get('content-length'))
  return Number.isFinite(length) && length > MAX_BODY_BYTES
}

// Не форма или неразбираемое тело — 400, а не исключение: иначе бот одним curl'ом устраивает
// поток 500-х с событиями в Sentry.
async function readForm(request: Request): Promise<FormData | undefined> {
  const type = (request.headers.get('content-type') ?? '').toLowerCase()
  if (!FORM_CONTENT_TYPES.some((allowed) => type.startsWith(allowed))) return undefined
  try {
    return await request.formData()
  } catch {
    return undefined
  }
}

const readLocale = (form: FormData): Locale => {
  const value = form.get(LOCALE_FIELD)
  return SUPPORTED_LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE
}

// Антиспам-лестница: origin-check → размер и форма тела → honeypot → валидация (согласие
// включительно) → шов капчи → доставка. Ступени дешевле и раньше — первыми; ни одна не
// требует JS.
export async function handleContactRequest(
  request: Request,
  context: ContactContext,
): Promise<ContactOutcome> {
  if (!isTrustedOrigin(request, context.env)) {
    logContact('warn', { result: 'forbidden', rid: context.rid }, context.env)
    return { status: 'forbidden' }
  }

  if (isTooLarge(request)) {
    logContact('warn', { result: 'too-large', rid: context.rid }, context.env)
    return { status: 'too-large' }
  }

  const form = await readForm(request)
  if (form === undefined) {
    logContact('warn', { result: 'bad-request', rid: context.rid }, context.env)
    return { status: 'bad-request' }
  }

  const locale = readLocale(form)
  const values = toContactValues(form)

  // Бот получает тот же ответ, что и человек: по ответу ловушку не различить.
  const honeypot = form.get(HONEYPOT_FIELD)
  if (typeof honeypot === 'string' && honeypot !== '') {
    logContact('info', { result: 'honeypot', rid: context.rid }, context.env)
    return { status: 'accepted', locale }
  }

  const validation = validateContact(values)
  if (!validation.ok) {
    logContact(
      'info',
      { result: 'invalid', rid: context.rid, fields: Object.keys(validation.errors).join(',') },
      context.env,
    )
    return { status: 'invalid', locale, values, errors: validation.errors }
  }

  // Провайдера капчи в шаблоне нет, поэтому и токена в форме нет: он появится полем формы
  // вместе с реализацией (shared/antispam).
  const captcha = getCaptchaVerifier(context.env)
  if (!(await captcha.verify(null))) {
    logContact(
      'info',
      { result: 'captcha', rid: context.rid, provider: captcha.provider },
      context.env,
    )
    return { status: 'invalid', locale, values, errors: {}, notice: 'form.error.captcha' }
  }

  try {
    const { channel, attempts } = await deliverLead(
      {
        ...validation.data,
        consentVersion: PRIVACY_POLICY_VERSION,
        consentedAt: new Date().toISOString(),
      },
      context,
    )
    logContact('info', { result: 'accepted', rid: context.rid, channel, attempts }, context.env)
    return { status: 'accepted', locale }
  } catch (error) {
    logContact(
      'error',
      {
        result: 'failed',
        rid: context.rid,
        reason: error instanceof Error ? error.message : 'unknown',
      },
      context.env,
    )
    await captureServerError(error, { rid: context.rid, path: new URL(request.url).pathname })
    return { status: 'failed', locale, values, notice: 'form.error.delivery' }
  }
}
