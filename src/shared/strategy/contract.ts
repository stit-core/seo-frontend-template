import { z } from 'zod'

// Правила контракта strategy → сайт («Язык контракта с <org>/site» слоя страницы strategy) и форма файлов, которую
// читает код. Модуль листовой — без алиасов и импортов своего кода: Node исполняет его без сборки, поэтому правила
// доступны и скриптам гейта. Схемы — только поля, которые берёт код: форма файла целиком — схемы v1 базы strategy.

const Target = z.object({
  kind: z.enum(['anchor', 'route', 'url', 'tel', 'messenger', 'store', 'external']),
  value: z.string(),
})

const PlanSlot = z.object({
  id: z.string(),
  anatomy: z.string().optional(),
  group: z.string().optional(),
})

export const PlanSchema = z.object({
  page: z.object({ id: z.string(), url: z.string().optional() }),
  sections: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      block: z.string(),
      variant: z.string().optional(),
      slots: z
        .object({
          text: z.array(PlanSlot).default([]),
          action: z
            .array(PlanSlot.extend({ target: Target.optional(), label: z.string().optional() }))
            .default([]),
          data: z
            .array(PlanSlot.extend({ fact: z.string().regex(/^(?:fact|missing):/) }))
            .default([]),
        })
        .default({ text: [], action: [], data: [] }),
    }),
  ),
})

const Variant = z.object({ id: z.string(), text: z.string() })

// Непустые списки — кортежем с хвостом: первый элемент есть и у типа.
const DeckSlot = z.object({
  slot_id: z.string(),
  variants: z.tuple([Variant], Variant),
  chosen: z.string().optional(),
})

export const CopyDeckSchema = z.object({
  copy_deck: z.object({
    lang: z.string(),
    pages: z.array(
      z.object({
        page_id: z.string(),
        meta: z
          .object({
            title: z.string().optional(),
            description: z.string().optional(),
            og_title: z.string().optional(),
            og_description: z.string().optional(),
            og_image_alt: z.string().optional(),
          })
          .optional(),
        sections: z.array(z.object({ section_id: z.string(), slots: z.array(DeckSlot) })),
      }),
    ),
  }),
})

// Значение контакта или реквизита для кода — `machine` факта (facts.schema.yaml, $defs/machine).
const MachineSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('telephone'), value: z.string() }),
  z.object({ type: z.literal('email'), value: z.string() }),
  z.object({ type: z.literal('url'), value: z.string() }),
  z.object({ type: z.literal('messenger'), network: z.string(), value: z.string() }),
  z.object({
    type: z.literal('postal-address'),
    country: z.string(),
    region: z.string().optional(),
    locality: z.string(),
    street: z.string(),
    postal_code: z.string().optional(),
  }),
  z.object({
    type: z.literal('opening-hours'),
    hours: z.array(z.object({ days: z.array(z.string()), opens: z.string(), closes: z.string() })),
  }),
  z.object({ type: z.literal('legal-id'), scheme: z.string(), value: z.string() }),
  z.object({ type: z.literal('geo'), lat: z.number(), lon: z.number() }),
])

const FactSchema = z.object({
  id: z.string(),
  verbatim: z.tuple([z.string()], z.string()),
  machine: MachineSchema.optional(),
})

export const FactsSchema = z.object({ lang: z.string(), facts: z.array(FactSchema) })

export const SiteMapSchema = z.object({
  languages: z.object({
    primary: z.string(),
    versions: z
      .array(
        z.object({
          lang: z.string(),
          scope: z.enum(['all-pages', 'selected-pages']),
          pages: z.array(z.string()).default([]),
          untranslated_fallback: z.enum(['language-home', 'hide-link']).default('language-home'),
        }),
      )
      .default([]),
  }),
  pages: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      parent: z.string().nullable(),
      lang_versions: z.array(z.string()).optional(),
    }),
  ),
})

export type Plan = z.infer<typeof PlanSchema>
export type PlanSlot = z.infer<typeof PlanSlot>
export type CopyDeck = z.infer<typeof CopyDeckSchema>
export type DeckSlot = z.infer<typeof DeckSlot>
export type Fact = z.infer<typeof FactSchema>
export type Facts = z.infer<typeof FactsSchema>
export type Machine = z.infer<typeof MachineSchema>
export type SiteMap = z.infer<typeof SiteMapSchema>
export type PlanTarget = z.infer<typeof Target>

// Файл снимка по своей схеме; ошибка называет файл и поле.
export function parseFile<S extends z.ZodType>(
  schema: S,
  data: unknown,
  path: string,
): z.output<S> {
  const result = schema.safeParse(data)
  if (!result.success) throw new Error(`strategy/${path}: ${z.prettifyError(result.error)}`)
  return result.data
}

// Ошибка чтения называет ключ `<страница>/<секция>/<слот>`: по нему исполнитель находит место в плане и в copy deck.
export function fail(key: string, why: string): never {
  throw new Error(`strategy: ${key} — ${why}`)
}

// Язык файла — первый подтег: copy deck и факты пишут `ru` или `ru-RU`.
export const langOf = (lang: string): string => lang.slice(0, 2)

// Языки карты: основной — первым, затем версии в порядке карты.
export function mapLanguages(map: SiteMap): string[] {
  const { primary, versions } = map.languages
  return [...new Set([primary, ...versions.map((version) => version.lang)].map(langOf))]
}

const versionOf = (map: SiteMap, lang: string) =>
  map.languages.versions.find((version) => langOf(version.lang) === lang)

export const mapPage = (map: SiteMap, id: string) =>
  map.pages.find((page) => page.id === id) ?? fail(id, 'страницы нет в карте')

// Языки страницы карты: версия со всеми страницами или с этой страницей в списке (основной язык без строки версии — со
// всеми), и `lang_versions` страницы сужает набор.
export function pageLanguages(map: SiteMap, id: string): string[] {
  const own = mapPage(map, id).lang_versions?.map(langOf)
  return mapLanguages(map).filter((lang) => {
    const version = versionOf(map, lang)
    const listed =
      version === undefined || version.scope === 'all-pages' || version.pages.includes(id)
    return listed && (own === undefined || own.includes(lang))
  })
}

// Куда ведёт переключатель на язык со страницы без версии на нём (`untranslated_fallback` версии): на главную языка
// или никуда.
export const untranslatedFallback = (map: SiteMap, lang: string) =>
  versionOf(map, lang)?.untranslated_fallback ?? 'language-home'

// Текст слота — выбранный вариант `variants[id == chosen]`; у слота без `chosen` — его единственный вариант (так
// выбирает и copydeck.py strategy). Невыбранные варианты код не читает.
export function chosenText(slot: DeckSlot, key: string): string {
  if (slot.chosen === undefined && slot.variants.length > 1) {
    fail(key, `вариантов ${slot.variants.length}, а chosen нет`)
  }
  const variant =
    slot.chosen === undefined
      ? slot.variants[0]
      : slot.variants.find((candidate) => candidate.id === slot.chosen)
  if (variant === undefined) fail(key, `chosen «${slot.chosen}» — такого варианта нет`)
  return variant.text
}

// Адрес действия — цель плана: литерал как есть (`#якорь`, путь, `tel:`, `mailto:`, адрес ссылки), у цели
// `messenger:<fact-id>` — адрес ссылки из `machine` её факта. Строку `canonical` код не разбирает.
export function targetAddress(target: PlanTarget, facts: ReadonlyMap<string, Fact>, key: string) {
  if (target.kind !== 'messenger' || !target.value.startsWith('messenger:')) return target.value
  const id = target.value.slice('messenger:'.length)
  const machine = facts.get(id)?.machine
  if (machine?.type !== 'messenger' && machine?.type !== 'url') {
    fail(key, `${target.value}: у факта нет machine с адресом ссылки`)
  }
  return machine.value
}
