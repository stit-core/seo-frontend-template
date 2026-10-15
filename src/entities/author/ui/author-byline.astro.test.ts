import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import AuthorByline from './author-byline.astro'

const render = async (props: { locale: Locale; name: string; jobTitle?: string }) => {
  const container = await AstroContainer.create()
  return container.renderToString(AuthorByline, { props })
}
const text = (html: string) => parseHtml(html).body.textContent?.replace(/\s+/g, ' ').trim()

describe('AuthorByline', () => {
  it('подпись — имя и роль автора на языке страницы, одной строкой', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const html = await render({ locale, name: 'Анна Смирнова', jobTitle: 'врач-кардиолог' })
      expect(text(html), locale).toBe(`${t(locale, 'author.by')} Анна Смирнова, врач-кардиолог`)
    }
  })

  it('без роли — только имя', async () => {
    expect(text(await render({ locale: DEFAULT_LOCALE, name: 'Анна Смирнова' }))).toBe(
      `${t(DEFAULT_LOCALE, 'author.by')} Анна Смирнова`,
    )
  })

  it('без скриптов и нарушений доступности', async () => {
    const html = await render({
      locale: DEFAULT_LOCALE,
      name: 'Анна Смирнова',
      jobTitle: 'врач-кардиолог',
    })
    expect(html).not.toContain('<script')
    await expectNoA11yViolations(html)
  })
})
