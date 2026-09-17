import { getRuntimeConfig } from '@/shared/config'
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '@/shared/i18n'

/** Путь без локали → путь с префиксом локали (дефолтная — без префикса). */
export function localePath(locale: Locale, path: string): string {
  const clean = path === '/' ? '' : path.replace(/\/+$/, '')
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`
}

/** Абсолютный URL из runtime SITE_URL; trailing slash срезается (trailingSlash: 'never'). */
export function absoluteUrl(path: string): string {
  const base = getRuntimeConfig().SITE_URL.replace(/\/+$/, '')
  const clean = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`
  return clean === '/' ? `${base}/` : `${base}${clean}`
}

export interface Alternate {
  hreflang: string
  href: string
}

/** Полный взаимный hreflang + x-default (L-3 канона). */
export function alternates(pathWithoutLocale: string): Alternate[] {
  const list: Alternate[] = SUPPORTED_LOCALES.map((locale) => ({
    hreflang: locale,
    href: absoluteUrl(localePath(locale, pathWithoutLocale)),
  }))
  list.push({
    hreflang: 'x-default',
    href: absoluteUrl(localePath(DEFAULT_LOCALE, pathWithoutLocale)),
  })
  return list
}

/** Путь текущего URL без префикса локали. */
export function stripLocale(pathname: string): string {
  const stripped = pathname.replace(/^\/(?:en)(?=\/|$)/, '')
  return stripped === '' ? '/' : stripped.replace(/\/+$/, '') || '/'
}
