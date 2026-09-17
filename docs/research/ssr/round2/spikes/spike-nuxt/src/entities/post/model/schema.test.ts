import { describe, expect, it } from 'vitest'
import { postFrontmatterSchema } from './schema'

const valid = {
  title: 'Техническое SEO',
  description: 'Canonical, hreflang, robots и sitemap — что реально влияет.',
  pubDate: '2026-03-11',
  updatedDate: '2026-07-02',
  cover: '/covers/tehnicheskoe-seo.png',
  tags: ['seo'],
}

describe('postFrontmatterSchema', () => {
  it('принимает корректный фронтматтер', () => {
    expect(postFrontmatterSchema.parse(valid)).toMatchObject({ title: valid.title })
  })

  it('отклоняет обложку вне /covers/', () => {
    expect(() => postFrontmatterSchema.parse({ ...valid, cover: 'cover.png' })).toThrow()
  })

  it('отклоняет дату не в формате ISO', () => {
    expect(() => postFrontmatterSchema.parse({ ...valid, pubDate: '11.03.2026' })).toThrow()
  })

  it('требует хотя бы один тег', () => {
    expect(() => postFrontmatterSchema.parse({ ...valid, tags: [] })).toThrow()
  })
})
