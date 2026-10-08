import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import AuthorByline from './author-byline.astro'

const render = async (props: { locale: 'ru' | 'en'; name: string; jobTitle?: string }) => {
  const container = await AstroContainer.create()
  return container.renderToString(AuthorByline, { props })
}
const text = (html: string) => parseHtml(html).body.textContent?.replace(/\s+/g, ' ').trim()

describe('AuthorByline', () => {
  it('подпись — имя и роль автора на языке страницы, одной строкой', async () => {
    const ru = await render({ locale: 'ru', name: 'Анна Смирнова', jobTitle: 'врач-кардиолог' })
    expect(text(ru)).toBe('Автор — Анна Смирнова, врач-кардиолог')
    const en = await render({ locale: 'en', name: 'Anna Smirnova', jobTitle: 'cardiologist' })
    expect(text(en)).toBe('By Anna Smirnova, cardiologist')
  })

  it('без роли — только имя', async () => {
    expect(text(await render({ locale: 'ru', name: 'Анна Смирнова' }))).toBe(
      'Автор — Анна Смирнова',
    )
  })

  it('без скриптов и нарушений доступности', async () => {
    const html = await render({ locale: 'ru', name: 'Анна Смирнова', jobTitle: 'врач-кардиолог' })
    expect(html).not.toContain('<script')
    await expectNoA11yViolations(html)
  })
})
