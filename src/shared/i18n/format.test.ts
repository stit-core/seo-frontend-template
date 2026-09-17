import { formatDate, isoDate } from './format'

describe('i18n/format', () => {
  const date = new Date('2026-03-05T00:00:00Z')

  it('форматирует дату по локали в UTC', () => {
    expect(formatDate('ru', date)).toBe('5 марта 2026 г.')
    expect(formatDate('en', date)).toBe('5 March 2026')
  })

  it('isoDate — календарная дата без времени', () => {
    expect(isoDate(date)).toBe('2026-03-05')
  })

  it('дата без времени из frontmatter — тот же календарный день в любом часовом поясе', () => {
    const calendar = new Date('2026-03-05')
    expect(isoDate(calendar)).toBe('2026-03-05')
    expect(formatDate('ru', calendar)).toBe('5 марта 2026 г.')
    expect(formatDate('en', calendar)).toBe('5 March 2026')
  })
})
