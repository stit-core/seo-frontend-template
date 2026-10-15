import type * as AuthorSlice from '@/entities/author'
import { getPost, listPosts, type Post, paginate } from '@/entities/post'
import { type DictKey, type Locale, t } from '@/shared/i18n'
import { testLocale } from '@/shared/lib/testing'
import { blogPosting, breadcrumbList } from '@/shared/seo'
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
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)
const RU = testLocale('ru')
const EN = testLocale('en')

const ORIGIN = 'https://demo.example'

beforeEach(() => {
  vi.stubEnv('SITE_URL', ORIGIN)
  // Vitest работает в dev-режиме Vite; режим сборки, где черновиков нет, задаётся явно.
  vi.stubEnv('DEV', false)
})
afterEach(() => vi.unstubAllEnvs())

// Слова каркаса — из словаря: форк, переименовавший раздел, остаётся зелёным.
const ru = (key: DictKey) => t(RU, key)
const home = { name: ru('nav.home'), href: '/' }
const blog = { name: ru('blog.title'), href: '/blog' }
const page2 = t(RU, 'blog.page', { page: 2 })
const paged = (key: DictKey) => t(RU, 'blog.paged', { text: ru(key), page: 2 })

const post = async (locale: Locale, slug: string): Promise<Post> => {
  const found = await getPost(locale, slug)
  if (!found) throw new Error(`${locale}/${slug} нет в фикстурах`)
  return found
}

describe('страница записи', () => {
  it('перевод: ссылка на slug перевода, крошки локали, BlogPosting без правки и обложки', async () => {
    const para = await post(RU, 'para')
    const model = await postPageModel(para)
    const author = { id: 'anna-smirnova', name: 'Анна Смирнова', jobTitle: 'редактор блога' }
    expect(model.translations).toEqual({ ru: '/blog/para', en: '/en/blog/pair' })
    expect(model.ogImage).toBeUndefined()
    expect(model.author).toEqual(author)
    expect(model.crumbs).toEqual([home, blog, { name: 'Запись с переводом' }])
    expect(model.jsonLd).toEqual([
      blogPosting({
        locale: RU,
        path: '/blog/para',
        title: 'Запись с переводом',
        description: 'Анонс записи ru/para.',
        published: new Date('2026-03-01'),
        author,
      }),
      breadcrumbList(model.crumbs),
    ])

    const pair = await postPageModel(await post(EN, 'pair'))
    expect(pair.translations).toEqual({ ru: '/blog/para', en: '/en/blog/pair' })
    expect(pair.crumbs[1]).toEqual({ name: t(EN, 'blog.title'), href: '/en/blog' })
  })

  it('автор: имя и роль — на языке страницы; без роли — только имя; без автора подписи нет', async () => {
    expect((await postPageModel(await post(EN, 'pair'))).author).toEqual({
      id: 'anna-smirnova',
      name: 'Anna Smirnova',
      jobTitle: 'blog editor',
    })
    expect((await postPageModel(await post(RU, 'odna'))).author).toEqual({
      id: 'petr-ivanov',
      name: 'Пётр Иванов',
      jobTitle: undefined,
    })
    const plain = await postPageModel(await post(RU, 'zametka-1'))
    expect(plain.author).toBeUndefined()
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

  it('правка без перевода: hreflang нет, dateModified и article:modified_time — из updatedDate', async () => {
    const model = await postPageModel(await post(RU, 'odna'))
    expect(model.translations).toEqual({ ru: '/blog/odna' })
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

describe('страница списка', () => {
  it('первая страница: ссылка на перевод, крошка без ссылки, только «дальше»', async () => {
    const model = await blogListPageModel(RU, paginate(await listPosts(RU), 1))
    expect(model.translations).toEqual({ ru: '/blog', en: '/en/blog' })
    expect(model.heading).toBe(ru('blog.title'))
    expect(model.title).toBe(ru('blog.pageTitle'))
    expect(model.description).toBe(ru('blog.description'))
    expect(model.crumbs).toEqual([home, { name: ru('blog.title') }])
    expect(model.tags).toEqual(['almost', 'astro', 'i18n', 'seo'])
    expect(model.pagination).toEqual({
      current: 1,
      last: 2,
      newerHref: undefined,
      olderHref: '/blog/page/2',
    })
  })

  it('страница 2: своё имя в сниппете; у английского блога её нет — и ссылки на перевод нет', async () => {
    const model = await blogListPageModel(RU, paginate(await listPosts(RU), 2))
    expect(model.translations).toEqual({ ru: '/blog/page/2' })
    expect(model.heading).toBe(paged('blog.title'))
    expect(model.title).toBe(paged('blog.pageTitle'))
    expect(model.description).toBe(paged('blog.description'))
    expect(model.heading).toContain('2')
    expect(model.crumbs).toEqual([home, blog, { name: page2 }])
    expect(model.pagination).toEqual({
      current: 2,
      last: 2,
      newerHref: '/blog',
      olderHref: undefined,
    })
  })

  it('английский список: перевод — русская первая страница', async () => {
    const model = await blogListPageModel(EN, paginate(await listPosts(EN), 1))
    expect(model.translations).toEqual({ ru: '/blog', en: '/en/blog' })
    expect(model.tags).toEqual(['i18n', 'seo'])
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

  it('заголовок, сниппет и крошки', async () => {
    const model = await tagPageModel(RU, 'astro')
    expect(model.heading).toBe(t(RU, 'blog.tag', { tag: 'astro' }))
    expect(model.title).toBe(model.heading)
    expect(model.description).toBe(t(RU, 'blog.tagDescription', { tag: 'astro' }))
    expect([model.heading, model.description].every((text) => text.includes('astro'))).toBe(true)
    expect(model.crumbs).toEqual([home, blog, { name: '#astro' }])
    expect(model.jsonLd).toEqual([breadcrumbList(model.crumbs)])
  })
})
