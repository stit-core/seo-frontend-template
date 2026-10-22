import { getRuntimeConfig } from '@/shared/config'

// Ступени антиспам-лестницы формы без JavaScript: origin-check → размер и форма тела → ловушка. Порядок и почему
// каждая ступень такая — rule forms-antispam.

// Заявка — несколько коротких полей: тело с заявленной длиной больше лимита не читается вовсе — разбор формы
// буферизует его в heap процесса.
const MAX_BODY_BYTES = 64 * 1024

const FORM_CONTENT_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data']

// Origin заявки — `Origin`, без него `Referer`: свой — origin runtime SITE_URL или самого запроса (прямое обращение к
// контейнеру); заголовка нет — чужой: браузер шлёт Origin на POST формы всегда.
export function isTrustedOrigin(request: Request): boolean {
  const header = request.headers.get('origin') ?? request.headers.get('referer')
  if (header === null || header === '') return false
  try {
    const allowed = [new URL(getRuntimeConfig().SITE_URL).origin, new URL(request.url).origin]
    return allowed.includes(new URL(header).origin)
  } catch {
    return false
  }
}

// Тело без Content-Length (chunked) ступень не меряет: его держат лимит адаптера и буферизация прокси.
export function isTooLarge(request: Request): boolean {
  const length = Number(request.headers.get('content-length'))
  return Number.isFinite(length) && length > MAX_BODY_BYTES
}

// Не форма или тело не разбирается — `undefined`, а не исключение: иначе бот одним curl'ом устраивает поток 500-х с
// событиями в Sentry.
export async function readForm(request: Request): Promise<FormData | undefined> {
  const type = (request.headers.get('content-type') ?? '').toLowerCase()
  if (!FORM_CONTENT_TYPES.some((allowed) => type.startsWith(allowed))) return undefined
  try {
    return await request.formData()
  } catch {
    return undefined
  }
}

// Ловушка — скрытое поле: человек его не видит и не заполняет.
export function isTrapped(form: FormData, field: string): boolean {
  const value = form.get(field)
  return typeof value === 'string' && value !== ''
}
