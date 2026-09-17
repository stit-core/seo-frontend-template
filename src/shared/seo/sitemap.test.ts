import { buildSitemap, SITEMAP_URL_LIMIT } from './sitemap'

describe('seo/sitemap', () => {
  it('urlset с loc и lastmod только там, где есть дата; без changefreq/priority', () => {
    const xml = buildSitemap([
      { loc: 'https://demo.example/' },
      { loc: 'https://demo.example/blog/x', lastmod: new Date('2026-09-10') },
    ])
    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url><loc>https://demo.example/</loc></url>',
        '  <url><loc>https://demo.example/blog/x</loc><lastmod>2026-09-10</lastmod></url>',
        '</urlset>',
        '',
      ].join('\n'),
    )
    expect(xml).not.toMatch(/changefreq|priority/)
  })

  it('экранирует спецсимволы XML в loc', () => {
    expect(buildSitemap([{ loc: 'https://demo.example/a?b=1&c=<2>' }])).toContain(
      '<loc>https://demo.example/a?b=1&amp;c=&lt;2&gt;</loc>',
    )
  })

  it('пустой список — валидный пустой urlset', () => {
    expect(buildSitemap([])).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>',
    )
  })

  it('больше лимита одного файла — ошибка, а не молчаливая обрезка', () => {
    const entries = Array.from({ length: SITEMAP_URL_LIMIT + 1 }, (_, index) => ({
      loc: `https://demo.example/p/${index}`,
    }))
    expect(() => buildSitemap(entries)).toThrow(/sitemap index/)
  })
})
