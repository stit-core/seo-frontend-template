import type * as AuthorSlice from '@/entities/author'
import { getPost, listPosts, type Post, paginate } from '@/entities/post'
import { type Locale, t } from '@/shared/i18n'
import { testLocale } from '@/shared/lib/testing'
import { blogPosting } from '@/shared/seo'
import { articleImagesOf, ogImageOf } from './images'
import { blogListPageModel, postPageModel, tagPageModel } from './models'

vi.mock('astro:content', () =>
  import('../_tests/fixtures').then((fixtures) => fixtures.astroContent),
)
// Реестр авторов шаблона пуст: подпись и Person проверяются на фикстурных авторах.
vi.mock('@/entities/author', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthorSlice>()),
  AUTHORS: (await import('../_tests/fixtures')).AUTHORS,
}))
// Записи фикстур — на ru и en: блог судится на локалях и карте теста, а не сайта.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
// Правило «связанных» — карты теста; тест подменяет его признак связи.
const related = vi.hoisted(() => ({ by: undefined as string | undefined }))
vi.mock('@/shared/strategy', async (importOriginal) => {
  const strategy = await (await import('@/shared/lib/testing')).withTestSite(importOriginal)
  return {
    ...strategy,
    relatedOf: (id: string) => ({
      ...strategy.relatedOf(id),
      by: related.by ?? strategy.relatedOf(id).by,
    }),
  }
})
const RU = testLocale('ru')
const EN = testLocale('en')

const ORIGIN = 'https://demo.example'

beforeEach(() => {
  vi.stubEnv('SITE_URL', ORIGIN)
  // Vitest работает в dev-режиме Vite; режим сборки, где черновиков нет, задаётся явно.
  vi.stubEnv('DEV', false)
})
afterEach(() => vi.unstubAllEnvs())

const post = async (locale: Locale, slug: string): Promise<Post> => {
  const found = await getPost(locale, slug)
  if (!found) throw new Error(`${locale}/${slug} нет в фикстурах`)
  return found
}

describe('страница записи', () => {
  it('перевод: ссылка на slug перевода; слоты записи — её поля; BlogPosting без правки и обложки', async () => {
    const para = await post(RU, 'para')
    const model = await postPageModel(para)
    expect(model.translations).toEqual({ ru: '/blog/para', en: '/en/blog/pair' })
    expect(model.ogImage).toBeUndefined()
    expect(model.record).toEqual({
      title: 'Запись с переводом',
      lead: 'Анонс записи ru/para.',
      date: { published: new Date('2026-03-01'), updated: undefined },
      author: {
        name: 'Анна Смирнова',
        jobTitle: 'редактор блога',
        profile: '/avtory/anna-smirnova',
      },
      cover: undefined,
      alt: undefined,
    })
    expect(model.tags).toEqual([{ label: '#seo', href: '/blog/tag/seo' }])
    expect(model.jsonLd).toEqual([
      blogPosting({
        locale: RU,
        path: '/blog/para',
        title: 'Запись с переводом',
        description: 'Анонс записи ru/para.',
        published: new Date('2026-03-01'),
        author: { id: 'anna-smirnova', name: 'Анна Смирнова', jobTitle: 'редактор блога' },
      }),
    ])

    const pair = await postPageModel(await post(EN, 'pair'))
    expect(pair.translations).toEqual({ ru: '/blog/para', en: '/en/blog/pair' })
    expect(pair.tags).toEqual([{ label: '#seo', href: '/en/blog/tag/seo' }])
  })

  it('автор: имя и роль — на языке страницы, профиль — из реестра; без роли — только имя; без автора подписи нет', async () => {
    expect((await postPageModel(await post(EN, 'pair'))).record.author).toEqual({
      name: 'Anna Smirnova',
      jobTitle: 'blog editor',
      profile: '/avtory/anna-smirnova',
    })
    expect((await postPageModel(await post(RU, 'odna'))).record.author).toEqual({
      name: 'Пётр Иванов',
      jobTitle: undefined,
      profile: 'https://petr-ivanov.example',
    })
    const plain = await postPageModel(await post(RU, 'zametka-1'))
    expect(plain.record.author).toBeUndefined()
    expect(plain.jsonLd[0]).toEqual(
      blogPosting({
        locale: RU,
        path: '/blog/zametka-1',
        title: 'Заметка 1',
        description: 'Анонс записи ru/zametka-1.',
        published: new Date('2026-01-01'),
      }),
    )
  })

  it('автор вне реестра — ошибка сборки, а не запись без подписи', async () => {
    const para = await post(RU, 'para')
    await expect(
      postPageModel({ ...para, data: { ...para.data, author: 'nikto' } }),
    ).rejects.toThrow('автора nikto записи ru/para нет в реестре')
  })

  it('правка без перевода: hreflang нет, дата правки — в слоте записи, dateModified и article:modified_time', async () => {
    const model = await postPageModel(await post(RU, 'odna'))
    expect(model.translations).toEqual({ ru: '/blog/odna' })
    expect(model.record.date).toEqual({
      published: new Date('2026-02-01'),
      updated: new Date('2026-02-10'),
    })
    expect(model.article).toEqual({
      published: new Date('2026-02-01'),
      modified: new Date('2026-02-10'),
    })
    expect(model.jsonLd[0]).toEqual(
      blogPosting({
        locale: RU,
        path: '/blog/odna',
        title: 'Запись без перевода',
        description: 'Анонс записи ru/odna.',
        published: new Date('2026-02-01'),
        updated: new Date('2026-02-10'),
        author: { id: 'petr-ivanov', name: 'Пётр Иванов' },
      }),
    )
  })

  it('обложка с alt — превью ссылки и кадры разметки из неё', async () => {
    const para = await post(RU, 'para')
    const cover = { src: '/_astro/para.png', width: 1600, height: 900, format: 'png' as const }
    const model = await postPageModel({
      ...para,
      data: { ...para.data, cover, coverAlt: 'Обложка записи' },
    })
    expect(model.ogImage).toEqual(await ogImageOf(cover, 'Обложка записи'))
    expect(model.record).toMatchObject({ cover, alt: 'Обложка записи' })
    const frames = (await articleImagesOf(cover)).map(({ path }) => path)
    expect(model.jsonLd[0]).toEqual(
      blogPosting({
        locale: RU,
        path: '/blog/para',
        title: 'Запись с переводом',
        description: 'Анонс записи ru/para.',
        published: new Date('2026-03-01'),
        imagePaths: frames,
        author: { id: 'anna-smirnova', name: 'Анна Смирнова', jobTitle: 'редактор блога' },
      }),
    )
  })
})

// Связанные — правило карты post-tags теста: записи той же локали с общим тегом, новые первыми, не больше трёх.
describe('связанные записи', () => {
  afterEach(() => {
    related.by = undefined
  })

  const relatedOf = async (locale: Locale, slug: string) =>
    (await postPageModel(await post(locale, slug))).related

  it('записи с общим тегом той же локали, новые первыми; своей записи и черновика нет', async () => {
    expect(await relatedOf(RU, 'para')).toEqual([
      { title: 'Заметка 2', link: { href: '/blog/zametka-2' } },
      { title: 'Заметка 1', link: { href: '/blog/zametka-1' } },
    ])
    // Английская запись — связанные из английских записей, адреса — с префиксом языка.
    expect(await relatedOf(EN, 'pair')).toEqual([
      { title: 'Note 2', link: { href: '/en/blog/note-2' } },
      { title: 'Note 1', link: { href: '/en/blog/note-1' } },
    ])
  })

  it('не больше максимума правила; нет записей с общим тегом — пусто', async () => {
    expect((await relatedOf(RU, 'zametka-2')).map(({ title }) => title)).toEqual([
      'Запись с переводом',
      'Заметка 4',
      'Заметка 3',
    ])
    expect(await relatedOf(RU, 'odna')).toEqual([])
  })

  it('связь не по общему тегу — ошибка сборки, а не чужая выборка', async () => {
    related.by = 'same-category'
    await expect(postPageModel(await post(RU, 'para'))).rejects.toThrow(
      'post: связанные по same-category — записи связывает общий тег',
    )
  })
})

describe('страница списка', () => {
  it('первая страница: ссылка на перевод, тексты как есть, записи страницы карточками, только «дальше»', async () => {
    const model = await blogListPageModel(RU, paginate(await listPosts(RU), 1))
    expect(model.translations).toEqual({ ru: '/blog', en: '/en/blog' })
    expect(model.paged('Заметки студии')).toBe('Заметки студии')
    expect(model.articles.map(({ link }) => link.href)).toEqual([
      '/blog/para',
      '/blog/odna',
      '/blog/zametka-4',
      '/blog/zametka-3',
      '/blog/zametka-2',
    ])
    expect(model.articles[0]).toEqual({
      title: 'Запись с переводом',
      date: new Date('2026-03-01'),
      link: { href: '/blog/para' },
      excerpt: 'Анонс записи ru/para.',
    })
    expect(model.pagination).toEqual({
      current: 1,
      last: 2,
      newer: undefined,
      older: '/blog/page/2',
    })
  })

  it('страница 2: номер страницы в h1 и сниппете; у английского блога её нет — и ссылки на перевод нет', async () => {
    const model = await blogListPageModel(RU, paginate(await listPosts(RU), 2))
    expect(model.translations).toEqual({ ru: '/blog/page/2' })
    expect(model.paged('Заметки студии')).toBe(
      t(RU, 'blog.paged', { text: 'Заметки студии', page: 2 }),
    )
    expect(model.paged('Заметки студии')).toContain('2')
    expect(model.articles.map(({ link }) => link.href)).toEqual(['/blog/zametka-1'])
    expect(model.pagination).toEqual({
      current: 2,
      last: 2,
      newer: '/blog',
      older: undefined,
    })
  })

  it('английский список: перевод — русская первая страница', async () => {
    const model = await blogListPageModel(EN, paginate(await listPosts(EN), 1))
    expect(model.translations).toEqual({ ru: '/blog', en: '/en/blog' })
  })
})

describe('страница тега', () => {
  // Порог — три опубликованные записи локали: ниже страница тега почти повторяет список.
  it('индексируется от трёх записей локали, ниже порога — noindex; черновик не в счёт', async () => {
    expect((await tagPageModel(RU, 'seo')).noindex).toBe(false)
    expect((await tagPageModel(EN, 'seo')).noindex).toBe(false)
    expect((await tagPageModel(RU, 'i18n')).noindex).toBe(false)
    expect((await tagPageModel(EN, 'i18n')).noindex).toBe(true)
    expect((await tagPageModel(RU, 'astro')).noindex).toBe(true)
    // Две записи и черновик с тем же тегом.
    expect((await tagPageModel(RU, 'almost')).noindex).toBe(true)
  })

  it('перевод — только страница тега другой локали от порога', async () => {
    const seo = { ru: '/blog/tag/seo', en: '/en/blog/tag/seo' }
    expect((await tagPageModel(RU, 'seo')).translations).toEqual(seo)
    expect((await tagPageModel(EN, 'seo')).translations).toEqual(seo)
    // Английская страница тега — тонкая: русской ссылаться не на что; обратная ссылка есть.
    expect((await tagPageModel(RU, 'i18n')).translations).toEqual({ ru: '/blog/tag/i18n' })
    expect((await tagPageModel(EN, 'i18n')).translations).toEqual({
      ru: '/blog/tag/i18n',
      en: '/en/blog/tag/i18n',
    })
    expect((await tagPageModel(RU, 'astro')).translations).toEqual({ ru: '/blog/tag/astro' })
  })

  it('подпись и вводный абзац тега — заголовок и описание страницы; текущая крошка — тег', async () => {
    const model = await tagPageModel(RU, 'astro')
    expect(model.title).toBe(t(RU, 'blog.tag', { tag: 'astro' }))
    expect(model.description).toBe(t(RU, 'blog.tagDescription', { tag: 'astro' }))
    expect([model.title, model.description].every((text) => text.includes('astro'))).toBe(true)
    expect(model.current).toBe('#astro')
  })
})
