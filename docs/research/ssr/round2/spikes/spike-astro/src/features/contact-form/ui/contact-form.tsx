import { type FormEvent, useEffect, useRef, useState } from 'react'

interface Props {
  labels: { name: string; email: string; message: string; submit: string; thanks: string }
  endpoint?: string
}

export function ContactForm({ labels, endpoint = '/api/contact' }: Props) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const ts = useRef<HTMLInputElement>(null)

  // Без JS поля ts нет — time-trap работает только для гидрированного острова.
  useEffect(() => {
    if (ts.current) ts.current.value = String(Date.now())
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('sending')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => null)
    setState(response?.ok ? 'done' : 'error')
  }

  if (state === 'done') {
    return (
      <p role="status" className="rounded-control bg-surface p-4 text-body-md">
        {labels.thanks}
      </p>
    )
  }

  return (
    <form method="POST" action={endpoint} onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-body-sm">
        {labels.name}
        <input
          name="name"
          required
          minLength={2}
          className="rounded-control border border-divider px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-body-sm">
        {labels.email}
        <input
          name="email"
          type="email"
          required
          className="rounded-control border border-divider px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-body-sm">
        {labels.message}
        <textarea
          name="message"
          required
          minLength={10}
          rows={5}
          className="rounded-control border border-divider px-3 py-2"
        />
      </label>
      <input
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <input ref={ts} type="hidden" name="ts" />
      <button
        type="submit"
        disabled={state === 'sending'}
        className="self-start rounded-control bg-accent px-5 py-2.5 font-medium text-accent-ink"
      >
        {labels.submit}
      </button>
      {state === 'error' && <p role="alert">error</p>}
    </form>
  )
}
