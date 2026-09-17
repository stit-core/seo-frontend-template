import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { postsQueryOptions } from '@/entities/post'
import { absoluteUrl, robotsMeta, seoLinks } from '@/shared/seo'
import { PageHeader } from '@/shared/ui/page-header'
import { SiteShell } from '@/widgets/site-shell'

const TITLE = 'Публикации — stit SSR spike'
const DESCRIPTION = 'Список публикаций, отрендеренный на сервере до выполнения JavaScript.'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(postsQueryOptions)
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      ...robotsMeta(),
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: absoluteUrl('/') },
    ],
    links: seoLinks('/', 'ru'),
  }),
  component: HomePage,
})

function HomePage() {
  const { data: posts } = useSuspenseQuery(postsQueryOptions)

  return (
    <SiteShell>
      <PageHeader title="Публикации" description={DESCRIPTION} />
      <ul className="flex flex-col gap-4">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link to="/posts/$slug" params={{ slug: post.slug }} className="text-body-md underline">
              {post.title}
            </Link>
            <p className="text-body-sm text-muted">{post.excerpt}</p>
          </li>
        ))}
      </ul>
    </SiteShell>
  )
}
