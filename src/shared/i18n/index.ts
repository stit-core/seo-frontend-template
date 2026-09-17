import { i18n } from '@lingui/core'

const SUPPORTED_LOCALES = ['ru', 'en'] as const
type Locale = (typeof SUPPORTED_LOCALES)[number]

const DEFAULT_LOCALE: Locale = 'ru'

// Каталоги подгружаются лениво — неактивная локаль не попадает в бандл.
const catalogLoaders: Record<Locale, () => Promise<{ messages: Record<string, string> }>> = {
  ru: () => import('./locales/ru'),
  en: () => import('./locales/en'),
}

export async function activateLocale(locale: Locale): Promise<void> {
  const { messages } = await catalogLoaders[locale]()
  i18n.load(locale, messages)
  i18n.activate(locale)
}

export async function initI18n(locale: Locale = DEFAULT_LOCALE): Promise<void> {
  await activateLocale(locale)
}

export type { Locale }
export { DEFAULT_LOCALE, i18n, SUPPORTED_LOCALES }
