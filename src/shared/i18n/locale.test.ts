import { localeOf, localePath } from './locale'

describe('i18n/locale', () => {
  it('локаль адреса — по префиксу пути; имя, которое только начинается с кода локали, — не префикс', () => {
    expect(localeOf('/')).toBe('ru')
    expect(localeOf('/blog/zapis')).toBe('ru')
    expect(localeOf('/en')).toBe('en')
    expect(localeOf('/en/blog/post')).toBe('en')
    expect(localeOf('/english')).toBe('ru')
    expect(localeOf('/blog/en')).toBe('ru')
  })

  it('дефолтная локаль без префикса, остальные — с префиксом', () => {
    expect(localePath('ru', '/')).toBe('/')
    expect(localePath('ru', '/blog/')).toBe('/blog')
    expect(localePath('en', '/')).toBe('/en')
    expect(localePath('en', '/blog')).toBe('/en/blog')
    expect(localePath('en', '/blog/')).toBe('/en/blog')
  })
})
