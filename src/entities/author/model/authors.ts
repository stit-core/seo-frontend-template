import type { Locale } from '@/shared/i18n'

export interface Author {
  // Имя и роль — как их читает человек на каждой локали: их печатает подпись под заголовком и
  // размечает Person. Роль — должность или специализация, по которой автору можно верить.
  name: Record<Locale, string>
  jobTitle?: Record<Locale, string>
}

// Реестр авторов: id — то, что запись называет в поле `author`. Автор — реальный человек, который
// написал или проверил текст; вымышленного демо-автора у шаблона нет, поэтому реестр пуст.
export const AUTHORS: Readonly<Record<string, Author>> = {}
