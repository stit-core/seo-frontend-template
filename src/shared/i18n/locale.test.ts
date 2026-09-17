import { localePath } from './locale'

describe('i18n/locale', () => {
  it('дефолтная локаль без префикса, остальные — с префиксом', () => {
    expect(localePath('ru', '/')).toBe('/')
    expect(localePath('ru', '/blog/')).toBe('/blog')
    expect(localePath('en', '/')).toBe('/en')
    expect(localePath('en', '/blog')).toBe('/en/blog')
    expect(localePath('en', '/blog/')).toBe('/en/blog')
  })
})
