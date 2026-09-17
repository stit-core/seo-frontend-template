import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import SiteHeader from './site-header.astro'

const alternateLink = (html: string) => html.match(/<a\b[^>]*\bhreflang="[^"]*"[^>]*>/)?.[0]

describe('SiteHeader', () => {
  it('рендерит бренд и ссылку на перевод страницы', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(SiteHeader, {
      props: { locale: 'ru', alternatePath: '/blog' },
    })
    expect(html).toContain('<header')
    expect(html).toContain('href="/"')
    const link = alternateLink(html)
    expect(link).toContain('href="/en/blog"')
    expect(link).toContain('hreflang="en"')
    expect(link).toContain('lang="en"')
  })

  it('на английской странице ведёт на русскую версию без префикса', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(SiteHeader, {
      props: { locale: 'en', alternatePath: '/' },
    })
    expect(html).toContain('href="/en"')
    const link = alternateLink(html)
    expect(link).toContain('href="/"')
    expect(link).toContain('hreflang="ru"')
  })

  it('без alternatePath ссылки на другую локаль нет', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(SiteHeader, { props: { locale: 'ru' } })
    expect(alternateLink(html)).toBeUndefined()
    expect(html).not.toContain('/en')
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(SiteHeader, {
      props: { locale: 'ru', alternatePath: '/' },
    })
    await expectNoA11yViolations(html)
  })
})
