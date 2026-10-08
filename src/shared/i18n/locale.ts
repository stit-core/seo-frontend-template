export const SUPPORTED_LOCALES = ['ru', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ru'

// Локаль адреса — по префиксу пути: `/en` и `/en/…` — английская, без префикса — дефолтная.
export function localeOf(path: string): Locale {
  return (
    SUPPORTED_LOCALES.find((locale) => path === `/${locale}` || path.startsWith(`/${locale}/`)) ??
    DEFAULT_LOCALE
  )
}

// Дефолтная локаль живёт без префикса (routing.prefixDefaultLocale: false).
export function localePath(locale: Locale, path: string): string {
  const clean = path === '/' ? '' : path.replace(/\/+$/, '')
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`
}
