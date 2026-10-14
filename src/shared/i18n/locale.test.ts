import { DEFAULT_LOCALE, LOCALES, localeRules, SUPPORTED_LOCALES } from './locale'

const row = (code: string) => ({ code, intl: code, og: code, name: code })
// Правила адреса — на фикстурах дескриптора, а не на локалях сайта: одна локаль и три.
const one = localeRules([row('ru')])
const three = localeRules([row('ru'), row('en'), row('de')])

describe('i18n/locale', () => {
  it('дескриптор сайта: дефолтная локаль — первая строка, список — коды строк по порядку', () => {
    expect(DEFAULT_LOCALE).toBe(LOCALES[0].code)
    expect(SUPPORTED_LOCALES).toEqual(LOCALES.map(({ code }) => code))
  })

  it('локаль адреса — по префиксу пути; код в середине пути и имя, которое с него начинается, — не префикс', () => {
    expect(
      ['/', '/blog/zapis', '/de', '/en/x', '/deutsch', '/blog/de'].map(three.localeOf),
    ).toEqual(['ru', 'ru', 'de', 'en', 'ru', 'ru'])
    // Одна локаль — у адреса нет префикса, локаль любого пути — она.
    expect(['/', '/en', '/en/x'].map(one.localeOf)).toEqual(['ru', 'ru', 'ru'])
  })

  it('маршрут страницы — путь без префикса локали и хвостового слеша', () => {
    expect(
      ['/', '/blog/zapis/', '/de', '/de/', '/en/blog/post', '/deutsch'].map(three.routeOf),
    ).toEqual(['/', '/blog/zapis', '/', '/', '/blog/post', '/deutsch'])
    expect(['/', '/en/x/'].map(one.routeOf)).toEqual(['/', '/en/x'])
  })

  it('адрес на локали: дефолтная — без префикса, остальные — с префиксом своего кода', () => {
    expect(three.localePath('ru', '/')).toBe('/')
    expect(three.localePath('ru', '/blog/')).toBe('/blog')
    expect(three.localePath('en', '/')).toBe('/en')
    expect(three.localePath('de', '/blog')).toBe('/de/blog')
    expect(three.localePath('de', '/blog/')).toBe('/de/blog')
    expect(one.localePath('ru', '/blog')).toBe('/blog')
  })

  it('сегмент [...locale] маршрута: у дефолтной локали его нет, у остальных — код', () => {
    expect(three.SUPPORTED_LOCALES.map(three.localeParam)).toEqual([undefined, 'en', 'de'])
    expect(one.SUPPORTED_LOCALES.map(one.localeParam)).toEqual([undefined])
  })

  it('строка локали по коду; кода нет в списке или список пуст — ошибка', () => {
    expect(three.localeInfo('de')).toEqual(row('de'))
    expect(() => one.localeInfo('de')).toThrow('локали de нет в списке')
    expect(() => localeRules([])).toThrow('список локалей пуст')
  })
})
