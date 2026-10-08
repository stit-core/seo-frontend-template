import type { ImageFunction } from 'astro:content'
import { z } from 'zod'
import { postSchema } from './schema'

// Реальный image() резолвит файл на сборке; в unit-тесте достаточно заглушки.
const image = (() =>
  z.object({ src: z.string(), width: z.number(), height: z.number() })) as unknown as ImageFunction
// Реестр авторов шаблона пуст: схема получает id от того, кто собирает коллекцию.
const schema = postSchema({ image, authors: ['anna-smirnova'] })

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

  it('автор — id из реестра: чужой id и любой id при пустом реестре — ошибка', () => {
    expect(schema.parse(valid).author).toBeUndefined()
    expect(schema.parse({ ...valid, author: 'anna-smirnova' }).author).toBe('anna-smirnova')
    expect(schema.safeParse({ ...valid, author: 'petr-ivanov' }).success).toBe(false)
    const empty = postSchema({ image, authors: [] })
    expect(empty.safeParse({ ...valid, author: 'anna-smirnova' }).success).toBe(false)
    expect(empty.safeParse(valid).success).toBe(true)
  })

  // Границы — литералами: сниппет выдачи держит title 25–65 и description 70–170 знаков.
  it.each([
    ['title', 24, false],
    ['title', 25, true],
    ['title', 65, true],
    ['title', 66, false],
    ['description', 69, false],
    ['description', 70, true],
    ['description', 170, true],
    ['description', 171, false],
  ])('бюджет сниппета: %s в %i знаков — %s', (field, length, ok) => {
    expect(schema.safeParse({ ...valid, [field]: 'ж'.repeat(length) }).success).toBe(ok)
  })

  it.each([
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
