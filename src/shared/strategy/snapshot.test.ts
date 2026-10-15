import { SUPPORTED_LOCALES } from '@/shared/i18n'
import { langOf, mapLanguages } from './contract'
import { pageLink, snapshot, strategyPage } from './page'

describe('снимок сайта strategy/', () => {
  // Языки карты и дескриптор локалей — один список: язык карты без строки дескриптора не собрать, а строка без языка
  // карты не дала бы ни одной страницы.
  it('языки карты — локали дескриптора по порядку: основной — дефолтная', () => {
    const { map } = snapshot()
    expect(map && mapLanguages(map)).toEqual(SUPPORTED_LOCALES)
  })

  it('каждая страница copy deck читается на своём языке: у слотов плана есть тексты, факты и адреса', () => {
    const pages = SUPPORTED_LOCALES.flatMap((locale) =>
      snapshot()
        .decks.filter((file) => langOf(file.copy_deck.lang) === locale)
        .flatMap((file) => file.copy_deck.pages.map((page) => [page.page_id, locale] as const)),
    )
    expect(pages.length).toBeGreaterThan(0)
    for (const [id, locale] of pages) {
      expect(() => strategyPage(id, locale), `${id} (${locale})`).not.toThrow()
    }
  })

  // Цель действия — страница карты, как ссылка со страницы: версия на её языке, без неё — версия основного языка.
  it('маршрут действия главной — ссылка на страницу карты с языка страницы', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const hero = strategyPage('home', locale).sections.find((section) => section.id === 'hero')
      expect(hero?.slots.cta, locale).toEqual(pageLink('/contacts', locale))
    }
  })
})
