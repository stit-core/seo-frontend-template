import { type Locale, localePath } from '@/shared/i18n'

const BLOG = '/blog'

export function blogPath(locale: Locale, page = 1): string {
  return localePath(locale, page === 1 ? BLOG : `${BLOG}/page/${page}`)
}

export function postPath(locale: Locale, slug: string): string {
  return localePath(locale, `${BLOG}/${slug}`)
}

export function tagPath(locale: Locale, tag: string): string {
  return localePath(locale, `${BLOG}/tag/${tag}`)
}
