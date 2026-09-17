import type { Locale } from './locale'

// Строки каркаса (шапка, подвал, 404); контент страниц — в самих страницах.
const ru = {
  'nav.label': 'Основная навигация',
  'nav.skip': 'К содержимому',
  'lang.name': 'Русский',
  'footer.note': 'шаблон индексируемого сайта',
  'notFound.title': 'Страница не найдена',
  'notFound.lead': 'Проверьте адрес или вернитесь на главную.',
  'notFound.home': 'На главную',
} as const

export type DictKey = keyof typeof ru
type Dict = Record<DictKey, string>

const en: Dict = {
  'nav.label': 'Main navigation',
  'nav.skip': 'Skip to content',
  'lang.name': 'English',
  'footer.note': 'indexable site template',
  'notFound.title': 'Page not found',
  'notFound.lead': 'Check the address or go back to the home page.',
  'notFound.home': 'Home',
}

const DICTS: Record<Locale, Dict> = { ru, en }

export function t(locale: Locale, key: DictKey): string {
  return DICTS[locale][key]
}
