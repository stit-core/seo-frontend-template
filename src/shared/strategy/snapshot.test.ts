import { SUPPORTED_LOCALES } from '@/shared/i18n'
import { langOf, mapLanguages } from './contract'
import { pageLink, pageLocales, snapshot, strategyPage } from './page'

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
  it('маршрут действия каждого плана на каждом языке страницы — ссылка на страницу карты с этого языка', () => {
    const { map, plans } = snapshot()
    const routes = new Set(map?.pages.map((page) => page.url))
    let checked = 0
    for (const { page, sections } of plans) {
      for (const locale of pageLocales(page.id)) {
        strategyPage(page.id, locale).sections.forEach((read, index) => {
          const values = [read.slots, ...Object.values(read.groups).flat()]
            .flatMap((slots) => Object.values(slots))
            .flat()
          for (const { target } of sections[index]?.slots.action ?? []) {
            if (target?.kind !== 'route' || !routes.has(target.value)) continue
            expect(values, `${page.id}/${read.id} (${locale})`).toContainEqual(
              pageLink(target.value, locale),
            )
            checked += 1
          }
        })
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})
