import { expect, test } from 'vitest'
import { z } from 'zod'

const PostSchema = z.object({ title: z.string().min(1), pubDate: z.coerce.date() })

test('схема контента отбрасывает пустой заголовок', () => {
  expect(PostSchema.safeParse({ title: '', pubDate: '2026-01-01' }).success).toBe(false)
  expect(PostSchema.safeParse({ title: 'ok', pubDate: '2026-01-01' }).success).toBe(true)
})
