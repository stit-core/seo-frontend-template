import type { Metadata } from 'next'
import { type Locale, t } from '@/shared/i18n'
import { buildMetadata } from '@/shared/seo'

export function contactMetadata(locale: Locale): Metadata {
  const d = t(locale)
  return buildMetadata({
    locale,
    path: '/contact',
    title: `${d.contact} — ${d.siteName}`,
    description: d.tagline,
  })
}
