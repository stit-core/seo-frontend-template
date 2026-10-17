import { SITE_LOGO_PATH, SITE_NAME, SITE_SAME_AS } from '@/shared/config'
import { isoDate, type Locale } from '@/shared/i18n'
import { type FactValue, fail, type StrategyPage } from '@/shared/strategy'
import { absoluteUrl } from './urls'

// Узел JSON-LD страницы — тип schema.org и его свойства: страница печатает ровно типы `seo.structured_data` своего
// плана. Форму каждого типа держит тест фабрик (схемы Zod — `shared/lib/testing`): на рендере значения не
// разбираются, ограничения держит их производитель (absoluteUrl, isoDate, схема коллекции, факты strategy).
export type JsonLd = { readonly '@context': 'https://schema.org'; readonly '@type': string } & {
  readonly [property: string]: unknown
}

const CONTEXT = 'https://schema.org'

// Организация и сайт — одни сущности на все страницы: узлы и ссылки на них несут один @id, по нему поисковик и
// ИИ-система склеивают страницы. Ссылка несёт тип и имя: блок читается и на странице без узла.
const organizationId = () => `${absoluteUrl('/')}#org`
const webSiteId = () => `${absoluteUrl('/')}#website`
const organizationRef = () =>
  ({ '@type': 'Organization', '@id': organizationId(), name: SITE_NAME }) as const
const webSiteRef = () => ({ '@type': 'WebSite', '@id': webSiteId(), name: SITE_NAME }) as const

type Machine = NonNullable<FactValue['machine']>
type MachineOf<T extends Machine['type']> = Extract<Machine, { type: T }>

const DAYS = {
  mo: 'Monday',
  tu: 'Tuesday',
  we: 'Wednesday',
  th: 'Thursday',
  fr: 'Friday',
  sa: 'Saturday',
  su: 'Sunday',
} as const

// Разные значения одного вида — списком в порядке фактов, одно — значением, ни одного — свойства нет.
function oneOrMany<T>(values: readonly T[]): T | T[] | undefined {
  const unique = [...new Map(values.map((value) => [JSON.stringify(value), value])).values()]
  return unique.length > 1 ? unique : unique[0]
}

// Свойство без значения в разметку не идёт.
const present = <T extends Record<string, unknown>>(node: T) =>
  Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>
  }

// Контакты и реквизиты организации — `machine` фактов, которые называет страница, по таблице head-kit
// `jsonld_policy.fields_from_facts`: вид → свойство, часы — узел на ряд со временем hh:mm:ss. Вида нет в таблице (url,
// messenger, ОГРН, КПП) — в разметку он не идёт; строку canonical код не разбирает.
function contactsOf(facts: readonly FactValue[]) {
  const machines = facts.flatMap(({ machine }) => (machine === undefined ? [] : [machine]))
  const all = <T extends Machine['type']>(type: T) =>
    machines.filter((machine): machine is MachineOf<T> => machine.type === type)
  const legalId = (scheme: string) =>
    oneOrMany(
      all('legal-id')
        .filter((machine) => machine.scheme === scheme)
        .map(({ value }) => value),
    )
  const hours = all('opening-hours').flatMap((machine) =>
    machine.hours.map(({ days, opens, closes }) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days.map((day) => DAYS[day]),
      opens: `${opens}:00`,
      closes: `${closes}:00`,
    })),
  )
  return present({
    telephone: oneOrMany(all('telephone').map(({ value }) => value)),
    email: oneOrMany(all('email').map(({ value }) => value)),
    address: oneOrMany(
      all('postal-address').map((machine) =>
        present({
          '@type': 'PostalAddress',
          addressCountry: machine.country,
          addressRegion: machine.region,
          addressLocality: machine.locality,
          streetAddress: machine.street,
          postalCode: machine.postal_code,
        }),
      ),
    ),
    openingHoursSpecification: hours.length > 0 ? hours : undefined,
    geo: oneOrMany(
      all('geo').map(({ lat, lon }) => ({
        '@type': 'GeoCoordinates',
        latitude: lat,
        longitude: lon,
      })),
    ),
    taxID: legalId('inn'),
    vatID: legalId('vat'),
  })
}

// Организация сайта: её узлы (Organization главной, LocalBusiness контактов) несут одно ядро — имя (бренд), юрлицо
// (оператор плана), адрес сайта, логотип и профили — и контакты с реквизитами, которые называет страница.
function organizationOf(page: Pick<StrategyPage, 'operator' | 'facts'>) {
  return {
    '@id': organizationId(),
    name: SITE_NAME,
    ...(page.operator === undefined ? {} : { legalName: page.operator.text }),
    url: absoluteUrl('/'),
    logo: absoluteUrl(SITE_LOGO_PATH),
    sameAs: [...SITE_SAME_AS],
    ...contactsOf(page.facts),
  }
}

// Часы работы и координаты — свойства места: у Organization их нет (schema.org), их несёт LocalBusiness.
export function organization(page: Pick<StrategyPage, 'operator' | 'facts'>) {
  const { openingHoursSpecification: _hours, geo: _geo, ...node } = organizationOf(page)
  return { '@context': CONTEXT, '@type': 'Organization', ...node } as const
}

// Каналы страницы — ссылки `tel:` и `mailto:` её секций.
function channelsOf({ id, sections }: Pick<StrategyPage, 'id' | 'sections'>) {
  return sections.flatMap((section) =>
    [section.slots, ...Object.values(section.groups).flat()].flatMap((slots) =>
      Object.entries(slots).flatMap(([element, value]) =>
        [value].flat().flatMap((item) => {
          const href = typeof item === 'object' && 'href' in item ? item.href : undefined
          return href !== undefined && /^(?:tel|mailto):/.test(href)
            ? [{ key: `${id}/${section.id}/${element}`, href }]
            : []
        }),
      ),
    ),
  )
}

// LocalBusiness — организация с адресом, и NAP у страницы и разметки один: адрес обязателен (Google), каждый канал,
// который страница показывает ссылкой, — `machine` факта, который она называет. Нет — ошибка сборки с ключом: разметка
// не теряет контакт, который видит человек, и не расходится с ним.
export function localBusiness(page: Pick<StrategyPage, 'id' | 'operator' | 'facts' | 'sections'>) {
  const node = { '@context': CONTEXT, '@type': 'LocalBusiness', ...organizationOf(page) } as const
  if (node.address === undefined) {
    fail(
      `${page.id}/seo/structured_data`,
      'LocalBusiness без факта адреса (machine postal-address)',
    )
  }
  const carried = new Set(
    page.facts.flatMap(({ machine }) =>
      machine?.type === 'telephone'
        ? [`tel:${machine.value}`]
        : machine?.type === 'email'
          ? [`mailto:${machine.value}`]
          : [],
    ),
  )
  for (const { key, href } of channelsOf(page)) {
    if (!carried.has(href)) fail(key, `${href} — нет факта страницы с этим machine`)
  }
  return node
}

// Сайт — узел главной каждого языка: имя (бренд), адрес, язык страницы и издатель — организация по @id.
export function webSite(locale: Locale) {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': webSiteId(),
    name: SITE_NAME,
    url: absoluteUrl('/'),
    inLanguage: locale,
    publisher: organizationRef(),
  } as const
}

export interface WebPageInput {
  locale: Locale
  // Путь страницы с префиксом локали.
  path: string
  // Имя страницы — заголовок её меты.
  name: string
}

// Страница сайта: адрес, имя и язык; часть сайта — по @id.
function webPage<T extends string>(type: T, { locale, path, name }: WebPageInput) {
  return {
    '@context': CONTEXT,
    '@type': type,
    url: absoluteUrl(path),
    name,
    inLanguage: locale,
    isPartOf: webSiteRef(),
  } as const
}

// «О компании» и контакты — страницы об организации.
export const aboutPage = (input: WebPageInput) =>
  ({ ...webPage('AboutPage', input), about: organizationRef() }) as const
export const contactPage = (input: WebPageInput) =>
  ({ ...webPage('ContactPage', input), about: organizationRef() }) as const
// Список записей (блог, тег) — собрание страниц, которое издаёт организация.
export const collectionPage = (input: WebPageInput) =>
  ({ ...webPage('CollectionPage', input), publisher: organizationRef() }) as const

export interface Crumb {
  name: string
  // Корневой путь; у последней крошки (текущая страница) ссылки нет.
  href?: string | undefined
}

export function breadcrumbList(items: readonly Crumb[]) {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.href === undefined ? {} : { item: absoluteUrl(item.href) }),
    })),
  } as const
}

export interface PersonInput {
  // id автора в реестре — из него @id; имя и роль — те же строки, что печатает подпись.
  id: string
  name: string
  jobTitle?: string | undefined
  // Профиль реестра: корневой путь страницы сайта или адрес профиля вне его.
  profile: string
}

export interface ArticleInput {
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

// Автор — тоже одна сущность на сайт: @id не зависит от страницы и локали, имя и роль — по локали, адрес — его
// профиль (страница сайта — абсолютным адресом).
function person({ id, name, jobTitle, profile }: PersonInput) {
  return {
    '@type': 'Person',
    '@id': `${absoluteUrl('/')}#author-${id}`,
    name,
    ...(jobTitle === undefined ? {} : { jobTitle }),
    url: profile.startsWith('/') ? absoluteUrl(profile) : profile,
  } as const
}

export function article(input: ArticleInput) {
  return {
    '@context': CONTEXT,
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: isoDate(input.published),
    ...(input.updated === undefined ? {} : { dateModified: isoDate(input.updated) }),
    inLanguage: input.locale,
    ...(input.imagePaths === undefined ? {} : { image: input.imagePaths.map(absoluteUrl) }),
    author: input.author === undefined ? organizationRef() : person(input.author),
    publisher: organizationRef(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(input.path) },
  } as const
}

// `</script>` внутри строки закрыл бы data block раньше времени — экранируется `<`.
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
