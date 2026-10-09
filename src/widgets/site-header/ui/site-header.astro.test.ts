import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as Config from '@/shared/config'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import SiteHeader from './site-header.astro'

// Поле THEME — решение проекта: тест задаёт его и смотрит, печатает ли шапка кнопку темы.
const theme = vi.hoisted(() => ({ default: 'system', switcher: true }))
vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof Config>()),
  THEME: theme,
}))

const alternateLink = (html: string) => html.match(/<a\b[^>]*\bhreflang="[^"]*"[^>]*>/)?.[0]

describe('SiteHeader', () => {
  // У дизайн-системы с одной темой выбирать не из чего: кнопку печатает только парная тема.
  it.each([
    [{ default: 'system', switcher: true }, 1],
    [{ default: 'light', switcher: false }, 0],
  ])('кнопка темы — по полю THEME: %o — кнопок %i', async (site, buttons) => {
    Object.assign(theme, site)
    const container = await AstroContainer.create()
    const html = await container.renderToString(SiteHeader, { props: { locale: 'ru' } })
    expect(parseHtml(html).querySelectorAll('button[data-preference="theme"]')).toHaveLength(
      buttons,
    )
    Object.assign(theme, { default: 'system', switcher: true })
  })

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
