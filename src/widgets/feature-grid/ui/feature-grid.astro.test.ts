import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import FeatureGrid from './feature-grid.astro'

const astro = await AstroContainer.create()

const cards = [
  { title: 'Замер', body: 'Приедем в удобный день и снимем размеры.' },
  { title: 'Смета', body: 'Посчитаем работы и материалы за три дня.' },
  { title: 'Отделка', body: 'Одна бригада от черновых работ до чистовых.' },
  { title: 'Сроки', body: 'График по дням — в договоре.' },
]
const slots = { id: 'benefits', variant: 'cards', title: 'Как мы работаем', card: cards }

async function render() {
  const html = await astro.renderToString(FeatureGrid, { props: slots })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('FeatureGrid', () => {
  it('секция подписана своим заголовком — h2 с id секции плана', async () => {
    const { section } = await render()
    expect(section?.getAttribute('aria-labelledby')).toBe('benefits')
    const title = section?.querySelector('h2')
    expect([title?.id, title?.textContent]).toEqual(['benefits', 'Как мы работаем'])
  })

  it('карточки — пункты списка по порядку плана, все: заголовок h3 и текст карточки', async () => {
    const items = [...((await render()).section?.querySelectorAll('ul > li') ?? [])]
    expect(
      items.map((item) => [
        item.querySelector('h3')?.textContent,
        item.querySelector('p')?.textContent,
      ]),
    ).toEqual(cards.map((card) => [card.title, card.body]))
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
