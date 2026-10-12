import type * as Site from './site'

// Где стоят острова оболочки — решения проекта в site.ts: тест задаёт их и читает реестр заново.
const site = vi.hoisted(() => ({ metrika: '', switcher: true }))
vi.mock('./site', async (importOriginal) => {
  const original = await importOriginal<typeof Site>()
  return {
    ...original,
    get METRIKA_ID() {
      return site.metrika
    },
    get THEME() {
      return { ...original.THEME, switcher: site.switcher }
    },
  }
})

const islands = async () => {
  vi.resetModules()
  return (await import('./islands')).ISLANDS
}

describe('реестр островов', () => {
  it('счётчик стоит только при заданном идентификаторе: без него сторонних скриптов нет', async () => {
    site.metrika = ''
    expect((await islands()).metrika.pages).toEqual([])
    site.metrika = '12345678'
    expect((await islands()).metrika.pages).toEqual(['*'])
  })

  // Без кнопки темы остров нужен только страницам с переключателем движения: их пути вписывает
  // проект.
  it('остров предпочтений — на всём сайте с кнопкой темы, без неё — нигде', async () => {
    site.switcher = true
    expect((await islands()).preferences.pages).toEqual(['*'])
    site.switcher = false
    expect((await islands()).preferences.pages).toEqual([])
  })
})
