'use server'

import { redirect } from 'next/navigation'
import { type Locale, localePath, t } from '@/shared/i18n'
import { ContactFormSchema, type ContactState, MIN_FILL_MS } from '../model/schema'

export async function submitContact(
  locale: Locale,
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot: поле скрыто от людей, заполняют его только боты — уводим на «спасибо»
  // молча, чтобы бот не подбирал обход.
  if (String(formData.get('website') ?? '') !== '') redirect(localePath(locale, '/contact/thanks'))

  // Time-trap работает только когда поле заполнил клиентский JS: на prerender-странице
  // серверного времени рендера нет (форма запечена на билде). Без JS проверка пропускается.
  const openedAt = Number(formData.get('openedAt') ?? 0)
  if (openedAt > 0 && Date.now() - openedAt < MIN_FILL_MS) {
    return { status: 'error', message: t(locale).formError }
  }

  const parsed = ContactFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  })

  if (!parsed.success) return { status: 'error', message: t(locale).formError }

  // PRG: и с JS, и без JS пользователь оказывается на отдельном URL «спасибо»,
  // повторный POST по F5 невозможен.
  redirect(localePath(locale, '/contact/thanks'))
}
