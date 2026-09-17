import { type SchemaContext, z } from 'astro:content'

export const postSchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string().min(3).max(120),
    description: z.string().min(10).max(300),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    cover: image(),
    tags: z.array(z.string()).default([]),
  })
