import { listPosts, postPath } from '@/entities/post'
import { SITE_NAME } from '@/shared/config'
import { type Locale, localePath, t } from '@/shared/i18n'
import { buildFeed } from '@/shared/seo'

// Один фид на локаль (/rss.xml, /en/rss.xml): анонсы последних записей блога, тело — по ссылке.
// Файл сборки: абсолютные URL в нём — на плейсхолдере origin, его штампует entrypoint контейнера.
export async function blogFeed(locale: Locale): Promise<Response> {
  const posts = await listPosts(locale)
  const xml = await buildFeed({
    title: `${t(locale, 'blog.title')} — ${SITE_NAME}`,
    description: t(locale, 'blog.description'),
    language: locale,
    homePath: localePath(locale, '/'),
    feedPath: localePath(locale, '/rss.xml'),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      path: postPath(locale, post.slug),
      pubDate: post.data.pubDate,
      tags: post.data.tags,
    })),
  })
  // Заголовок видит только `astro dev`: файл сборки отдаёт статик-хендлер со своими.
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
