import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import Breadcrumbs from './breadcrumbs.astro'

// Пропсы блока — секция плана страницы: ступени пути (подпись и адрес) и текущая страница.
const trail = {
  id: 'breadcrumbs',
  variant: 'full-path',
  crumb: [
    { label: 'Начало', link: { href: '/' } },
    { label: 'Заметки', link: { href: '/blog' } },
  ],
  current: 'Запись про статику',
}

const render = async (props: Record<string, unknown>) => {
  const container = await AstroContainer.create()
  return container.renderToString(Breadcrumbs, { props })
}

describe('Breadcrumbs', () => {
  it('видимые крошки: ссылки на ступени пути по порядку, текущая страница без ссылки, без скриптов', async () => {
    const doc = parseHtml(await render({ ...trail, locale: DEFAULT_LOCALE }))
    const nav = doc.querySelector(`nav[aria-label="${t(DEFAULT_LOCALE, 'nav.breadcrumbs')}"]`)
    expect(nav?.querySelectorAll('ol > li')).toHaveLength(3)
    const links = [...(nav?.querySelectorAll('a') ?? [])]
    expect(links.map((link) => [link.getAttribute('href'), link.textContent])).toEqual([
      ['/', 'Начало'],
      ['/blog', 'Заметки'],
    ])
    const current = nav?.querySelector('li:last-child [aria-current="page"]')
    expect([current?.tagName, current?.textContent]).toEqual(['SPAN', 'Запись про статику'])
    expect(doc.querySelector('script')).toBeNull()
  })

  it('ступень — версия основного языка: ссылка называет её язык', async () => {
    const crumb = [{ label: 'Начало', link: { href: '/', hreflang: 'ru' } }]
    const doc = parseHtml(await render({ ...trail, crumb, locale: DEFAULT_LOCALE }))
    expect(doc.querySelector('nav a')?.getAttribute('hreflang')).toBe('ru')
  })

  it('подпись навигации — на языке страницы', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const doc = parseHtml(await render({ ...trail, locale }))
      expect(doc.querySelector('nav')?.getAttribute('aria-label'), locale).toBe(
        t(locale, 'nav.breadcrumbs'),
      )
    }
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render({ ...trail, locale: DEFAULT_LOCALE }))
  })
})
