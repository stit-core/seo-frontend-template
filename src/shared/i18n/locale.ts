export const SUPPORTED_LOCALES = ['ru', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ru'

// Дефолтная локаль живёт без префикса (routing.prefixDefaultLocale: false).
export function localePath(locale: Locale, path: string): string {
  const clean = path === '/' ? '' : path.replace(/\/+$/, '')
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`
}
