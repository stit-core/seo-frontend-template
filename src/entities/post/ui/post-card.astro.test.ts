import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { formatDate, localePath, SUPPORTED_LOCALES } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
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

  it('запись ссылается под префиксом своей локали, дата — в её формате', async () => {
    const container = await AstroContainer.create()
    for (const locale of SUPPORTED_LOCALES) {
      const html = await container.renderToString(PostCard, {
        props: { post: { ...post, id: `${locale}/${post.slug}`, locale } },
      })
      expect(html, locale).toContain(`href="${localePath(locale, `/blog/${post.slug}`)}"`)
      expect(html, locale).toContain(`href="${localePath(locale, '/blog/tag/seo')}"`)
      expect(html, locale).toContain(formatDate(locale, post.data.pubDate))
    }
  })

  it('миниатюра обложки — слот 160×90: размеры заданы, файлы — по плотности экрана до 2x', async () => {
    const container = await AstroContainer.create()
    const cover = { src: '/_astro/cover.png', width: 1600, height: 900, format: 'png' as const }
    const html = await container.renderToString(PostCard, {
      props: { post: { ...post, data: { ...post.data, cover, coverAlt: 'Обложка' } } },
    })
    const doc = parseHtml(html)
    const img = doc.querySelector('img')
    expect([img?.getAttribute('width'), img?.getAttribute('height')]).toEqual(['160', '90'])
    expect(img?.getAttribute('loading')).toBe('lazy')
    // Без размеров Picture отдал бы исходные 1600 px в слот шириной 160; слоту постоянной ширины
    // нужны плотности экрана, а не ширины окна.
    const descriptors = [...doc.querySelectorAll('source, img')].flatMap((element) =>
      (element.getAttribute('srcset') ?? '')
        .split(', ')
        .map((candidate) => candidate.split(' ')[1] ?? '1x'),
    )
    expect(new Set(descriptors)).toEqual(new Set(['1x', '2x']))
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    await expectNoA11yViolations(await container.renderToString(PostCard, { props: { post } }))
  })
})
