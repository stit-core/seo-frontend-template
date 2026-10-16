import { DEFAULT_LOCALE, localePath } from '@/shared/i18n'
import type { Post } from '../api/queries'
import { postCard } from './card'

const post: Post = {
  id: `${DEFAULT_LOCALE}/odin-obraz`,
  locale: DEFAULT_LOCALE,
  slug: 'odin-obraz',
  data: {
    title: 'Один Docker-образ на все среды',
    description:
      'Сборка печёт плейсхолдер адреса, а контейнер при старте штампует реальный адрес сайта.',
    pubDate: new Date('2026-09-08'),
    updatedDate: new Date('2026-09-10'),
    tags: ['deploy'],
    draft: false,
    translationKey: 'one-image',
  },
}

describe('postCard', () => {
  it('карточка записи — заголовок, дата публикации, адрес записи на её языке и анонс', () => {
    expect(postCard(post)).toEqual({
      title: 'Один Docker-образ на все среды',
      date: new Date('2026-09-08'),
      link: { href: localePath(DEFAULT_LOCALE, '/blog/odin-obraz') },
      excerpt: post.data.description,
    })
  })
})
