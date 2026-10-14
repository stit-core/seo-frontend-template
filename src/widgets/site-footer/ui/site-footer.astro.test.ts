import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { Locale } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import type * as Strategy from '@/shared/strategy'
import SiteFooter from './site-footer.astro'

// Разделы, которых нет на языке страницы (версия основного языка), и страницы вне карты.
const pages = vi.hoisted(() => ({ untranslated: new Set<string>(), absent: new Set<string>() }))
vi.mock('@/shared/strategy', async (importOriginal) => {
  const strategy = await importOriginal<typeof Strategy>()
  return {
    ...strategy,
    pageLink: (route: string, locale: Locale) => {
      if (pages.absent.has(route)) return undefined
      if (pages.untranslated.has(route)) return { href: route, hreflang: 'ru' }
      return strategy.pageLink(route, locale)
    },
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
  it('копирайт с годом; ссылки — контакты, политика, фид и время сервера на языке страницы', async () => {
    const html = await render('ru')
    expect(html).toContain(`© ${new Date().getFullYear()}`)
    expect(html).toContain('шаблон индексируемого сайта')
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
    expect(html).toContain('server time')
  })

  it('раздела нет на языке страницы — ни контактов, ни фида; политики нет в карте — нет и ссылки', async () => {
    pages.untranslated.add('/contacts').add('/blog')
    pages.absent.add('/legal/privacy')
    expect(links(await render('en'))).toEqual([['/now', 'ru']])
    pages.untranslated.clear()
    pages.absent.clear()
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render('ru'))
  })
})
