import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Suspense } from 'react'
import { sessionQueryOptions } from '@/entities/session'
import {
  TodoItem,
  todosQueryOptions,
  useDeleteTodoMutation,
  useToggleTodoMutation,
} from '@/entities/todo'
import { CreateTodoForm } from '@/features/create-todo'
import { PageHeader } from '@/shared/ui/page-header'

export const Route = createFileRoute('/todos')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions)
    if (!session) throw redirect({ to: '/login' })
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(todosQueryOptions),
  component: TodosPage,
})

function TodosPage() {
  return (
    <>
      <PageHeader title="Задачи" description="CRUD-пример с оптимистичным обновлением" />
      <CreateTodoForm />
      <Suspense fallback={<p className="mt-6">Загрузка…</p>}>
        <TodoList />
      </Suspense>
    </>
  )
}

function TodoList() {
  const { data: todos } = useSuspenseQuery(todosQueryOptions)
  const toggle = useToggleTodoMutation()
  const remove = useDeleteTodoMutation()

  if (todos.length === 0) {
    return <p className="mt-6 text-muted">Пока пусто. Добавь первую задачу.</p>
  }

  return (
    <ul className="mt-6 flex flex-col gap-2">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={(t) => toggle.mutate({ id: t.id, done: !t.done })}
          onDelete={(t) => remove.mutate(t.id)}
        />
      ))}
    </ul>
  )
}
