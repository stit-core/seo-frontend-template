import { readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { parseHtml } from '@/shared/lib/testing'
import Container from './container.astro'
import { SLOT_SIZES } from './sizes'

const astro = await AstroContainer.create()

// Значение ключа слоя в пикселях — роль файла токенов: `--max-width-measure: var(--size-measure)` → 38rem.
const layer = readFileSync(new URL('../../../app/styles/index.css', import.meta.url), 'utf8')
const tokens = readFileSync(new URL('../../../app/styles/tokens.css', import.meta.url), 'utf8')
const px = (key: string) => {
  const role = new RegExp(`${key}:\\s*var\\((--[\\w-]+)\\)`).exec(layer)?.[1]
  return 16 * Number(new RegExp(`${role}:\\s*([\\d.]+)rem`).exec(tokens)?.[1])
}

// Ширина слота по `sizes` на окне шириной `vw`: длина первой записи, чьё условие выполнено.
function slot(sizes: string, vw: number) {
  const length = (value: string): number => {
    const [, minuend = '', subtrahend = ''] = /^calc\((\S+) - (\S+)\)$/.exec(value) ?? []
    if (minuend) return length(minuend) - length(subtrahend)
    const [, number = 'NaN', unit] = /^([\d.]+)(rem|vw|px)$/.exec(value) ?? []
    return Number(number) * (unit === 'rem' ? 16 : unit === 'vw' ? vw / 100 : 1)
  }
  for (const entry of sizes.split(', ')) {
    const [, min, value = ''] = /^(?:\(min-width: (\S+)\) )?(.+)$/.exec(entry) ?? []
    if (min === undefined || vw >= length(min)) return length(value)
  }
  return Number.NaN
}

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
    centered: classes.includes('mx-auto'),
  }
}

describe('Container', () => {
  it('чтение, страница и широкая сетка — каждая в границе своей роли, по центру, с полями страницы; по умолчанию — чтение', async () => {
    const boxes = await Promise.all(['reading', 'page', 'wide'].map((width) => render({ width })))
    expect(boxes.map(({ bounds }) => bounds)).toEqual([
      ['max-w-measure'],
      ['max-w-container'],
      ['max-w-container-wide'],
    ])
    expect(boxes.map(({ padded }) => padded)).toEqual([true, true, true])
    expect(boxes.map(({ centered }) => centered)).toEqual([true, true, true])
    expect((await render()).classes).toEqual(boxes[0]?.classes)
  })

  it('всё окно — ни границы, ни полей страницы', async () => {
    const full = await render({ width: 'full' })
    expect(full.bounds).toEqual([])
    expect(full.padded).toBe(false)
    expect(full.centered).toBe(false)
  })

  // Литералы `sizes` повторяют роли файла токенов: ДС с другой колонкой чтения тест называет здесь.
  it('слот картинки (sizes) — ширина контейнера без полей страницы на любом окне', async () => {
    const pageX = px('--spacing-page-x')
    for (const width of ['reading', 'page', 'wide', 'full'] as const) {
      const { bounds, padded } = await render({ width })
      const [bound] = bounds
      const max = bound
        ? px(`--max-width-${bound.slice('max-w-'.length)}`)
        : Number.POSITIVE_INFINITY
      for (const vw of [320, 390, 600, 640, 768, 1024, 1280, 1440, 1920]) {
        const box = Math.min(vw, max) - (padded ? 2 * pageX : 0)
        expect(slot(SLOT_SIZES[width], vw), `${width} на ${vw}`).toBeCloseTo(box)
      }
    }
  })

  it('содержимое — внутри, класс раскладки каркаса — рядом со своими', async () => {
    const plain = await render({ width: 'page' })
    const framed = await render({ width: 'page', class: 'flex gap-lg' })
    expect(framed.box?.querySelector('p')?.textContent).toBe('Текст')
    expect(framed.classes).toEqual([...plain.classes, 'flex', 'gap-lg'])
  })
})
