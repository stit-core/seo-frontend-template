import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n'
import { NotFoundPage } from '@/views/not-found'
import './styles/index.css'

// global-not-found обходит layout (док: «bypasses your app's normal rendering»),
// поэтому здесь свой <html> и свой импорт стилей. Нужен потому, что корневой
// layout живёт под динамическим сегментом [lang].
export const metadata: Metadata = {
  title: '404',
  robots: { index: false, follow: false },
}

export default async function GlobalNotFound() {
  const locale = (await headers()).get('x-locale') ?? DEFAULT_LOCALE
  const safe = isLocale(locale) ? locale : DEFAULT_LOCALE

  return (
    <html lang={safe}>
      <body>
        <NotFoundPage locale={safe} />
      </body>
    </html>
  )
}
