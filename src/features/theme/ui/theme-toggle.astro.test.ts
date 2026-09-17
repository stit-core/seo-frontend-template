import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import ThemeToggle from './theme-toggle.astro'

const render = async (locale: 'ru' | 'en') => {
  const container = await AstroContainer.create()
  return container.renderToString(ThemeToggle, { props: { locale } })
}

describe('ThemeToggle', () => {
  it('кнопка с подписью и маркером для делегирования, иконки скрыты от чтеца', async () => {
    const html = await render('ru')
    expect(html).toContain('<button')
    expect(html).toContain('type="button"')
    expect(html).toContain('data-theme-toggle')
    expect(html).toContain('aria-label="Переключить тему"')
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2)
    // Обработчик живёт в ThemeInit (в <head>): здесь только разметка.
    expect(html).not.toContain('<script')
  })

  it('подпись переводится', async () => {
    expect(await render('en')).toContain('aria-label="Switch theme"')
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render('ru'))
  })
})
