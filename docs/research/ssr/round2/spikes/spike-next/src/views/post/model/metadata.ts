import type { Metadata } from 'next'
import { getPostBySlug } from '@/entities/post'
import { getSiteUrl } from '@/shared/config'
import { type Locale, t } from '@/shared/i18n'
import { buildMetadata } from '@/shared/seo'

export async function postMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const post = await getPostBySlug(locale, slug)
  if (!post) return { title: t(locale).notFoundTitle, robots: { index: false, follow: false } }

  return buildMetadata({
    locale,
    path: `/blog/${slug}`,
    title: `${post.title} — ${t(locale).siteName}`,
    description: post.description,
    type: 'article',
    image: `${getSiteUrl()}${post.cover}`,
    publishedTime: post.pubDate,
    modifiedTime: post.updatedDate,
  })
}
