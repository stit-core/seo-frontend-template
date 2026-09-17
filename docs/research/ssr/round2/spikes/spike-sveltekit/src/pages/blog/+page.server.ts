import { pageOfPosts } from '@/entities/post'
import { POSTS_PER_PAGE } from '@/shared/config'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = () => {
  const { posts, pages } = pageOfPosts(1, POSTS_PER_PAGE)
  return { posts, page: 1, pages }
}
