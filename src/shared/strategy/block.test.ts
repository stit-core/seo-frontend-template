import { action, defineBlock, fact, group, list, text } from './block'
import type { Section, StrategyPage } from './page'

const promo = defineBlock({
  id: 'promo',
  variants: ['split', 'stacked'],
  slots: {
    title: text,
    cta: action,
    'cta-label': text,
    note: text.optional(),
    point: list(text),
    company: fact.optional(),
    card: group({ title: text, link: action.optional() }),
  },
})

const company = { id: 'company-name', text: 'Студия «Демо»', machine: undefined }
const section = (change: Partial<Section> = {}): Section => ({
  id: 'offer',
  role: 'offer',
  block: 'promo',
  variant: 'split',
  slots: {
    title: 'Ремонт под ключ',
    cta: { href: '/contacts' },
    'cta-label': 'Оставить заявку',
    point: 'Смета за три дня',
    company,
  },
  groups: { card: [{ title: 'Замер' }, { title: 'Смета', link: { href: '/smeta' } }] },
  ...change,
})
const page = (...sections: Section[]): StrategyPage => ({
  id: 'home',
  url: '/',
  parents: [],
  meta: {
    title: 'Главная',
    description: 'Описание',
    ogTitle: undefined,
    ogDescription: undefined,
    ogImageAlt: undefined,
  },
  sections,
})

describe('strategy/block', () => {
  it('секция плана → пропсы блока: id секции, вариант, слоты по элементам анатомии, экземпляры групп', () => {
    expect(promo.props(page(section()), 'offer')).toStrictEqual({
      id: 'offer',
      variant: 'split',
      title: 'Ремонт под ключ',
      cta: { href: '/contacts' },
      'cta-label': 'Оставить заявку',
      point: ['Смета за три дня'],
      company,
      card: [{ title: 'Замер' }, { title: 'Смета', link: { href: '/smeta' } }],
    })
  })

  it('элемент, который план заполняет не раз, — список по порядку плана; пробел в фактах — без значения', () => {
    const repeated = section({
      slots: { ...section().slots, point: ['Замер', 'Смета'], company: undefined },
    })
    expect(promo.props(page(repeated), 'offer')).toMatchObject({
      point: ['Замер', 'Смета'],
      company: undefined,
    })
  })

  it('другой блок или секции нет в плане — ошибка называет секцию', () => {
    expect(() => promo.props(page(section()), 'hero')).toThrow(
      'strategy: home/hero — секции нет в плане',
    )
    expect(() => promo.props(page(section({ block: 'hero-text' })), 'offer')).toThrow(
      'strategy: home/offer — в плане блок hero-text, а не promo',
    )
  })

  it('вариант не из блока, слот вне анатомии блока или без значения, не тот вид значения — ошибка называет слот', () => {
    const { title: _title, ...untitled } = section().slots
    const cases: Array<[Partial<Section>, string]> = [
      [{ variant: 'marquee' }, '→ at variant'],
      [{ slots: { ...section().slots, eyebrow: 'Новое' } }, 'Unrecognized key: "eyebrow"'],
      [{ slots: untitled }, '→ at title'],
      [{ slots: { ...section().slots, title: ['Ремонт', 'Отделка'] } }, '→ at title'],
      [{ slots: { ...section().slots, cta: { href: undefined } } }, '→ at cta.href'],
      [{ slots: { ...section().slots, company: 'Студия' } }, '→ at company'],
      [{ groups: { card: [{ title: 'Замер', body: 'Приедем' }] } }, '→ at card[0]'],
      [{ groups: {} }, '→ at card'],
    ]
    for (const [change, where] of cases) {
      const run = () => promo.props(page(section(change)), 'offer')
      expect(run, where).toThrow('strategy: home/offer — блок promo: ')
      expect(run, where).toThrow(where)
    }
  })
})
