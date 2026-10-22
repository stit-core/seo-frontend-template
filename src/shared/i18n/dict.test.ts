import { DICTS, t } from './dict'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locale'

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort()

describe('i18n/dict', () => {
  // Перевод строки не теряет подстановку и не придумывает свою: число и тег встают по словарю каждого языка.
  it('у каждой локали — словарь с теми же ключами, у каждой строки — те же подстановки, что у дефолтной', () => {
    const base = DICTS[DEFAULT_LOCALE]
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(DICTS[locale]).sort(), locale).toEqual(Object.keys(base).sort())
      for (const [key, text] of Object.entries(DICTS[locale])) {
        expect(placeholders(text), `${locale} ${key}`).toEqual(
          placeholders(base[key as keyof typeof base]),
        )
      }
    }
  })

  it('подстановка — по имени; строки без подстановок — как есть; без значения — ошибка с ключом', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(t(locale, 'blog.tag', { tag: 'seo' })).toContain('seo')
      const paged = t(locale, 'blog.paged', { text: 'Блог', page: 7 })
      expect([paged.includes('Блог'), paged.includes('7'), paged.includes('{')]).toEqual([
        true,
        true,
        false,
      ])
    }
    expect(t(DEFAULT_LOCALE, 'nav.skip')).toBe(DICTS[DEFAULT_LOCALE]['nav.skip'])
    expect(() => t(DEFAULT_LOCALE, 'blog.paged', { text: 'Блог' })).toThrow(
      'i18n: blog.paged — нет подстановки {page}',
    )
  })

  // Ключ из данных (поле формы каталога) словарь проверяет сам: строка есть на каждом языке или ни на одном.
  it('ключ из данных — has: строка словаря есть или её нет', () => {
    expect([t.has('nav.skip'), t.has('nav.nope')]).toEqual([true, false])
  })
})
