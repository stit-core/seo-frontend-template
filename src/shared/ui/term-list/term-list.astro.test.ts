import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import Term from './term.astro'
import TermList from './term-list.astro'

const astro = await AstroContainer.create()

const term = (name: string, description: string) =>
  astro.renderToString(Term, { props: { name }, slots: { default: description } })

async function render(props: Record<string, unknown> = {}) {
  const pairs = [
    await term('Почта', '<a href="mailto:hello@example.com">hello@example.com</a>'),
    await term('Часы работы', 'Пн–Пт, 10:00–19:00'),
  ]
  const html = await astro.renderToString(TermList, { props, slots: { default: pairs.join('') } })
  return { html, list: parseHtml(html).querySelector('dl') }
}

describe('TermList', () => {
  it('пары «термин — описание» — прямые дети списка определений, по порядку', async () => {
    const { list } = await render()
    expect([...(list?.children ?? [])].map((child) => child.tagName)).toEqual([
      'DT',
      'DD',
      'DT',
      'DD',
    ])
    expect([...(list?.querySelectorAll('dt') ?? [])].map((name) => name.textContent)).toEqual([
      'Почта',
      'Часы работы',
    ])
    expect(list?.querySelector('dd a')?.getAttribute('href')).toBe('mailto:hello@example.com')
    expect(list?.querySelectorAll('dd')[1]?.textContent?.trim()).toBe('Пн–Пт, 10:00–19:00')
  })

  it('класс страницы — рядом со своими', async () => {
    const own = [...((await render()).list?.classList ?? [])]
    const spaced = [...((await render({ class: 'mt-lg' })).list?.classList ?? [])]
    expect(spaced).toEqual([...own, 'mt-lg'])
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
