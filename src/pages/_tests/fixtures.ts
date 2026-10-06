import type { PostData, PostEntry } from '@/entities/post'
import PostBody from './post-body.astro'

// Коллекция для подмены astro:content в тестах маршрутов: пара переводов, запись без перевода
// с updatedDate, черновик со своим тегом — сборка не видит ни черновик, ни его тег — и четыре
// заметки, с которыми у русского блога две страницы списка, а у английского одна.
const entry = (id: string, data: Partial<PostData>): PostEntry =>
  ({
    id,
    collection: 'post',
    data: { description: `Анонс записи ${id}.`, tags: [], draft: false, ...data },
  }) as unknown as PostEntry

export const POSTS: readonly PostEntry[] = [
  entry('ru/para', {
    title: 'Запись с переводом',
    pubDate: new Date('2026-03-01'),
    tags: ['seo'],
    translationKey: 'pair',
  }),
  entry('en/pair', {
    title: 'Post with a translation',
    pubDate: new Date('2026-03-02'),
    tags: ['seo'],
    translationKey: 'pair',
  }),
  entry('ru/odna', {
    title: 'Запись без перевода',
    pubDate: new Date('2026-02-01'),
    updatedDate: new Date('2026-02-10'),
    tags: ['astro'],
    translationKey: 'alone',
  }),
  entry('ru/chernovik', {
    title: 'Черновик',
    pubDate: new Date('2026-04-01'),
    tags: ['draft-only'],
    draft: true,
    translationKey: 'draft',
  }),
  ...[1, 2, 3, 4].map((n) =>
    entry(`ru/zametka-${n}`, {
      title: `Заметка ${n}`,
      pubDate: new Date(`2026-01-0${n}`),
      translationKey: `zametka-${n}`,
    }),
  ),
]

// Модуль astro:content для vi.mock.
export const astroContent = {
  getCollection: (_collection: string, filter?: (entry: PostEntry) => unknown) =>
    Promise.resolve(filter ? POSTS.filter(filter) : POSTS),
  getEntry: (_collection: string, id: string) =>
    Promise.resolve(POSTS.find((post) => post.id === id)),
  render: () => Promise.resolve({ Content: PostBody, headings: [] }),
}
