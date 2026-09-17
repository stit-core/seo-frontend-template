import { createFileRoute } from '@tanstack/react-router'
import { mockPosts } from '@/shared/api/mock/posts'

export const Route = createFileRoute('/api/v1/posts/')({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          mockPosts.map(({ slug, title, excerpt, publishedAt }) => ({
            slug,
            title,
            excerpt,
            publishedAt,
          })),
          { headers: { 'cache-control': 'public, max-age=60' } },
        ),
    },
  },
})
