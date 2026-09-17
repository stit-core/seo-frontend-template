import { z } from 'zod'

// Схема собирается в функции, а не top-level const: иначе Rolldown не может
// доказать чистоту `z.object(...)` и тянет zod в клиентский бандл острова
// через public API слайса (замерено: +22 КБ gzip).
export function contactSchema() {
  return z.object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(160),
    message: z.string().trim().min(10).max(2000),
  })
}

export type ContactInput = z.infer<ReturnType<typeof contactSchema>>
