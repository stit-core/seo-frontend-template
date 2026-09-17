import { SITE_NAME } from '@/shared/config'

export const LOCALES = ['ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ru'

export interface SeoInput {
  origin: string
  /** Путь без префикса локали, всегда с ведущим слешем и без хвостового */
  path: string
  locale: Locale
  title: string
  description: string
  indexable: boolean
}

export interface AlternateLink {
  hreflang: string
  href: string
}

function localizedPath(path: string, locale: Locale): string {
  const clean = path === '/' ? '' : path
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`
}

export function absoluteUrl(origin: string, path: string, locale: Locale = DEFAULT_LOCALE): string {
  const p = localizedPath(path, locale)
  return `${origin}${p === '/' ? '/' : p}`
}

export function alternateLinks(origin: string, path: string): AlternateLink[] {
  return [
    ...LOCALES.map((l) => ({ hreflang: l, href: absoluteUrl(origin, path, l) })),
    { hreflang: 'x-default', href: absoluteUrl(origin, path, DEFAULT_LOCALE) },
  ]
}

export function robotsContent(indexable: boolean, policy: 'index' | 'noindex'): string {
  return indexable && policy === 'index' ? 'index, follow' : 'noindex, nofollow'
}

export function websiteJsonLd(origin: string): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${origin}/#org`, name: SITE_NAME, url: `${origin}/` },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#site`,
        name: SITE_NAME,
        url: `${origin}/`,
        publisher: { '@id': `${origin}/#org` },
        inLanguage: 'ru-RU',
      },
    ],
  })
}

export function breadcrumbJsonLd(
  origin: string,
  items: Array<{ name: string; path: string }>,
  locale: Locale,
): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(origin, item.path, locale),
    })),
  })
}

export function articleJsonLd(input: {
  origin: string
  path: string
  locale: Locale
  headline: string
  description: string
  datePublished: string
  dateModified: string
  image: string
}): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    image: [input.image.startsWith('http') ? input.image : `${input.origin}${input.image}`],
    inLanguage: input.locale === 'en' ? 'en-GB' : 'ru-RU',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(input.origin, input.path, input.locale),
    },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${input.origin}/` },
  })
}

// Тег собирается здесь, а не в разметке: литерал `<script>` внутри .svelte
// ломает и компилятор Svelte, и svelte-eslint-parser.
const LD_OPEN = `<${'script'} type="application/ld+json">`
const LD_CLOSE = `</${'script'}>`

export function jsonLdTag(json: string): string {
  return LD_OPEN + json.replace(/</g, '\\u003c') + LD_CLOSE
}
