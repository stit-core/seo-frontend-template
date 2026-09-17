import type { Locale } from '@/shared/i18n'

interface JsonLdProps {
  data: Record<string, unknown>
}

// JSON-LD рендерится сервером в разметку; экранируем '<' чтобы не разорвать скрипт.
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD по спецификации inline
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

export function siteJsonLd(siteUrl: string, name: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${siteUrl}#org`, name, url: siteUrl },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#site`,
        name,
        url: siteUrl,
        publisher: { '@id': `${siteUrl}#org` },
      },
    ],
  }
}

export function articleJsonLd(input: {
  siteUrl: string
  url: string
  headline: string
  description: string
  image: string
  datePublished: string
  dateModified: string
  locale: Locale
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    headline: input.headline,
    description: input.description,
    image: [input.image],
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    inLanguage: input.locale,
    author: { '@type': 'Organization', name: 'stit demo' },
    publisher: { '@type': 'Organization', name: 'stit demo', url: input.siteUrl },
  }
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
