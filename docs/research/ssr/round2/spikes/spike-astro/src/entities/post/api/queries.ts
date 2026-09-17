import { type CollectionEntry, getCollection, getEntry } from 'astro:content'

export type Post = CollectionEntry<'post'>

export async function listPosts(): Promise<Post[]> {
  const posts = await getCollection('post')
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime())
}

export async function latestPosts(limit: number): Promise<Post[]> {
  return (await listPosts()).slice(0, limit)
}

export async function getPost(id: string): Promise<Post | undefined> {
  return getEntry('post', id)
}

export function postPath(post: Post): string {
  return `/blog/${post.id}`
}

export function lastmod(post: Post): Date {
  return post.data.updatedDate ?? post.data.pubDate
}
