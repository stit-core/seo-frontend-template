import { listPosts, postPath } from '@/entities/post'
import { SITE_NAME } from '@/shared/config'
import { type Locale, localePath, t } from '@/shared/i18n'
import { buildFeed } from '@/shared/seo'

// Один фид на локаль (/rss.xml, /en/rss.xml): анонсы последних записей блога, тело — по ссылке.
// On-demand: абсолютные URL известны только контейнеру (runtime SITE_URL).
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
  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      // Читалки и агрегаторы; после релиза с новой записью 10 минут задержки — норма.
      'cache-control': 'public, max-age=600',
      // Фид — не страница выдачи.
      'x-robots-tag': 'noindex',
    },
  })
}
