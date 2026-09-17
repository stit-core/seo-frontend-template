import type { Post } from '@/entities/post/model/schema'
export const load = (): { posts: Post[] } => ({ posts: [] })
