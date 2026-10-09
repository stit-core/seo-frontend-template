import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { parseHtml } from '@/shared/lib/testing'
import Container from './container.astro'

const astro = await AstroContainer.create()

async function render(props: Record<string, unknown> = {}) {
  const html = await astro.renderToString(Container, { props, slots: { default: '<p>Текст</p>' } })
  const box = parseHtml(html).body.firstElementChild
  const classes = [...(box?.classList ?? [])]
  return {
    box,
    classes,
    // Граница ширины и поля страницы — роли слоя: `max-w-<роль>` и `px-page-x`.
    bounds: classes.filter((name) => name.startsWith('max-w-')),
    padded: classes.includes('px-page-x'),
  }
}

describe('Container', () => {
  it('у чтения, страницы и широкой сетки — своя граница и поля страницы; по умолчанию — чтение', async () => {
    const boxes = await Promise.all(['reading', 'page', 'wide'].map((width) => render({ width })))
    expect(boxes.map(({ bounds }) => bounds.length)).toEqual([1, 1, 1])
    expect(new Set(boxes.flatMap(({ bounds }) => bounds)).size).toBe(3)
    expect(boxes.map(({ padded }) => padded)).toEqual([true, true, true])
    expect((await render()).classes).toEqual(boxes[0]?.classes)
  })

  it('всё окно — ни границы, ни полей страницы', async () => {
    const full = await render({ width: 'full' })
    expect(full.bounds).toEqual([])
    expect(full.padded).toBe(false)
  })

  it('содержимое — внутри, класс раскладки каркаса — рядом со своими', async () => {
    const plain = await render({ width: 'page' })
    const framed = await render({ width: 'page', class: 'flex gap-lg' })
    expect(framed.box?.querySelector('p')?.textContent).toBe('Текст')
    expect(framed.classes).toEqual([...plain.classes, 'flex', 'gap-lg'])
  })
})
