import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as Fonts from '@/app/styles/fonts'
import type * as Config from '@/shared/config'
import { SITE_NAME } from '@/shared/config'
import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { PACKAGE_LANDING, parseHtml, testLocale } from '@/shared/lib/testing'
import { projectOf, siteOf, strategyPage } from '@/shared/strategy'
import { jsonLdBlocks } from '../../../scripts/lib/html.mjs'
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

// Каркас страницы — её план strategy (chrome, по умолчанию — главная сайта) и крошки (crumbs): пропсы оболочки, которые
// тест задаёт сам.
interface Options {
  preferences?: string[]
  metrika?: string[]
  path?: string
  chrome?: unknown
  crumbs?: unknown
}

async function render(
  site: typeof theme,
  {
    preferences = ['*'],
    metrika = [],
    path = '/stranica',
    chrome = strategyPage('home', DEFAULT_LOCALE),
    crumbs,
  }: Options = {},
) {
  Object.assign(theme, site)
  islands.preferences.pages = preferences
  islands.metrika.pages = metrika
  const html = await container.renderToString(DocumentLayout, {
    props: {
      locale: DEFAULT_LOCALE,
      meta: {
        title: 'Страница для проверки оболочки',
        description:
          'Страница существует только в тесте: оболочка печатает её head и каркас сайта.',
      },
      chrome,
      crumbs,
    },
    request: new Request(`https://demo.example${path}`),
    partial: false,
    slots: { default: '<h1>Страница</h1>' },
  })
  const document = parseHtml(html)
  return {
    document,
    jsonLd: jsonLdBlocks(html).map((json) => JSON.parse(json) as Record<string, unknown>),
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
      for (const locale of SUPPORTED_LOCALES) {
        expect(await printed(['/video'], localePath(locale, '/video')), locale).toBe(true)
      }
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

  // Каркас — секции шапки и подвала плана страницы strategy: вариант — плана, тексты и адреса — его copy deck и цели;
  // своих текстов и пунктов у оболочки нет — только подпись перехода к содержимому.
  it('шапка и подвал — секции плана страницы: посадочная (фикстура базы) — без меню и разделов', async () => {
    const chrome = siteOf(projectOf(PACKAGE_LANDING)).strategyPage('spasibo', testLocale('ru'))
    const { document } = await render({ default: 'light', switcher: false }, { chrome })
    expect(document.querySelectorAll('header nav, footer a[href^="/"]')).toHaveLength(0)
    expect(
      [...document.body.querySelectorAll('a')].map((link) => [
        link.getAttribute('href'),
        link.textContent?.trim(),
      ]),
    ).toEqual([
      ['#main', t(DEFAULT_LOCALE, 'nav.skip')],
      [localePath(DEFAULT_LOCALE, '/'), SITE_NAME],
      ['tel:+79000000001', '+79000000001'],
      ['#lead-form', 'Вызвать замерщика'],
      ['#lead-form', 'Политика обработки персональных данных'],
    ])
    expect(document.querySelector('footer p')?.textContent).toBe(
      'Студия ремонта «Отвес», Нижний Новгород',
    )
  })

  it('план главной — шапка сайта с меню и подвал сайта с реквизитами', async () => {
    const home = strategyPage('home', DEFAULT_LOCALE)
    const legal = home.sections.find((section) => section.block === 'footer')?.slots.legal
    const { document } = await render({ default: 'system', switcher: true }, { chrome: home })
    expect(document.querySelector('header nav')?.getAttribute('aria-label')).toBe(
      t(DEFAULT_LOCALE, 'nav.label'),
    )
    expect(document.querySelector('footer p')?.textContent?.replace(/\s/g, ' ')).toBe(legal)
  })

  // Крошки — один проп: видимые перед <main> и BreadcrumbList в <head> — одни имена и адреса.
  it('крошки — из одного пропа: видимые до <main> и BreadcrumbList; без пропа — ни тех ни других', async () => {
    const crumbs = {
      id: 'breadcrumbs',
      variant: 'full-path',
      crumb: [{ label: 'Начало', link: { href: '/' } }],
      current: 'Страница',
    }
    const page = await render({ default: 'system', switcher: true }, { crumbs })
    const nav = page.document.querySelector('body > div > nav')
    expect(
      [...(nav?.querySelectorAll('a, [aria-current="page"]') ?? [])].map(
        (step) => step.textContent,
      ),
    ).toEqual(['Начало', 'Страница'])
    expect([...page.document.body.children].map((element) => element.tagName)).toEqual([
      'A',
      'HEADER',
      'DIV',
      'MAIN',
      'FOOTER',
    ])
    const list = page.jsonLd.find((block) => block['@type'] === 'BreadcrumbList')
      ?.itemListElement as Array<{ name: string; item?: string }>
    expect(list.map(({ name, item }) => [name, item && new URL(item).pathname])).toEqual([
      ['Начало', '/'],
      ['Страница', undefined],
    ])
    const plain = await render({ default: 'system', switcher: true })
    expect(plain.document.querySelector('nav > ol')).toBeNull()
    expect(plain.jsonLd).toEqual([])
  })
})
