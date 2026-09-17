import { useLingui } from '@lingui/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { postsQueryOptions } from '@/entities/post'
import { absoluteUrl, robotsMeta, seoLinks } from '@/shared/seo'
import { PageHeader } from '@/shared/ui/page-header'
import { SiteShell } from '@/widgets/site-shell'

export const Route = createFileRoute('/$locale/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(postsQueryOptions)
  },
  head: ({ params }) => ({
    meta: [
      { title: 'Publications — stit SSR spike' },
      { name: 'description', content: 'Server-rendered list of publications.' },
      ...robotsMeta(),
      { property: 'og:url', content: absoluteUrl(`/${params.locale}/`) },
    ],
    links: seoLinks('/', params.locale === 'en' ? 'en' : 'ru'),
  }),
  component: LocalizedHome,
})

function LocalizedHome() {
  const { i18n } = useLingui()
  const { data: posts } = useSuspenseQuery(postsQueryOptions)

  return (
    <SiteShell>
      <PageHeader title={i18n._('home.title')} description={i18n._('home.lead')} />
      <ul className="flex flex-col gap-4">
        {posts.map((post) => (
          <li key={post.slug} className="text-body-md">
            {post.title}
          </li>
        ))}
      </ul>
    </SiteShell>
  )
}
