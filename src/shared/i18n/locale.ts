// Дескриптор локалей — строка на язык: код (префикс адреса, `lang`, hreflang), локаль Intl для дат, локаль OG и
// самоназвание языка — подпись переключателя. Первая строка — дефолтная локаль: её адреса без префикса
// (routing.prefixDefaultLocale: false). Языки карты strategy сверяет с этим списком тест снимка; модуль листовой — его
// берут конфиг Astro и скрипты гейта.
export const LOCALES = [
  { code: 'ru', intl: 'ru-RU', og: 'ru_RU', name: 'Русский' },
  { code: 'en', intl: 'en-GB', og: 'en_US', name: 'English' },
] as const

export interface LocaleRow {
  readonly code: string
  readonly intl: string
  readonly og: string
  readonly name: string
}

export type Locale = (typeof LOCALES)[number]['code']

// Карта переводов страницы: локаль → адрес её версии на этом языке (своя — тоже). Одна версия — ни hreflang, ни
// перевода в переключателе.
export type Translations = Partial<Record<Locale, string>>

// Правила адреса по списку локалей: первая — без префикса, у остальных префикс — код. Список — параметр: у сайта это
// дескриптор, у скриптов гейта — локали проверяемого проекта, у тестов — фикстура.
export function localeRules<const R extends LocaleRow>(rows: readonly R[]) {
  type Code = R['code']
  const [first] = rows
  if (first === undefined) throw new Error('i18n: список локалей пуст')
  const fallback: Code = first.code
  const codes: readonly Code[] = rows.map((row) => row.code)
  const prefixed = codes.slice(1)
  const prefixOf = (locale: Code): string => (prefixed.includes(locale) ? `/${locale}` : '')
  // Локаль адреса — по префиксу пути: `/en` и `/en/…` — английская, без префикса — дефолтная.
  const localeOf = (path: string): Code =>
    prefixed.find((code) => path === `/${code}` || path.startsWith(`/${code}/`)) ?? fallback
  return {
    SUPPORTED_LOCALES: codes,
    DEFAULT_LOCALE: fallback,
    localeOf,
    // Путь без префикса локали и хвостового слеша — маршрут страницы: `/en/blog/` → `/blog`, `/en` → `/`.
    routeOf: (path: string): string => {
      const clean = path.replace(/(?<=.)\/+$/, '')
      return clean.slice(prefixOf(localeOf(clean)).length) || '/'
    },
    localePath: (locale: Code, path: string): string =>
      `${prefixOf(locale)}${path === '/' ? '' : path.replace(/\/+$/, '')}` || '/',
    // Сегмент `[...locale]` маршрута страницы: у дефолтной локали его нет.
    localeParam: (locale: Code): string | undefined => prefixOf(locale).slice(1) || undefined,
    localeInfo: (locale: Code): R => {
      const row = rows.find((candidate) => candidate.code === locale)
      if (row === undefined) throw new Error(`i18n: локали ${locale} нет в списке`)
      return row
    },
  }
}

export const {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  localeOf,
  routeOf,
  localePath,
  localeParam,
  localeInfo,
} = localeRules(LOCALES)
