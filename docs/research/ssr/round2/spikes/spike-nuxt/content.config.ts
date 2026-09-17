import { fileURLToPath } from 'node:url'
import { defineCollection, defineContentConfig } from '@nuxt/content'
import { defineSitemapSchema } from '@nuxtjs/sitemap/content'
import { z } from 'zod'
import { postFrontmatterSchema } from './src/entities/post/model/schema'

// Контент живёт в FSD-слайсе, а не в навязанном content/ на корне.
const postsDir = fileURLToPath(new URL('./src/entities/post/content', import.meta.url))

// Sitemap не видит коллекции сам: поле sitemap в схеме — единственный способ попасть в него без prerender.
function postsCollection(locale: 'ru' | 'en') {
  return defineCollection({
    type: 'page',
    source: {
      include: '**/*.md',
      cwd: `${postsDir}/${locale}`,
      prefix: locale === 'ru' ? '/blog' : '/en/blog',
    },
    schema: postFrontmatterSchema.extend({
      sitemap: defineSitemapSchema({
        z,
        name: `posts${locale === 'ru' ? 'Ru' : 'En'}`,
        onUrl: (url: Record<string, unknown>, item: Record<string, unknown>) => {
          url.lastmod = item.updatedDate
        },
      }),
    }),
  })
}

export default defineContentConfig({
  collections: {
    postsRu: postsCollection('ru'),
    postsEn: postsCollection('en'),
  },
})
