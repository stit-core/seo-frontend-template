import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import ThemeToggle from './theme-toggle.astro'

const container = await AstroContainer.create()
const render = (locale: 'ru' | 'en') => container.renderToString(ThemeToggle, { props: { locale } })

describe('ThemeToggle', () => {
  it('кнопка острова предпочтений: подпись называет тёмную тему, иконки скрыты от чтеца', async () => {
    const html = await render('ru')
    const button = parseHtml(html).querySelector('button')
    expect(button?.getAttribute('type')).toBe('button')
    expect(button?.hasAttribute('data-theme-toggle')).toBe(true)
    expect(button?.getAttribute('aria-label')).toBe('Тёмная тема')
    expect(button?.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2)
    // Обработчик живёт в острове (в <head>): здесь только разметка.
    expect(html).not.toContain('<script')
  })

  // Сервер темы посетителя не знает: состояние объявляет остров, и до него кнопка скрыта.
  it('состояние в разметке не объявлено', async () => {
    expect(parseHtml(await render('ru')).querySelector('[aria-pressed]')).toBeNull()
  })

  it('подпись переводится', async () => {
    const button = parseHtml(await render('en')).querySelector('button')
    expect(button?.getAttribute('aria-label')).toBe('Dark theme')
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await render('ru'))
  })
})
