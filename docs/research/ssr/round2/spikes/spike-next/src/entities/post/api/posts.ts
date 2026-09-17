import 'server-only'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import type { Locale } from '@/shared/i18n'
import { type Post, PostFrontmatterSchema } from '../model/schema'

// process.cwd() в standalone — корень .next/standalone, поэтому контент должен
// попасть в трейс (outputFileTracingIncludes в next.config.ts).
const CONTENT_ROOT = path.join(process.cwd(), 'src', 'entities', 'post', 'content')

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify)

async function parseFile(locale: Locale, file: string): Promise<Post> {
  const raw = await readFile(path.join(CONTENT_ROOT, locale, file), 'utf8')
  const parsed = matter(raw)
  const frontmatter = PostFrontmatterSchema.parse(parsed.data)
  const html = String(await processor.process(parsed.content))
  const words = parsed.content.split(/\s+/u).length

  return {
    ...frontmatter,
    slug: file.replace(/\.md$/, ''),
    html,
    readingMinutes: Math.max(1, Math.round(words / 180)),
  }
}

export async function getPostSlugs(locale: Locale): Promise<string[]> {
  const files = await readdir(path.join(CONTENT_ROOT, locale))
  return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''))
}

export async function getAllPosts(locale: Locale): Promise<Post[]> {
  const files = await readdir(path.join(CONTENT_ROOT, locale))
  const posts = await Promise.all(
    files.filter((f) => f.endsWith('.md')).map((file) => parseFile(locale, file)),
  )
  return posts.sort((a, b) => b.pubDate.localeCompare(a.pubDate))
}

export async function getPostBySlug(locale: Locale, slug: string): Promise<Post | null> {
  try {
    return await parseFile(locale, `${slug}.md`)
  } catch {
    return null
  }
}
