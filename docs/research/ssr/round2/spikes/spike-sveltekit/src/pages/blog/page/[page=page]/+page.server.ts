import { error } from '@sveltejs/kit'
import { allPosts, pageOfPosts } from '@/entities/post'
import { POSTS_PER_PAGE } from '@/shared/config'
import type { EntryGenerator, PageServerLoad } from './$types'

export const entries: EntryGenerator = () => {
  const total = Math.max(1, Math.ceil(allPosts().length / POSTS_PER_PAGE))
  return Array.from({ length: total - 1 }, (_, i) => ({ page: String(i + 2) }))
}

export const load: PageServerLoad = ({ params }) => {
  const n = Number(params.page)
  if (!Number.isInteger(n) || n < 2) error(404, 'Нет такой страницы')
  const { posts, pages } = pageOfPosts(n, POSTS_PER_PAGE)
  if (posts.length === 0) error(404, 'Нет такой страницы')
  return { posts, page: n, pages }
}
