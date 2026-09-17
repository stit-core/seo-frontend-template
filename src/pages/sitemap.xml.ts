export const prerender = false

import type { APIRoute } from 'astro'
import { blogRoute, listPosts, listTags, pageCount, postRoute, tagRoute } from '@/entities/post'
import { localePath, SUPPORTED_LOCALES } from '@/shared/i18n'
import { absoluteUrl, buildSitemap, type SitemapEntry } from '@/shared/seo'

// Только индексируемые prerendered-страницы: главные, списки блога, записи (без черновиков —
// их не отдаёт listPosts) и теги. Служебные on-demand (404, /now, /healthz, фиды, ключ IndexNow)
// в карту не попадают; адрес из redirects.yaml не может быть живым маршрутом (check:content),
// поэтому и его здесь нет. lastmod — только updatedDate записи.
async function entries(): Promise<SitemapEntry[]> {
  const paths: SitemapEntry[] = []
  for (const locale of SUPPORTED_LOCALES) {
    const posts = await listPosts(locale)
    const routes = [
      '/',
      ...Array.from({ length: pageCount(posts.length) }, (_, index) => blogRoute(index + 1)),
      ...(await listTags(locale)).map(tagRoute),
    ]
    paths.push(...routes.map((route) => ({ loc: localePath(locale, route) })))
    paths.push(
      ...posts.map((post) => ({
        loc: localePath(locale, postRoute(post.slug)),
        lastmod: post.data.updatedDate,
      })),
    )
  }
  return paths.map((entry) => ({ ...entry, loc: absoluteUrl(entry.loc) }))
}

export const GET: APIRoute = async () =>
  new Response(buildSitemap(await entries()), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Карта меняется релизом; без CDN час — про повторные обходы, не про свежесть.
      'cache-control': 'public, max-age=3600',
      // Сама карта — не страница выдачи.
      'x-robots-tag': 'noindex',
    },
  })
