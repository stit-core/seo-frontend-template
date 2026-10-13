import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import { SLOT_SIZES } from '@/shared/ui/section'
import type { Post } from '../api/queries'
import PostArticle from './post-article.astro'

const post: Post = {
  id: 'ru/odin-obraz-na-vse-sredy',
  locale: 'ru',
  slug: 'odin-obraz-na-vse-sredy',
  data: {
    title: 'Один Docker-образ на все среды',
    description:
      'Сборка не знает адреса сайта: в HTML печётся плейсхолдер, а entrypoint штампует реальный SITE_URL.',
    pubDate: new Date('2026-09-08'),
    updatedDate: new Date('2026-09-10'),
    tags: ['deploy'],
    draft: false,
    translationKey: 'one-image-all-envs',
  },
}

describe('PostArticle', () => {
  it('рендерит один h1, обе даты и слот с телом; пометки черновика нет', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(PostArticle, {
      props: { post },
      slots: { default: '<h2>Раздел</h2><p>Тело записи.</p>' },
    })
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).toContain('Один Docker-образ на все среды')
    expect(html).toContain('datetime="2026-09-08"')
    expect(html).toContain('datetime="2026-09-10"')
    expect(html).toContain('обновлено')
    const paragraphs = [...parseHtml(html).querySelectorAll('article p')]
    expect(paragraphs.map((paragraph) => paragraph.textContent)).toContain('Тело записи.')
    expect(html).toContain('href="/blog/tag/deploy"')
    expect(html).not.toContain('Черновик')
  })

  it('подпись автора — слот шапки статьи: над датами, а без него шапка без подписи', async () => {
    const container = await AstroContainer.create()
    const signed = await container.renderToString(PostArticle, {
      props: { post },
      slots: { byline: '<p>Автор — Анна Смирнова</p>', default: '<p>Тело записи.</p>' },
    })
    const header = parseHtml(signed).querySelector('article header')
    const lines = [...(header?.querySelectorAll('p') ?? [])].map((line) => line.textContent)
    expect(lines.indexOf('Автор — Анна Смирнова')).toBe(1)
    expect(lines).toHaveLength(3)

    const plain = await container.renderToString(PostArticle, { props: { post } })
    expect(parseHtml(plain).querySelectorAll('article header p')).toHaveLength(2)
  })

  it('без updatedDate второй даты нет', async () => {
    const container = await AstroContainer.create()
    const { updatedDate: _omit, ...data } = post.data
    const html = await container.renderToString(PostArticle, { props: { post: { ...post, data } } })
    expect(html).not.toContain('обновлено')
    expect(html.match(/<time[\s>]/g)).toHaveLength(1)
  })

  // seo:check узнаёт кандидата в LCP по месту — картинка над h1; место и загрузку обложки держит
  // этот тест: под заголовком и с lazy она прошла бы гейт.
  it('обложка — кандидат в LCP: над h1, грузится сразу и с приоритетом, размеры заданы', async () => {
    const container = await AstroContainer.create()
    const cover = { src: '/_astro/cover.png', width: 1600, height: 900, format: 'png' as const }
    const html = await container.renderToString(PostArticle, {
      props: { post: { ...post, data: { ...post.data, cover, coverAlt: 'Обложка записи' } } },
    })
    const img = /<img\b[^>]*>/.exec(html)
    expect(img?.index).toBeLessThan(html.search(/<h1[\s>]/))
    expect(img?.[0]).toContain('fetchpriority="high"')
    expect(img?.[0]).not.toContain('loading="lazy"')
    expect(img?.[0]).toMatch(/\swidth="\d+"/)
    expect(img?.[0]).toMatch(/\sheight="\d+"/)
  })

  // Файл обложки браузер выбирает до раскладки — по `sizes`: шире слота — лишние байты LCP.
  it('файлы обложки — по слоту колонки чтения записи', async () => {
    const container = await AstroContainer.create()
    const cover = { src: '/_astro/cover.png', width: 1600, height: 900, format: 'png' as const }
    const html = await container.renderToString(PostArticle, {
      props: { post: { ...post, data: { ...post.data, cover, coverAlt: 'Обложка записи' } } },
    })
    const candidates = [...parseHtml(html).querySelectorAll('picture source, picture img')]
    expect(candidates.length).toBeGreaterThan(1)
    for (const element of candidates) expect(element.getAttribute('sizes')).toBe(SLOT_SIZES.reading)
  })

  it('черновик (astro dev) помечен', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(PostArticle, {
      props: { post: { ...post, locale: 'en', data: { ...post.data, draft: true } } },
    })
    expect(html).toContain('Draft')
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    await expectNoA11yViolations(
      await container.renderToString(PostArticle, {
        props: { post },
        slots: { default: '<p>Тело.</p>' },
      }),
    )
  })
})
