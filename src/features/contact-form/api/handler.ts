import { isTooLarge, isTrapped, isTrustedOrigin, readForm } from '@/shared/antispam'
import { PRIVACY_POLICY_VERSION } from '@/shared/config'
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
import { deliverLead } from './delivery'

export type ContactOutcome =
  | { status: 'accepted'; locale: Locale }
  | {
      status: 'invalid'
      locale: Locale
      values: ContactValues
      errors: ContactErrors
    }
  | { status: 'failed'; locale: Locale; values: ContactValues; notice: DictKey }
  | { status: 'forbidden' }
  | { status: 'bad-request' }
  | { status: 'too-large' }

export interface ContactContext {
  // X-Request-Id ответа: по нему событие формы сходится со строкой лога запроса.
  rid: string
}

// Тело заявки — персональные данные: в лог уходит только факт, канал и число попыток.
const logContact = (level: LogLevel, fields: LogFields): void =>
  log(level, { evt: 'contact', ...fields })

const readLocale = (form: FormData): Locale => {
  const value = form.get(LOCALE_FIELD)
  return SUPPORTED_LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE
}

// Антиспам-лестница (rule forms-antispam): origin-check → размер и форма тела → ловушка → валидация, согласие
// включительно, → доставка.
export async function handleContactRequest(
  request: Request,
  context: ContactContext,
): Promise<ContactOutcome> {
  if (!isTrustedOrigin(request)) {
    logContact('warn', { result: 'forbidden', rid: context.rid })
    return { status: 'forbidden' }
  }

  if (isTooLarge(request)) {
    logContact('warn', { result: 'too-large', rid: context.rid })
    return { status: 'too-large' }
  }

  const form = await readForm(request)
  if (form === undefined) {
    logContact('warn', { result: 'bad-request', rid: context.rid })
    return { status: 'bad-request' }
  }

  const locale = readLocale(form)
  const values = toContactValues(form)

  // Бот получает тот же ответ, что и человек: по ответу ловушку не различить.
  if (isTrapped(form, HONEYPOT_FIELD)) {
    logContact('info', { result: 'honeypot', rid: context.rid })
    return { status: 'accepted', locale }
  }

  const validation = validateContact(values)
  if (!validation.ok) {
    logContact('info', {
      result: 'invalid',
      rid: context.rid,
      fields: Object.keys(validation.errors).join(','),
    })
    return { status: 'invalid', locale, values, errors: validation.errors }
  }

  try {
    const { channel, attempts } = await deliverLead({
      ...validation.data,
      consentVersion: PRIVACY_POLICY_VERSION,
      consentedAt: new Date().toISOString(),
    })
    logContact('info', { result: 'accepted', rid: context.rid, channel, attempts })
    return { status: 'accepted', locale }
  } catch (error) {
    logContact('error', {
      result: 'failed',
      rid: context.rid,
      reason: error instanceof Error ? error.message : 'unknown',
    })
    await captureServerError(error, { rid: context.rid, path: new URL(request.url).pathname })
    return { status: 'failed', locale, values, notice: 'form.error.delivery' }
  }
}
