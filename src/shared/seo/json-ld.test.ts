import {
  blogPosting,
  breadcrumbList,
  JsonLdSchema,
  localBusiness,
  organization,
  serializeJsonLd,
  webSite,
} from './json-ld'

// Фабрики не парсят результат на рендере — схему к их выходу применяет этот тест.
describe('seo/json-ld', () => {
  beforeEach(() => vi.stubEnv('SITE_URL', 'https://demo.example'))
  afterEach(() => vi.unstubAllEnvs())

  it('Organization: абсолютные url/logo/sameAs, проходит схему', () => {
    const data = organization()
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      url: 'https://demo.example/',
      logo: 'https://demo.example/icon-512.png',
    })
    expect(JsonLdSchema.parse(data)).toEqual(data)
  })

  it('WebSite: корень домена на дефолтной локали, проходит схему', () => {
    const data = webSite()
    expect(data).toMatchObject({
      '@type': 'WebSite',
      url: 'https://demo.example/',
      inLanguage: 'ru',
    })
    expect(JsonLdSchema.parse(data)).toEqual(data)
  })

  it('LocalBusiness: адрес разложен по PostalAddress, url — корень сайта, проходит схему', () => {
    const data = localBusiness({
      name: 'ООО «Пример»',
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
    expect(data).toMatchObject({
      '@type': 'LocalBusiness',
      url: 'https://demo.example/',
      image: 'https://demo.example/icon-512.png',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'RU',
        addressLocality: 'Москва',
        streetAddress: 'ул. Примерная, 1',
      },
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
        { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://demo.example/' },
        { '@type': 'ListItem', position: 2, name: 'Блог', item: 'https://demo.example/blog' },
        { '@type': 'ListItem', position: 3, name: 'Запись' },
      ],
    })
    expect(JsonLdSchema.parse(data)).toEqual(data)
  })

  it('BlogPosting: календарные даты, dateModified и image только при наличии, проходит схему', () => {
    const base = {
      locale: 'ru' as const,
      path: '/blog/x',
      title: 'Заголовок',
      description: 'Описание',
      published: new Date('2026-09-08'),
    }
    const plain = blogPosting(base)
    expect(plain).toMatchObject({
      '@type': 'BlogPosting',
      datePublished: '2026-09-08',
      inLanguage: 'ru',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://demo.example/blog/x' },
      author: { '@type': 'Organization', url: 'https://demo.example/' },
    })
    expect(plain).not.toHaveProperty('dateModified')
    expect(plain).not.toHaveProperty('image')
    expect(JsonLdSchema.parse(plain)).toEqual(plain)

    const full = blogPosting({
      ...base,
      updated: new Date('2026-09-10'),
      imagePath: '/_astro/cover.abc.png',
    })
    expect(full).toMatchObject({
      dateModified: '2026-09-10',
      image: 'https://demo.example/_astro/cover.abc.png',
    })
    expect(JsonLdSchema.parse(full)).toEqual(full)
  })

  it('схема отвергает относительные URL, пустой список крошек и чужие типы', () => {
    expect(
      JsonLdSchema.safeParse({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'x',
        url: '/',
        logo: '/logo.png',
        sameAs: [],
      }).success,
    ).toBe(false)
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
