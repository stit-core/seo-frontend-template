/** Honeypot: реальные люди не заполняют скрытое поле. */
export const HONEYPOT_FIELD = 'company'

/** Time-trap: форма, отправленная быстрее — бот. */
export const MIN_FILL_MS = 3_000
export const MAX_FORM_AGE_MS = 60 * 60 * 1000
