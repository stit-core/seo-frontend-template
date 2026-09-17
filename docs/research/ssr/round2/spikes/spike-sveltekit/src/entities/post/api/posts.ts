import matter from 'gray-matter'
import { PostFrontmatterSchema, type PostMeta } from '../model/schema'

const raw = import.meta.glob('../content/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

function build(): PostMeta[] {
  const list = Object.entries(raw).map(([path, source]) => {
    const slug = path.split('/').pop()?.replace(/\.md$/, '') ?? ''
    const parsed = PostFrontmatterSchema.safeParse(matter(source).data)
    if (!parsed.success) {
      throw new Error(`Невалидный frontmatter в ${path}: ${parsed.error.message}`)
    }
    return { ...parsed.data, slug }
  })
  return list.sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1))
}

// Мемоизированная функция, а не `export const allPosts = build()`: top-level
// вызов в public API слайса не шейкается и утаскивает весь контент
// (gray-matter + 12 markdown) в клиентский бандл каждой страницы с PostCard.
let cache: PostMeta[] | null = null

export function allPosts(): PostMeta[] {
  cache ??= build()
  return cache
}

export function postBySlug(slug: string): PostMeta | undefined {
  return allPosts().find((p) => p.slug === slug)
}

export function pageOfPosts(page: number, perPage: number): { posts: PostMeta[]; pages: number } {
  const posts = allPosts()
  const pages = Math.max(1, Math.ceil(posts.length / perPage))
  const start = (page - 1) * perPage
  return { posts: posts.slice(start, start + perPage), pages }
}

export function lastModified(): string {
  return allPosts().reduce((acc, p) => (p.updatedDate > acc ? p.updatedDate : acc), '1970-01-01')
}
