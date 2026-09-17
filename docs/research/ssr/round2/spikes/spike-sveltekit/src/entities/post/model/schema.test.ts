import { describe, expect, it } from 'vitest'
import { PostFrontmatterSchema, PostMetaSchema } from './schema'

const valid = {
  title: 'Заголовок',
  description: 'Описание',
  pubDate: '2026-03-03',
  updatedDate: '2026-06-05',
  cover: './covers/slug-one.png',
  tags: ['seo'],
}

describe('PostFrontmatterSchema', () => {
  it('принимает валидный frontmatter', () => {
    expect(PostFrontmatterSchema.parse(valid)).toEqual(valid)
  })

  it.each([
    ['пустой title', { ...valid, title: '' }],
    ['дата не ISO', { ...valid, pubDate: '03.03.2026' }],
    ['обложка вне ./covers', { ...valid, cover: '/img/x.png' }],
    ['нет тегов', { ...valid, tags: [] }],
    ['лишнее поле не ломает, но битый тип ломает', { ...valid, tags: 'seo' }],
  ])('отвергает: %s', (_name, input) => {
    expect(PostFrontmatterSchema.safeParse(input).success).toBe(false)
  })
})

describe('PostMetaSchema', () => {
  it('требует kebab-case slug', () => {
    expect(PostMetaSchema.safeParse({ ...valid, slug: 'ok-slug' }).success).toBe(true)
    expect(PostMetaSchema.safeParse({ ...valid, slug: 'Bad Slug' }).success).toBe(false)
  })
})
