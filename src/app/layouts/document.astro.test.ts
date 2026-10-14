import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as Fonts from '@/app/styles/fonts'
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

// Список шрифтов — данные ДС проекта, у шаблона он пуст: тест задаёт семейства, а их `@font-face`
// и файлы — как их собрал бы Fonts API.
const fonts = vi.hoisted(() => ({ families: [] as ReturnType<typeof Fonts.fontFamilies> }))
vi.mock('@/app/styles/fonts', async (importOriginal) => ({
  ...(await importOriginal<typeof Fonts>()),
  fontFamilies: () => fonts.families,
}))
vi.mock('virtual:astro:assets/fonts/internal', () => {
  const face = (name: string) => `@font-face{font-family:"${name}-1a2b";}`
  const file = (url: string, weight: string) => ({ url, type: 'woff2', weight, style: 'normal' })
  return {
    // Данные `fontData` из astro:assets — оболочка их не читает.
    fontDataByCssVariable: new Map(),
    componentDataByCssVariable: new Map([
      [
        '--font-golos-text',
        {
          css: face('Golos Text'),
          preloads: [
            file('/_astro/fonts/golos-latin.woff2', '400 900'),
            file('/_astro/fonts/golos-cyrillic.woff2', '400 900'),
          ],
        },
      ],
      [
        '--font-onest',
        { css: face('Onest'), preloads: [file('/_astro/fonts/onest-latin.woff2', '100 900')] },
      ],
    ]),
  }
})

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
    fontStyles: [...document.head.querySelectorAll('style')].map((style) => style.textContent),
    fontPreloads: [...document.head.querySelectorAll('link[rel="preload"][as="font"]')].map(
      (link) => link.getAttribute('href'),
    ),
    root: document.documentElement,
    main: document.querySelector('main'),
    island: (name: string) => document.head.querySelector(`script[data-island="${name}"]`),
    toggle: document.body.querySelector('[data-theme-toggle]'),
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

  // Где стоит остров, решает его строка реестра: оболочка печатает его по ней — на всём сайте, на
  // своём пути, в разделе или нигде. Путь страницы встаёт в строку без префикса локали — и оболочка
  // печатает остров на ней под любой локалью.
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

  // Fonts API печатает `@font-face` семейства и его переменную только там, где стоит `<Font>`:
  // оболочка ставит его каждому семейству списка, preload — файлам начертаний первого экрана.
  it('шрифты — <Font> каждого семейства списка, preload — начертания первого экрана', async () => {
    const { fontFamilies } = await vi.importActual<typeof Fonts>('@/app/styles/fonts')
    const face = { weight: '400 900', style: 'normal', preload: true } as const
    fonts.families = fontFamilies([
      { family: 'Golos Text', ...face, file: 'golos-latin.woff2' },
      { family: 'Golos Text', ...face, file: 'golos-cyrillic.woff2' },
      { family: 'Onest', weight: '100 900', style: 'normal', file: 'onest-latin.woff2' },
    ])
    const page = await render({ default: 'system', switcher: true })
    expect(page.fontStyles).toEqual([
      '@font-face{font-family:"Golos Text-1a2b";}',
      '@font-face{font-family:"Onest-1a2b";}',
    ])
    expect(page.fontPreloads).toEqual([
      '/_astro/fonts/golos-latin.woff2',
      '/_astro/fonts/golos-cyrillic.woff2',
    ])
    fonts.families = []
    const plain = await render({ default: 'system', switcher: true })
    expect([...plain.fontStyles, ...plain.fontPreloads]).toEqual([])
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
