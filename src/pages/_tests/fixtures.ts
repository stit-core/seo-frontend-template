import type { PostData, PostEntry } from '@/entities/post'

// Коллекция для подмены astro:content в тестах маршрутов: пара переводов, запись без перевода
// с updatedDate и черновик со своим тегом — сборка не видит ни черновик, ни его тег.
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
]

// Модуль astro:content для vi.mock.
export const astroContent = {
  getCollection: (_collection: string, filter?: (entry: PostEntry) => unknown) =>
    Promise.resolve(filter ? POSTS.filter(filter) : POSTS),
  getEntry: (_collection: string, id: string) =>
    Promise.resolve(POSTS.find((post) => post.id === id)),
}
