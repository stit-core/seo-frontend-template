import { getRuntimeConfig } from '@/shared/config'
import { DEFAULT_LOCALE, type Locale, localePath, SUPPORTED_LOCALES } from '@/shared/i18n'

// Канонический вид пути: без query и фрагмента, без хвостового слеша (`trailingSlash: 'never'`).
// Регистр не трогается: URL к нему чувствительны, canonical обязан совпадать с реальным адресом.
export function normalizePath(path: string): string {
  const trimmed = path.replace(/[?#].*$/, '').replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

// Единственная точка, где к пути добавляется origin: runtime SITE_URL на on-demand, на prerender —
// плейсхолдер сборки, который штампует entrypoint контейнера. Корень сайта — `https://host/`.
export function absoluteUrl(path: string): string {
  const origin = getRuntimeConfig().SITE_URL
  const normalized = normalizePath(path)
  return normalized === '/' ? `${origin}/` : `${origin}${normalized}`
}

export interface Alternate {
  hreflang: string
  href: string
}

export interface AlternatesInput {
  locale: Locale
  // Путь текущей страницы (с префиксом локали).
  path: string
  // Путь перевода без префикса локали; нет перевода — нет hreflang вовсе.
  alternatePath: string | undefined
}

// hreflang — только при реальном переводе: полный взаимный набор с self-ссылкой и x-default
// (версия дефолтной локали). Две локали: «другая» — единственная кроме текущей.
export function alternates({ locale, path, alternatePath }: AlternatesInput): Alternate[] {
  const other = SUPPORTED_LOCALES.find((candidate) => candidate !== locale)
  if (alternatePath === undefined || other === undefined) return []
  const own = absoluteUrl(path)
  const twin = absoluteUrl(localePath(other, alternatePath))
  const hrefOf = (candidate: Locale) => (candidate === locale ? own : twin)
  return [
    ...SUPPORTED_LOCALES.map((candidate) => ({ hreflang: candidate, href: hrefOf(candidate) })),
    { hreflang: 'x-default', href: hrefOf(DEFAULT_LOCALE) },
  ]
}
