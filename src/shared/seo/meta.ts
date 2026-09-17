import { OG_DEFAULT_IMAGE, SITE_NAME } from '@/shared/config'
import type { Locale } from '@/shared/i18n'

export interface OgImage {
  // Корневой путь картинки; абсолютный URL добавляет absoluteUrl.
  path: string
  width: number
  height: number
  alt: string
}

// og:locale — language_TERRITORY (ogp.me).
export const OG_LOCALE: Record<Locale, string> = { ru: 'ru_RU', en: 'en_US' }

// Один шаблон для <title> и og:title: Google берёт title link и из og:title, расходиться им нельзя.
export function pageTitle(title: string): string {
  return `${title} — ${SITE_NAME}`
}

export function defaultOgImage(locale: Locale): OgImage {
  const { path, width, height, alt } = OG_DEFAULT_IMAGE
  return { path, width, height, alt: alt[locale] }
}
