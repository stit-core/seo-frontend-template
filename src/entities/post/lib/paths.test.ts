import { blogPath, blogRoute, postPath, postRoute, tagPath, tagRoute } from './paths'

describe('post paths', () => {
  it('страница 1 — /blog, остальные — /blog/page/N', () => {
    expect(blogRoute()).toBe('/blog')
    expect(blogRoute(1)).toBe('/blog')
    expect(blogRoute(2)).toBe('/blog/page/2')
    expect(blogPath('ru', 2)).toBe('/blog/page/2')
    expect(blogPath('en')).toBe('/en/blog')
    expect(blogPath('en', 3)).toBe('/en/blog/page/3')
  })

  it('пост и тег с префиксом локали', () => {
    expect(postRoute('x')).toBe('/blog/x')
    expect(postPath('ru', 'x')).toBe('/blog/x')
    expect(postPath('en', 'x')).toBe('/en/blog/x')
    expect(tagRoute('seo')).toBe('/blog/tag/seo')
    expect(tagPath('en', 'seo')).toBe('/en/blog/tag/seo')
  })
})
