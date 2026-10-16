import type { FactValue } from '@/shared/strategy'
import { hoursOf } from './hours'

// Факт часов: ряды «дни, открытие, закрытие».
const hours = (...rows: Array<[string[], string, string]>): FactValue => ({
  id: 'company-hours',
  text: 'часы',
  machine: {
    type: 'opening-hours',
    hours: rows.map(([days, opens, closes]) => ({ days, opens, closes })),
  },
  binds: [],
})
const WEEKDAYS = ['mo', 'tu', 'we', 'th', 'fr']
const operator: FactValue = {
  id: 'company-name',
  text: 'ООО «Тест»',
  machine: undefined,
  binds: [],
}

describe('hoursOf', () => {
  it('строка с временем факта — части текста и время, прочие строки — как есть', () => {
    expect(
      hoursOf(
        ['Москва', 'Пн–Пт, 10:00–19:00 (МСК)'],
        [operator, hours([WEEKDAYS, '10:00', '19:00'])],
        'k',
      ),
    ).toEqual([
      undefined,
      [
        'Пн–Пт, ',
        { time: '10:00', text: '10:00' },
        '–',
        { time: '19:00', text: '19:00' },
        ' (МСК)',
      ],
    ])
  })

  // Сопоставление — по смыслу: ровный час без минут, точка вместо двоеточия, час без нуля; ряд называет строка, где
  // закрытие ближе всего к открытию, — номер дома и офиса в адресе часами не становится.
  it('время по смыслу: «10–19», «9.30», «с 10 до 19»; пояс и номера в адресе — не время', () => {
    expect(hoursOf(['Пн–Пт с 10 до 19'], [hours([WEEKDAYS, '10:00', '19:00'])], 'k')).toEqual([
      ['Пн–Пт с ', { time: '10:00', text: '10' }, ' до ', { time: '19:00', text: '19' }],
    ])
    expect(
      hoursOf(
        ['ул. Тестовая, 10, офис 19', 'Пн–Пт 10–19 (UTC+3)', 'Сб 9.30–14'],
        [hours([WEEKDAYS, '10:00', '19:00'], [['sa'], '09:30', '14:00'])],
        'k',
      ),
    ).toEqual([
      undefined,
      ['Пн–Пт ', { time: '10:00', text: '10' }, '–', { time: '19:00', text: '19' }, ' (UTC+3)'],
      ['Сб ', { time: '09:30', text: '9.30' }, '–', { time: '14:00', text: '14' }],
    ])
  })

  it('несколько рядов одной строкой и повтор времени: каждое вхождение — время', () => {
    expect(
      hoursOf(
        ['10:00–19:00, сб 10:00–16:00'],
        [hours([WEEKDAYS, '10:00', '19:00'], [['sa'], '10:00', '16:00'])],
        'k',
      ),
    ).toEqual([
      [
        { time: '10:00', text: '10:00' },
        '–',
        { time: '19:00', text: '19:00' },
        ', сб ',
        { time: '10:00', text: '10:00' },
        '–',
        { time: '16:00', text: '16:00' },
      ],
    ])
  })

  it('без факта часов — строк часов нет', () => {
    expect(hoursOf(['Москва', 'Пн–Пт, 10:00–19:00'], [operator], 'k')).toEqual([
      undefined,
      undefined,
    ])
  })

  it('ряда факта нет ни в одной строке — ошибка называет ключ, факт и ряд', () => {
    for (const info of [['Пн–Пт, 10:00–18:00'], ['Пн–Пт, 10:30–19:00'], ['Пн–Пт с 10', 'до 19']]) {
      expect(() =>
        hoursOf(info, [hours([WEEKDAYS, '10:00', '19:00'])], 'about/details/info'),
      ).toThrow(
        'strategy: about/details/info — часы факта company-hours (mo, tu, we, th, fr 10:00–19:00) — нет строки контактов с ними',
      )
    }
  })
})
