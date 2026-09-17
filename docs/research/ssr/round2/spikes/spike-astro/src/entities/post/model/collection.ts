import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { postSchema } from './schema'

// Контент живёт внутри слайса entity — content layer позволяет любой base.
export const postCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/entities/post/content' }),
  schema: postSchema,
})
