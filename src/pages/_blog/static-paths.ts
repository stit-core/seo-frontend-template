import type { GetStaticPathsResult } from 'astro'
import { listByTag, listPosts, listTags, pageCount, paginate } from '@/entities/post'
import type { Locale } from '@/shared/i18n'

// getStaticPaths изолирован от frontmatter страницы, поэтому локаль приходит аргументом:
// ru- и en-обёртки маршрутов делят одну реализацию вместо копии в каждой.

// Только видимые записи локали: неизвестный slug (и черновик в сборке) — честный 404.
export async function postPaths(locale: Locale): Promise<GetStaticPathsResult> {
  return (await listPosts(locale)).map((post) => ({ params: { slug: post.slug }, props: { post } }))
}

// Страница 1 — это /blog; здесь только 2…N, остальное — честный 404.
export async function pagePaths(locale: Locale): Promise<GetStaticPathsResult> {
  const posts = await listPosts(locale)
  return Array.from({ length: pageCount(posts.length) - 1 }, (_, index) => {
    const current = index + 2
    return { params: { page: String(current) }, props: { locale, page: paginate(posts, current) } }
  })
}

export async function tagPaths(locale: Locale): Promise<GetStaticPathsResult> {
  const tags = await listTags(locale)
  return Promise.all(
    tags.map(async (tag) => ({
      params: { tag },
      props: { locale, tag, posts: await listByTag(locale, tag) },
    })),
  )
}
