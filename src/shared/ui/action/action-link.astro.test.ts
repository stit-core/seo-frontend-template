import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import ActionLink from './action-link.astro'

const astro = await AstroContainer.create()

async function render(kind: 'primary' | 'secondary') {
  const html = await astro.renderToString(ActionLink, {
    props: { href: '/contacts', label: 'Оставить заявку', kind },
  })
  return { html, link: parseHtml(html).querySelector('a') }
}

describe('ActionLink', () => {
  it('действие — ссылка на свою цель с подписью без пробелов исходника', async () => {
    for (const kind of ['primary', 'secondary'] as const) {
      const { link } = await render(kind)
      expect([link?.getAttribute('href'), link?.textContent], kind).toEqual([
        '/contacts',
        'Оставить заявку',
      ])
    }
  })

  it('цель — версия основного языка: ссылка называет её язык', async () => {
    const html = await astro.renderToString(ActionLink, {
      props: { href: '/legal/privacy', hreflang: 'ru', label: 'Политика', kind: 'secondary' },
    })
    expect(parseHtml(html).querySelector('a')?.getAttribute('hreflang')).toBe('ru')
    expect((await render('primary')).link?.hasAttribute('hreflang')).toBe(false)
  })

  it('главный призыв — кнопка с заливкой, второй путь — ссылка с целью касания', async () => {
    expect([...((await render('primary')).link?.classList ?? [])]).toEqual(['button'])
    expect([...((await render('secondary')).link?.classList ?? [])]).toEqual(['touch-target'])
  })

  it('не имеет нарушений доступности', async () => {
    for (const kind of ['primary', 'secondary'] as const) {
      await expectNoA11yViolations((await render(kind)).html)
    }
  })
})
