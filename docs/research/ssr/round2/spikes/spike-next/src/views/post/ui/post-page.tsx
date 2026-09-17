import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getPostBySlug } from '@/entities/post'
import { getSiteUrl } from '@/shared/config'
import { type Locale, localePath, t } from '@/shared/i18n'
import { formatDate } from '@/shared/lib'
import { absoluteUrl, articleJsonLd, breadcrumbJsonLd, JsonLd } from '@/shared/seo'
import { Breadcrumbs } from '@/shared/ui/breadcrumbs'
import { Container } from '@/shared/ui/container'
import { Prose } from '@/shared/ui/prose'

export async function PostPage({ locale, slug }: { locale: Locale; slug: string }) {
  const post = await getPostBySlug(locale, slug)
  if (!post) notFound()

  const d = t(locale)
  const url = absoluteUrl(localePath(locale, `/blog/${slug}`))

  return (
    <Container>
      <JsonLd
        data={articleJsonLd({
          siteUrl: getSiteUrl(),
          url,
          headline: post.title,
          description: post.description,
          image: `${getSiteUrl()}${post.cover}`,
          datePublished: post.pubDate,
          dateModified: post.updatedDate,
          locale,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: d.home, url: absoluteUrl(localePath(locale, '/')) },
          { name: d.blog, url: absoluteUrl(localePath(locale, '/blog')) },
          { name: post.title, url },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: d.home, href: localePath(locale, '/') },
          { name: d.blog, href: localePath(locale, '/blog') },
          { name: post.title, href: localePath(locale, `/blog/${slug}`) },
        ]}
      />
      <article className="mt-3">
        <h1 className="text-heading-lg font-semibold">{post.title}</h1>
        <p className="text-body-sm text-muted mt-2">
          {d.published}: <time dateTime={post.pubDate}>{formatDate(post.pubDate, locale)}</time>
          {' · '}
          {d.updated}:{' '}
          <time dateTime={post.updatedDate}>{formatDate(post.updatedDate, locale)}</time>
        </p>
        <Image
          src={post.cover}
          alt={post.title}
          width={1600}
          height={900}
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="rounded-control mt-4 w-full"
        />
        <Prose html={post.html} />
        <ul className="text-body-sm text-muted mt-6 flex gap-2">
          {post.tags.map((tag) => (
            <li key={tag}>#{tag}</li>
          ))}
        </ul>
      </article>
    </Container>
  )
}
