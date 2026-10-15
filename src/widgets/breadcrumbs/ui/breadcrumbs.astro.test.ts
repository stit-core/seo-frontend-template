import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import Breadcrumbs from './breadcrumbs.astro'

const items = [
  { name: 'Главная', href: '/' },
  { name: 'Блог', href: '/blog' },
  { name: 'Запись про статику' },
]

const render = async (props: Record<string, unknown>) => {
  const container = await AstroContainer.create()
  return container.renderToString(Breadcrumbs, { props })
}

describe('Breadcrumbs', () => {
  it('видимые крошки: ссылки на предков, текущая страница без ссылки, без скриптов', async () => {
    const doc = parseHtml(await render({ locale: DEFAULT_LOCALE, items }))
    const nav = doc.querySelector(`nav[aria-label="${t(DEFAULT_LOCALE, 'nav.breadcrumbs')}"]`)
    expect(nav?.querySelectorAll('li')).toHaveLength(3)
    const links = [...(nav?.querySelectorAll('a') ?? [])]
    expect(links.map((link) => [link.getAttribute('href'), link.textContent])).toEqual([
      ['/', 'Главная'],
      ['/blog', 'Блог'],
    ])
    const current = nav?.querySelector('[aria-current="page"]')
    expect(current?.tagName).toBe('SPAN')
    expect(current?.textContent).toBe('Запись про статику')
    expect(doc.querySelector('script')).toBeNull()
  })

  it('подпись навигации — на языке страницы', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const home = { name: t(locale, 'nav.home'), href: localePath(locale, '/') }
      const doc = parseHtml(await render({ locale, items: [home, { name: 'Запись' }] }))
      const link = doc.querySelector(`nav[aria-label="${t(locale, 'nav.breadcrumbs')}"] a`)
      expect([link?.getAttribute('href'), link?.textContent], locale).toEqual([
        home.href,
        home.name,
      ])
    }
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render({ locale: DEFAULT_LOCALE, items }))
  })
})
