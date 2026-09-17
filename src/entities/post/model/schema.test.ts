import type { ImageFunction } from 'astro:content'
import { z } from 'zod'
import { DESCRIPTION_LENGTH, postSchema, TITLE_LENGTH } from './schema'

// Реальный image() резолвит файл на сборке; в unit-тесте достаточно заглушки.
const image = (() =>
  z.object({ src: z.string(), width: z.number(), height: z.number() })) as unknown as ImageFunction
const schema = postSchema({ image })

const valid = {
  title: 'Prerender по умолчанию: почему статика',
  description:
    'Контентная страница не зависит от запроса, поэтому её честнее собрать один раз на билде и отдавать как файл.',
  pubDate: '2026-06-30',
  tags: ['rendering', 'astro'],
  translationKey: 'prerender-by-default',
}

describe('post schema', () => {
  it('принимает валидный frontmatter; draft по умолчанию false', () => {
    const post = schema.parse(valid)
    expect(post.pubDate).toBeInstanceOf(Date)
    expect(post.draft).toBe(false)
    expect(post.updatedDate).toBeUndefined()
    expect(post.cover).toBeUndefined()
  })

  it('дата без времени — полночь UTC, и как строка, и как Date из YAML-парсера', () => {
    expect(schema.parse(valid).pubDate.toISOString()).toBe('2026-06-30T00:00:00.000Z')
    const fromYaml = schema.parse({ ...valid, pubDate: new Date('2026-06-30') })
    expect(fromYaml.pubDate.toISOString()).toBe('2026-06-30T00:00:00.000Z')
  })

  it('принимает обложку с alt и updatedDate не раньше pubDate', () => {
    const post = schema.parse({
      ...valid,
      updatedDate: '2026-07-01',
      cover: { src: '/x.png', width: 1600, height: 900 },
      coverAlt: 'Три круга на светлом фоне',
      draft: true,
    })
    expect(post.draft).toBe(true)
    expect(post.cover?.width).toBe(1600)
  })

  it.each([
    ['title короче бюджета', { title: 'Коротко' }],
    ['title длиннее бюджета', { title: 'x'.repeat(TITLE_LENGTH.max + 1) }],
    ['description короче бюджета', { description: 'Мало' }],
    ['description длиннее бюджета', { description: 'y'.repeat(DESCRIPTION_LENGTH.max + 1) }],
    ['невалидная дата', { pubDate: 'вчера' }],
    ['updatedDate раньше pubDate', { updatedDate: '2026-01-01' }],
    ['тег не slug', { tags: ['SEO'] }],
    ['дубль тега', { tags: ['seo', 'seo'] }],
    ['translationKey не slug', { translationKey: 'Prerender_By_Default' }],
    ['cover без coverAlt', { cover: { src: '/x.png', width: 1, height: 1 } }],
    ['coverAlt без cover', { coverAlt: 'Обложка' }],
    ['неизвестное поле (опечатка)', { pubdate: '2026-06-30' }],
    ['поле lang — язык задаёт каталог', { lang: 'ru' }],
  ])('отвергает: %s', (_name, patch) => {
    expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
})
