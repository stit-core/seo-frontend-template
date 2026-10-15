import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import HeroText from './hero-text.astro'

const astro = await AstroContainer.create()

const slots = {
  id: 'hero',
  variant: 'statement-cta',
  headline: 'Ремонт под ключ',
  subheadline: 'Замер, смета и отделка — одной бригадой за два месяца.',
  cta: { href: '/contacts' },
  'cta-label': 'Вызвать замерщика',
  'cta-secondary': { href: '/raboty' },
  'cta-secondary-label': 'Наши работы',
}

async function render(props: Record<string, unknown> = slots) {
  const html = await astro.renderToString(HeroText, { props })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('HeroText', () => {
  it('секция подписана заголовком страницы: h1 с id секции плана, под ним — лид', async () => {
    const { section } = await render()
    expect(section?.getAttribute('aria-labelledby')).toBe('hero')
    const headings = [...(section?.querySelectorAll('h1, h2, h3') ?? [])]
    expect(headings.map((heading) => [heading.tagName, heading.id, heading.textContent])).toEqual([
      ['H1', 'hero', 'Ремонт под ключ'],
    ])
    expect(section?.querySelector('h1 + p')?.textContent).toBe(slots.subheadline)
  })

  it('призыв — кнопка на цель плана, второй путь — ссылкой; подписи — свои элементы', async () => {
    const links = [...((await render()).section?.querySelectorAll('a') ?? [])]
    expect(
      links.map((link) => [
        link.getAttribute('href'),
        link.textContent,
        link.classList.contains('button'),
      ]),
    ).toEqual([
      ['/contacts', 'Вызвать замерщика', true],
      ['/raboty', 'Наши работы', false],
    ])
  })

  it('без второго пути — один призыв', async () => {
    const { 'cta-secondary': _secondary, 'cta-secondary-label': _secondaryLabel, ...single } = slots
    const links = [...((await render(single)).section?.querySelectorAll('a') ?? [])]
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/contacts'])
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
