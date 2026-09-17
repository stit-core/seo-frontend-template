import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { postSchema } from './schema'

// Контент живёт внутри слайса; id записи — путь от base без расширения: `<locale>/<slug>`.
export const postCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/entities/post/content' }),
  schema: postSchema,
})
