import { z } from 'zod'

export const TodoSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
})

export type Todo = z.infer<typeof TodoSchema>

export const NewTodoSchema = z.object({
  title: z.string().trim().min(1, { message: 'Заголовок обязателен' }).max(200),
})

export type NewTodo = z.infer<typeof NewTodoSchema>
