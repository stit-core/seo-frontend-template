import { z } from 'zod'

// YAML сам разворачивает 2026-03-03 в Date — приводим обратно к ISO-строке,
// чтобы контракт фронтматтера был одним типом и в тестах, и в сборке.
const IsoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.iso.date(),
)

export const PostFrontmatterSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  pubDate: IsoDate,
  updatedDate: IsoDate,
  cover: z.string().regex(/^\.\/covers\/[a-z0-9-]+\.png$/),
  tags: z.array(z.string().min(1)).min(1),
})

export type PostFrontmatter = z.infer<typeof PostFrontmatterSchema>

export const PostMetaSchema = PostFrontmatterSchema.extend({
  slug: z.string().regex(/^[a-z0-9-]+$/),
})

export type PostMeta = z.infer<typeof PostMetaSchema>
