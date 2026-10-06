// Реестр мини-проекта check:content — свой, со своей схемой, а не реестр сайта: гейт на гейт не
// меняется от того, какие коллекции у сайта. Схема — минимальная строгая: бюджеты и форму полей
// держат unit-тесты схем самого сайта, здесь проверяется скрипт.
import { z } from 'zod'

const entryRoute = (slug) => `/blog/${slug}`

export const collections = [
  {
    name: 'post',
    dir: 'src/entities/post/content',
    schema: () =>
      z.strictObject({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        tags: z.array(z.string()),
        draft: z.boolean().default(false),
        translationKey: z.string(),
      }),
    entryRoute,
    routes: ({ slugs }) => ['/blog', ...slugs.map(entryRoute)],
  },
  // Запись реестра без каталога.
  { name: 'bez-kataloga', dir: 'src/entities/bez-kataloga/content', entryRoute, routes: () => [] },
]
