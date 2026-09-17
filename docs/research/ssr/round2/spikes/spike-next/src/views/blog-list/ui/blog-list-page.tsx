import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllPosts } from '@/entities/post'
import { getSiteUrl } from '@/shared/config'
import { type Locale, localePath, t } from '@/shared/i18n'
import { absoluteUrl, breadcrumbJsonLd, JsonLd } from '@/shared/seo'
import { Breadcrumbs } from '@/shared/ui/breadcrumbs'
import { Container } from '@/shared/ui/container'
import { PostList } from '@/widgets/post-list'
import { PAGE_SIZE, totalPages } from '../model/metadata'

export async function BlogListPage({ locale, page }: { locale: Locale; page: number }) {
  const all = await getAllPosts(locale)
  const pages = totalPages(all.length)
  if (page < 1 || page > pages) notFound()

  const posts = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const d = t(locale)
  const pageHref = (n: number) => localePath(locale, n === 1 ? '/blog' : `/blog/page/${n}`)

  return (
    <Container>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: d.home, url: absoluteUrl(localePath(locale, '/')) },
          { name: d.blog, url: absoluteUrl(localePath(locale, '/blog')) },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: d.home, href: localePath(locale, '/') },
          { name: d.blog, href: localePath(locale, '/blog') },
        ]}
      />
      <h1 className="text-heading-lg mt-3 font-semibold">
        {d.blog}
        {page > 1 ? ` — ${d.page} ${page}` : ''}
      </h1>
      <PostList posts={posts} locale={locale} />
      <nav aria-label="pagination" className="text-body-sm mt-6 flex gap-3">
        {page > 1 && <Link href={pageHref(page - 1)}>← {d.prev}</Link>}
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <Link
            key={n}
            href={pageHref(n)}
            aria-current={n === page ? 'page' : undefined}
            className={n === page ? 'font-semibold' : 'underline'}
          >
            {n}
          </Link>
        ))}
        {page < pages && <Link href={pageHref(page + 1)}>{d.next} →</Link>}
      </nav>
      <p className="text-body-sm text-muted mt-6">origin: {getSiteUrl()}</p>
    </Container>
  )
}
