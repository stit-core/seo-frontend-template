'use client'

import { useActionState, useEffect, useRef } from 'react'
import { type Locale, t } from '@/shared/i18n'
import { submitContact } from '../api/submit'
import type { ContactState } from '../model/schema'

const INITIAL: ContactState = { status: 'idle' }

export function ContactForm({ locale }: { locale: Locale }) {
  const d = t(locale)
  const [state, action, pending] = useActionState(submitContact.bind(null, locale), INITIAL)
  const openedAt = useRef<HTMLInputElement>(null)

  // Страница пререндерена, серверного времени рендера в разметке нет — момент открытия
  // проставляет клиент. Без JS поле останется пустым и time-trap не сработает.
  useEffect(() => {
    if (openedAt.current) openedAt.current.value = String(Date.now())
  }, [])

  return (
    <form action={action} className="mt-6 grid gap-4" noValidate>
      <label className="grid gap-1">
        <span className="text-body-sm">{d.formName}</span>
        <input
          name="name"
          required
          minLength={2}
          className="border-divider rounded-control border px-3 py-2"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-body-sm">{d.formEmail}</span>
        <input
          name="email"
          type="email"
          required
          className="border-divider rounded-control border px-3 py-2"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-body-sm">{d.formMessage}</span>
        <textarea
          name="message"
          required
          minLength={10}
          rows={5}
          className="border-divider rounded-control border px-3 py-2"
        />
      </label>
      <input ref={openedAt} type="hidden" name="openedAt" defaultValue="" />
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-action-bg text-action-fg rounded-control justify-self-start px-4 py-2"
      >
        {d.formSubmit}
      </button>
      {state.status === 'error' && (
        <p role="alert" data-testid="contact-result" className="text-body-sm">
          {state.message ?? d.formError}
        </p>
      )}
    </form>
  )
}
