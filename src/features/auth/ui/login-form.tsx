import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { useLoginMutation } from '../api/login'
import { type LoginInput, LoginSchema } from '../model/schema'

export function LoginForm() {
  const login = useLoginMutation()
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: { email: '', password: '' } satisfies LoginInput,
    validators: { onChange: LoginSchema },
    onSubmit: async ({ value }) => {
      await login.mutateAsync(value)
      await navigate({ to: '/profile' })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-4 w-full max-w-sm"
    >
      <form.Field name="email">
        {(field) => (
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
              className="px-3 py-2 rounded-control border border-divider"
            />
            {field.state.meta.errors.map((issue) => (
              <span key={issue?.message} className="text-body-sm text-danger">
                {issue?.message}
              </span>
            ))}
          </label>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-medium">Пароль</span>
            <input
              type="password"
              autoComplete="current-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
              className="px-3 py-2 rounded-control border border-divider"
            />
            {field.state.meta.errors.map((issue) => (
              <span key={issue?.message} className="text-body-sm text-danger">
                {issue?.message}
              </span>
            ))}
          </label>
        )}
      </form.Field>

      {login.error && (
        <div role="alert" className="text-body-sm text-danger">
          {login.error.message}
        </div>
      )}

      <button
        type="submit"
        disabled={login.isPending}
        className="px-4 py-2 rounded-control bg-action-bg text-action-fg disabled:opacity-50"
      >
        {login.isPending ? 'Входим…' : 'Войти'}
      </button>
    </form>
  )
}
