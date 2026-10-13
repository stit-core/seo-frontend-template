import { z } from 'zod'
import { SITE_DESCRIPTION, SITE_LOGO_PATH, SITE_NAME, SITE_SAME_AS } from '@/shared/config'
import { DEFAULT_LOCALE, isoDate, type Locale } from '@/shared/i18n'
import { absoluteUrl } from './urls'

// Только типы, которые reference-набор реально печатает; FAQPage/HowTo/SearchAction не
// генерируются (rich results сняты). Схемы — гейт на обязательные поля и абсолютные URL, не
// валидатор словаря schema.org; проверяют выход фабрик в unit-тесте, на рендере не исполняются:
// каждое ограничение уже держит производитель значения (absoluteUrl, isoDate, схема коллекции).
const CONTEXT = 'https://schema.org'
const absolute = z.url({ protocol: /^https?$/ })
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const OrganizationRefSchema = z.object({
  '@type': z.literal('Organization'),
  '@id': absolute,
  name: z.string().min(1),
})

const PersonSchema = z.object({
  '@type': z.literal('Person'),
  '@id': absolute,
  name: z.string().min(1),
  jobTitle: z.string().min(1).optional(),
})

const OrganizationSchema = z.object({
  '@context': z.literal(CONTEXT),
  '@type': z.literal('Organization'),
  '@id': absolute,
  name: z.string().min(1),
  url: absolute,
  logo: absolute,
  sameAs: z.array(absolute),
})

const WebSiteSchema = z.object({
  '@context': z.literal(CONTEXT),
  '@type': z.literal('WebSite'),
  '@id': absolute,
  name: z.string().min(1),
  description: z.string().min(1),
  url: absolute,
  inLanguage: z.string().min(2),
  publisher: OrganizationRefSchema,
})

const PostalAddressSchema = z.object({
  '@type': z.literal('PostalAddress'),
  addressCountry: z.string().length(2),
  postalCode: z.string().min(1),
  addressLocality: z.string().min(1),
  streetAddress: z.string().min(1),
})

const LocalBusinessSchema = z.object({
  '@context': z.literal(CONTEXT),
  '@type': z.literal('LocalBusiness'),
  '@id': absolute,
  name: z.string().min(1),
  legalName: z.string().min(1),
  description: z.string().min(1),
  url: absolute,
  image: absolute,
  email: z.email(),
  telephone: z.string().min(1),
  address: PostalAddressSchema,
  openingHours: z.string().min(1),
  sameAs: z.array(absolute),
})

const BreadcrumbListSchema = z.object({
  '@context': z.literal(CONTEXT),
  '@type': z.literal('BreadcrumbList'),
  itemListElement: z
    .array(
      z.object({
        '@type': z.literal('ListItem'),
        position: z.int().positive(),
        name: z.string().min(1),
        item: absolute.optional(),
      }),
    )
    .min(1),
})

const BlogPostingSchema = z.object({
  '@context': z.literal(CONTEXT),
  '@type': z.literal('BlogPosting'),
  headline: z.string().min(1),
  description: z.string().min(1),
  datePublished: calendarDate,
  dateModified: calendarDate.optional(),
  inLanguage: z.string().min(2),
  image: z.array(absolute).min(1).optional(),
  author: z.union([PersonSchema, OrganizationRefSchema]),
  publisher: OrganizationRefSchema,
  mainEntityOfPage: z.object({ '@type': z.literal('WebPage'), '@id': absolute }),
})

export const JsonLdSchema = z.discriminatedUnion('@type', [
  OrganizationSchema,
  WebSiteSchema,
  LocalBusinessSchema,
  BreadcrumbListSchema,
  BlogPostingSchema,
])
export type JsonLd = z.infer<typeof JsonLdSchema>

export interface Crumb {
  name: string
  // Корневой путь; у последней крошки (текущая страница) ссылки нет.
  href?: string | undefined
}

export interface LocalBusinessInput {
  // Всё перечисленное страница показывает читателю: разметка не добавляет фактов,
  // которых нет в тексте.
  legalName: string
  description: string
  email: string
  telephone: string
  address: { country: string; postalCode: string; locality: string; street: string }
  openingHours: string
}

export interface PersonInput {
  // id автора в реестре — из него @id; имя и роль — те же строки, что печатает подпись.
  id: string
  name: string
  jobTitle?: string | undefined
}

export interface BlogPostingInput {
  locale: Locale
  // Путь записи с префиксом локали.
  path: string
  title: string
  description: string
  published: Date
  updated?: Date | undefined
  // Корневые пути кадров обложки (16:9, 4:3, 1:1 — `articleImagesOf`); без обложки поле не выводится.
  imagePaths?: readonly string[] | undefined
  // Автор-человек; без него автор записи — организация.
  author?: PersonInput | undefined
}

// Организация у сайта одна: её узлы (Organization главной, LocalBusiness «о компании») и ссылки
// на неё несут один @id — по нему поисковик и ИИ-система склеивают страницы в одну сущность.
// Имя сущности — бренд; юрлицо — legalName.
const organizationId = () => `${absoluteUrl('/')}#org`
const webSiteId = () => `${absoluteUrl('/')}#website`

// Ссылка несёт и имя: блок читается и на странице, где узла организации нет.
function organizationRef() {
  return { '@type': 'Organization', '@id': organizationId(), name: SITE_NAME } as const
}

// Автор — тоже одна сущность на сайт: @id не зависит от страницы и локали, имя — по локали.
function person({ id, name, jobTitle }: PersonInput) {
  return {
    '@type': 'Person',
    '@id': `${absoluteUrl('/')}#author-${id}`,
    name,
    ...(jobTitle === undefined ? {} : { jobTitle }),
  } as const
}

export function organization(): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': organizationId(),
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: absoluteUrl(SITE_LOGO_PATH),
    sameAs: [...SITE_SAME_AS],
  }
}

// Имя сайта в выдаче Google читается с корня домена — WebSite печатает только `/`.
export function webSite(): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': webSiteId(),
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
    inLanguage: DEFAULT_LOCALE,
    publisher: organizationRef(),
  }
}

// Та же организация с адресом и часами работы — разметка страницы «о компании».
export function localBusiness(input: LocalBusinessInput): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'LocalBusiness',
    '@id': organizationId(),
    name: SITE_NAME,
    legalName: input.legalName,
    description: input.description,
    url: absoluteUrl('/'),
    image: absoluteUrl(SITE_LOGO_PATH),
    email: input.email,
    telephone: input.telephone,
    address: {
      '@type': 'PostalAddress',
      addressCountry: input.address.country,
      postalCode: input.address.postalCode,
      addressLocality: input.address.locality,
      streetAddress: input.address.street,
    },
    openingHours: input.openingHours,
    sameAs: [...SITE_SAME_AS],
  }
}

export function breadcrumbList(items: readonly Crumb[]): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.href === undefined ? {} : { item: absoluteUrl(item.href) }),
    })),
  }
}

export function blogPosting(input: BlogPostingInput): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    datePublished: isoDate(input.published),
    ...(input.updated === undefined ? {} : { dateModified: isoDate(input.updated) }),
    inLanguage: input.locale,
    ...(input.imagePaths === undefined ? {} : { image: input.imagePaths.map(absoluteUrl) }),
    author: input.author === undefined ? organizationRef() : person(input.author),
    publisher: organizationRef(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(input.path) },
  }
}

// `</script>` внутри строки закрыл бы data block раньше времени — экранируется `<`.
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
