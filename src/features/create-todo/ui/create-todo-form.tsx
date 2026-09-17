import { useForm } from '@tanstack/react-form'
import { type NewTodo, NewTodoSchema, useCreateTodoMutation } from '@/entities/todo'

export function CreateTodoForm() {
  const create = useCreateTodoMutation()

  const form = useForm({
    defaultValues: { title: '' } satisfies NewTodo,
    validators: { onChange: NewTodoSchema },
    onSubmit: async ({ value, formApi }) => {
      await create.mutateAsync(value)
      formApi.reset()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="flex gap-2"
    >
      <form.Field name="title">
        {(field) => (
          <input
            type="text"
            placeholder="Что сделать…"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            aria-label="Заголовок задачи"
            className="flex-1 px-3 py-2 rounded-control border border-divider"
          />
        )}
      </form.Field>
      <button
        type="submit"
        disabled={create.isPending}
        className="px-4 py-2 rounded-control bg-action-bg text-action-fg disabled:opacity-50"
      >
        Добавить
      </button>
    </form>
  )
}
