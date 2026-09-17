import type { SchemaContext } from 'astro:content'
import { z } from 'zod'

// Slug'и тегов и translationKey попадают в URL и в hreflang — только латиница и дефисы.
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Бюджеты выдачи (title ≈ ширина сниппета, description — до усечения) — часть схемы:
// нарушение — красная сборка, а не тихая обрезка в SERP.
export const TITLE_LENGTH = { min: 25, max: 65 } as const
export const DESCRIPTION_LENGTH = { min: 70, max: 170 } as const

const slug = z.string().regex(SLUG_RE, 'только a-z, 0-9 и дефисы')

// Язык записи — каталог `content/<locale>/`, не поле: один источник, расхождений не бывает.
export const postSchema = ({ image }: SchemaContext) =>
  z
    .strictObject({
      title: z.string().trim().min(TITLE_LENGTH.min).max(TITLE_LENGTH.max),
      description: z.string().trim().min(DESCRIPTION_LENGTH.min).max(DESCRIPTION_LENGTH.max),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      cover: image().optional(),
      coverAlt: z.string().trim().min(1).optional(),
      tags: z.array(slug).refine((tags) => new Set(tags).size === tags.length, 'теги без дублей'),
      draft: z.boolean().default(false),
      translationKey: slug,
    })
    .superRefine((post, ctx) => {
      if (post.updatedDate && post.updatedDate < post.pubDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['updatedDate'],
          message: 'updatedDate раньше pubDate',
        })
      }
      if (post.cover && !post.coverAlt) {
        ctx.addIssue({
          code: 'custom',
          path: ['coverAlt'],
          message: 'у обложки должен быть coverAlt',
        })
      }
      if (post.coverAlt && !post.cover) {
        ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: 'coverAlt без cover' })
      }
    })

export type PostData = z.infer<ReturnType<typeof postSchema>>
