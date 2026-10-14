import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES } from '@/shared/i18n'
import { blogPath, postPath, tagPath } from './paths'

describe('post paths', () => {
  it('страница 1 — /blog, остальные — /blog/page/N; пост и тег — под /blog', () => {
    expect(blogPath(DEFAULT_LOCALE)).toBe('/blog')
    expect(blogPath(DEFAULT_LOCALE, 1)).toBe('/blog')
    expect(blogPath(DEFAULT_LOCALE, 2)).toBe('/blog/page/2')
    expect(postPath(DEFAULT_LOCALE, 'x')).toBe('/blog/x')
    expect(tagPath(DEFAULT_LOCALE, 'seo')).toBe('/blog/tag/seo')
  })

  it('адрес локали — с её префиксом', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(blogPath(locale, 3)).toBe(localePath(locale, '/blog/page/3'))
      expect(postPath(locale, 'x')).toBe(localePath(locale, '/blog/x'))
      expect(tagPath(locale, 'seo')).toBe(localePath(locale, '/blog/tag/seo'))
    }
  })
})
