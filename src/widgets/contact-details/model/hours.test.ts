import type { FactValue } from '@/shared/strategy'
import { hoursOf } from './hours'

const hours = (opens: string, closes: string, more: Array<[string, string]> = []): FactValue => ({
  id: 'company-hours',
  text: 'часы',
  machine: {
    type: 'opening-hours',
    hours: [[opens, closes] as const, ...more].map(([from, to]) => ({
      days: ['mo'],
      opens: from,
      closes: to,
    })),
  },
})
const operator: FactValue = { id: 'company-name', text: 'ООО «Тест»', machine: undefined }

describe('hoursOf', () => {
  it('строка с временем факта — части текста и время, прочие строки — как есть', () => {
    expect(
      hoursOf(['Москва', 'Пн–Пт, 10:00–19:00 (МСК)'], [operator, hours('10:00', '19:00')], 'k'),
    ).toEqual([undefined, ['Пн–Пт, ', { time: '10:00' }, '–', { time: '19:00' }, ' (МСК)']])
  })

  it('несколько рядов и повтор времени: каждое вхождение — время, строка начинается и кончается им', () => {
    expect(
      hoursOf(
        ['10:00–19:00, сб 10:00–16:00'],
        [hours('10:00', '19:00', [['10:00', '16:00']])],
        'k',
      ),
    ).toEqual([
      [
        { time: '10:00' },
        '–',
        { time: '19:00' },
        ', сб ',
        { time: '10:00' },
        '–',
        { time: '16:00' },
      ],
    ])
  })

  it('без факта часов — строк часов нет', () => {
    expect(hoursOf(['Москва', 'Пн–Пт, 10:00–19:00'], [operator], 'k')).toEqual([
      undefined,
      undefined,
    ])
  })

  it('строки со всем временем факта нет — ошибка называет ключ и факт', () => {
    expect(() =>
      hoursOf(['Пн–Пт, 10:00–18:00'], [hours('10:00', '19:00')], 'about/details/info'),
    ).toThrow(
      'strategy: about/details/info — часы факта company-hours (10:00, 19:00) — нет строки контактов с ними',
    )
  })
})
