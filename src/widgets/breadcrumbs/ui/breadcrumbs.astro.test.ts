import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import Breadcrumbs from './breadcrumbs.astro'

const items = [
  { name: 'Главная', href: '/' },
  { name: 'Блог', href: '/blog' },
  { name: 'Запись про статику' },
]

describe('Breadcrumbs', () => {
  it('видимые крошки: ссылки на предков, текущая страница без ссылки, без скриптов', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(Breadcrumbs, { props: { locale: 'ru', items } })
    expect(html).toContain('aria-label="Хлебные крошки"')
    expect(html).toContain('<a href="/">Главная</a>')
    expect(html).toContain('<a href="/blog">Блог</a>')
    expect(html).toContain('<span aria-current="page">Запись про статику</span>')
    expect(html.match(/<li/g)).toHaveLength(3)
    expect(html).not.toContain('<script')
  })

  it('локаль en: подпись навигации по-английски', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(Breadcrumbs, {
      props: { locale: 'en', items: [{ name: 'Home', href: '/en' }, { name: 'Blog' }] },
    })
    expect(html).toContain('aria-label="Breadcrumbs"')
    expect(html).toContain('<a href="/en">Home</a>')
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    await expectNoA11yViolations(
      await container.renderToString(Breadcrumbs, { props: { locale: 'ru', items } }),
    )
  })
})
