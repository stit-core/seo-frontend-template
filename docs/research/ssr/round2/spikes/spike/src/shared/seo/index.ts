import { runtimeConfig } from '@/shared/config'
import { type Locale, SUPPORTED_LOCALES } from '@/shared/i18n'

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, runtimeConfig.SITE_URL).toString()
}

export function localizedPath(locale: Locale, pathname: string): string {
  return locale === 'ru' ? pathname : `/${locale}${pathname === '/' ? '/' : pathname}`
}

interface SeoLink {
  rel: string
  href: string
  hrefLang?: string
}

// canonical + hreflang-альтернативы (Google и Яндекс читают одни и те же теги).
export function seoLinks(pathname: string, locale: Locale): Array<SeoLink> {
  const links: Array<SeoLink> = [{ rel: 'canonical', href: absoluteUrl(localizedPath(locale, pathname)) }]
  for (const alt of SUPPORTED_LOCALES) {
    links.push({
      rel: 'alternate',
      hrefLang: alt,
      href: absoluteUrl(localizedPath(alt, pathname)),
    })
  }
  links.push({ rel: 'alternate', hrefLang: 'x-default', href: absoluteUrl(pathname) })
  return links
}

// staging/preview не должен попадать в индекс — INDEXABLE приходит из env контейнера.
export function robotsMeta(noindex = false): Array<{ name: string; content: string }> {
  const blocked = noindex || !runtimeConfig.INDEXABLE
  return [{ name: 'robots', content: blocked ? 'noindex, nofollow' : 'index, follow' }]
}
