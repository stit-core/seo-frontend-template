// Реестр коллекций контента — общая основа гейтов check:content (до build) и seo:check (после):
// где лежат .md, чем валидируются, какие маршруты порождают (без префикса локали — его
// подставляет localePath). Новая коллекция — запись здесь. TS-модули — только «листовые»
// (без alias-импортов): их Node исполняет напрямую.
import { POSTS_PER_PAGE, pageCount } from '../../src/entities/post/lib/paginate.ts'
import { postSchema } from '../../src/entities/post/model/schema.ts'

const postRoute = (slug) => `/blog/${slug}`

export const collections = [
  {
    name: 'post',
    dir: 'src/entities/post/content',
    schema: postSchema,
    // Маршрут одной записи и все маршруты коллекции по видимым slug'ам и тегам.
    entryRoute: postRoute,
    routes: ({ slugs, tags }) => [
      '/blog',
      ...Array.from(
        { length: pageCount(slugs.length, POSTS_PER_PAGE) - 1 },
        (_, index) => `/blog/page/${index + 2}`,
      ),
      ...slugs.map(postRoute),
      ...tags.map((tag) => `/blog/tag/${tag}`),
    ],
  },
]

// Frontmatter между строками `---` и тело; без frontmatter — undefined.
export function splitFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source)
  return match ? { frontmatter: match[1], body: match[2] } : undefined
}
