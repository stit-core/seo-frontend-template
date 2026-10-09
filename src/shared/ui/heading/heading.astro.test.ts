import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import Heading from './heading.astro'

const astro = await AstroContainer.create()

async function render(props: Record<string, unknown>, content = 'Заголовок') {
  const html = await astro.renderToString(Heading, { props, slots: { default: content } })
  const heading = parseHtml(html).body.firstElementChild
  return { html, heading, classes: [...(heading?.classList ?? [])] }
}

describe('Heading', () => {
  it('уровень — тег заголовка, id — подпись секции', async () => {
    for (const level of [1, 2, 3]) {
      const { heading } = await render({ level, id: 'title' })
      expect(heading?.tagName).toBe(`H${level}`)
      expect(heading?.id).toBe('title')
      expect(heading?.textContent).toBe('Заголовок')
    }
    expect((await render({ level: 2 })).heading?.hasAttribute('id')).toBe(false)
  })

  it('роль текста — по уровню; kind меняет роль, а не уровень', async () => {
    const [page, section, card] = await Promise.all(
      [1, 2, 3].map(async (level) => (await render({ level })).classes),
    )
    expect(new Set([page, section, card].map((own) => own?.join(' '))).size).toBe(3)

    const cardAtSecond = await render({ level: 2, kind: 'card' })
    expect(cardAtSecond.heading?.tagName).toBe('H2')
    expect(cardAtSecond.classes).toEqual(card)
    expect((await render({ level: 1, kind: 'page' })).classes).toEqual(page)
  })

  it('заголовок главной — роль страницы и крупнее от границы tablet', async () => {
    const page = await render({ level: 1 })
    const display = await render({ level: 1, kind: 'display' })
    const larger = display.classes.filter((name) => !page.classes.includes(name))
    expect(display.classes).toEqual(expect.arrayContaining(page.classes))
    expect(larger.length).toBe(1)
    expect(larger[0]).toMatch(/^tablet:text-/)
  })

  it('пробелы и переносы исходника по краям текста в разметку не попадают, вложенная ссылка цела', async () => {
    const plain = await render({ level: 1 }, '\n      Шаблон индексируемого сайта\n    ')
    expect(plain.heading?.innerHTML).toBe('Шаблон индексируемого сайта')

    const linked = await render(
      { level: 2, kind: 'card' },
      '\n  <a href="/blog/zapis">Запись</a>\n',
    )
    expect(linked.heading?.innerHTML).toBe('<a href="/blog/zapis">Запись</a>')
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render({ level: 1, id: 'title' })).html)
  })
})
