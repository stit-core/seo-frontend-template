import { z } from 'zod'
import type { FormField, LeadForm } from '@/shared/strategy'

// Скрытые поля, которые без JS пишет сборка (hidden_fields_without_js.build каталога): id формы и адрес её страницы.
export const FORM_ID_FIELD = 'form_id'
export const PAGE_URL_FIELD = 'page_url'
export const CONSENT_FIELD = 'consent'

// Потолки длины по виду поля: заявка — несколько коротких ответов, а не документ.
export const MAX_LENGTH: Readonly<Record<FormField['type'], number>> = {
  text: 200,
  textarea: 2000,
  email: 254,
  tel: 32,
  radio: 200,
}

// Телефон — как его набирает человек: 8 или +7, пробелы, скобки и дефисы нормализует оператор; цифр — от 10 до 15
// (E.164).
const TEL = /^\+?[\d\s()-]+$/
const isPhone = (value: string) =>
  TEL.test(value) && value.replace(/\D/g, '').length >= 10 && value.replace(/\D/g, '').length <= 15

const Email = z.email()

// Согласие на обработку ПДн — `literal(true)` и на сервере: без галочки обработка шла бы без согласия (152-ФЗ ст. 9
// ч. 1), а валидация обходилась бы curl'ом.
const Consent = z.literal(true)

export type FieldFault = 'required' | 'long' | 'email' | 'tel' | 'option' | 'oneOf' | 'consent'

// Ответ человека как он пришёл: отвечая ошибкой, страница возвращает его в поля.
export interface Submission {
  values: Readonly<Record<string, string>>
  consent: boolean
}

export type Faults = Readonly<Record<string, FieldFault>>

// Ответ обработчика формы: id формы, которой он пришёл, присланное, отказы полей и сбой доставки; на самой странице его
// нет.
export interface FormAnswer {
  form: string
  submission: Submission
  faults: Faults
  failed: boolean
}

const text = (data: FormData, field: string): string => {
  const value = data.get(field)
  return typeof value === 'string' ? value.trim() : ''
}

export function submissionOf(form: LeadForm, data: FormData): Submission {
  return {
    values: Object.fromEntries(form.fields.map((field) => [field.id, text(data, field.id)])),
    // Браузер шлёт значение чекбокса, только если он отмечен; пустая строка из рукописного запроса согласием не
    // считается.
    consent: text(data, CONSENT_FIELD) !== '',
  }
}

function faultOf(field: FormField, value: string): FieldFault | undefined {
  if (value === '') return field.required ? 'required' : undefined
  if (value.length > MAX_LENGTH[field.type]) return 'long'
  if (field.type === 'email' && !Email.safeParse(value).success) return 'email'
  if (field.type === 'tel' && !isPhone(value)) return 'tel'
  if (field.type === 'radio' && !field.options.includes(value)) return 'option'
  return undefined
}

// Правила набора на сервере — те же, что у разметки: обязательные поля, вид и длина значения, вариант из списка,
// «хотя бы одно из» (`one_of_required`) и согласие. Отказ — поле и вид ошибки, а не текст: текст даёт словарь языка.
export function faultsOf(form: LeadForm, { values, consent }: Submission): Faults {
  const faults: Record<string, FieldFault> = {}
  for (const field of form.fields) {
    const fault = faultOf(field, values[field.id] ?? '')
    if (fault !== undefined) faults[field.id] = fault
  }
  if (form.oneOf.length > 0 && form.oneOf.every((field) => (values[field] ?? '') === '')) {
    for (const field of form.oneOf) faults[field] = 'oneOf'
  }
  if (!Consent.safeParse(consent).success) faults[CONSENT_FIELD] = 'consent'
  return faults
}
