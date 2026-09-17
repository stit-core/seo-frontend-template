import { z } from 'zod'
import { SITE_NAME } from '@/shared/config'
import { absoluteUrl } from './urls'

const ThingSchema = z.object({ '@type': z.string() }).loose()
export const JsonLdSchema = z
  .object({ '@context': z.literal('https://schema.org'), '@type': z.string() })
  .loose()
export type JsonLd = z.infer<typeof JsonLdSchema>

export function organization(): JsonLd {
  return JsonLdSchema.parse({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/'),
  })
}

export function website(): JsonLd {
  return JsonLdSchema.parse({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    inLanguage: 'ru-RU',
  })
}

export interface ArticleInput {
  path: string
  title: string
  description: string
  image: string
  published: Date
  updated?: Date | undefined
}

export function article(input: ArticleInput): JsonLd {
  return JsonLdSchema.parse({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    image: [input.image.startsWith('http') ? input.image : absoluteUrl(input.image)],
    datePublished: input.published.toISOString(),
    ...(input.updated ? { dateModified: input.updated.toISOString() } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(input.path) },
    publisher: ThingSchema.parse({ '@type': 'Organization', name: SITE_NAME }),
  })
}

export function breadcrumbs(items: Array<{ name: string; path: string }>): JsonLd {
  return JsonLdSchema.parse({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  })
}
