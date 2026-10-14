import { listByTag, listPosts, listTags, pageCount, paginate } from '@/entities/post'
import { localeParam } from '@/shared/i18n'
import { pageLocales } from '@/shared/strategy'

// Пути маршрутов блога — по локалям версий его страниц в карте (`blog`, `post`, `tag`): сегмент локали — параметр
// `[...locale]`. getStaticPaths изолирован от frontmatter страницы, поэтому пути — здесь, а не в маршруте.

// Первая страница списка — /blog своей локали.
export function listPaths() {
  return Promise.all(
    pageLocales('blog').map(async (locale) => ({
      params: { locale: localeParam(locale) },
      props: { locale, page: paginate(await listPosts(locale), 1) },
    })),
  )
}

// Страница 1 — это /blog; здесь только 2…N, остальное — честный 404.
export async function pagePaths() {
  const paths = await Promise.all(
    pageLocales('blog').map(async (locale) => {
      const posts = await listPosts(locale)
      return Array.from({ length: pageCount(posts.length) - 1 }, (_, index) => {
        const current = index + 2
        return {
          params: { locale: localeParam(locale), page: String(current) },
          props: { locale, page: paginate(posts, current) },
        }
      })
    }),
  )
  return paths.flat()
}

// Только видимые записи локали: неизвестный slug (и черновик в сборке) — честный 404.
export async function postPaths() {
  const paths = await Promise.all(
    pageLocales('post').map(async (locale) =>
      (await listPosts(locale)).map((post) => ({
        params: { locale: localeParam(locale), slug: post.slug },
        props: { post },
      })),
    ),
  )
  return paths.flat()
}

export async function tagPaths() {
  const paths = await Promise.all(
    pageLocales('tag').map(async (locale) =>
      Promise.all(
        (await listTags(locale)).map(async (tag) => ({
          params: { locale: localeParam(locale), tag },
          props: { locale, tag, posts: await listByTag(locale, tag) },
        })),
      ),
    ),
  )
  return paths.flat()
}
