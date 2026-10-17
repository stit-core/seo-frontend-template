import { OG_DEFAULT_IMAGE, SITE_NAME } from '@/shared/config'
import { type Locale, t } from '@/shared/i18n'

// Мета страницы — copy deck как есть: заголовок (бренд в нём пишет strategy) и описание; тексты превью ссылки — свои у
// copy deck (`og_title`, `og_description`), без них — заголовок и описание. У записи коллекции — её поля.
export interface PageMeta {
  title: string
  description: string
  ogTitle?: string | undefined
  ogDescription?: string | undefined
}

export interface OgImage {
  // Корневой путь картинки; абсолютный URL добавляет absoluteUrl.
  path: string
  width: number
  height: number
  alt: string
}

export function defaultOgImage(locale: Locale): OgImage {
  const { path, width, height } = OG_DEFAULT_IMAGE
  return { path, width, height, alt: t(locale, 'og.alt', { site: SITE_NAME }) }
}
