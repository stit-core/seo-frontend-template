import { z } from 'zod'

export const SessionSchema = z.object({
  userId: z.string(),
  email: z.email(),
  createdAt: z.iso.datetime(),
})

export type Session = z.infer<typeof SessionSchema>
