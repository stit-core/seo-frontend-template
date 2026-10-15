import type { Locale } from '@/shared/i18n'
import { testLocale } from '@/shared/lib/testing'
import type { Post, PostEntry } from './queries'

// Записи фикстур — на локалях теста (ru и en), а не на локалях сайта.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
const ru = testLocale('ru')
const en = testLocale('en')

const { fixtures } = vi.hoisted(() => {
  const entry = (id: string, data: Record<string, unknown>) =>
    ({
      id,
      collection: 'post',
      data: { tags: [], draft: false, ...data },
    }) as unknown as PostEntry
  return {
    fixtures: [
      entry('ru/staryj', {
        title: 'Старый',
        pubDate: new Date('2026-01-01'),
        tags: ['seo'],
        translationKey: 'old',
      }),
      entry('ru/novyj', {
        title: 'Новый',
        pubDate: new Date('2026-03-01'),
        tags: ['seo', 'astro'],
        translationKey: 'new',
      }),
      // Тег только у черновика: в сборке его нет ни в списке тегов, ни страницей.
      entry('ru/chernovik', {
        title: 'Черновик',
        pubDate: new Date('2026-04-01'),
        tags: ['draft-only'],
        draft: true,
        translationKey: 'draft',
      }),
      entry('ru/bez-perevoda', {
        title: 'Без перевода',
        pubDate: new Date('2026-02-01'),
        tags: ['astro'],
        translationKey: 'alone',
      }),
      entry('en/new-post', {
        title: 'New',
        pubDate: new Date('2026-03-02'),
        tags: ['seo'],
        translationKey: 'new',
      }),
      entry('en/draft-twin', {
        title: 'Draft twin',
        pubDate: new Date('2026-04-02'),
        draft: true,
        translationKey: 'draft',
      }),
    ],
  }
})

vi.mock('astro:content', () => ({
  getCollection: (_collection: string, filter?: (entry: PostEntry) => unknown) =>
    Promise.resolve(filter ? fixtures.filter(filter) : fixtures),
  getEntry: (_collection: string, id: string) =>
    Promise.resolve(fixtures.find((entry) => entry.id === id)),
  render: () => Promise.resolve({ Content: null, headings: [], remarkPluginFrontmatter: {} }),
}))

const { findTranslation, getPost, listByTag, listPosts, listTags, toPost } = await import(
  './queries'
)

const slugs = async (posts: Promise<Post[]>) => (await posts).map((post) => post.slug)
const found = async (locale: Locale, slug: string): Promise<Post> => {
  const post = await getPost(locale, slug)
  if (!post) throw new Error(`${locale}/${slug} не найден`)
  return post
}

// Vitest сам работает в dev-режиме Vite, поэтому режим сборки задаётся явно.
describe('post queries: сборка (import.meta.env.DEV = false)', () => {
  beforeEach(() => vi.stubEnv('DEV', false))
  afterEach(() => vi.unstubAllEnvs())

  it('listPosts: только опубликованные записи локали, новые сверху', async () => {
    expect(await slugs(listPosts(ru))).toEqual(['novyj', 'bez-perevoda', 'staryj'])
    expect((await listPosts(ru))[0]).toMatchObject({
      id: 'ru/novyj',
      locale: 'ru',
      slug: 'novyj',
    })
    expect(await slugs(listPosts(en))).toEqual(['new-post'])
  })

  it('getPost: черновик и чужая локаль — не найдены', async () => {
    expect((await found(ru, 'novyj')).data.title).toBe('Новый')
    expect(await getPost(ru, 'chernovik')).toBeUndefined()
    expect(await getPost(en, 'novyj')).toBeUndefined()
    expect(await getPost(ru, 'net-takogo')).toBeUndefined()
  })

  it('listByTag и listTags: без черновиков и их тегов, теги отсортированы и уникальны', async () => {
    expect(await slugs(listByTag(ru, 'astro'))).toEqual(['novyj', 'bez-perevoda'])
    expect(await listByTag(ru, 'draft-only')).toEqual([])
    expect(await listByTag(ru, 'nope')).toEqual([])
    expect(await listTags(ru)).toEqual(['astro', 'seo'])
    expect(await listTags(en)).toEqual(['seo'])
  })

  it('findTranslation: twin по translationKey, черновик-twin не считается', async () => {
    const novyj = await found(ru, 'novyj')
    expect((await findTranslation(novyj, en))?.slug).toBe('new-post')
    expect(await findTranslation(novyj, ru)).toBe(novyj)
    expect(await findTranslation(await found(ru, 'bez-perevoda'), en)).toBeUndefined()
  })
})

describe('post queries: astro dev (import.meta.env.DEV = true)', () => {
  beforeEach(() => vi.stubEnv('DEV', true))
  afterEach(() => vi.unstubAllEnvs())

  it('черновики видны в списках, по URL и в тегах; флаг draft остаётся для пометки', async () => {
    expect(await slugs(listPosts(ru))).toEqual(['chernovik', 'novyj', 'bez-perevoda', 'staryj'])
    const draft = await found(ru, 'chernovik')
    expect(draft.data.draft).toBe(true)
    expect(await listTags(ru)).toEqual(['astro', 'draft-only', 'seo'])
    expect(await slugs(listByTag(ru, 'draft-only'))).toEqual(['chernovik'])
    expect((await findTranslation(draft, en))?.slug).toBe('draft-twin')
  })
})

describe('toPost', () => {
  it('id обязан быть <locale>/<slug>', () => {
    const bad = (id: string) => ({ id, collection: 'post', data: {} }) as unknown as PostEntry
    expect(() => toPost(bad('xx/foo'))).toThrow()
    expect(() => toPost(bad('ru/a/b'))).toThrow()
    expect(() => toPost(bad('foo'))).toThrow()
  })
})
