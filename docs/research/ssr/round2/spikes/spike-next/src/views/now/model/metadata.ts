import type { Metadata } from 'next'
import { type Locale, t } from '@/shared/i18n'
import { buildMetadata } from '@/shared/seo'

export function nowMetadata(locale: Locale): Metadata {
  const d = t(locale)
  return buildMetadata({
    locale,
    path: '/now',
    title: `${d.now} — ${d.siteName}`,
    description: d.tagline,
    indexable: false,
  })
}
