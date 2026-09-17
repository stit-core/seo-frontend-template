import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import type { Post } from '../api/queries'
import PostCard from './post-card.astro'

const post: Post = {
  id: 'ru/chestnye-404-i-410',
  locale: 'ru',
  slug: 'chestnye-404-i-410',
  data: {
    title: 'Честные 404 и 410 вместо soft-404',
    description:
      'Несуществующий адрес отвечает 404, удалённый навсегда — 410, и оба без meta refresh.',
    pubDate: new Date('2026-07-14'),
    tags: ['seo', 'astro'],
    draft: false,
    translationKey: 'honest-404-410',
  },
}

describe('PostCard', () => {
  it('рендерит заголовок-ссылку, дату и теги; пометки черновика нет', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(PostCard, { props: { post } })
    expect(html).toContain('<article')
    expect(html).toContain('href="/blog/chestnye-404-i-410"')
    expect(html).toMatch(/<h2[^>]*>.*Честные 404 и 410/s)
    expect(html).toContain('datetime="2026-07-14"')
    expect(html).toContain('14 июля 2026')
    expect(html).toContain('href="/blog/tag/seo"')
    expect(html).toContain('href="/blog/tag/astro"')
    expect(html).not.toContain('Черновик')
    expect(html).not.toContain('<script')
  })

  it('черновик (astro dev) помечен', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(PostCard, {
      props: { post: { ...post, data: { ...post.data, draft: true } } },
    })
    expect(html).toContain('Черновик')
  })

  it('английская запись ссылается под /en', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(PostCard, {
      props: {
        post: { ...post, id: 'en/honest-404-and-410', locale: 'en', slug: 'honest-404-and-410' },
      },
    })
    expect(html).toContain('href="/en/blog/honest-404-and-410"')
    expect(html).toContain('href="/en/blog/tag/seo"')
    expect(html).toContain('14 July 2026')
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    await expectNoA11yViolations(await container.renderToString(PostCard, { props: { post } }))
  })
})
