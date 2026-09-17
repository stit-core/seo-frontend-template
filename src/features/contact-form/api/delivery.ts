import { getRuntimeConfig, type RuntimeConfig, type RuntimeEnv, SITE_NAME } from '@/shared/config'
import type { Contact } from '../model/schema'

export interface Lead extends Contact {
  // Доказательство согласия хранится вместе с заявкой: версия текста политики и момент
  // согласия (152-ФЗ ст. 9 ч. 1).
  consentVersion: string
  consentedAt: string
}

export interface DeliveryResult {
  channel: RuntimeConfig['FORM_DELIVERY']
  attempts: number
}

export interface DeliveryOptions {
  env?: RuntimeEnv
  retryDelaysMs?: readonly number[]
}

// Один канал с ретраями: отправитель ждёт ответа формы, поэтому попыток мало и они короткие.
// Durable-спул на диске и второй канал — решение проекта, не шаблона.
const RETRY_DELAYS_MS = [500, 2000] as const
const TIMEOUT_MS = 5000

type Target =
  | { channel: 'backend'; url: string }
  | { channel: 'smtp'; url: string; to: string; from: string }

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

const leadText = (lead: Lead): string =>
  [
    `Имя: ${lead.name}`,
    `Почта: ${lead.email}`,
    '',
    lead.message,
    '',
    `Согласие на обработку ПДн: версия ${lead.consentVersion}, ${lead.consentedAt}`,
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
      replyTo: lead.email,
      subject: `Заявка с сайта ${SITE_NAME}: ${lead.name}`,
      text: leadText(lead),
    })
  } finally {
    transport.close()
  }
}

const send = (lead: Lead, target: Target): Promise<void> =>
  target.channel === 'smtp' ? sendViaSmtp(lead, target) : sendViaBackend(lead, target)

// Бросает, если ни одна попытка не прошла: ответ формы об этом честно говорит.
export async function deliverLead(
  lead: Lead,
  options: DeliveryOptions = {},
): Promise<DeliveryResult> {
  const target = resolveTarget(getRuntimeConfig(options.env))
  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS

  let lastError: unknown
  for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
    try {
      await send(lead, target)
      return { channel: target.channel, attempts: attempt }
    } catch (error) {
      lastError = error
      const delay = delays[attempt - 1]
      if (delay !== undefined) await sleep(delay)
    }
  }
  throw lastError
}
