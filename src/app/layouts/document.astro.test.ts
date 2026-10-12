import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as Config from '@/shared/config'
import { parseHtml } from '@/shared/lib/testing'
import DocumentLayout from './document.astro'

// Поле THEME и страницы островов в реестре — решения проекта: тест задаёт их и смотрит, что
// печатает оболочка. У строки реестра оболочка читает только страницы.
const theme = vi.hoisted(() => ({ default: 'system', switcher: true }))
const islands = vi.hoisted(() => ({
  preferences: { pages: ['*'] },
  metrika: { pages: [] as string[] },
}))
vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof Config>()),
  THEME: theme,
  ISLANDS: islands,
}))

const container = await AstroContainer.create()

async function render(
  site: typeof theme,
  { preferences = ['*'], metrika = [] as string[], path = '/stranica' } = {},
) {
  Object.assign(theme, site)
  islands.preferences.pages = preferences
  islands.metrika.pages = metrika
  const html = await container.renderToString(DocumentLayout, {
    props: {
      locale: 'ru',
      title: 'Страница для проверки оболочки',
      description: 'Страница существует только в тесте: оболочка печатает её head и каркас сайта.',
    },
    request: new Request(`https://demo.example${path}`),
    partial: false,
    slots: { default: '<h1>Страница</h1>' },
  })
  const document = parseHtml(html)
  return {
    root: document.documentElement,
    main: document.querySelector('main'),
    island: (name: string) => document.head.querySelector(`script[data-island="${name}"]`),
    toggle: document.body.querySelector('[data-preference="theme"]'),
    colorScheme: document.querySelector('meta[name="color-scheme"]'),
  }
}

describe('DocumentLayout', () => {
  it('тема по системе: атрибута темы на <html> нет, кнопка выбора есть', async () => {
    const page = await render({ default: 'system', switcher: true })
    expect(page.root.hasAttribute('data-theme')).toBe(false)
    expect(page.toggle).not.toBeNull()
  })

  it('тему по умолчанию ставит атрибут ДС; без кнопки выбора её нет', async () => {
    const page = await render({ default: 'dark', switcher: false })
    expect(page.root.getAttribute('data-theme')).toBe('dark')
    expect(page.toggle).toBeNull()
  })

  // Где стоит остров, решает его строка реестра: сайту одной темы предпочтения нужны только там, где
  // страница печатает переключатель движения, счётчик — где его поставил проект. Путь страницы
  // встаёт в строку без префикса локали — и оболочка печатает остров на ней под любой локалью.
  it.each(['preferences', 'metrika'] as const)(
    'остров %s стоит на страницах своей строки реестра',
    async (name) => {
      const site = { default: 'dark', switcher: false }
      const printed = async (pages: string[], path: string) => {
        const where = { preferences: [] as string[], metrika: [] as string[], path }
        where[name] = pages
        return (await render(site, where)).island(name) !== null
      }
      expect(await printed(['*'], '/stranica')).toBe(true)
      expect(await printed([], '/stranica')).toBe(false)
      expect(await printed(['/video'], '/video')).toBe(true)
      expect(await printed(['/video'], '/en/video')).toBe(true)
      expect(await printed(['/video'], '/stranica')).toBe(false)
      expect(await printed(['/kejsy/*'], '/kejsy/dom')).toBe(true)
      expect(await printed(['/kejsy/*'], '/kejsy')).toBe(false)
    },
  )

  // Ширину, фон и отступы странице дают её секции: класс на <main> сузил бы каждую страницу.
  it('оболочка страницу не сужает: у <main> — только место в колонке оболочки', async () => {
    const page = await render({ default: 'system', switcher: true })
    expect(page.main?.className).toBe('flex-1')
  })

  // color-scheme страницы объявляет файл токенов: у ДС с одной темой второй схемы нет.
  it.each([
    { default: 'system', switcher: true },
    { default: 'light', switcher: false },
  ])('своего color-scheme у оболочки нет: тема $default', async (site) => {
    const page = await render(site)
    expect(page.colorScheme).toBeNull()
    expect(page.root.hasAttribute('style')).toBe(false)
  })
})
