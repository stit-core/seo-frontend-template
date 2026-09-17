import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.email({ message: 'Введи корректный email' }),
  password: z.string().min(6, { message: 'Минимум 6 символов' }),
})

export type LoginInput = z.infer<typeof LoginSchema>
