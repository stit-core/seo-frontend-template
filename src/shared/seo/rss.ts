import { getRssString } from '@astrojs/rss'
import type { Locale } from '@/shared/i18n'
import { absoluteUrl } from './urls'

export interface FeedItem {
  title: string
  description: string
  // Корневой путь записи (с префиксом локали).
  path: string
  pubDate: Date
  tags?: readonly string[] | undefined
}

export interface FeedOptions {
  title: string
  description: string
  language: Locale
  // Корневые пути главной локали и самого фида (atom:link rel="self").
  homePath: string
  feedPath: string
  // Новые сверху; в фид попадают первые FEED_ITEMS_LIMIT.
  items: readonly FeedItem[]
}

export const FEED_ITEMS_LIMIT = 20

// Анонс и ссылка, не полный текст: меньше дублирования и веса. Абсолютные URL — только через
// absoluteUrl (runtime origin); trailingSlash: false — как у сайта.
export function buildFeed({
  title,
  description,
  language,
  homePath,
  feedPath,
  items,
}: FeedOptions): Promise<string> {
  return getRssString({
    title,
    description,
    site: absoluteUrl(homePath),
    trailingSlash: false,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>${language}</language><atom:link href="${absoluteUrl(feedPath)}" rel="self" type="application/rss+xml"/>`,
    items: items.slice(0, FEED_ITEMS_LIMIT).map((item) => ({
      title: item.title,
      description: item.description,
      link: absoluteUrl(item.path),
      pubDate: item.pubDate,
      categories: [...(item.tags ?? [])],
    })),
  })
}
