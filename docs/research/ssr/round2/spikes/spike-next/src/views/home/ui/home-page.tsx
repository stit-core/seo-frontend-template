import { getAllPosts } from '@/entities/post'
import { getSiteUrl } from '@/shared/config'
import { type Locale, localePath, t } from '@/shared/i18n'
import { JsonLd, siteJsonLd } from '@/shared/seo'
import { Container } from '@/shared/ui/container'
import { Hero } from '@/widgets/hero'
import { PostList } from '@/widgets/post-list'

export async function HomePage({ locale }: { locale: Locale }) {
  const posts = (await getAllPosts(locale)).slice(0, 3)
  const d = t(locale)

  return (
    <Container>
      <JsonLd data={siteJsonLd(getSiteUrl(), d.siteName)} />
      <Hero locale={locale} />
      <h2 className="text-heading-md mt-6 font-semibold">{d.latest}</h2>
      <PostList posts={posts} locale={locale} />
      <p className="mt-6">
        <a href={localePath(locale, '/blog')} className="underline">
          {d.cta}
        </a>
      </p>
    </Container>
  )
}
