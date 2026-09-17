import type { Metadata } from 'next'
import { type Locale, t } from '@/shared/i18n'
import { buildMetadata } from '@/shared/seo'

export function contactThanksMetadata(locale: Locale): Metadata {
  const d = t(locale)
  return buildMetadata({
    locale,
    path: '/contact/thanks',
    title: `${d.formThanks} — ${d.siteName}`,
    description: d.tagline,
    indexable: false,
  })
}
