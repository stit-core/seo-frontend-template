import { type Locale, localeInfo } from './locale'

// Даты контента — календарные (frontmatter `2026-01-01` → полночь UTC); форматируем
// в UTC, иначе в западных часовых поясах сборка сдвинет день назад.
export function formatDate(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(localeInfo(locale).intl, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date)
}

// Момент времени (серверное время on-demand страниц) — до секунды и явно в UTC:
// часовой пояс контейнера не должен менять текст между средами.
export function formatDateTime(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(localeInfo(locale).intl, {
    dateStyle: 'long',
    timeStyle: 'long',
    timeZone: 'UTC',
  }).format(date)
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
