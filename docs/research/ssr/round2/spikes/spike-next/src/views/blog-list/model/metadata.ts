import type { Metadata } from 'next'
import { type Locale, t } from '@/shared/i18n'
import { buildMetadata } from '@/shared/seo'

export const PAGE_SIZE = 5

export function totalPages(count: number): number {
  return Math.max(1, Math.ceil(count / PAGE_SIZE))
}

// Пагинация: self-canonical на каждой странице, без rel=prev/next-канонизации на первую.
export function blogListMetadata(locale: Locale, page: number): Metadata {
  const d = t(locale)
  const path = page === 1 ? '/blog' : `/blog/page/${page}`
  const suffix = page === 1 ? '' : ` — ${d.page} ${page}`
  return buildMetadata({
    locale,
    path,
    title: `${d.blog}${suffix} — ${d.siteName}`,
    description: `${d.heroLead}`,
  })
}
