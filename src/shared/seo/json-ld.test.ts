import { SITE_DESCRIPTION, SITE_LOGO_PATH, SITE_NAME, SITE_SAME_AS } from '@/shared/config'
import {
  blogPosting,
  breadcrumbList,
  JsonLdSchema,
  localBusiness,
  organization,
  serializeJsonLd,
  webSite,
} from './json-ld'

const ORIGIN = 'https://demo.example'
// Адреса узлов графа — литералами: по ним страницы сайта склеиваются в одну сущность.
const ORG_ID = 'https://demo.example/#org'
const organizationRef = { '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME }

// Фабрики не парсят результат на рендере — схему к их выходу применяет этот тест.
describe('seo/json-ld', () => {
  beforeEach(() => vi.stubEnv('SITE_URL', ORIGIN))
  afterEach(() => vi.unstubAllEnvs())

  it('Organization: @id сущности, имя — бренд, абсолютные url и logo, профили; проходит схему', () => {
    const data = organization()
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': ORG_ID,
      name: SITE_NAME,
      url: `${ORIGIN}/`,
      logo: `${ORIGIN}${SITE_LOGO_PATH}`,
      sameAs: SITE_SAME_AS,
    })
    expect(JsonLdSchema.parse(data)).toEqual(data)
  })

  it('WebSite: свой @id, корень домена, издатель — организация по @id; проходит схему', () => {
    const data = webSite()
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': 'https://demo.example/#website',
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: `${ORIGIN}/`,
      inLanguage: 'ru',
      publisher: organizationRef,
    })
    expect(JsonLdSchema.parse(data)).toEqual(data)
  })

  it('LocalBusiness: @id организации, имя — бренд, юрлицо — legalName, адрес — PostalAddress; проходит схему', () => {
    const data = localBusiness({
      legalName: 'ООО «Пример»',
      description: 'Небольшая студия',
      email: 'hello@example.com',
      telephone: '+7 495 000-00-00',
      address: {
        country: 'RU',
        postalCode: '101000',
        locality: 'Москва',
        street: 'ул. Примерная, 1',
      },
      openingHours: 'Mo-Fr 10:00-19:00',
    })
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': ORG_ID,
      name: SITE_NAME,
      legalName: 'ООО «Пример»',
      description: 'Небольшая студия',
      url: `${ORIGIN}/`,
      image: `${ORIGIN}${SITE_LOGO_PATH}`,
      email: 'hello@example.com',
      telephone: '+7 495 000-00-00',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'RU',
        postalCode: '101000',
        addressLocality: 'Москва',
        streetAddress: 'ул. Примерная, 1',
      },
      openingHours: 'Mo-Fr 10:00-19:00',
      sameAs: SITE_SAME_AS,
    })
    expect(JsonLdSchema.parse(data)).toEqual(data)
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

  it('BlogPosting: даты, dateModified и image при наличии, автор и издатель — организация по @id; проходит схему', () => {
    const base = {
      locale: 'ru' as const,
      path: '/blog/x',
      title: 'Заголовок',
      description: 'Описание',
      published: new Date('2026-09-08'),
    }
    const plain = blogPosting(base)
    expect(plain).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Заголовок',
      description: 'Описание',
      datePublished: '2026-09-08',
      inLanguage: 'ru',
      author: organizationRef,
      publisher: organizationRef,
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${ORIGIN}/blog/x` },
    })
    expect(JsonLdSchema.parse(plain)).toEqual(plain)

    const full = blogPosting({
      ...base,
      updated: new Date('2026-09-10'),
      imagePath: '/_astro/cover.abc.png',
    })
    expect(full).toEqual({
      ...plain,
      dateModified: '2026-09-10',
      image: `${ORIGIN}/_astro/cover.abc.png`,
    })
    expect(JsonLdSchema.parse(full)).toEqual(full)
  })

  it('BlogPosting с автором: Person со своим @id, именем и ролью; издатель — организация; проходит схему', () => {
    const input = {
      locale: 'ru' as const,
      path: '/blog/x',
      title: 'Заголовок',
      description: 'Описание',
      published: new Date('2026-09-08'),
    }
    const author = { id: 'anna-smirnova', name: 'Анна Смирнова' }
    const signed = blogPosting({ ...input, author: { ...author, jobTitle: 'редактор блога' } })
    expect(signed).toEqual({
      ...blogPosting(input),
      author: {
        '@type': 'Person',
        '@id': 'https://demo.example/#author-anna-smirnova',
        name: 'Анна Смирнова',
        jobTitle: 'редактор блога',
      },
    })
    expect(signed).toHaveProperty('publisher', organizationRef)
    expect(JsonLdSchema.parse(signed)).toEqual(signed)

    const plain = blogPosting({ ...input, author })
    expect(plain).toHaveProperty('author', {
      '@type': 'Person',
      '@id': 'https://demo.example/#author-anna-smirnova',
      name: 'Анна Смирнова',
    })
    expect(JsonLdSchema.parse(plain)).toEqual(plain)
  })

  it('схема отвергает относительные URL, узел без @id, пустой список крошек и чужие типы', () => {
    const node = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': ORG_ID,
      name: 'x',
      url: `${ORIGIN}/`,
      logo: `${ORIGIN}/logo.png`,
      sameAs: [],
    }
    expect(JsonLdSchema.safeParse(node).success).toBe(true)
    expect(JsonLdSchema.safeParse({ ...node, url: '/', logo: '/logo.png' }).success).toBe(false)
    const { '@id': _omit, ...withoutId } = node
    expect(JsonLdSchema.safeParse(withoutId).success).toBe(false)
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
