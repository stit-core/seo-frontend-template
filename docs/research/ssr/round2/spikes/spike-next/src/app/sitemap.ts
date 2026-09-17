import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/entities/post'
import { getSiteUrl } from '@/shared/config'
import { DEFAULT_LOCALE, LOCALES, localePath } from '@/shared/i18n'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const abs = (path: string) => `${siteUrl}${path === '/' ? '' : path}`

  const languagesFor = (path: string) => {
    const languages: Record<string, string> = {}
    for (const locale of LOCALES) languages[locale] = abs(localePath(locale, path))
    languages['x-default'] = abs(localePath(DEFAULT_LOCALE, path))
    return languages
  }

  const staticPaths = ['/', '/blog', '/about', '/contact']
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: abs(localePath(DEFAULT_LOCALE, path)),
    alternates: { languages: languagesFor(path) },
  }))

  for (const post of await getAllPosts(DEFAULT_LOCALE)) {
    entries.push({
      url: abs(localePath(DEFAULT_LOCALE, `/blog/${post.slug}`)),
      lastModified: post.updatedDate,
      alternates: { languages: languagesFor(`/blog/${post.slug}`) },
    })
  }

  return entries
}
