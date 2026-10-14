import { OG_DEFAULT_IMAGE, SITE_NAME } from '@/shared/config'
import { type Locale, t } from '@/shared/i18n'

export interface OgImage {
  // Корневой путь картинки; абсолютный URL добавляет absoluteUrl.
  path: string
  width: number
  height: number
  alt: string
}

// Один шаблон для <title> и og:title: Google берёт title link и из og:title, расходиться им нельзя.
export function pageTitle(title: string): string {
  return `${title} — ${SITE_NAME}`
}

export function defaultOgImage(locale: Locale): OgImage {
  const { path, width, height } = OG_DEFAULT_IMAGE
  return { path, width, height, alt: t(locale, 'og.alt', { site: SITE_NAME }) }
}
