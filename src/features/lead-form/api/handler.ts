import { isTooLarge, isTrapped, isTrustedOrigin, readForm } from '@/shared/antispam'
import { getRuntimeConfig } from '@/shared/config'
import { type Locale, localeOf } from '@/shared/i18n'
import { captureServerError, type LogFields, type LogLevel, log } from '@/shared/observability'
import { t } from '../lib/text'
import {
  type Faults,
  FORM_ID_FIELD,
  faultsOf,
  PAGE_URL_FIELD,
  type Submission,
  submissionOf,
} from '../model/schema'
import { deliverLead } from './delivery'
import type { FormEntry } from './forms'

export interface LeadContext<P> {
  // X-Request-Id ответа: по нему событие формы сходится со строкой лога запроса.
  rid: string
  // Белый список — формы плана на версиях своих страниц (`formsOf`): `form_id` и `page_url` заявки называют одну из них.
  forms: readonly FormEntry<P>[]
}

// Отказ до разбора заявки — статус и строка словаря `refusal.<отказ>`.
const REFUSALS = { forbidden: 403, 'bad-request': 400, 'too-large': 413 } as const
export type Refusal = keyof typeof REFUSALS

export type LeadOutcome<P> =
  | { status: 'accepted'; entry: FormEntry<P> }
  | { status: 'invalid'; entry: FormEntry<P>; submission: Submission; faults: Faults }
  | { status: 'failed'; entry: FormEntry<P>; submission: Submission }
  | { status: Refusal }

// Тело заявки — персональные данные: в лог уходит только факт, канал и число попыток.
const logLead = (level: LogLevel, fields: LogFields): void =>
  log(level, { evt: 'contact', ...fields })

const field = (data: FormData, name: string): string => {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

// Referer — страница с формой того же сайта: Referrer-Policy сайта отдаёт своим запросам полный адрес.
const refererOf = (request: Request): URL | null => {
  const referer = request.headers.get('referer')
  return referer === null ? null : URL.parse(referer)
}

// Метки рекламы — скрытые поля, которые без JS ставит сервер (`hidden_fields_without_js.server` каталога), из query
// Referer.
function trackingOf(request: Request, names: readonly string[]): Record<string, string> {
  const query = refererOf(request)?.searchParams
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = query?.get(name)?.trim().slice(0, 200)
      return value ? [[name, value]] : []
    }),
  )
}

// Язык ответа без разобранной формы (отказ, GET) — префикс пути Referer, без него — основной: поля локали в
// непрочитанном теле нет.
export const refererLocale = (request: Request): Locale =>
  localeOf(refererOf(request)?.pathname ?? '/')

// Отказ до разбора заявки — короткий текст, а не страница: возвращать в форму нечего; вне кеша и индекса.
export const refusalOf = (refusal: Refusal, locale: Locale): Response =>
  new Response(t(locale, `refusal.${refusal}`), {
    status: REFUSALS[refusal],
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex',
    },
  })

// Антиспам-лестница (rule forms-antispam): origin-check → размер и форма тела → ловушка → правила набора, согласие
// включительно, → доставка с записью согласия.
export async function handleLeadRequest<P>(
  request: Request,
  context: LeadContext<P>,
): Promise<LeadOutcome<P>> {
  if (!isTrustedOrigin(request)) {
    logLead('warn', { result: 'forbidden', rid: context.rid })
    return { status: 'forbidden' }
  }

  if (isTooLarge(request)) {
    logLead('warn', { result: 'too-large', rid: context.rid })
    return { status: 'too-large' }
  }

  const data = await readForm(request)
  const entry =
    data &&
    context.forms.find(
      ({ form }) =>
        form.id === field(data, FORM_ID_FIELD) && form.page === field(data, PAGE_URL_FIELD),
    )
  if (data === undefined || entry === undefined) {
    logLead('warn', { result: 'bad-request', rid: context.rid })
    return { status: 'bad-request' }
  }

  // Бот получает тот же ответ, что и человек: по ответу ловушку не различить.
  if (isTrapped(data, entry.form.honeypot)) {
    logLead('info', { result: 'honeypot', rid: context.rid })
    return { status: 'accepted', entry }
  }

  const submission = submissionOf(entry.form, data)
  const faults = faultsOf(entry.form, submission)
  if (Object.keys(faults).length > 0) {
    logLead('info', { result: 'invalid', rid: context.rid, fields: Object.keys(faults).join(',') })
    return { status: 'invalid', entry, submission, faults }
  }

  try {
    const { form, policy } = entry
    const { channel, attempts } = await deliverLead({
      fields: Object.fromEntries(
        Object.entries(submission.values).filter(([, value]) => value !== ''),
      ),
      hidden: trackingOf(request, form.server),
      consent: {
        consent_version: policy.revision,
        consent_at: new Date().toISOString(),
        page_url: new URL(form.page, getRuntimeConfig().SITE_URL).href,
        form_id: form.id,
        marketing_consent: form.marketingConsent,
      },
    })
    logLead('info', { result: 'accepted', rid: context.rid, channel, attempts })
    return { status: 'accepted', entry }
  } catch (error) {
    logLead('error', {
      result: 'failed',
      rid: context.rid,
      reason: error instanceof Error ? error.message : 'unknown',
    })
    await captureServerError(error, { rid: context.rid, path: new URL(request.url).pathname })
    return { status: 'failed', entry, submission }
  }
}
