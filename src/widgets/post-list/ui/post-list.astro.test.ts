import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { Post } from '@/entities/post'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import PostList from './post-list.astro'

const post = (slug: string, title: string): Post => ({
  id: `ru/${slug}`,
  locale: 'ru',
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
        locale: 'ru',
        posts: [post('a', 'Первая запись про статику'), post('b', 'Вторая запись про статику')],
        pagination: { current: 2, last: 3, newerHref: '/blog', olderHref: '/blog/page/3' },
      },
    })
    expect(html.match(/<article/g)).toHaveLength(2)
    expect(html).toContain('href="/blog" rel="prev"')
    expect(html).toContain('href="/blog/page/3" rel="next"')
    expect(html).toContain('2 / 3')
  })

  it('на единственной странице пагинации нет, пустой список — текст-заглушка', async () => {
    const container = await AstroContainer.create()
    const single = await container.renderToString(PostList, {
      props: {
        locale: 'ru',
        posts: [post('a', 'Единственная запись')],
        pagination: { current: 1, last: 1 },
      },
    })
    expect(single).not.toContain('<nav')
    const empty = await container.renderToString(PostList, { props: { locale: 'en', posts: [] } })
    expect(empty).toContain('No posts yet.')
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    await expectNoA11yViolations(
      await container.renderToString(PostList, {
        props: {
          locale: 'ru',
          posts: [post('a', 'Первая запись про статику')],
          pagination: { current: 1, last: 2, olderHref: '/blog/page/2' },
        },
      }),
    )
  })
})
