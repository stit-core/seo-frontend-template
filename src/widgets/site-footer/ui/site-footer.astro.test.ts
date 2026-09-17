import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import SiteFooter from './site-footer.astro'

const nowLink = (html: string) => html.match(/<a\b[^>]*\bhref="\/now"[^>]*>/)?.[0]

describe('SiteFooter', () => {
  it('рендерит копирайт с годом и ссылку на /now без hreflang в дефолтной локали', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(SiteFooter, { props: { locale: 'ru' } })
    expect(html).toContain('<footer')
    expect(html).toContain(`© ${new Date().getFullYear()}`)
    expect(html).toContain('шаблон индексируемого сайта')
    expect(nowLink(html)).toBeDefined()
    expect(nowLink(html)).not.toContain('hreflang')
    expect(html).toContain('время сервера')
    expect(html).not.toContain('<script')
  })

  it('в другой локали ссылка на /now помечена языком страницы-цели', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(SiteFooter, { props: { locale: 'en' } })
    expect(nowLink(html)).toContain('hreflang="ru"')
    expect(html).toContain('server time')
  })

  it('не имеет нарушений доступности', async () => {
    const container = await AstroContainer.create()
    await expectNoA11yViolations(
      await container.renderToString(SiteFooter, { props: { locale: 'ru' } }),
    )
  })
})
