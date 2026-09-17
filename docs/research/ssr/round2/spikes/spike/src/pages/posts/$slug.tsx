import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { postQueryOptions } from '@/entities/post'
import { ApiError } from '@/shared/api'
import { absoluteUrl, robotsMeta, seoLinks } from '@/shared/seo'
import { PageHeader } from '@/shared/ui/page-header'
import { SiteShell } from '@/widgets/site-shell'

export const Route = createFileRoute('/posts/$slug')({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(postQueryOptions(params.slug))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — stit SSR spike` : 'stit SSR spike' },
      { name: 'description', content: loaderData?.excerpt ?? '' },
      ...robotsMeta(),
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: absoluteUrl(`/posts/${params.slug}`) },
    ],
    links: seoLinks(`/posts/${params.slug}`, 'ru'),
  }),
  component: PostPage,
})

function PostPage() {
  const { slug } = Route.useParams()
  const { data: post } = useSuspenseQuery(postQueryOptions(slug))

  return (
    <SiteShell>
      <PageHeader title={post.title} description={post.excerpt} />
      <p className="text-body-md">{post.body}</p>
      <p className="text-body-sm text-muted mt-4">{post.publishedAt}</p>
    </SiteShell>
  )
}
