import { getRuntimeConfig, type RuntimeConfig, SITE_NAME } from '@/shared/config'
import { DEFAULT_LOCALE } from '@/shared/i18n'
import { FORM_DICTS } from '../config/dict'
import { t } from '../lib/text'

// Запись согласия (`defaults.consent.record` каталога) — доказательство на стороне канала (152-ФЗ ст. 9 ч. 3): редакция
// политики, момент согласия, страница и форма, согласие на рекламу.
export interface ConsentRecord {
  consent_version: string
  consent_at: string
  page_url: string
  form_id: string
  marketing_consent: boolean
}

// Заявка: ответы набора по id поля каталога (пустые — без ключа), скрытые поля без JS (`hidden_fields_without_js`
// каталога: метки рекламы, которые сервер взял из Referer) и запись согласия.
export interface Lead {
  fields: Readonly<Record<string, string>>
  hidden: Readonly<Record<string, string>>
  consent: ConsentRecord
}

export interface DeliveryResult {
  channel: RuntimeConfig['FORM_DELIVERY']
  attempts: number
}

// Один канал с ретраями: отправитель ждёт ответа формы, поэтому попыток мало и они короткие.
// Durable-спул на диске и второй канал — решение проекта, не шаблона.
const RETRY_DELAYS_MS = [500, 2000] as const
const TIMEOUT_MS = 5000

type Target =
  | { channel: 'backend'; url: string }
  | { channel: 'smtp'; url: string; to: string; from: string }

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

// Письмо оператору — на основном языке сайта: подписи полей и вариантов — словарь формы, метки рекламы — по именам каталога.
const word = (key: string, fallback: string): string =>
  (FORM_DICTS[DEFAULT_LOCALE] as Readonly<Record<string, string>>)[key] ?? fallback

const leadText = ({ fields, hidden, consent }: Lead): string =>
  [
    ...Object.entries(fields).map(([field, value]) =>
      t(DEFAULT_LOCALE, 'mail.field', {
        label: word(`label.${field}`, field),
        value: word(`option.${field}.${value}`, value),
      }),
    ),
    '',
    ...Object.entries({ ...hidden, page_url: consent.page_url, form_id: consent.form_id }).map(
      ([name, value]) => t(DEFAULT_LOCALE, 'mail.field', { label: name, value }),
    ),
    t(DEFAULT_LOCALE, 'mail.consent', { version: consent.consent_version, at: consent.consent_at }),
  ].join('\n')

// Пустой адрес канала — не повод падать при старте (сайт без настроенной формы обязан
// подниматься и отдавать контент), но и не повод молча терять заявку: отказ виден
// отправителю и в логе, и повторять его бессмысленно — это не сетевой сбой.
function requireValue(value: string, key: string): string {
  if (value === '') throw new Error(`form: ${key} не задан — канал доставки не настроен`)
  return value
}

function resolveTarget(config: RuntimeConfig): Target {
  if (config.FORM_DELIVERY === 'smtp') {
    return {
      channel: 'smtp',
      url: requireValue(config.SMTP_URL, 'SMTP_URL'),
      to: requireValue(config.FORM_TO, 'FORM_TO'),
      from: requireValue(config.FORM_FROM, 'FORM_FROM'),
    }
  }
  return { channel: 'backend', url: requireValue(config.FORM_BACKEND_URL, 'FORM_BACKEND_URL') }
}

async function sendViaBackend(lead: Lead, target: Extract<Target, { channel: 'backend' }>) {
  const response = await fetch(target.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(lead),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`form: бэкенд ответил ${response.status}`)
}

async function sendViaSmtp(lead: Lead, target: Extract<Target, { channel: 'smtp' }>) {
  // nodemailer грузится только на этом канале и только в момент отправки: сайту с
  // FORM_DELIVERY=backend он не стоит ни байта памяти.
  const { createTransport } = await import('nodemailer')
  // Транспорт на отправку, а не на процесс: модульное состояние в on-demand коде живёт до
  // рестарта и не видно второй реплике, а заявок здесь единицы в сутки.
  const transport = createTransport({
    url: target.url,
    // Дефолты nodemailer — минуты: отправитель столько ждать не должен.
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  })
  try {
    await transport.sendMail({
      from: target.from,
      to: target.to,
      ...(lead.fields.email === undefined ? {} : { replyTo: lead.fields.email }),
      subject: t(DEFAULT_LOCALE, 'mail.subject', { site: SITE_NAME, form: lead.consent.form_id }),
      text: leadText(lead),
    })
  } finally {
    transport.close()
  }
}

const send = (lead: Lead, target: Target): Promise<void> =>
  target.channel === 'smtp' ? sendViaSmtp(lead, target) : sendViaBackend(lead, target)

// Бросает, если ни одна попытка не прошла: ответ формы об этом честно говорит.
export async function deliverLead(lead: Lead): Promise<DeliveryResult> {
  const target = resolveTarget(getRuntimeConfig())

  let lastError: unknown
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      await send(lead, target)
      return { channel: target.channel, attempts: attempt }
    } catch (error) {
      lastError = error
      const delay = RETRY_DELAYS_MS[attempt - 1]
      if (delay !== undefined) await sleep(delay)
    }
  }
  throw lastError
}
