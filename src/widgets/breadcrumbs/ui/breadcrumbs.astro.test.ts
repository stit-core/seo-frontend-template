import { experimental_AstroContainer as AstroContainer } from 'astro/container'
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
    const doc = parseHtml(await render({ locale: 'ru', items }))
    const nav = doc.querySelector('nav[aria-label="Хлебные крошки"]')
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

  it('локаль en: подпись навигации по-английски', async () => {
    const doc = parseHtml(
      await render({ locale: 'en', items: [{ name: 'Home', href: '/en' }, { name: 'Blog' }] }),
    )
    const home = doc.querySelector('nav[aria-label="Breadcrumbs"] a')
    expect([home?.getAttribute('href'), home?.textContent]).toEqual(['/en', 'Home'])
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render({ locale: 'ru', items }))
  })
})
