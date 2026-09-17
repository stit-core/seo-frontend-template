import type { Metadata } from 'next'
import { getSiteUrl, isIndexable } from '@/shared/config'
import { DEFAULT_LOCALE, LOCALES, type Locale, localePath } from '@/shared/i18n'

export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path === '/' ? '' : path}` || getSiteUrl()
}

// hreflang: self + все локали + x-default на дефолтную.
export function alternatesFor(path: string): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {}
  for (const locale of LOCALES) languages[locale] = absoluteUrl(localePath(locale, path))
  languages['x-default'] = absoluteUrl(localePath(DEFAULT_LOCALE, path))
  return { languages }
}

export function robotsMeta(indexable = true): NonNullable<Metadata['robots']> {
  const allowed = indexable && isIndexable()
  return { index: allowed, follow: allowed }
}

interface BuildMetadataInput {
  locale: Locale
  /** путь БЕЗ префикса локали: '/', '/blog', '/blog/foo' */
  path: string
  title: string
  description: string
  type?: 'website' | 'article'
  image?: string
  indexable?: boolean
  publishedTime?: string
  modifiedTime?: string
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const { locale, path, title, description, type = 'website', image, indexable = true } = input
  const canonical = absoluteUrl(localePath(locale, path))

  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    description,
    alternates: { canonical, ...alternatesFor(path) },
    robots: robotsMeta(indexable),
    openGraph: {
      type,
      title,
      description,
      url: canonical,
      siteName: 'stit demo',
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
      ...(image ? { images: [{ url: image, width: 1600, height: 900, alt: title }] } : {}),
      ...(type === 'article' && input.publishedTime
        ? { publishedTime: input.publishedTime, modifiedTime: input.modifiedTime }
        : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}
