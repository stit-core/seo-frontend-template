import { isTooLarge, isTrapped, isTrustedOrigin, readForm } from '@/shared/antispam'
import { getRuntimeConfig } from '@/shared/config'
import type { Locale } from '@/shared/i18n'
import { captureServerError, type LogFields, type LogLevel, log } from '@/shared/observability'
import type { LeadForm, Policy } from '@/shared/strategy'
import {
  type Faults,
  FORM_ID_FIELD,
  faultsOf,
  PAGE_URL_FIELD,
  type Submission,
  submissionOf,
} from '../model/schema'
import { deliverLead } from './delivery'

// Форма, которой пришла заявка: форма плана на версии своей страницы и политика, на которую ссылается её согласие.
export interface FormEntry {
  form: LeadForm
  policy: Policy
  locale: Locale
}

export interface LeadContext {
  // X-Request-Id ответа: по нему событие формы сходится со строкой лога запроса.
  rid: string
  // Форма по скрытым полям заявки: `form_id` и `page_url` — форма плана на версии её страницы, иначе её нет.
  formOf: (formId: string, pageUrl: string) => FormEntry | undefined
}

export type LeadOutcome =
  | { status: 'accepted'; entry: FormEntry }
  | { status: 'invalid'; entry: FormEntry; submission: Submission; faults: Faults }
  | { status: 'failed'; entry: FormEntry; submission: Submission }
  | { status: 'forbidden' }
  | { status: 'bad-request' }
  | { status: 'too-large' }

// Тело заявки — персональные данные: в лог уходит только факт, канал и число попыток.
const logLead = (level: LogLevel, fields: LogFields): void =>
  log(level, { evt: 'contact', ...fields })

const field = (data: FormData, name: string): string => {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

// Метки рекламы — скрытые поля, которые без JS ставит сервер (`hidden_fields_without_js.server` каталога): из query
// Referer — страницы с формой того же сайта (Referrer-Policy сайта отдаёт своим запросам полный адрес).
function trackingOf(request: Request, names: readonly string[]): Record<string, string> {
  const referer = request.headers.get('referer')
  if (referer === null) return {}
  try {
    const query = new URL(referer).searchParams
    return Object.fromEntries(
      names.flatMap((name) => {
        const value = query.get(name)?.trim().slice(0, 200)
        return value ? [[name, value]] : []
      }),
    )
  } catch {
    return {}
  }
}

// Антиспам-лестница (rule forms-antispam): origin-check → размер и форма тела → ловушка → правила набора, согласие
// включительно, → доставка с записью согласия.
export async function handleLeadRequest(
  request: Request,
  context: LeadContext,
): Promise<LeadOutcome> {
  if (!isTrustedOrigin(request)) {
    logLead('warn', { result: 'forbidden', rid: context.rid })
    return { status: 'forbidden' }
  }

  if (isTooLarge(request)) {
    logLead('warn', { result: 'too-large', rid: context.rid })
    return { status: 'too-large' }
  }

  const data = await readForm(request)
  const entry = data && context.formOf(field(data, FORM_ID_FIELD), field(data, PAGE_URL_FIELD))
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
