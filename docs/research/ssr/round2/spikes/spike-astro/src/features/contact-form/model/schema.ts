import { z } from 'zod'

// `company` — honeypot: боты заполняют, люди не видят.
// `ts` — time-trap: остров проставляет момент монтирования; без JS поля нет и ловушка пропускается.
export const ContactInputSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.email(),
  message: z.string().min(10).max(2000),
  company: z.string().optional(),
  ts: z.coerce.number().int().positive().optional(),
})

export type ContactInput = z.infer<typeof ContactInputSchema>

export interface ContactResult {
  ok: boolean
  id: string
  reason?: 'honeypot' | 'time-trap'
}

export const MIN_FILL_MS = 3_000

/** Единственная точка обработки заявки: и action, и endpoint зовут её. */
export function handleContact(input: ContactInput, now = Date.now()): ContactResult {
  if (input.company) return { ok: true, id: 'dropped', reason: 'honeypot' }
  if (input.ts !== undefined && now - input.ts < MIN_FILL_MS) {
    return { ok: true, id: 'dropped', reason: 'time-trap' }
  }
  return { ok: true, id: `msg_${input.email.length}${input.message.length}` }
}

/** FormData → объект; пустые строки выбрасываем, чтобы `optional()` отработал. */
export function formToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string' && value.length > 0) out[key] = value
  }
  return out
}
