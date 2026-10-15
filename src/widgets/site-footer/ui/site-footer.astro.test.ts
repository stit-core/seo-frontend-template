import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { type Locale, t } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml, testLocale } from '@/shared/lib/testing'
import SiteFooter from './site-footer.astro'

// Локали и карта теста: контакты и блог — на ru и en, у немецкой версии — главная и «О компании», политика ПДн — только
// на ru; страница вне карты (политика у сайта без формы) — `absent`.
const absent = vi.hoisted(() => new Set<string>())
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) => {
  const strategy = await (await import('@/shared/lib/testing')).withTestSite(importOriginal)
  return {
    ...strategy,
    pageLink: (route: string, locale: Locale) =>
      absent.has(route) ? undefined : strategy.pageLink(route, locale),
  }
})

const render = async (locale: string) => {
  const container = await AstroContainer.create()
  return container.renderToString(SiteFooter, { props: { locale } })
}
const links = (html: string) =>
  [...parseHtml(html).querySelectorAll('footer a')].map((link) => [
    link.getAttribute('href'),
    link.getAttribute('hreflang'),
  ])

describe('SiteFooter', () => {
  afterEach(() => absent.clear())

  it('копирайт с годом; ссылки — контакты, политика, фид и время сервера на языке страницы', async () => {
    const html = await render('ru')
    expect(html).toContain(`© ${new Date().getFullYear()}`)
    expect(html).toContain(t(testLocale('ru'), 'footer.note'))
    expect(links(html)).toEqual([
      ['/contacts', null],
      ['/legal/privacy', null],
      ['/rss.xml', null],
      ['/now', null],
    ])
    expect(html).not.toContain('<script')
  })

  // Политика ПДн и время сервера есть только на дефолтном языке: ссылка ведёт на них и называет их язык.
  it('в другой локали — свои разделы, а у страницы без перевода — её язык в hreflang', async () => {
    const html = await render('en')
    expect(links(html)).toEqual([
      ['/en/contacts', null],
      ['/legal/privacy', 'ru'],
      ['/en/rss.xml', null],
      ['/now', 'ru'],
    ])
    expect(html).toContain(t(testLocale('en'), 'footer.now'))
  })

  it('раздела нет на языке страницы — ни контактов, ни фида; политики нет в карте — нет и ссылки', async () => {
    expect(links(await render('de'))).toEqual([
      ['/legal/privacy', 'ru'],
      ['/now', 'ru'],
    ])
    absent.add('/legal/privacy')
    expect(links(await render('de'))).toEqual([['/now', 'ru']])
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render('ru'))
  })
})
