import { buildFeed, FEED_ITEMS_LIMIT } from './rss'

const item = (index: number) => ({
  title: `Запись ${index}`,
  description: `Описание записи ${index}`,
  path: `/blog/post-${index}`,
  pubDate: new Date(Date.UTC(2026, 8, 30 - index)),
  tags: ['seo'],
})

describe('seo/rss', () => {
  beforeEach(() => vi.stubEnv('SITE_URL', 'https://demo.example'))
  afterEach(() => vi.unstubAllEnvs())

  it('RSS 2.0 с self-ссылкой, языком и абсолютными постоянными ссылками записей', async () => {
    const xml = await buildFeed({
      title: 'Блог — demo',
      description: 'Заметки',
      language: 'ru',
      homePath: '/',
      feedPath: '/rss.xml',
      items: [item(0)],
    })
    expect(xml).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">')
    expect(xml).toContain('<link>https://demo.example</link>')
    expect(xml).toContain('<language>ru</language>')
    expect(xml).toContain(
      '<atom:link href="https://demo.example/rss.xml" rel="self" type="application/rss+xml"/>',
    )
    expect(xml).toContain('<link>https://demo.example/blog/post-0</link>')
    expect(xml).toContain('<guid isPermaLink="true">https://demo.example/blog/post-0</guid>')
    expect(xml).toContain('<pubDate>Wed, 30 Sep 2026 00:00:00 GMT</pubDate>')
    expect(xml).toContain('<category>seo</category>')
    expect(xml).not.toContain('content:encoded')
  })

  it('фид локали en: ссылки под /en', async () => {
    const xml = await buildFeed({
      title: 'Blog — demo',
      description: 'Notes',
      language: 'en',
      homePath: '/en',
      feedPath: '/en/rss.xml',
      items: [{ ...item(0), path: '/en/blog/post-0' }],
    })
    expect(xml).toContain('<link>https://demo.example/en</link>')
    expect(xml).toContain('<atom:link href="https://demo.example/en/rss.xml"')
    expect(xml).toContain('<link>https://demo.example/en/blog/post-0</link>')
  })

  it('в фид попадают только первые FEED_ITEMS_LIMIT записей', async () => {
    const items = Array.from({ length: FEED_ITEMS_LIMIT + 5 }, (_, index) => item(index))
    const xml = await buildFeed({
      title: 't',
      description: 'd',
      language: 'ru',
      homePath: '/',
      feedPath: '/rss.xml',
      items,
    })
    expect(xml.match(/<item>/g)).toHaveLength(FEED_ITEMS_LIMIT)
  })
})
