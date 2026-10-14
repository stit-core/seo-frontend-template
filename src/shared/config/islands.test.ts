import { standsOn } from './islands'
import type * as Site from './site'

// Где стоят острова оболочки — решения проекта в site.ts: тест задаёт их и читает реестр заново.
const site = vi.hoisted(() => ({ metrika: '', theme: true, motion: false }))
vi.mock('./site', async (importOriginal) => {
  const original = await importOriginal<typeof Site>()
  return {
    ...original,
    get METRIKA_ID() {
      return site.metrika
    },
    get THEME() {
      return { ...original.THEME, switcher: site.theme }
    },
    get MOTION() {
      return { ...original.MOTION, switcher: site.motion }
    },
  }
})

const islands = async () => {
  vi.resetModules()
  return (await import('./islands')).ISLANDS
}

// Главная, запись и страница, на которой переключателя нет.
const ROUTES = ['/', '/blog/zapis', '/stranica-bez-pereklyuchatelya']

describe('реестр островов', () => {
  it('счётчик стоит только при заданном идентификаторе: без него сторонних скриптов нет', async () => {
    site.metrika = ''
    expect((await islands()).metrika.pages).toEqual([])
    site.metrika = '12345678'
    expect((await islands()).metrika.pages).toEqual(['*'])
  })

  // Выбор посетителя действует на всём сайте: «Меньше» на странице с переключателем движения
  // останавливает и переход между любыми страницами.
  it.each([
    ['кнопка темы', true, false],
    ['переключатель движения', false, true],
    ['оба', true, true],
  ])('сайт даёт выбор (%s) — остров предпочтений на каждой странице', async (_, theme, motion) => {
    Object.assign(site, { theme, motion })
    const { preferences } = await islands()
    expect(ROUTES.filter((route) => !standsOn(preferences, route))).toEqual([])
  })

  it('сайт без выбора — острова предпочтений нет нигде', async () => {
    Object.assign(site, { theme: false, motion: false })
    expect((await islands()).preferences.pages).toEqual([])
  })
})
