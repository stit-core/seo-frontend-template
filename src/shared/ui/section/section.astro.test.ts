import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import Container from './container.astro'
import Section from './section.astro'

const astro = await AstroContainer.create()
const CONTENT = '<h2 id="title">Раздел</h2><p>Текст раздела.</p>'

async function render(props: Record<string, unknown>) {
  const html = await astro.renderToString(Section, { props, slots: { default: CONTENT } })
  const section = parseHtml(html).querySelector('section')
  const classes = [...(section?.classList ?? [])]
  return {
    html,
    section,
    box: section?.firstElementChild,
    background: classes.filter((name) => name.startsWith('bg-')),
    // Шаг ритма — роль `section-<шаг>`: внутри фона (`py-`) или снаружи (`my-`).
    inside: classes.filter((name) => name.startsWith('py-section-')),
    outside: classes.filter((name) => name.startsWith('my-section-')),
  }
}

const boxClasses = async (width?: string) => {
  const html = await astro.renderToString(Container, { props: { width } })
  return [...(parseHtml(html).body.firstElementChild?.classList ?? [])]
}

describe('Section', () => {
  it('лендмарк подписан своим заголовком', async () => {
    const { html, section } = await render({ labelledby: 'title' })
    expect(section?.getAttribute('aria-labelledby')).toBe('title')
    expect(section?.hasAttribute('aria-label')).toBe(false)
    expect(section?.querySelector('#title')?.textContent).toBe('Раздел')
    await expectNoA11yViolations(html)
  })

  it('без видимого заголовка лендмарк подписан текстом', async () => {
    const html = await astro.renderToString(Section, {
      props: { label: 'О шаблоне' },
      slots: { default: '<p>Врезка.</p>' },
    })
    const section = parseHtml(html).querySelector('section')
    expect(section?.getAttribute('aria-label')).toBe('О шаблоне')
    expect(section?.hasAttribute('aria-labelledby')).toBe(false)
    await expectNoA11yViolations(html)
  })

  it('ширину держит контейнер внутри секции, сама секция — на всё окно', async () => {
    for (const width of ['reading', 'page', 'wide', 'full']) {
      const { section, box } = await render({ labelledby: 'title', width })
      expect([...(section?.classList ?? [])].filter((name) => name.startsWith('max-w-'))).toEqual(
        [],
      )
      expect(section?.children.length, width).toBe(1)
      expect([...(box?.classList ?? [])], width).toEqual(await boxClasses(width))
      expect(box?.querySelector('p')?.textContent, width).toBe('Текст раздела.')
    }
    const byDefault = await render({ labelledby: 'title' })
    expect([...(byDefault.box?.classList ?? [])]).toEqual(await boxClasses('reading'))
  })

  it('полоса несёт фон и отступ ритма внутри него, секция без фона — отступ снаружи', async () => {
    const band = await render({ labelledby: 'title', tone: 'subtle' })
    expect(band.background.length).toBe(1)
    expect([band.inside.length, band.outside.length]).toEqual([1, 0])

    const plain = await render({ labelledby: 'title' })
    expect(plain.background).toEqual([])
    expect([plain.inside.length, plain.outside.length]).toEqual([0, 1])
  })

  it('шаг ритма — s, m или l, по умолчанию — s', async () => {
    for (const tone of [undefined, 'subtle']) {
      const steps = await Promise.all(
        ['s', 'm', 'l'].map(async (rhythm) => {
          const { inside, outside } = await render({ labelledby: 'title', tone, rhythm })
          return [...inside, ...outside]
        }),
      )
      expect(steps.map((own) => own.length)).toEqual([1, 1, 1])
      expect(new Set(steps.flat()).size).toBe(3)
      const byDefault = await render({ labelledby: 'title', tone })
      expect([...byDefault.inside, ...byDefault.outside]).toEqual(steps[0])
    }
  })
})
