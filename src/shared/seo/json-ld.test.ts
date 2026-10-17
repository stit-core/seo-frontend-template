import { z } from 'zod'
import { SITE_LOGO_PATH, SITE_NAME, SITE_SAME_AS } from '@/shared/config'
import { SUPPORTED_LOCALES } from '@/shared/i18n'
import { JsonLdSchema, testLocale } from '@/shared/lib/testing'
import { type FactValue, pageLocales, type Section, strategyPage } from '@/shared/strategy'
import headKit from '../../../strategy/kb/site/07-seo-geo-performance-analytics/head-kit.yaml'
import {
  aboutPage,
  article,
  breadcrumbList,
  collectionPage,
  contactPage,
  localBusiness,
  organization,
  serializeJsonLd,
  webSite,
} from './json-ld'

const ORIGIN = 'https://demo.example'
// Адреса узлов графа — литералами: по ним страницы сайта склеиваются в одну сущность.
const ORG_ID = 'https://demo.example/#org'
const organizationRef = { '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME }
const webSiteRef = { '@type': 'WebSite', '@id': 'https://demo.example/#website', name: SITE_NAME }

type Machine = NonNullable<FactValue['machine']>
const fact = (id: string, text: string, machine?: Machine): FactValue => ({
  id,
  text,
  machine,
  binds: [],
})

// Факты страницы фикстуры — каждый вид machine базы: телефон дважды и ещё раз тот же номер, часы двумя рядами; вид вне
// таблицы head-kit (адрес ссылки, мессенджер, ОГРН) и факт без machine — текст, не свойство.
const FACTS = [
  fact('company-name', 'ООО «Тест»'),
  fact('phone-office', '+7 900 111-22-33', { type: 'telephone', value: '+79001112233' }),
  fact('phone-sales', '+7 900 444-55-66', { type: 'telephone', value: '+79004445566' }),
  fact('phone-copy', '8 900 111-22-33', { type: 'telephone', value: '+79001112233' }),
  fact('company-email', 'team@test.example', { type: 'email', value: 'team@test.example' }),
  fact('company-address', '141400, Московская область, Химки, ул. Тестовая, 5', {
    type: 'postal-address',
    country: 'RU',
    region: 'Московская область',
    locality: 'Химки',
    street: 'ул. Тестовая, 5',
    postal_code: '141400',
  }),
  fact('company-hours', 'Пн–Пт 9:30–18:00, Сб 10–15', {
    type: 'opening-hours',
    hours: [
      { days: ['mo', 'tu', 'we', 'th', 'fr'], opens: '09:30', closes: '18:00' },
      { days: ['sa'], opens: '10:00', closes: '15:00' },
    ],
  }),
  fact('company-geo', '55.88916, 37.43021', { type: 'geo', lat: 55.88916, lon: 37.43021 }),
  fact('company-inn', 'ИНН 5047000000', { type: 'legal-id', scheme: 'inn', value: '5047000000' }),
  fact('company-vat', 'USt-IdNr. DE123456789', {
    type: 'legal-id',
    scheme: 'vat',
    value: 'DE123456789',
  }),
  fact('company-ogrn', 'ОГРН 1025000000000', {
    type: 'legal-id',
    scheme: 'ogrn',
    value: '1025000000000',
  }),
  fact('company-site', 'test.example', { type: 'url', value: 'https://test.example' }),
  fact('company-chat', 'Телеграм', {
    type: 'messenger',
    network: 'telegram',
    value: 'https://t.me/test',
  }),
]

// Секция контактов страницы фикстуры: каналы — ссылки телефона и почты.
const contacts = (slots: Section['slots']): Section => ({
  id: 'contacts',
  role: 'contacts',
  block: 'contact-details',
  variant: 'compact',
  slots,
  groups: {},
})
const PAGE = {
  id: 'kontakty',
  operator: fact('company-name', 'ООО «Тест»'),
  facts: FACTS,
  sections: [
    contacts({
      phone: { href: 'tel:+79004445566' },
      email: { href: 'mailto:team@test.example' },
    }),
  ],
}

const CORE = {
  '@id': ORG_ID,
  name: SITE_NAME,
  legalName: 'ООО «Тест»',
  url: `${ORIGIN}/`,
  logo: `${ORIGIN}${SITE_LOGO_PATH}`,
  sameAs: SITE_SAME_AS,
  telephone: ['+79001112233', '+79004445566'],
  email: 'team@test.example',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'RU',
    addressRegion: 'Московская область',
    addressLocality: 'Химки',
    streetAddress: 'ул. Тестовая, 5',
    postalCode: '141400',
  },
  taxID: '5047000000',
  vatID: 'DE123456789',
}

// Фабрики не разбирают результат на рендере — схему к их выходу применяют тесты.
describe('seo/json-ld', () => {
  beforeEach(() => vi.stubEnv('SITE_URL', ORIGIN))
  afterEach(() => vi.unstubAllEnvs())

  it('Organization: @id сущности, имя — бренд, юрлицо — оператор, контакты и реквизиты — machine фактов страницы; проходит схему', () => {
    const data = organization(PAGE)
    expect(data).toEqual({ '@context': 'https://schema.org', '@type': 'Organization', ...CORE })
    expect(JsonLdSchema.parse(data)).toEqual(data)
    // Факты без вида таблицы — ни одного свойства: остаётся ядро.
    const plain = organization({ operator: undefined, facts: [fact('company-name', 'ООО «Тест»')] })
    expect(plain).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': ORG_ID,
      name: SITE_NAME,
      url: `${ORIGIN}/`,
      logo: `${ORIGIN}${SITE_LOGO_PATH}`,
      sameAs: SITE_SAME_AS,
    })
    expect(JsonLdSchema.parse(plain)).toEqual(plain)
  })

  it('LocalBusiness: то же ядро, адрес, часы рядами hh:mm:ss и координаты; проходит схему', () => {
    const data = localBusiness(PAGE)
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      ...CORE,
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:30:00',
          closes: '18:00:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Saturday'],
          opens: '10:00:00',
          closes: '15:00:00',
        },
      ],
      geo: { '@type': 'GeoCoordinates', latitude: 55.88916, longitude: 37.43021 },
    })
    expect(JsonLdSchema.parse(data)).toEqual(data)
  })

  // NAP страницы и разметки один: контакт, который человек видит ссылкой, разметка несёт тем же значением.
  it('LocalBusiness: без адреса и с каналом страницы мимо machine её фактов — ошибка с ключом', () => {
    const facts = FACTS.filter(({ id }) => id !== 'company-address')
    expect(() => localBusiness({ ...PAGE, facts })).toThrow(
      'strategy: kontakty/seo/structured_data — LocalBusiness без факта адреса',
    )
    for (const href of ['tel:+79007778899', 'mailto:sales@test.example']) {
      expect(() => localBusiness({ ...PAGE, sections: [contacts({ phone: { href } })] })).toThrow(
        `strategy: kontakty/contacts/phone — ${href} — нет факта страницы с этим machine`,
      )
    }
    const withoutPhones = FACTS.filter(({ machine }) => machine?.type !== 'telephone')
    expect(() => localBusiness({ ...PAGE, facts: withoutPhones })).toThrow(
      'kontakty/contacts/phone — tel:+79004445566',
    )
  })

  // Таблица «вид machine → свойство» — копия каталога head-kit в strategy/kb: реализация следует ей, а не своей памяти.
  it('свойства организации — таблица head-kit fields_from_facts: каждый вид, его свойство, тип узла, поля, дни и схемы реквизита', () => {
    const Row = z.object({
      property: z.string().optional(),
      type: z.string().optional(),
      fields: z.record(z.string(), z.string()).optional(),
      days: z.record(z.string(), z.string()).optional(),
      property_by_scheme: z.record(z.string(), z.string()).optional(),
    })
    const table = z
      .object({ jsonld_policy: z.object({ fields_from_facts: z.record(z.string(), Row) }) })
      .parse(headKit).jsonld_policy.fields_from_facts
    const samples = FACTS.flatMap(({ machine }) => (machine === undefined ? [] : [machine]))
    const node: Record<string, unknown> = localBusiness(PAGE)
    expect(Object.keys(table).sort()).toEqual(
      [...new Set(samples.map(({ type }) => type))].filter((type) => type in table).sort(),
    )
    for (const [kind, row] of Object.entries(table)) {
      const sample = samples.find((machine) => machine.type === kind) as Record<string, unknown>
      if (row.property_by_scheme) {
        for (const [scheme, property] of Object.entries(row.property_by_scheme)) {
          const id = samples.find(
            (machine) => machine.type === 'legal-id' && machine.scheme === scheme,
          )
          expect(node[property], `${kind}.${scheme}`).toBe(id?.type === 'legal-id' && id.value)
        }
        continue
      }
      const value = [node[row.property ?? '']].flat()[0] as Record<string, unknown>
      expect(value, kind).toBeDefined()
      if (row.type === undefined) {
        expect(value, kind).toBe(sample.value)
        continue
      }
      expect(value['@type'], kind).toBe(row.type)
      // У часов поля — у ряда (узел на элемент hours), у прочих видов — у самого machine.
      const source = (kind === 'opening-hours' ? (sample.hours as unknown[])[0] : sample) as Record<
        string,
        unknown
      >
      for (const [field, property] of Object.entries(row.fields ?? {})) {
        const expected =
          field === 'days'
            ? (source.days as string[]).map((day) => row.days?.[day])
            : kind === 'opening-hours'
              ? `${source[field] as string}:00`
              : source[field]
        expect(value[property], `${kind}.${field}`).toEqual(expected)
      }
    }
    // Виды вне таблицы — адрес ссылки, мессенджер, ОГРН — в разметку не идут.
    for (const value of ['"https://test.example"', 'https://t.me/test', '1025000000000']) {
      expect(JSON.stringify(node)).not.toContain(value)
    }
  })

  // Организация — один раз и одними данными (head-kit: «не в двух местах с разными данными»): узел главной и узел
  // контактов на каждом языке сайта — одно ядро и одни реквизиты.
  it('данные шаблона: Organization главной и LocalBusiness контактов — одна сущность на каждом языке; проходят схему', () => {
    const shared = ['@id', 'name', 'legalName', 'url', 'logo', 'sameAs', 'taxID', 'vatID']
    const pick = (node: Record<string, unknown>) =>
      Object.fromEntries(shared.filter((key) => key in node).map((key) => [key, node[key]]))
    const locales = SUPPORTED_LOCALES.filter(
      (locale): boolean =>
        pageLocales('home').includes(locale) && pageLocales('contacts').includes(locale),
    )
    expect(locales.length).toBeGreaterThan(0)
    for (const locale of locales) {
      const home = organization(strategyPage('home', locale))
      const business = localBusiness(strategyPage('contacts', locale))
      expect(JsonLdSchema.parse(home), locale).toEqual(home)
      expect(JsonLdSchema.parse(business), locale).toEqual(business)
      expect(pick(business), locale).toEqual(pick(home))
    }
  })

  it('WebSite: свой @id, корень домена, язык страницы, издатель — организация по @id; проходит схему', () => {
    const data = webSite(testLocale('en'))
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': 'https://demo.example/#website',
      name: SITE_NAME,
      url: `${ORIGIN}/`,
      inLanguage: 'en',
      publisher: organizationRef,
    })
    expect(JsonLdSchema.parse(data)).toEqual(data)
  })

  it('AboutPage, ContactPage — страницы об организации, CollectionPage — её список; часть сайта по @id; проходят схему', () => {
    const input = { locale: testLocale('ru'), path: '/o-nas', name: 'О компании — Бренд' }
    const page = {
      '@context': 'https://schema.org',
      url: `${ORIGIN}/o-nas`,
      name: 'О компании — Бренд',
      inLanguage: 'ru',
      isPartOf: webSiteRef,
    }
    expect(aboutPage(input)).toEqual({ ...page, '@type': 'AboutPage', about: organizationRef })
    expect(contactPage(input)).toEqual({ ...page, '@type': 'ContactPage', about: organizationRef })
    expect(collectionPage(input)).toEqual({
      ...page,
      '@type': 'CollectionPage',
      publisher: organizationRef,
    })
    for (const data of [aboutPage(input), contactPage(input), collectionPage(input)]) {
      expect(JsonLdSchema.parse(data)).toEqual(data)
    }
  })

  it('BreadcrumbList: позиции с 1, у последней крошки нет item, проходит схему', () => {
    const data = breadcrumbList([
      { name: 'Главная', href: '/' },
      { name: 'Блог', href: '/blog' },
      { name: 'Запись' },
    ])
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Блог', item: `${ORIGIN}/blog` },
        { '@type': 'ListItem', position: 3, name: 'Запись' },
      ],
    })
    expect(JsonLdSchema.parse(data)).toEqual(data)
  })

  it('Article: даты, dateModified и кадры обложки при наличии, автор и издатель — организация по @id; проходит схему', () => {
    const base = {
      locale: testLocale('ru'),
      path: '/blog/x',
      title: 'Заголовок',
      description: 'Описание',
      published: new Date('2026-09-08'),
    }
    const plain = article(base)
    expect(plain).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Заголовок',
      description: 'Описание',
      datePublished: '2026-09-08',
      inLanguage: 'ru',
      author: organizationRef,
      publisher: organizationRef,
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${ORIGIN}/blog/x` },
    })
    expect(JsonLdSchema.parse(plain)).toEqual(plain)

    const full = article({
      ...base,
      updated: new Date('2026-09-10'),
      imagePaths: [
        '/_astro/cover.abc_16x9.jpg',
        '/_astro/cover.abc_4x3.jpg',
        '/_astro/cover.abc_1x1.jpg',
      ],
    })
    expect(full).toEqual({
      ...plain,
      dateModified: '2026-09-10',
      image: [
        `${ORIGIN}/_astro/cover.abc_16x9.jpg`,
        `${ORIGIN}/_astro/cover.abc_4x3.jpg`,
        `${ORIGIN}/_astro/cover.abc_1x1.jpg`,
      ],
    })
    expect(JsonLdSchema.parse(full)).toEqual(full)
  })

  it('Article с автором: Person со своим @id, именем, ролью и адресом профиля реестра; издатель — организация; проходит схему', () => {
    const input = {
      locale: testLocale('ru'),
      path: '/blog/x',
      title: 'Заголовок',
      description: 'Описание',
      published: new Date('2026-09-08'),
    }
    const author = { id: 'anna-smirnova', name: 'Анна Смирнова', profile: '/o-nas/anna' }
    const signed = article({ ...input, author: { ...author, jobTitle: 'редактор блога' } })
    expect(signed).toEqual({
      ...article(input),
      author: {
        '@type': 'Person',
        '@id': 'https://demo.example/#author-anna-smirnova',
        name: 'Анна Смирнова',
        jobTitle: 'редактор блога',
        url: `${ORIGIN}/o-nas/anna`,
      },
    })
    expect(signed).toHaveProperty('publisher', organizationRef)
    expect(JsonLdSchema.parse(signed)).toEqual(signed)

    // Профиль вне сайта — его адрес как есть.
    const outside = article({
      ...input,
      author: { ...author, profile: 'https://ru.wikipedia.org/wiki/Anna' },
    })
    expect(outside).toHaveProperty('author', {
      '@type': 'Person',
      '@id': 'https://demo.example/#author-anna-smirnova',
      name: 'Анна Смирнова',
      url: 'https://ru.wikipedia.org/wiki/Anna',
    })
    expect(JsonLdSchema.parse(outside)).toEqual(outside)
  })

  it('схема отвергает относительные URL, узел без @id, лишнее свойство, LocalBusiness без адреса, пустые крошки и чужие типы', () => {
    const node = organization({ operator: undefined, facts: [] })
    expect(JsonLdSchema.safeParse(node).success).toBe(true)
    expect(JsonLdSchema.safeParse({ ...node, url: '/', logo: '/logo.png' }).success).toBe(false)
    const { '@id': _omit, ...withoutId } = node
    expect(JsonLdSchema.safeParse(withoutId).success).toBe(false)
    expect(JsonLdSchema.safeParse({ ...node, openingHours: 'Mo-Fr 10:00-19:00' }).success).toBe(
      false,
    )
    expect(JsonLdSchema.safeParse({ ...node, '@type': 'LocalBusiness' }).success).toBe(false)
    expect(JsonLdSchema.safeParse(breadcrumbList([])).success).toBe(false)
    expect(
      JsonLdSchema.safeParse({ '@context': 'https://schema.org', '@type': 'FAQPage' }).success,
    ).toBe(false)
  })

  it('serializeJsonLd: JSON без «</script>»', () => {
    const data = breadcrumbList([{ name: '</script><b>x' }])
    const serialized = serializeJsonLd(data)
    expect(serialized).not.toContain('</script>')
    expect(JSON.parse(serialized)).toEqual(data)
  })
})
