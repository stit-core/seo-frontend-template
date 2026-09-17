import { describe, expect, it } from 'vitest'
import { article, breadcrumbs, JsonLdSchema, organization } from './json-ld'

describe('seo/json-ld', () => {
  it('Organization валиден', () => {
    expect(JsonLdSchema.safeParse(organization()).success).toBe(true)
  })

  it('Article содержит абсолютные URL', () => {
    const jsonLd = article({
      path: '/blog/x',
      title: 'T',
      description: 'D',
      image: '/_astro/x.avif',
      published: new Date('2026-01-01'),
      updated: new Date('2026-02-01'),
    }) as Record<string, unknown>
    expect(jsonLd.image).toEqual(['http://localhost:3201/_astro/x.avif'])
    expect(jsonLd.dateModified).toBe('2026-02-01T00:00:00.000Z')
  })

  it('BreadcrumbList нумеруется с 1', () => {
    const crumbs = breadcrumbs([{ name: 'Главная', path: '/' }]) as Record<string, unknown>
    const items = crumbs.itemListElement as Array<{ position: number }>
    expect(items[0]?.position).toBe(1)
  })
})
