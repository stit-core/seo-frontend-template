import { z } from 'zod'
import type { DictKey } from '@/shared/i18n'

export const CONTACT_FIELDS = ['name', 'email', 'message', 'consent'] as const
export type ContactField = (typeof CONTACT_FIELDS)[number]

// Скрытое поле-ловушка: бот заполняет всё подряд, человек его не видит. Имя выбрано
// правдоподобным — на «honeypot» боты смотрят.
export const HONEYPOT_FIELD = 'company'

// Локаль отправителя приезжает скрытым полем: ответ с ошибками рисуется на её языке.
export const LOCALE_FIELD = 'locale'

export const NAME_LENGTH = { min: 2, max: 80 } as const
export const MESSAGE_LENGTH = { min: 10, max: 2000 } as const

// Согласие на обработку ПДн — `literal(true)` и на сервере: иначе валидация обходится
// одним curl, а обработка идёт без согласия (152-ФЗ ст. 9 ч. 1).
export const ContactSchema = z.object({
  name: z.string().trim().min(NAME_LENGTH.min).max(NAME_LENGTH.max),
  email: z.email().max(254),
  message: z.string().trim().min(MESSAGE_LENGTH.min).max(MESSAGE_LENGTH.max),
  consent: z.literal(true),
})

export type Contact = z.infer<typeof ContactSchema>

// Значения формы как они пришли: отвечая ошибкой, страница возвращает их в поля —
// человек не перепечатывает письмо заново.
export interface ContactValues {
  name: string
  email: string
  message: string
  consent: boolean
}

export type ContactErrors = Partial<Record<ContactField, DictKey>>

export const EMPTY_CONTACT_VALUES: ContactValues = {
  name: '',
  email: '',
  message: '',
  consent: false,
}

// Одно сообщение на поле — требование, а не код ошибки: читателю нужно знать, что исправить.
const ERROR_KEY: Record<ContactField, DictKey> = {
  name: 'form.error.name',
  email: 'form.error.email',
  message: 'form.error.message',
  consent: 'form.error.consent',
}

const text = (form: FormData, field: string): string => {
  const value = form.get(field)
  return typeof value === 'string' ? value.trim() : ''
}

export function toContactValues(form: FormData): ContactValues {
  return {
    name: text(form, 'name'),
    email: text(form, 'email'),
    message: text(form, 'message'),
    // Браузер шлёт значение чекбокса, только если он отмечен; пустая строка из рукописного
    // запроса согласием не считается.
    consent: text(form, 'consent') !== '',
  }
}

export type ContactValidation = { ok: true; data: Contact } | { ok: false; errors: ContactErrors }

export function validateContact(values: ContactValues): ContactValidation {
  const result = ContactSchema.safeParse(values)
  if (result.success) return { ok: true, data: result.data }
  const errors: ContactErrors = {}
  for (const issue of result.error.issues) {
    const field = CONTACT_FIELDS.find((candidate) => candidate === issue.path[0])
    if (field) errors[field] = ERROR_KEY[field]
  }
  return { ok: false, errors }
}
