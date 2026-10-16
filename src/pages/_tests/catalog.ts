import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import { z } from 'zod'
import type { Locale } from '@/shared/i18n'
import { type projectOf, type Section, type StrategyPage, siteOf } from '@/shared/strategy'
import catalogFile from '../../../strategy/kb/site/04-blocks/blocks.yaml'

// Каталог блоков базы strategy (копия strategy/kb): поля, которые судят тесты блоков и страниц.
const Element = z.object({
  id: z.string(),
  slot: z.string(),
  required: z.union([z.boolean(), z.string()]).optional(),
  variants: z.array(z.string()).optional(),
})
const Catalog = z.object({
  blocks: z.record(
    z.string(),
    z.object({
      // Каркас (`chrome`) ставит оболочка, а не план страницы секцией.
      flow: z.string().optional(),
      html: z
        .object({
          element: z.string().optional(),
          heading: z.string().optional(),
          form: z.boolean().optional(),
        })
        .default({}),
      variants: z.array(
        z.object({
          id: z.string(),
          drops: z.array(z.string()).default([]),
          adds: z.array(z.string()).default([]),
        }),
      ),
      slots: z.array(Element).default([]),
      groups: z
        .array(z.object({ id: z.string(), min: z.number().default(0), slots: z.array(Element) }))
        .default([]),
    }),
  ),
})
export const catalog = Catalog.parse(catalogFile).blocks

// Блоки шаблона — public API слайсов widgets: контракт (id, варианты, слоты, пропсы секции) и компонент блока.
export interface Block {
  id: string
  variants: readonly string[]
  slots: Record<string, z.ZodType>
  props: (page: StrategyPage, section: string) => Record<string, unknown>
}
export const isBlock = (value: unknown): value is Block =>
  typeof value === 'object' && value !== null && 'variants' in value && 'slots' in value
export const slices = Object.entries(
  import.meta.glob<Record<string, unknown>>('../../widgets/*/index.ts', { eager: true }),
).map(([path, module]) => ({ slice: path.split('/').at(-2) ?? '', module }))
export const blocks = slices.flatMap(({ slice, module }) =>
  Object.values(module)
    .filter(isBlock)
    .map((block) => ({ slice, block })),
)
// Компонент блока — экспорт слайса по имени блока: `hero-text` → `HeroText`.
export const componentName = (id: string) =>
  id.replace(/(?:^|-)(\w)/g, (_, letter: string) => letter.toUpperCase())
export const componentOf = (id: string) => {
  const component = slices.find(({ slice }) => slice === id)?.module[componentName(id)]
  return typeof component === 'function' ? (component as AstroComponentFactory) : undefined
}

// Каркас показывает разделы версии языка страницы: пункта меню, чьей страницы карты нет на этом языке, и раздела
// подвала, чья ссылка ведёт на версию другого языка (с её hreflang), на странице нет.
export function elsewhere(section: Section, locale: Locale, project: ReturnType<typeof projectOf>) {
  const items = project.map?.chrome?.header?.items ?? []
  return new Set([
    ...items.flatMap(({ page }, index) =>
      siteOf(project).pageLocales(page).includes(locale) ? [] : [`nav-link[${index}]`],
    ),
    ...Object.entries(section.groups).flatMap(([group, instances]) =>
      instances.flatMap((instance, index) =>
        Object.values(instance).some(
          (value) =>
            typeof value === 'object' && 'hreflang' in value && value.hreflang !== undefined,
        )
          ? [`${group}[${index}]`]
          : [],
      ),
    ),
  ])
}

// Что судит проверка секции плана в разметке: каркас (`flow: chrome`) — внутри своего лендмарка каталога, кроме разделов
// без версии на языке страницы; секция страницы — по своему заголовку.
export const chromeOf = (
  section: Section,
  locale: Locale,
  project: ReturnType<typeof projectOf>,
) => {
  const entry = catalog[section.block]
  return entry?.flow === 'chrome'
    ? { landmark: entry.html.element, elsewhere: elsewhere(section, locale, project) }
    : {}
}
