import { z } from 'zod'
import { PACKAGE_LANDING } from '@/shared/lib/testing'
import {
  action,
  defineBlock,
  elementOf,
  fact,
  group,
  list,
  projectOf,
  snapshot,
  text,
} from '@/shared/strategy'
import catalogFile from '../../../strategy/kb/site/04-blocks/blocks.yaml'

// Каталог блоков базы strategy (копия strategy/kb): поля, которые судит тест.
const Element = z.object({
  id: z.string(),
  required: z.union([z.boolean(), z.string()]).optional(),
  variants: z.array(z.string()).optional(),
})
const Catalog = z.object({
  blocks: z.record(
    z.string(),
    z.object({
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
const catalog = Catalog.parse(catalogFile).blocks

// Блоки шаблона — контракты из public API слайсов widgets: id, варианты и слоты.
interface Block {
  id: string
  variants: readonly string[]
  slots: Record<string, z.ZodType>
}
const isBlock = (value: unknown): value is Block =>
  typeof value === 'object' && value !== null && 'variants' in value && 'slots' in value
const blocks = Object.entries(
  import.meta.glob<Record<string, unknown>>('../../widgets/*/index.ts', { eager: true }),
).flatMap(([path, module]) =>
  Object.values(module)
    .filter(isBlock)
    .map((block) => ({ slice: path.split('/').at(-2), block })),
)

// Форма слота блока — его JSON Schema: элементы экземпляра набора и список ли значение. Факт — значение чтения без
// формы JSON (`z.custom`): у него форма пустая.
const shapeOf = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as {
    type?: string
    items?: { properties?: Record<string, { type?: string }> }
  }

// Элементы анатомии, которые блок принимает: «headline», набор — «card» и его элементы «card.title»; значение —
// список ли (элемент, который план заполняет не раз).
function acceptedOf(block: Block) {
  const groups = new Set(catalog[block.id]?.groups.map((group) => group.id))
  const accepted = new Map<string, boolean>()
  for (const [slot, schema] of Object.entries(block.slots)) {
    const shape = shapeOf(schema)
    if (!groups.has(slot)) {
      accepted.set(slot, shape.type === 'array')
      continue
    }
    accepted.set(slot, true)
    for (const [element, value] of Object.entries(shape.items?.properties ?? {})) {
      accepted.set(`${slot}.${element}`, value.type === 'array')
    }
  }
  return accepted
}

const plans = [...snapshot().plans, ...projectOf(PACKAGE_LANDING).plans]

describe('блоки каталога: блок ↔ каталог ↔ планы', () => {
  it('форма слота читается у любого вида значения: элемент, список, набор и его элементы', () => {
    const footer = defineBlock({
      id: 'footer',
      variants: ['site'],
      slots: {
        legal: text,
        company: fact.optional(),
        privacy: list(action),
        nav: group({ label: text, link: action }),
      },
    })
    expect([...acceptedOf(footer)]).toEqual([
      ['legal', false],
      ['company', false],
      ['privacy', true],
      ['nav', true],
      ['nav.label', false],
      ['nav.link', false],
    ])
  })

  it('у шаблона есть блоки, каждый — widgets/<id блока каталога>', () => {
    expect(blocks.length).toBeGreaterThan(0)
    expect(
      blocks.flatMap(({ slice, block }) => [
        ...(slice === block.id
          ? []
          : [`widgets/${slice ?? ''}: блок ${block.id} — не в своём слайсе`]),
        ...(block.id in catalog ? [] : [`${block.id}: такого блока нет в каталоге`]),
      ]),
    ).toEqual([])
  })

  it('варианты и слоты блока — варианты и элементы анатомии его блока каталога', () => {
    expect(
      blocks.flatMap(({ block }) => {
        const entry = catalog[block.id]
        if (entry === undefined) return []
        const anatomy = new Set([
          ...entry.slots.map((element) => element.id),
          ...entry.groups.flatMap((group) => [
            group.id,
            ...group.slots.map((element) => `${group.id}.${element.id}`),
          ]),
        ])
        return [
          ...block.variants
            .filter((variant) => !entry.variants.some((known) => known.id === variant))
            .map((variant) => `${block.id}: варианта ${variant} нет в каталоге`),
          ...[...acceptedOf(block).keys()]
            .filter((element) => !anatomy.has(element))
            .map((element) => `${block.id}: элемента ${element} нет в анатомии блока каталога`),
        ]
      }),
    ).toEqual([])
  })

  it('обязательные элементы анатомии в каждом варианте блока блок принимает', () => {
    expect(
      blocks.flatMap(({ block }) => {
        const entry = catalog[block.id]
        if (entry === undefined) return []
        const accepted = acceptedOf(block)
        return entry.variants
          .filter((variant) => block.variants.includes(variant.id))
          .flatMap((variant) => {
            const top = entry.slots.filter(
              (element) =>
                element.required === true ||
                (element.required === 'by-variant' && element.variants?.includes(variant.id)),
            )
            // Набор обязателен с минимумом экземпляров; принятый набор несёт свои обязательные элементы.
            const groups = entry.groups.filter((group) => group.min > 0 || accepted.has(group.id))
            const required = [
              ...top.map((element) => element.id),
              ...groups.flatMap((group) => [
                ...(group.min > 0 ? [group.id] : []),
                ...group.slots
                  .filter((element) => element.required === true)
                  .map((element) => `${group.id}.${element.id}`),
              ]),
              ...variant.adds,
            ].filter((element) => !variant.drops.includes(element))
            return required
              .filter((element) => !accepted.has(element))
              .map(
                (element) =>
                  `${block.id}: обязательный элемент ${element} (вариант ${variant.id}) блок не принимает`,
              )
          })
      }),
    ).toEqual([])
  })

  it('секция плана — вариант, который блок умеет, слоты — элементы, которые он принимает', () => {
    const byId = new Map(blocks.map(({ block }) => [block.id, block]))
    expect(
      plans.flatMap((plan) =>
        plan.sections.flatMap((section) => {
          const block = byId.get(section.block)
          if (block === undefined) return []
          const key = `${plan.page.id}/${section.id}`
          const accepted = acceptedOf(block)
          const faults = block.variants.includes(section.variant)
            ? []
            : [
                `${key}: вариант ${section.variant} — блок ${block.id} его не умеет (умеет: ${block.variants.join(', ')})`,
              ]
          const kinds = [
            ['text', section.slots.text],
            ['action', section.slots.action],
            ['data', section.slots.data],
          ] as const
          const filled = new Set<string>()
          for (const [kind, slots] of kinds) {
            for (const slot of slots) {
              const at = elementOf(slot, kind)
              if (at === undefined) continue
              const element = at.group === undefined ? at.element : `${at.group}.${at.element}`
              const place = `${at.instance ?? ''}/${element}`
              if (!accepted.has(element)) {
                faults.push(`${key}/${slot.id}: элемент ${element} блок ${block.id} не принимает`)
              } else if (filled.has(place) && accepted.get(element) === false) {
                faults.push(
                  `${key}/${slot.id}: элемент ${element} — второй раз, блок ${block.id} берёт один`,
                )
              }
              filled.add(place)
            }
          }
          return faults
        }),
      ),
    ).toEqual([])
  })
})
