import { describe, expect, it } from 'vitest'
import { PostFrontmatterSchema } from './schema'

const valid = {
  title: 'Заголовок',
  description: 'Описание поста',
  pubDate: '2026-01-02',
  updatedDate: '2026-01-03',
  cover: '/covers/x.png',
  tags: ['seo'],
}

describe('PostFrontmatterSchema', () => {
  it('принимает валидный frontmatter', () => {
    expect(PostFrontmatterSchema.parse(valid)).toMatchObject(valid)
  })

  it('требует ISO-дату', () => {
    expect(PostFrontmatterSchema.safeParse({ ...valid, pubDate: '02.01.2026' }).success).toBe(false)
  })

  it('требует cover из /covers/', () => {
    expect(PostFrontmatterSchema.safeParse({ ...valid, cover: 'x.png' }).success).toBe(false)
  })

  it('требует непустой tags', () => {
    expect(PostFrontmatterSchema.safeParse({ ...valid, tags: [] }).success).toBe(false)
  })
})
