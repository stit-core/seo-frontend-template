import { TEST_LOCALES, testLocale } from '@/shared/lib/testing'
import { formatDate, formatDateTime, isoDate } from './format'
import type * as Locales from './locale'

// Формат даты — на строках локалей теста, а не сайта: ожидание «5 марта 2026 г.» не зависит от набора локалей сайта.
vi.mock('./locale', async (importOriginal) => {
  const locales = await importOriginal<typeof Locales>()
  const { TEST_LOCALES } = await import('@/shared/lib/testing')
  return { ...locales, ...locales.localeRules(TEST_LOCALES) }
})
const ru = testLocale('ru')

describe('i18n/format', () => {
  const date = new Date('2026-03-05T00:00:00Z')

  it('форматирует дату в UTC', () => {
    expect(formatDate(ru, date)).toBe('5 марта 2026 г.')
  })

  it('каждая локаль — свой формат Intl из своей строки дескриптора', () => {
    for (const { code, intl } of TEST_LOCALES) {
      const expected = new Intl.DateTimeFormat(intl, { dateStyle: 'long', timeZone: 'UTC' })
      expect(formatDate(testLocale(code), date), code).toBe(expected.format(date))
    }
  })

  it('isoDate — календарная дата без времени', () => {
    expect(isoDate(date)).toBe('2026-03-05')
  })

  it('дата без времени из frontmatter — тот же календарный день в любом часовом поясе', () => {
    const calendar = new Date('2026-03-05')
    expect(isoDate(calendar)).toBe('2026-03-05')
    expect(formatDate(ru, calendar)).toBe('5 марта 2026 г.')
  })

  it('formatDateTime — момент до секунды, явно в UTC', () => {
    const moment = new Date('2026-03-05T07:08:09.123Z')
    expect(formatDateTime(ru, moment)).toBe('5 марта 2026 г. в 07:08:09 UTC')
  })
})
