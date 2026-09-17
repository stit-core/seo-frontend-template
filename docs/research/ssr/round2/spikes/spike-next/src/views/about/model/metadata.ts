import type { Metadata } from 'next'
import { type Locale, t } from '@/shared/i18n'
import { buildMetadata } from '@/shared/seo'

export function aboutMetadata(locale: Locale): Metadata {
  const d = t(locale)
  return buildMetadata({
    locale,
    path: '/about',
    title: `${d.about} — ${d.siteName}`,
    description: d.tagline,
  })
}
