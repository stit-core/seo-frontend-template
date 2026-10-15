import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { Post } from '@/entities/post'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import PostList from './post-list.astro'

const post = (slug: string, title: string): Post => ({
  id: `ru/${slug}`,
  locale: DEFAULT_LOCALE,
  slug,
  data: {
    title,
    description: 'Описание записи длиной, достаточной для бюджета выдачи и для карточки в списке.',
    pubDate: new Date('2026-07-14'),
    tags: ['seo'],
    draft: false,
    translationKey: slug,
  },
})

describe('PostList', () => {
  it('рендерит карточки и ссылки пагинации', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(PostList, {
      props: {
        locale: DEFAULT_LOCALE,
        posts: [post('a', 'Первая запись про статику'), post('b', 'Вторая запись про статику')],
        pagination: { current: 2, last: 3, newerHref: '/blog', olderHref: '/blog/page/3' },
      },
    })
    const doc = parseHtml(html)
    expect(doc.querySelectorAll('article')).toHaveLength(2)
    expect(doc.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe('/blog')
    expect(doc.querySelector('a[rel="next"]')?.getAttribute('href')).toBe('/blog/page/3')
    expect(html).toContain('2 / 3')
  })

  it('на единственной странице пагинации нет, пустой список — текст-заглушка', async () => {
    const container = await AstroContainer.create()
    const single = await container.renderToString(PostList, {
      props: {
        locale: DEFAULT_LOCALE,
        posts: [post('a', 'Единственная запись')],
        pagination: { current: 1, last: 1 },
      },
    })
    expect(single).not.toContain('<nav')
    for (const locale of SUPPORTED_LOCALES) {
      const empty = await container.renderToString(PostList, { props: { locale, posts: [] } })
      expect(empty, locale).toContain(t(locale, 'blog.empty'))
    }
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    await expectNoA11yViolations(
      await container.renderToString(PostList, {
        props: {
          locale: DEFAULT_LOCALE,
          posts: [post('a', 'Первая запись про статику')],
          pagination: { current: 1, last: 2, olderHref: '/blog/page/2' },
        },
      }),
    )
  })
})
