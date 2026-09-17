import Image from 'next/image'
import Link from 'next/link'
import { type Locale, localePath, t } from '@/shared/i18n'
import { formatDate } from '@/shared/lib'
import type { Post } from '../model/schema'

export function PostCard({ post, locale }: { post: Post; locale: Locale }) {
  const href = localePath(locale, `/blog/${post.slug}`)

  return (
    <article className="border-divider border-b py-6">
      <Link href={href} className="group grid gap-3 sm:grid-cols-[160px_1fr]">
        <Image
          src={post.cover}
          alt=""
          width={1600}
          height={900}
          sizes="(max-width: 640px) 100vw, 160px"
          className="rounded-control w-full"
        />
        <div>
          <h2 className="text-heading-sm font-semibold group-hover:underline">{post.title}</h2>
          <p className="text-body-sm text-muted mt-1">{post.description}</p>
          <p className="text-body-sm text-muted mt-2">
            <time dateTime={post.pubDate}>{formatDate(post.pubDate, locale)}</time>
            {' · '}
            {post.readingMinutes} min · {t(locale).readMore}
          </p>
        </div>
      </Link>
    </article>
  )
}
