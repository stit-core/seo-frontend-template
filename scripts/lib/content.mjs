// Реестр коллекций контента — общая основа гейтов check:content (до build) и seo:check (после):
// где лежат .md, чем валидируются, какие маршруты порождают (без префикса локали — его
// подставляет localePath). Новая коллекция — запись здесь. TS-модули — только «листовые»
// (без alias-импортов): их Node исполняет напрямую.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { POSTS_PER_PAGE, pageCount } from '../../src/entities/post/lib/paginate.ts'
import { postSchema } from '../../src/entities/post/model/schema.ts'

/** @param {string} slug */
const postRoute = (slug) => `/blog/${slug}`

/**
 * @typedef {object} Collection
 * @property {string} name
 * @property {string} dir — каталог `.md` от корня проекта, внутри — `<locale>/<slug>.md`
 * @property {(context: { image: () => import('zod').ZodType }) => import('zod').ZodType} schema
 * @property {(slug: string) => string} entryRoute
 * @property {(visible: { slugs: string[], tags: string[] }) => string[]} routes
 */

/** @type {Collection[]} */
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

/**
 * Реестр проверяемого проекта — его `scripts/lib/content.mjs`: у сайта это модуль выше, у
 * мини-проектов check:gate (`.gate-fixtures/<скрипт>`) — свой. Гейт на гейт поэтому не зависит
 * от коллекций сайта: их добавляет /scaffold, переименовывает и удаляет /de-template.
 * @param {string} root
 * @returns {Promise<Collection[]>}
 */
export async function collectionsOf(root) {
  const registry = await import(pathToFileURL(resolve(root, 'scripts/lib/content.mjs')).href)
  return registry.collections
}

// Frontmatter между строками `---` и тело; без frontmatter — undefined.
/**
 * @param {string} source
 * @returns {{ frontmatter: string, body: string } | undefined}
 */
export function splitFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source)
  return match ? { frontmatter: match[1], body: match[2] } : undefined
}
