import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/shared/i18n'
import { langOf, mapLanguages } from './contract'
import {
  type PageFiles,
  pageLink,
  pageLocales,
  pageOf,
  projectOf,
  snapshot,
  strategyPage,
  templateOf,
} from './page'

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

  // Цель действия — страница карты, как ссылка со страницы: версия на её языке, без неё — версия другого языка.
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

  // Страница читает свои данные модулем по id: в нём только её план и copy deck, а прочитанная страница — та же, что из
  // снимка целиком.
  it('модуль страницы — её план и copy deck по языкам; страница модуля = страница снимка', async () => {
    const { plans } = snapshot()
    expect(plans.length).toBeGreaterThan(0)
    for (const { page } of plans) {
      const files = (
        (await import(/* @vite-ignore */ `virtual:strategy/${page.id}`)) as { default: PageFiles }
      ).default
      for (const path of Object.keys(files)) {
        expect(path, page.id).toMatch(
          new RegExp(`^site/[^/]+/(?:plans|copy)/${page.id}(?:\\.[\\w-]+)?\\.yaml$`),
        )
      }
      // План одной страницы читает pageOf, шаблон коллекции — templateOf.
      const read = page.template ? templateOf : pageOf
      for (const locale of pageLocales(page.id)) {
        expect(read(files, locale), `${page.id} (${locale})`).toEqual(strategyPage(page.id, locale))
      }
    }
  })

  // Страница модуля — из его файлов, а не из снимка: модуль без copy deck не читается и на языке, где у снимка он есть.
  it('страница модуля — его файлы: без copy deck языка в модуле — ошибка с ключом', async () => {
    const [plan] = snapshot().plans
    if (plan === undefined) throw new Error('у снимка нет планов')
    const files = (
      (await import(/* @vite-ignore */ `virtual:strategy/${plan.page.id}`)) as {
        default: PageFiles
      }
    ).default
    const plans = Object.fromEntries(
      Object.entries(files).filter(([path]) => path.includes('/plans/')),
    )
    expect(() => pageOf(plans, DEFAULT_LOCALE)).toThrow(
      `strategy: ${plan.page.id} — нет страницы в copy deck ${DEFAULT_LOCALE}`,
    )
  })

  // В бандл идут поля, которые читает код, а не файл целиком: прозы плана, статусов и источников текстов в нём нет.
  it('файл снимка в модуле сборки — поля схем чтения: разбор схемой его не меняет', () => {
    const files = import.meta.glob<unknown>(
      [
        '../../../strategy/facts*.yaml',
        '../../../strategy/site/*/site-map.yaml',
        '../../../strategy/site/*/plans/*.yaml',
        '../../../strategy/site/*/copy/*.yaml',
      ],
      { eager: true, import: 'default' },
    )
    expect(Object.keys(files).length).toBeGreaterThan(0)
    for (const [path, data] of Object.entries(files)) {
      const file = path.slice('../../../strategy/'.length)
      const { map, facts, plans, decks } = projectOf({ [file]: data })
      expect(data, file).toEqual(map ?? facts[0] ?? plans[0] ?? decks[0])
    }
  })

  // У шаблона коллекции слоты без текста и мету даёт запись: прочитанный как страница, он скрыл бы пропуск текста.
  it('шаблон коллекции читает templateOf, план одной страницы — pageOf; не та функция — ошибка с ключом', () => {
    const plan = (template: boolean) => ({
      'site/x/plans/a.yaml': { page: { id: 'a', template }, sections: [] },
    })
    expect(() => pageOf(plan(true), DEFAULT_LOCALE)).toThrow(
      'strategy: a — план шаблона коллекции — его читает templateOf',
    )
    expect(() => templateOf(plan(false), DEFAULT_LOCALE)).toThrow(
      'strategy: a — план одной страницы — его читает pageOf',
    )
  })

  it('модуль без плана или с двумя планами — ошибка', () => {
    const { plans } = snapshot()
    const plan = (id: string) => ({ ...plans[0], page: { id } })
    expect(() => pageOf({}, DEFAULT_LOCALE)).toThrow(
      'strategy: в модуле страницы планов 0, а нужен один',
    )
    expect(() =>
      pageOf(
        { 'site/x/plans/a.yaml': plan('a'), 'site/x/plans/b.yaml': plan('b') },
        DEFAULT_LOCALE,
      ),
    ).toThrow('strategy: в модуле страницы планов 2, а нужен один')
  })
})
