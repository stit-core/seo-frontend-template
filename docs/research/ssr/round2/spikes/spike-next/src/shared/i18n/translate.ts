import { DEFAULT_LOCALE, type Locale } from './locales'
import { en } from './locales/en'
import { ru } from './locales/ru'

export type Dict = { [K in keyof typeof ru]: string }

const DICTS: Record<Locale, Dict> = { ru, en }

// Невалидный префикс локали доходит до generateMetadata раньше, чем layout
// успевает вызвать notFound() — без фолбэка это 500 вместо 404.
export function t(locale: Locale): Dict {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE]
}

// Дефолтная локаль живёт без префикса: /blog, а не /ru/blog.
export function localePath(locale: Locale, path: string): string {
  const clean = path === '/' ? '' : path
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`
}
