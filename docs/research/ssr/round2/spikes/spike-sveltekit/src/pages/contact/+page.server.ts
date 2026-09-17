import { fail, redirect } from '@sveltejs/kit'
import {
  contactSchema,
  HONEYPOT_FIELD,
  MAX_FORM_AGE_MS,
  MIN_FILL_MS,
} from '@/features/contact-form'
import { localizeHref } from '@/shared/i18n'
import type { Actions, PageServerLoad } from './$types'

// Form actions несовместимы с prerender; страница интерактивна — здесь гидрация нужна.
export const prerender = false
export const csr = true

export const load: PageServerLoad = ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' })
  return { issuedAt: Date.now() }
}

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData()

    // Honeypot: ботам отвечаем так же, как людям, чтобы не подсказывать ловушку.
    if (String(form.get(HONEYPOT_FIELD) ?? '') !== '')
      redirect(303, localizeHref('/contact/spasibo'))

    const age = Date.now() - Number(form.get('issuedAt') ?? 0)
    if (!Number.isFinite(age) || age < MIN_FILL_MS || age > MAX_FORM_AGE_MS) {
      return fail(422, {
        errors: { message: 'Форма отправлена слишком быстро, попробуйте ещё раз' },
        values: {},
      })
    }

    const values = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      message: String(form.get('message') ?? ''),
    }
    const parsed = contactSchema().safeParse(values)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        errors[key] ??= issue.message
      }
      return fail(400, { errors, values })
    }

    // PRG: успешный POST уводит на отдельный URL, чтобы F5 не переотправлял форму.
    redirect(303, localizeHref('/contact/spasibo'))
  },
}
