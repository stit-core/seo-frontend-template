import { z } from 'zod'

// Форма узлов JSON-LD сайта — гейт тестов на обязательные свойства, абсолютные URL и формат значений, а не валидатор
// словаря schema.org: фабрики `shared/seo` значения не разбирают, их выход сверяют тесты фабрик и страниц. Лишнее
// свойство — тоже ошибка: тип печатает ровно то, что ему положено.
const CONTEXT = z.literal('https://schema.org')
const absolute = z.url({ protocol: /^https?$/ })
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
// Время часов работы — hh:mm:ss (head-kit `recipes.local_business`).
const time = z.string().regex(/^(?:[01]\d|2[0-4]):[0-5]\d:[0-5]\d$/)
const text = z.string().min(1)
const language = z.string().min(2)

// Ссылка на сущность сайта — тип, @id и имя: блок читается и на странице без её узла.
const ref = <T extends string>(type: T) =>
  z.strictObject({ '@type': z.literal(type), '@id': absolute, name: text })
const OrganizationRef = ref('Organization')
const WebSiteRef = ref('WebSite')

// Вид контакта или реквизита: одно значение или список разных (head-kit `fields_from_facts`).
const oneOrMany = <T extends z.ZodType>(value: T) => z.union([value, z.array(value).min(2)])

const PostalAddress = z.strictObject({
  '@type': z.literal('PostalAddress'),
  addressCountry: z.string().regex(/^[A-Z]{2}$/),
  addressRegion: text.optional(),
  addressLocality: text,
  streetAddress: text,
  postalCode: text.optional(),
})

const OpeningHours = z.strictObject({
  '@type': z.literal('OpeningHoursSpecification'),
  dayOfWeek: z
    .array(z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']))
    .min(1),
  opens: time,
  closes: time,
})

const GeoCoordinates = z.strictObject({
  '@type': z.literal('GeoCoordinates'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

const organization = {
  '@context': CONTEXT,
  '@id': absolute,
  name: text,
  legalName: text.optional(),
  url: absolute,
  logo: absolute,
  sameAs: z.array(absolute),
  telephone: oneOrMany(z.string().regex(/^\+[1-9]\d{6,14}$/)).optional(),
  email: oneOrMany(z.email()).optional(),
  address: oneOrMany(PostalAddress).optional(),
  openingHoursSpecification: z.array(OpeningHours).min(1).optional(),
  geo: oneOrMany(GeoCoordinates).optional(),
  taxID: oneOrMany(text).optional(),
  vatID: oneOrMany(text).optional(),
}

const OrganizationSchema = z.strictObject({
  ...organization,
  '@type': z.literal('Organization'),
})

// LocalBusiness — организация с адресом: без него Google тип не принимает.
const LocalBusinessSchema = z.strictObject({
  ...organization,
  '@type': z.literal('LocalBusiness'),
  address: oneOrMany(PostalAddress),
})

const WebSiteSchema = z.strictObject({
  '@context': CONTEXT,
  '@type': z.literal('WebSite'),
  '@id': absolute,
  name: text,
  url: absolute,
  inLanguage: language,
  publisher: OrganizationRef,
})

const webPage = {
  '@context': CONTEXT,
  url: absolute,
  name: text,
  inLanguage: language,
  isPartOf: WebSiteRef,
}

const AboutPageSchema = z.strictObject({
  ...webPage,
  '@type': z.literal('AboutPage'),
  about: OrganizationRef,
})
const ContactPageSchema = z.strictObject({
  ...webPage,
  '@type': z.literal('ContactPage'),
  about: OrganizationRef,
})
const CollectionPageSchema = z.strictObject({
  ...webPage,
  '@type': z.literal('CollectionPage'),
  publisher: OrganizationRef,
})

const BreadcrumbListSchema = z.strictObject({
  '@context': CONTEXT,
  '@type': z.literal('BreadcrumbList'),
  itemListElement: z
    .array(
      z.strictObject({
        '@type': z.literal('ListItem'),
        position: z.int().positive(),
        name: text,
        item: absolute.optional(),
      }),
    )
    .min(1),
})

const Person = z.strictObject({
  '@type': z.literal('Person'),
  '@id': absolute,
  name: text,
  jobTitle: text.optional(),
  url: absolute,
})

const ArticleSchema = z.strictObject({
  '@context': CONTEXT,
  '@type': z.literal('Article'),
  headline: text,
  description: text,
  datePublished: calendarDate,
  dateModified: calendarDate.optional(),
  inLanguage: language,
  image: z.array(absolute).min(1).optional(),
  author: z.union([Person, OrganizationRef]),
  publisher: OrganizationRef,
  mainEntityOfPage: z.strictObject({ '@type': z.literal('WebPage'), '@id': absolute }),
})

export const JsonLdSchema = z.discriminatedUnion('@type', [
  OrganizationSchema,
  LocalBusinessSchema,
  WebSiteSchema,
  AboutPageSchema,
  ContactPageSchema,
  CollectionPageSchema,
  BreadcrumbListSchema,
  ArticleSchema,
])
