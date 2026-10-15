import type * as I18n from '@/shared/i18n'

// Локали теста — свой дескриптор: механику локалей (префиксы адресов, переводы, переключатель, записи на двух языках)
// тест судит на ru, en и de при любом наборе локалей сайта.
export const TEST_LOCALES = [
  { code: 'ru', intl: 'ru-RU', og: 'ru_RU', name: 'Русский' },
  { code: 'en', intl: 'en-GB', og: 'en_US', name: 'English' },
  { code: 'de', intl: 'de-DE', og: 'de_DE', name: 'Deutsch' },
] as const

type TestCode = (typeof TEST_LOCALES)[number]['code']

// Код локали теста там, где тип ждёт локаль сайта. Через строку: локали сайта бывают и шире, и уже, и ровно те же.
export function testLocale(code: TestCode): I18n.Locale {
  const text: string = code
  return text as I18n.Locale
}

// Модуль `@/shared/i18n` на локалях теста — фабрика `vi.mock`: правила адреса — по TEST_LOCALES; строка словаря и
// дата — дефолтной локали сайта, у не первой локали теста — с её кодом в скобках: тест видит, на каком языке компонент
// их спросил, и не зависит от словарей сайта.
export async function withTestLocales(importOriginal: () => Promise<unknown>) {
  const i18n = (await importOriginal()) as typeof I18n
  const marked = (locale: string, text: string) =>
    locale === TEST_LOCALES[0].code ? text : `${text} (${locale})`
  return {
    ...i18n,
    ...i18n.localeRules(TEST_LOCALES),
    t: (locale: string, key: I18n.DictKey, params?: Readonly<Record<string, string | number>>) =>
      marked(locale, i18n.t(i18n.DEFAULT_LOCALE, key, params)),
    formatDate: (locale: string, date: Date) =>
      marked(locale, i18n.formatDate(i18n.DEFAULT_LOCALE, date)),
    formatDateTime: (locale: string, date: Date) =>
      marked(locale, i18n.formatDateTime(i18n.DEFAULT_LOCALE, date)),
  }
}
