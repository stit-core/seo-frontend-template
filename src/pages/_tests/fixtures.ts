import type { CollectionEntry, CollectionKey } from 'astro:content'
import type { Author } from '@/entities/author'
import type { PostData, PostEntry } from '@/entities/post'
import PostBody from './post-body.astro'

// Реестр авторов шаблона пуст — страницам с подписью нужен фикстурный: автор пары переводов (имя и
// роль по локалям) и автор без роли. Подменяет AUTHORS в `@/entities/author`.
export const AUTHORS: Record<string, Author> = {
  'anna-smirnova': {
    name: { ru: 'Анна Смирнова', en: 'Anna Smirnova' },
    jobTitle: { ru: 'редактор блога', en: 'blog editor' },
  },
  'petr-ivanov': { name: { ru: 'Пётр Иванов', en: 'Petr Ivanov' } },
}

// Коллекция для подмены astro:content в тестах маршрутов: пара переводов с автором, запись без
// перевода с updatedDate и автором без роли, черновик со своим тегом — сборка не видит ни
// черновик, ни его тег — и четыре заметки без автора, с которыми у русского блога две страницы
// списка, а у английского одна.
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
    author: 'anna-smirnova',
  }),
  entry('en/pair', {
    title: 'Post with a translation',
    pubDate: new Date('2026-03-02'),
    tags: ['seo'],
    translationKey: 'pair',
    author: 'anna-smirnova',
  }),
  entry('ru/odna', {
    title: 'Запись без перевода',
    pubDate: new Date('2026-02-01'),
    updatedDate: new Date('2026-02-10'),
    tags: ['astro'],
    translationKey: 'alone',
    author: 'petr-ivanov',
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

// Записи каждой коллекции сайта по имени: коллекция из content.config.ts без своей строки
// здесь (`/scaffold collection`) — ошибка typecheck, а не тихо пустой мок.
const COLLECTIONS: { [K in CollectionKey]: readonly CollectionEntry<K>[] } = { post: POSTS }

type Entry = CollectionEntry<CollectionKey>

// Модуль astro:content для vi.mock.
export const astroContent = {
  getCollection: (collection: CollectionKey, filter?: (entry: Entry) => unknown) => {
    const entries: readonly Entry[] = COLLECTIONS[collection]
    return Promise.resolve(filter ? entries.filter(filter) : entries)
  },
  getEntry: (collection: CollectionKey, id: string) => {
    const entries: readonly Entry[] = COLLECTIONS[collection]
    return Promise.resolve(entries.find((entry) => entry.id === id))
  },
  render: () => Promise.resolve({ Content: PostBody, headings: [] }),
}
