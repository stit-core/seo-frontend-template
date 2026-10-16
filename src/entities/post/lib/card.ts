import type { Post } from '../api/queries'
import { postPath } from './paths'

// Запись карточкой списка: заголовок, дата публикации, адрес записи и анонс.
export function postCard({ locale, slug, data }: Post) {
  return {
    title: data.title,
    date: data.pubDate,
    link: { href: postPath(locale, slug) },
    excerpt: data.description,
  }
}
