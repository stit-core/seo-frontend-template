import { error } from '@sveltejs/kit'
import { allPosts, postBySlug, renderPostBody } from '@/entities/post'
import type { EntryGenerator, PageServerLoad } from './$types'

// Список URL для кроулера prerender: динамический сегмент сам он не угадает.
export const entries: EntryGenerator = () => allPosts().map((p) => ({ slug: p.slug }))

export const load: PageServerLoad = ({ params }) => {
  const post = postBySlug(params.slug)
  if (!post) error(404, 'Нет такого поста')
  const html = renderPostBody(post.slug)
  if (!html) error(404, 'Нет такого поста')
  const posts = allPosts()
  const index = posts.findIndex((p) => p.slug === post.slug)
  return {
    post,
    html,
    prev: posts[index - 1] ?? null,
    next: posts[index + 1] ?? null,
  }
}
