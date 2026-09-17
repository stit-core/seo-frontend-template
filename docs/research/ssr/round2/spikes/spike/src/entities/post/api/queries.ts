import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from '@/shared/api'
import { PostDetailSchema, PostSchema } from '../model/schema'

export const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: async () => PostSchema.array().parse(await apiFetch('/api/v1/posts')),
})

export function postQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ['posts', slug],
    queryFn: async () => PostDetailSchema.parse(await apiFetch(`/api/v1/posts/${slug}`)),
  })
}
