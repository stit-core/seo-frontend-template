import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as Config from '@/shared/config'
import type * as I18n from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import type * as Strategy from '@/shared/strategy'
import SiteHeader from './site-header.astro'

// Поле THEME — решение проекта: тест задаёт его и смотрит, печатает ли шапка кнопку темы.
const theme = vi.hoisted(() => ({ default: 'system', switcher: true }))
vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof Config>()),
  THEME: theme,
}))

// Три локали — свой дескриптор теста: переключатель называет каждый перевод.
vi.mock('@/shared/i18n', async (importOriginal) => {
  const i18n = await importOriginal<typeof I18n>()
  return {
    ...i18n,
    ...i18n.localeRules([
      { code: 'ru', intl: 'ru-RU', og: 'ru_RU', name: 'Русский' },
      { code: 'en', intl: 'en-GB', og: 'en_US', name: 'English' },
      { code: 'de', intl: 'de-DE', og: 'de_DE', name: 'Deutsch' },
    ]),
  }
})

// Раздел без версии на языке страницы: ссылка на него ведёт на версию основного языка.
const untranslated = vi.hoisted(() => new Set<string>())
vi.mock('@/shared/strategy', async (importOriginal) => {
  const strategy = await importOriginal<typeof Strategy>()
  return {
    ...strategy,
    pageLink: (route: string, locale: I18n.Locale) =>
      untranslated.has(route) ? { href: route, hreflang: 'ru' } : strategy.pageLink(route, locale),
  }
})

const render = async (props: Record<string, unknown>) => {
  const container = await AstroContainer.create()
  return parseHtml(await container.renderToString(SiteHeader, { props }))
}
type Doc = Awaited<ReturnType<typeof render>>

const menu = (doc: Doc) =>
  [...doc.querySelectorAll('nav a:not([hreflang])')].map((link) => link.getAttribute('href'))
const languages = (doc: Doc) =>
  [...doc.querySelectorAll('a[hreflang]')].map((link) =>
    ['href', 'hreflang', 'lang', 'rel']
      .map((name) => link.getAttribute(name))
      .concat(link.textContent),
  )

describe('SiteHeader', () => {
  afterEach(() => untranslated.clear())

  // У дизайн-системы с одной темой выбирать не из чего: кнопку печатает только парная тема.
  it.each([
    [{ default: 'system', switcher: true }, 1],
    [{ default: 'light', switcher: false }, 0],
  ])('кнопка темы — по полю THEME: %o — кнопок %i', async (site, buttons) => {
    Object.assign(theme, site)
    const doc = await render({ locale: 'ru' })
    expect(doc.querySelectorAll('button[data-theme-toggle]')).toHaveLength(buttons)
    Object.assign(theme, { default: 'system', switcher: true })
  })

  it('бренд — на главную языка, меню — разделы версии языка страницы', async () => {
    const doc = await render({ locale: 'en' })
    expect(doc.querySelector('header a')?.getAttribute('href')).toBe('/en')
    expect(menu(doc)).toEqual(['/en/blog', '/en/about', '/en/contacts'])
    untranslated.add('/about')
    expect(menu(await render({ locale: 'en' }))).toEqual(['/en/blog', '/en/contacts'])
  })

  it('переключатель — каждый перевод страницы самоназванием языка, с hreflang, lang и rel="alternate"', async () => {
    const doc = await render({
      locale: 'ru',
      translations: { ru: '/blog', en: '/en/blog', de: '/de/blog' },
    })
    expect(languages(doc)).toEqual([
      ['/en/blog', 'en', 'en', 'alternate', 'English'],
      ['/de/blog', 'de', 'de', 'alternate', 'Deutsch'],
    ])
  })

  it('на английской странице перевод на русский — адрес без префикса', async () => {
    const doc = await render({ locale: 'en', translations: { ru: '/', en: '/en' } })
    expect(languages(doc)[0]).toEqual(['/', 'ru', 'ru', 'alternate', 'Русский'])
  })

  it('без перевода — главная языка по карте и без rel="alternate": это не версия страницы', async () => {
    const links = languages(await render({ locale: 'ru' }))
    expect(links).toContainEqual(['/en', 'en', 'en', null, 'English'])
    expect(links.filter(([, , , rel]) => rel !== null)).toEqual([])
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(SiteHeader, {
      props: { locale: 'ru', translations: { ru: '/', en: '/en' } },
    })
    await expectNoA11yViolations(html)
  })
})
