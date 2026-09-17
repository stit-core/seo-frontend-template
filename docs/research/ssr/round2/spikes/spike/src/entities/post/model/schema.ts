import { z } from 'zod'

export const PostSchema = z.object({
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  publishedAt: z.string(),
})

export const PostDetailSchema = PostSchema.extend({ body: z.string() })

export type Post = z.infer<typeof PostSchema>
export type PostDetail = z.infer<typeof PostDetailSchema>
