import { defineAction } from 'astro:actions'
import { z } from 'astro:schema'
import { handleContact } from '../model/schema'

// Astro Action оставлен как второй путь: он нужен только для JS-клиента
// (прогрессивный фолбэк требует on-demand страницы — см. отчёт).
export const contact = defineAction({
  accept: 'form',
  input: z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    message: z.string().min(10).max(2000),
    company: z.string().optional(),
    ts: z.coerce.number().int().positive().optional(),
  }),
  handler: (input) => handleContact(input),
})
