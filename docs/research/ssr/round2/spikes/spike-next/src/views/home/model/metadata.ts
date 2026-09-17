import type { Metadata } from 'next'
import { getSiteUrl } from '@/shared/config'
import { type Locale, t } from '@/shared/i18n'
import { buildMetadata } from '@/shared/seo'

export function homeMetadata(locale: Locale): Metadata {
  const d = t(locale)
  return buildMetadata({
    locale,
    path: '/',
    title: `${d.siteName} — ${d.tagline}`,
    description: d.heroLead,
    image: `${getSiteUrl()}/covers/ssr-i-indeksatsiya.png`,
  })
}
