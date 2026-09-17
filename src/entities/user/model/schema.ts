import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.iso.datetime(),
})

export type User = z.infer<typeof UserSchema>
