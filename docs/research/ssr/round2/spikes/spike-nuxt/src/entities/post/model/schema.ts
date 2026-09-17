import { z } from 'zod'

// Фронтматтер поста — единственный контракт между .md и рендером.
export const postFrontmatterSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(300),
  pubDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cover: z.string().startsWith('/covers/'),
  tags: z.array(z.string()).min(1),
})

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>

export const POSTS_PER_PAGE = 5
