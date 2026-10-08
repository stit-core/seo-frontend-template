import type * as AuthorSlice from '@/entities/author'
import { getPost, listPosts, type Post, paginate } from '@/entities/post'
import { type DictKey, t } from '@/shared/i18n'
import { blogPosting, breadcrumbList } from '@/shared/seo'
import { blogListPageModel, postPageModel, tagPageModel } from './sections'

vi.mock('astro:content', () =>
  import('../_tests/fixtures').then((fixtures) => fixtures.astroContent),
)
// Реестр авторов шаблона пуст: подпись и Person проверяются на фикстурных авторах.
vi.mock('@/entities/author', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthorSlice>()),
  AUTHORS: (await import('../_tests/fixtures')).AUTHORS,
}))

const ORIGIN = 'https://demo.example'

beforeEach(() => {
  vi.stubEnv('SITE_URL', ORIGIN)
  // Vitest работает в dev-режиме Vite; режим сборки, где черновиков нет, задаётся явно.
  vi.stubEnv('DEV', false)
})
afterEach(() => vi.unstubAllEnvs())

// Слова каркаса — из словаря: форк, переименовавший раздел, остаётся зелёным.
const ru = (key: DictKey) => t('ru', key)
const home = { name: ru('nav.home'), href: '/' }
const blog = { name: ru('blog.title'), href: '/blog' }
const page2 = `${ru('blog.page')} 2`

const post = async (locale: 'ru' | 'en', slug: string): Promise<Post> => {
  const found = await getPost(locale, slug)
  if (!found) throw new Error(`${locale}/${slug} нет в фикстурах`)
  return found
}

describe('страница записи', () => {
  it('перевод: ссылка на slug перевода, крошки локали, BlogPosting без правки и обложки', async () => {
    const para = await post('ru', 'para')
    const model = await postPageModel(para)
    const author = { id: 'anna-smirnova', name: 'Анна Смирнова', jobTitle: 'редактор блога' }
    expect(model.alternatePath).toBe('/blog/pair')
    expect(model.ogImage).toBeUndefined()
    expect(model.author).toEqual(author)
    expect(model.crumbs).toEqual([home, blog, { name: 'Запись с переводом' }])
    expect(model.jsonLd).toEqual([
      blogPosting({
        locale: 'ru',
        path: '/blog/para',
        title: 'Запись с переводом',
        description: 'Анонс записи ru/para.',
        published: new Date('2026-03-01'),
        author,
      }),
      breadcrumbList(model.crumbs),
    ])

    const pair = await postPageModel(await post('en', 'pair'))
    expect(pair.alternatePath).toBe('/blog/para')
    expect(pair.crumbs[1]).toEqual({ name: t('en', 'blog.title'), href: '/en/blog' })
  })

  it('автор: имя и роль — на языке страницы; без роли — только имя; без автора подписи нет', async () => {
    expect((await postPageModel(await post('en', 'pair'))).author).toEqual({
      id: 'anna-smirnova',
      name: 'Anna Smirnova',
      jobTitle: 'blog editor',
    })
    expect((await postPageModel(await post('ru', 'odna'))).author).toEqual({
      id: 'petr-ivanov',
      name: 'Пётр Иванов',
      jobTitle: undefined,
    })
    const plain = await postPageModel(await post('ru', 'zametka-1'))
    expect(plain.author).toBeUndefined()
    expect(plain.jsonLd[0]).toEqual(
      blogPosting({
        locale: 'ru',
        path: '/blog/zametka-1',
        title: 'Заметка 1',
        description: 'Анонс записи ru/zametka-1.',
        published: new Date('2026-01-01'),
      }),
    )
  })

  it('автор вне реестра — ошибка сборки, а не запись без подписи', async () => {
    const para = await post('ru', 'para')
    await expect(
      postPageModel({ ...para, data: { ...para.data, author: 'nikto' } }),
    ).rejects.toThrow('автора nikto записи ru/para нет в реестре')
  })

  it('правка без перевода: hreflang нет, dateModified и article:modified_time — из updatedDate', async () => {
    const model = await postPageModel(await post('ru', 'odna'))
    expect(model.alternatePath).toBeUndefined()
    expect(model.article).toEqual({
      published: new Date('2026-02-01'),
      modified: new Date('2026-02-10'),
    })
    expect(model.jsonLd[0]).toEqual(
      blogPosting({
        locale: 'ru',
        path: '/blog/odna',
        title: 'Запись без перевода',
        description: 'Анонс записи ru/odna.',
        published: new Date('2026-02-01'),
        updated: new Date('2026-02-10'),
        author: { id: 'petr-ivanov', name: 'Пётр Иванов' },
      }),
    )
  })

  it('обложка с alt — социальная карточка и image разметки', async () => {
    const para = await post('ru', 'para')
    const cover = { src: '/_astro/para.png', width: 1600, height: 900, format: 'png' as const }
    const model = await postPageModel({
      ...para,
      data: { ...para.data, cover, coverAlt: 'Обложка записи' },
    })
    expect(model.ogImage).toEqual({
      path: '/_astro/para.png',
      width: 1600,
      height: 900,
      alt: 'Обложка записи',
    })
    expect(model.jsonLd[0]).toHaveProperty('image', `${ORIGIN}/_astro/para.png`)
  })
})

describe('страница списка', () => {
  it('первая страница: ссылка на перевод, крошка без ссылки, только «дальше»', async () => {
    const model = await blogListPageModel('ru', paginate(await listPosts('ru'), 1))
    expect(model.alternatePath).toBe('/blog')
    expect(model.heading).toBe(ru('blog.title'))
    expect(model.title).toBe(ru('blog.pageTitle'))
    expect(model.description).toBe(ru('blog.description'))
    expect(model.crumbs).toEqual([home, { name: ru('blog.title') }])
    expect(model.tags).toEqual(['astro', 'seo'])
    expect(model.pagination).toEqual({
      current: 1,
      last: 2,
      newerHref: undefined,
      olderHref: '/blog/page/2',
    })
  })

  it('страница 2: своё имя в сниппете; у английского блога её нет — и ссылки на перевод нет', async () => {
    const model = await blogListPageModel('ru', paginate(await listPosts('ru'), 2))
    expect(model.alternatePath).toBeUndefined()
    expect(model.heading).toBe(`${ru('blog.title')} — ${page2}`)
    expect(model.title).toBe(`${ru('blog.pageTitle')} — ${page2}`)
    expect(model.description).toBe(`${ru('blog.description')} — ${page2}`)
    expect(model.crumbs).toEqual([home, blog, { name: page2 }])
    expect(model.pagination).toEqual({
      current: 2,
      last: 2,
      newerHref: '/blog',
      olderHref: undefined,
    })
  })

  it('английский список: перевод — русская первая страница', async () => {
    const model = await blogListPageModel('en', paginate(await listPosts('en'), 1))
    expect(model.alternatePath).toBe('/blog')
    expect(model.tags).toEqual(['seo'])
  })
})

describe('страница тега', () => {
  it('ссылка на перевод — только если в другой локали есть записи с тегом', async () => {
    expect((await tagPageModel('ru', 'seo')).alternatePath).toBe('/blog/tag/seo')
    expect((await tagPageModel('en', 'seo')).alternatePath).toBe('/blog/tag/seo')
    expect((await tagPageModel('ru', 'astro')).alternatePath).toBeUndefined()
  })

  it('заголовок, сниппет и крошки', async () => {
    const model = await tagPageModel('ru', 'astro')
    expect(model.heading).toBe(`${ru('blog.tagLead')} #astro`)
    expect(model.title).toBe(model.heading)
    expect(model.description).toBe(`${ru('blog.tagLead')} #astro — ${ru('blog.tagDescription')}`)
    expect(model.crumbs).toEqual([home, blog, { name: '#astro' }])
    expect(model.jsonLd).toEqual([breadcrumbList(model.crumbs)])
  })
})
