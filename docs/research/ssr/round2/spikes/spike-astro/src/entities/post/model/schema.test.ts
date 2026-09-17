import { type ImageFunction, z } from 'astro:content'
import { describe, expect, it } from 'vitest'
import { postSchema } from './schema'

// image() в unit-тесте заменяем заглушкой — реальный резолвер есть только в сборке.
const image = (() => z.custom<unknown>(() => true)) as unknown as ImageFunction

const schema = postSchema({ image })

describe('post schema', () => {
  it('принимает валидный frontmatter', () => {
    const parsed = schema.parse({
      title: 'Канон canonical',
      description: 'Абсолютный self-canonical и один хоп нормализации.',
      pubDate: '2026-01-01',
      cover: { src: '/x.png', width: 1600, height: 900, format: 'png' },
      tags: ['seo'],
    })
    expect(parsed.pubDate).toBeInstanceOf(Date)
    expect(parsed.tags).toEqual(['seo'])
  })

  it('падает на пустом description', () => {
    expect(() =>
      schema.parse({ title: 'Ок', description: '', pubDate: '2026-01-01', cover: {} }),
    ).toThrow()
  })
})
