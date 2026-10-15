import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as Config from '@/shared/config'
import { t } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml, testLocale } from '@/shared/lib/testing'
import { pageVersions } from '@/shared/strategy'
import SiteHeader from './site-header.astro'

// Поле THEME — решение проекта: тест задаёт его и смотрит, печатает ли шапка кнопку темы.
const theme = vi.hoisted(() => ({ default: 'system', switcher: true }))
vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof Config>()),
  THEME: theme,
}))

// Локали и карта теста: главная и «О компании» — на ru, en и de, блог и контакты — на ru и en.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

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

  it('бренд — на главную языка, меню — разделы версии языка страницы на её языке', async () => {
    const en = await render({ locale: 'en' })
    expect(en.querySelector('header a')?.getAttribute('href')).toBe('/en')
    expect(menu(en)).toEqual(['/en/blog', '/en/about', '/en/contacts'])
    expect(en.querySelector('nav')?.getAttribute('aria-label')).toBe(
      t(testLocale('en'), 'nav.label'),
    )
    // У немецкой версии нет блога и контактов: разделы основного языка в её меню не попадают.
    const de = await render({ locale: 'de' })
    expect(de.querySelector('header a')?.getAttribute('href')).toBe('/de')
    expect(menu(de)).toEqual(['/de/about'])
  })

  it('переключатель — каждый перевод страницы самоназванием языка, с hreflang, lang и rel="alternate"', async () => {
    const doc = await render({ locale: 'ru', translations: pageVersions('about') })
    expect(languages(doc)).toEqual([
      ['/en/about', 'en', 'en', 'alternate', 'English'],
      ['/de/about', 'de', 'de', 'alternate', 'Deutsch'],
    ])
  })

  it('на английской странице перевод на русский — адрес без префикса', async () => {
    const doc = await render({ locale: 'en', translations: pageVersions('home') })
    expect(languages(doc)[0]).toEqual(['/', 'ru', 'ru', 'alternate', 'Русский'])
  })

  it('без перевода — главная языка по карте и без rel="alternate": это не версия страницы', async () => {
    const doc = await render({ locale: 'en', translations: pageVersions('contacts') })
    expect(languages(doc)).toEqual([
      ['/contacts', 'ru', 'ru', 'alternate', 'Русский'],
      ['/de', 'de', 'de', null, 'Deutsch'],
    ])
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(SiteHeader, {
      props: { locale: 'ru', translations: pageVersions('home') },
    })
    await expectNoA11yViolations(html)
  })
})
