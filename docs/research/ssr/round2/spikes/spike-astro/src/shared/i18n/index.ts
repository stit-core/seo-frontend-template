import { en } from './locales/en'
import { type Dict, ru } from './locales/ru'

export const SUPPORTED_LOCALES = ['ru', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ru'

const DICTS: Record<Locale, Dict> = { ru, en }

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function t(locale: Locale, key: keyof Dict): string {
  return DICTS[locale][key]
}

export type { Dict }
