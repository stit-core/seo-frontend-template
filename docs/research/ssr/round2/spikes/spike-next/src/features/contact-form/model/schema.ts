import { z } from 'zod'

export const MIN_FILL_MS = 2000

export const ContactFormSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.email(),
  message: z.string().min(10).max(2000),
})

export interface ContactState {
  status: 'idle' | 'ok' | 'error'
  message?: string
}
