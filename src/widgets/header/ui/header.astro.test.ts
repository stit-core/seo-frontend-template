import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as Config from '@/shared/config'
import { SITE_NAME } from '@/shared/config'
import { localePath, t } from '@/shared/i18n'
import {
  expectNoA11yViolations,
  PACKAGE_LANDING,
  parseHtml,
  testLocale,
} from '@/shared/lib/testing'
import { pageVersions, projectOf, siteOf, strategyPage } from '@/shared/strategy'
import { header } from '../model/block'
import Header from './header.astro'

// Поле THEME — решение проекта: тест задаёт его и смотрит, печатает ли шапка кнопку темы.
const theme = vi.hoisted(() => ({ default: 'system', switcher: true }))
vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof Config>()),
  THEME: theme,
}))

// Локали и проект теста: главная и «О компании» — на ru, en и de, блог и контакты — на ru и en; меню карты — блог,
// «О компании», контакты; шапка — секция плана главной теста.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')
const DE = testLocale('de')

// Пропсы шапки — секция плана страницы: у сайта — главной теста, у посадочной — фикстуры базы package-landing.
const siteNav = (locale = RU) => header.props(strategyPage('home', locale), 'header')
const landing = () =>
  header.props(siteOf(projectOf(PACKAGE_LANDING)).strategyPage('spasibo', RU), 'header')

const render = async (props: Record<string, unknown>, path = '/stranica') => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(Header, {
    props,
    request: new Request(`https://demo.example${path}`),
  })
  return { html, doc: parseHtml(html) }
}
type Doc = Awaited<ReturnType<typeof render>>['doc']

const menu = (doc: Doc) =>
  [...doc.querySelectorAll('nav a:not([hreflang])')].map((link) => [
    link.getAttribute('href'),
    link.textContent,
  ])
const languages = (doc: Doc) =>
  [...doc.querySelectorAll('a[hreflang]')].map((link) =>
    ['href', 'hreflang', 'lang', 'rel']
      .map((name) => link.getAttribute(name))
      .concat(link.textContent),
  )

describe('Header', () => {
  // У дизайн-системы с одной темой выбирать не из чего: кнопку печатает только парная тема.
  it.each([
    [{ default: 'system', switcher: true }, 1],
    [{ default: 'light', switcher: false }, 0],
  ])('кнопка темы — по полю THEME: %o — кнопок %i', async (site, buttons) => {
    Object.assign(theme, site)
    const { doc } = await render({ ...siteNav(), locale: RU })
    expect(doc.querySelectorAll('button[data-theme-toggle]')).toHaveLength(buttons)
    Object.assign(theme, { default: 'system', switcher: true })
  })

  it('шапка сайта: знак — на главную языка, меню — пункты карты по порядку с подписями плана на её языке', async () => {
    const { doc } = await render({ ...siteNav(EN), locale: EN })
    expect(doc.querySelector('header a')?.getAttribute('href')).toBe('/en')
    expect(doc.querySelector('nav')?.getAttribute('aria-label')).toBe(t(EN, 'nav.label'))
    expect(menu(doc)).toEqual([
      ['/en/blog', 'Notes'],
      ['/en/about', 'Studio'],
      ['/en/contacts', 'Reach us'],
    ])
  })

  // У немецкой версии нет блога и контактов: разделы основного языка в её меню не попадают.
  it('меню версии — только её разделы', async () => {
    const { doc } = await render({ ...siteNav(DE), locale: DE })
    expect(doc.querySelector('header a')?.getAttribute('href')).toBe('/de')
    expect(menu(doc)).toEqual([['/de/about', 'Studio']])
  })

  it('пункт текущей страницы — aria-current', async () => {
    const { doc } = await render({ ...siteNav(), locale: RU }, '/blog/tag/astro')
    expect(
      [...doc.querySelectorAll('nav a[aria-current="page"]')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['/blog'])
  })

  // Адреса у элемента nav-link нет: пункт — страница карты, подпись — по тому же порядку.
  it('подписей меню больше или меньше пунктов карты — ошибка называет ключ', async () => {
    for (const labels of [
      ['Заметки', 'О студии'],
      ['Заметки', 'О студии', 'Связаться', 'Ещё'],
    ]) {
      await expect(render({ ...siteNav(), 'nav-link': labels, locale: RU })).rejects.toThrow(
        `strategy: header/nav-link — подписей меню ${labels.length}, а пунктов chrome.header.items карты 3`,
      )
    }
  })

  it('переключатель — каждый перевод страницы самоназванием языка, с hreflang, lang и rel="alternate"', async () => {
    const { doc } = await render({
      ...siteNav(),
      locale: RU,
      translations: pageVersions('about'),
    })
    expect(languages(doc)).toEqual([
      ['/en/about', 'en', 'en', 'alternate', 'English'],
      ['/de/about', 'de', 'de', 'alternate', 'Deutsch'],
    ])
  })

  it('на английской странице перевод на русский — адрес без префикса', async () => {
    const { doc } = await render({
      ...siteNav(EN),
      locale: EN,
      translations: pageVersions('home'),
    })
    expect(languages(doc)[0]).toEqual(['/', 'ru', 'ru', 'alternate', 'Русский'])
  })

  it('без перевода — главная языка по карте и без rel="alternate": это не версия страницы', async () => {
    const { doc } = await render({
      ...siteNav(EN),
      locale: EN,
      translations: pageVersions('contacts'),
    })
    expect(languages(doc)).toEqual([
      ['/contacts', 'ru', 'ru', 'alternate', 'Русский'],
      ['/de', 'de', 'de', null, 'Deutsch'],
    ])
  })

  it('переключатель — место действия lang-switch секции: без него языков в шапке нет', async () => {
    const { 'lang-switch': _switcher, ...single } = siteNav()
    const { doc } = await render({ ...single, locale: RU, translations: pageVersions('about') })
    expect(languages(doc)).toEqual([])
  })

  // Вариант плана посадочной — логотип, призыв и контакт: меню сайта в её шапке нет.
  it('шапка посадочной (фикстура базы): без меню и лендмарка навигации — призыв на цель плана и телефон', async () => {
    const { doc } = await render({ ...landing(), locale: RU })
    expect(doc.querySelector('nav')).toBeNull()
    expect(
      [...doc.querySelectorAll('header a')].map((link) => [
        link.getAttribute('href'),
        link.textContent,
        link.classList.contains('button'),
      ]),
    ).toEqual([
      [localePath(RU, '/'), SITE_NAME, false],
      ['tel:+79000000001', '+79000000001', false],
      ['#lead-form', 'Вызвать замерщика', true],
    ])
  })

  it('не имеет нарушений доступности: шапка сайта и посадочной', async () => {
    for (const props of [
      { ...siteNav(), locale: RU, translations: pageVersions('home') },
      { ...landing(), locale: RU },
    ]) {
      await expectNoA11yViolations((await render(props)).html)
    }
  })
})
