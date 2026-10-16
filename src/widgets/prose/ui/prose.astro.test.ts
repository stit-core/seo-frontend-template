import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { strategyPage } from '@/shared/strategy'
import { prose } from '../model/block'
import Prose from './prose.astro'

// Секция — раздел «О компании» проекта теста на его локалях.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const LOCALES = [testLocale('ru'), testLocale('en'), testLocale('de')]

const render = async (props: Record<string, unknown>) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(Prose, { props })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('Prose', () => {
  it('секция плана — в разметке на каждом языке страницы: каждый текст на своём месте', async () => {
    for (const locale of LOCALES) {
      const page = strategyPage('about', locale)
      const { html } = await render(prose.props(page, 'story'))
      expect(sectionFaults(html, page, 'story', prose), locale).toEqual([])
    }
  })

  it('секция подписана заголовком h2 с id секции; абзацы, под ними пункты — по порядку плана', async () => {
    const { section } = await render(prose.props(strategyPage('about', testLocale('ru')), 'story'))
    expect(section?.getAttribute('aria-labelledby')).toBe('story')
    const title = section?.querySelector('h1, h2, h3')
    expect([title?.tagName, title?.id, title?.textContent]).toEqual(['H2', 'story', 'О студии'])
    expect([...(section?.querySelectorAll('p') ?? [])].map((p) => p.textContent)).toEqual([
      'Студия делает сайты, которые видно в поиске.',
      'Тексты живут в git, страницы собираются заранее.',
    ])
    expect([...(section?.querySelectorAll('ul > li') ?? [])].map((li) => li.textContent)).toEqual([
      'Сайты-визитки и блоги',
      'Техническая сторона поиска',
    ])
  })

  it('без пунктов — только абзацы, списка нет', async () => {
    const { section } = await render({
      id: 'story',
      variant: 'story',
      title: 'История',
      body: ['Один абзац.'],
    })
    expect(section?.querySelector('ul')).toBeNull()
    expect(section?.querySelector('p')?.textContent).toBe('Один абзац.')
  })

  it('не имеет нарушений доступности', async () => {
    const { html } = await render(prose.props(strategyPage('about', testLocale('ru')), 'story'))
    await expectNoA11yViolations(html)
  })
})
