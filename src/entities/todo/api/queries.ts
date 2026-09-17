import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/shared/api'
import { type NewTodo, type Todo, TodoSchema } from '../model/schema'

export const todosQueryKey = ['todos'] as const

export const todosQueryOptions = queryOptions({
  queryKey: todosQueryKey,
  queryFn: async (): Promise<Todo[]> => z.array(TodoSchema).parse(await apiClient.get('/v1/todos')),
})

export function useCreateTodoMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewTodo): Promise<Todo> =>
      TodoSchema.parse(await apiClient.post('/v1/todos', { body: input })),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: todosQueryKey })
      const previous = qc.getQueryData<Todo[]>(todosQueryKey) ?? []
      const optimistic: Todo = {
        id: `optimistic-${Date.now()}`,
        title: input.title,
        done: false,
        createdAt: new Date().toISOString(),
      }
      qc.setQueryData<Todo[]>(todosQueryKey, [optimistic, ...previous])
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(todosQueryKey, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todosQueryKey }),
  })
}

export function useToggleTodoMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      TodoSchema.parse(await apiClient.patch(`/v1/todos/${id}`, { body: { done } })),
    onSettled: () => qc.invalidateQueries({ queryKey: todosQueryKey }),
  })
}

export function useDeleteTodoMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/todos/${id}`)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todosQueryKey }),
  })
}
