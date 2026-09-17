import { type Locale, localePath } from '@/shared/i18n'

const BLOG = '/blog'

// Маршруты без префикса локали — для alternate-ссылок (`document.astro` сам подставит локаль).
export function blogRoute(page = 1): string {
  return page === 1 ? BLOG : `${BLOG}/page/${page}`
}

export function postRoute(slug: string): string {
  return `${BLOG}/${slug}`
}

export function tagRoute(tag: string): string {
  return `${BLOG}/tag/${tag}`
}

export function blogPath(locale: Locale, page = 1): string {
  return localePath(locale, blogRoute(page))
}

export function postPath(locale: Locale, slug: string): string {
  return localePath(locale, postRoute(slug))
}

export function tagPath(locale: Locale, tag: string): string {
  return localePath(locale, tagRoute(tag))
}
