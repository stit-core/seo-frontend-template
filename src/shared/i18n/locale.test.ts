import { localeOf, localePath, routeOf } from './locale'

describe('i18n/locale', () => {
  it('локаль адреса — по префиксу пути; код локали в середине пути и имя, которое с него начинается, — не префикс', () => {
    expect(localeOf('/')).toBe('ru')
    expect(localeOf('/blog/zapis')).toBe('ru')
    expect(localeOf('/en')).toBe('en')
    expect(localeOf('/en/blog/post')).toBe('en')
    expect(localeOf('/english')).toBe('ru')
    expect(localeOf('/blog/en')).toBe('ru')
    expect(localeOf('/blog/en/zapis')).toBe('ru')
  })

  it('маршрут страницы — путь без префикса локали и хвостового слеша', () => {
    expect(routeOf('/')).toBe('/')
    expect(routeOf('/blog/zapis/')).toBe('/blog/zapis')
    expect(routeOf('/en')).toBe('/')
    expect(routeOf('/en/')).toBe('/')
    expect(routeOf('/en/blog/post')).toBe('/blog/post')
    expect(routeOf('/english')).toBe('/english')
  })

  it('дефолтная локаль без префикса, остальные — с префиксом', () => {
    expect(localePath('ru', '/')).toBe('/')
    expect(localePath('ru', '/blog/')).toBe('/blog')
    expect(localePath('en', '/')).toBe('/en')
    expect(localePath('en', '/blog')).toBe('/en/blog')
    expect(localePath('en', '/blog/')).toBe('/en/blog')
  })
})
