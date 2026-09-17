import { createFileRoute } from '@tanstack/react-router'
import { findPost } from '@/shared/api/mock/posts'

export const Route = createFileRoute('/api/v1/posts/$slug')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const post = findPost(params.slug)
        if (!post) return new Response(null, { status: 404 })
        return Response.json(post)
      },
    },
  },
})
