import { z } from 'zod'

export const PostFrontmatterSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  pubDate: z.iso.date(),
  updatedDate: z.iso.date(),
  cover: z.string().startsWith('/covers/'),
  tags: z.array(z.string().min(1)).min(1),
})

export type PostFrontmatter = z.infer<typeof PostFrontmatterSchema>

export interface Post extends PostFrontmatter {
  slug: string
  html: string
  readingMinutes: number
}
