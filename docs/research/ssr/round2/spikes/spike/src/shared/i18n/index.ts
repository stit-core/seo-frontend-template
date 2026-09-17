import { type I18n, setupI18n } from '@lingui/core'
import { messages as en } from './locales/en'
import { messages as ru } from './locales/ru'

export const SUPPORTED_LOCALES = ['ru', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ru'

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

// Per-request инстанс: setupI18n вместо глобального i18n из @lingui/core,
// иначе локаль одного запроса протекает в HTML другого.
export function createI18n(locale: Locale = DEFAULT_LOCALE): I18n {
  return setupI18n({ locale, messages: { ru, en } })
}

export type { I18n }
