import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import { z } from 'zod'
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n'
import {
  PACKAGE_LANDING,
  parseHtml,
  sectionFaults,
  testLocale,
  unshownOf,
} from '@/shared/lib/testing'
import {
  action,
  defineBlock,
  elementOf,
  fact,
  group,
  list,
  pageLocales,
  projectOf,
  type Section,
  type StrategyPage,
  siteOf,
  snapshot,
  strategyPage,
  text,
} from '@/shared/strategy'
import catalogFile from '../../../strategy/kb/site/04-blocks/blocks.yaml'

// Каталог блоков базы strategy (копия strategy/kb): поля, которые судит тест.
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
const catalog = Catalog.parse(catalogFile).blocks

// Блоки шаблона — public API слайсов widgets: контракт (id, варианты, слоты, пропсы секции) и компонент блока.
interface Block {
  id: string
  variants: readonly string[]
  slots: Record<string, z.ZodType>
  props: (page: StrategyPage, section: string) => Record<string, unknown>
}
const isBlock = (value: unknown): value is Block =>
  typeof value === 'object' && value !== null && 'variants' in value && 'slots' in value
const slices = Object.entries(
  import.meta.glob<Record<string, unknown>>('../../widgets/*/index.ts', { eager: true }),
).map(([path, module]) => ({ slice: path.split('/').at(-2) ?? '', module }))
const blocks = slices.flatMap(({ slice, module }) =>
  Object.values(module)
    .filter(isBlock)
    .map((block) => ({ slice, block })),
)
// Компонент блока — экспорт слайса по имени блока: `hero-text` → `HeroText`.
const componentName = (id: string) =>
  id.replace(/(?:^|-)(\w)/g, (_, letter: string) => letter.toUpperCase())
const componentOf = (id: string) => {
  const component = slices.find(({ slice }) => slice === id)?.module[componentName(id)]
  return typeof component === 'function' ? (component as AstroComponentFactory) : undefined
}

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

const landing = projectOf(PACKAGE_LANDING)
const plans = [...snapshot().plans, ...landing.plans]

// Страницы с планами — на своих языках: страницы снимка сайта на языках карты, посадочная фикстуры базы — тексты её
// copy deck на русском, а подписи интерфейса каркаса (словарь сайта) — дефолтной локали: у сайта может не быть ru.
const pages = [
  ...snapshot().plans.flatMap(({ page: { id } }) =>
    pageLocales(id).map((locale) => ({
      page: strategyPage(id, locale),
      locale,
      project: snapshot(),
    })),
  ),
  {
    page: siteOf(landing).strategyPage('spasibo', testLocale('ru')),
    locale: DEFAULT_LOCALE,
    project: landing,
  },
]

// Каркас показывает разделы версии языка страницы: пункта меню, чьей страницы карты нет на этом языке, и раздела
// подвала, чья ссылка ведёт на версию другого языка (с её hreflang), на странице нет.
function elsewhere(section: Section, locale: Locale, project: ReturnType<typeof projectOf>) {
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

  it('каждый widget — блок каталога: в слайсе контракт блока с id слайса и компонент блока', () => {
    expect(slices.length).toBeGreaterThan(0)
    expect(
      slices.flatMap(({ slice, module }) => {
        const own = Object.values(module).filter(isBlock)
        return [
          ...(own.length === 1 && own[0]?.id === slice
            ? []
            : [`widgets/${slice}: контракт — ${own.map((block) => block.id).join(', ') || 'нет'}`]),
          ...(slice in catalog ? [] : [`widgets/${slice}: блока ${slice} нет в каталоге`]),
          ...(componentOf(slice)
            ? []
            : [`widgets/${slice}: нет компонента ${componentName(slice)}`]),
        ]
      }),
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

  // Текст, который блок принимает и не показывает, — только успех формы: на месте формы его показал бы остров, а без JS
  // успех — страница «спасибо» плана. Любой другой элемент каталог велит показать.
  it('вид unshown — только у успеха формы: элемент со слотом form-success у блока с формой', () => {
    expect(
      blocks.flatMap(({ block }) =>
        [...unshownOf(block)]
          .filter((element) => {
            const entry = catalog[block.id]
            const slot = entry?.slots.find((candidate) => candidate.id === element)?.slot
            return entry?.html.form !== true || slot !== 'form-success'
          })
          .map(
            (element) => `${block.id}: элемент ${element} — unshown, а каталог велит его показать`,
          ),
      ),
    ).toEqual([])
  })

  it('у секции плана — блок шаблона: вариант, который он умеет, слоты — элементы, которые он принимает', () => {
    const byId = new Map(blocks.map(({ block }) => [block.id, block]))
    expect(
      plans.flatMap((plan) =>
        plan.sections.flatMap((section) => {
          const key = `${plan.page.id}/${section.id}`
          const block = byId.get(section.block)
          if (block === undefined)
            return [`${key}: блок ${section.block} — нет widgets/${section.block}`]
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

  // Каркас — шапку и подвал — ставит оболочка: его секция — лендмарк каталога без заголовка, меню и разделы подвала —
  // версии языка страницы.
  it('секция плана — в разметке блока: заголовок с id секции уровня каталога, каждый текст, адрес действия, экземпляр набора', async () => {
    const container = await AstroContainer.create()
    const faults: string[] = []
    for (const { page, locale, project } of pages) {
      for (const section of page.sections) {
        const entry = catalog[section.block]
        const block = blocks.find((candidate) => candidate.block.id === section.block)?.block
        const component = componentOf(section.block)
        if (entry === undefined || block === undefined || component === undefined) continue
        const html = await container.renderToString(component, {
          props: { ...block.props(page, section.id), locale },
        })
        const heading = parseHtml(html).getElementById(section.id)?.tagName.toLowerCase()
        if (heading !== entry.html.heading) {
          faults.push(
            `${locale} ${page.id}/${section.id}: заголовок ${heading ?? 'нет'}, в каталоге ${entry.html.heading ?? '—'}`,
          )
        }
        const chrome =
          entry.flow === 'chrome'
            ? { landmark: entry.html.element, elsewhere: elsewhere(section, locale, project) }
            : {}
        faults.push(
          ...sectionFaults(html, page, section.id, block, chrome).map(
            (fault) => `${locale} ${fault}`,
          ),
        )
      }
    }
    expect(faults).toEqual([])
  })
})
