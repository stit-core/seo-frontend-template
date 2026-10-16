import { fact, type StrategyPage, text } from '@/shared/strategy'
import { sectionFaults } from './section'

// Секция «итоги» страницы: заголовок и факт — без текстов секции (его показывает блок) или с ними (`binds`).
const page = (binds: string[]): StrategyPage => ({
  id: 'home',
  url: '/',
  parents: [],
  meta: {
    title: 'Главная',
    description: 'Главная страница',
    ogTitle: undefined,
    ogDescription: undefined,
    ogImageAlt: undefined,
  },
  sections: [
    {
      id: 'results',
      role: 'proof',
      block: 'stat-strip',
      variant: 'row',
      slots: {
        title: 'Итоги года',
        stat: { id: 'leads', text: '+64 % заявок', machine: undefined, binds },
      },
      groups: {},
    },
  ],
  policy: undefined,
  operator: undefined,
})
const block = { slots: { title: text, stat: fact } }
const section = (body: string) =>
  `<section aria-labelledby="results"><h2 id="results">Итоги года</h2>${body}</section>`

describe('sectionFaults: факт слота данных', () => {
  it('факт без текстов секции показывает сам блок: его формулировка — в видимом тексте секции', () => {
    expect(sectionFaults(section('<p>Год: +64 % заявок</p>'), page([]), 'results', block)).toEqual(
      [],
    )
    for (const body of ['<p>Год без чисел</p>', '<p aria-hidden="true">+64 % заявок</p>']) {
      expect(sectionFaults(section(body), page([]), 'results', block)).toEqual([
        'home/results/stat: факт «+64 % заявок» не виден',
      ])
    }
  })

  it('факт с текстами секции (binds) виден через них: формулировку факта проверка не ищет', () => {
    expect(
      sectionFaults(section('<p>Год без чисел</p>'), page(['title']), 'results', block),
    ).toEqual([])
  })
})
