import type { Locale } from '@/shared/i18n'

// Идентичность сайта — демо-значения шаблона; /de-template заменяет их проектными.
export const SITE_NAME = 'ssr-frontend-template'

// Описание сайта — JSON-LD WebSite.description на корне (дефолтная локаль).
export const SITE_DESCRIPTION = 'Шаблон индексируемого сайта: static-first, SSR по необходимости'

// Профили организации в других сервисах (JSON-LD Organization.sameAs).
export const SITE_SAME_AS: readonly string[] = [
  'https://git.stit.tech/stit-core/ssr-frontend-template',
]

// Логотип организации (JSON-LD Organization.logo) — из набора иконок public/.
export const SITE_LOGO_PATH = '/icon-512.png'

// Социальная карточка по умолчанию, 1200×630 (public/og-default.png); у записи с обложкой —
// её обложка.
export const OG_DEFAULT_IMAGE = {
  path: '/og-default.png',
  width: 1200,
  height: 630,
  alt: {
    ru: 'ssr-frontend-template — шаблон индексируемого сайта',
    en: 'ssr-frontend-template — indexable site template',
  } satisfies Record<Locale, string>,
} as const
