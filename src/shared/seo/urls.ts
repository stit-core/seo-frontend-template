import { getRuntimeConfig } from '@/shared/config'
import { type Locale, SUPPORTED_LOCALES, type Translations } from '@/shared/i18n'

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
  hreflang: Locale | 'x-default'
  href: string
}

// hreflang — по карте переводов страницы: её версия на каждом языке, своя включительно, и x-default — версия первой
// локали дескриптора (дефолтной), у которой версия есть. Версия одна — hreflang нет вовсе.
export function alternates(translations: Translations): Alternate[] {
  const versions = SUPPORTED_LOCALES.flatMap((locale): Alternate[] => {
    const path = translations[locale]
    return path === undefined ? [] : [{ hreflang: locale, href: absoluteUrl(path) }]
  })
  const [first] = versions
  if (first === undefined || versions.length < 2) return []
  return [...versions, { hreflang: 'x-default', href: first.href }]
}
