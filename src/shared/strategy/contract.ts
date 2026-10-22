import { z } from 'zod'

// Правила контракта strategy → сайт («Язык контракта с <org>/site» слоя страницы strategy) и форма файлов, которую
// читает код. Модуль листовой — без алиасов и импортов своего кода: Node исполняет его без сборки, поэтому правила
// доступны и скриптам гейта. Схемы — только поля, которые берёт код: форма файла целиком — схемы v1 базы strategy.

const Target = z.object({
  kind: z.enum(['anchor', 'route', 'url', 'tel', 'messenger', 'store', 'external']),
  value: z.string(),
  // Готовое первое сообщение мессенджера — id текстового слота `messenger-prefill` той же секции.
  prefill: z.string().optional(),
})

// Форма действия: набор полей каталога `lead-forms.yaml#<id>`, согласие, успех и страница «спасибо».
const PlanForm = z.object({
  ref: z.string().regex(/^lead-forms\.yaml#[a-z0-9]+(?:-[a-z0-9]+)*$/),
  consent: z.enum(['separate-checkbox', 'link-only', 'none']).optional(),
  success: z.enum(['inline', 'thank-you-page']).optional(),
  thank_you_page: z.string().optional(),
  marketing_consent: z.boolean().default(false),
  steps: z.number().optional(),
})

const PlanSlot = z.object({
  id: z.string(),
  anatomy: z.string().optional(),
  group: z.string().optional(),
})

export const PlanSchema = z.object({
  page: z.object({
    id: z.string(),
    // Тип страницы словаря strategy: по нему head-kit называет её типы JSON-LD (`page_types`).
    page_type: z.string(),
    url: z.string().optional(),
    // План шаблона коллекции: тексты шаблона — copy deck, слоты без текста и мету страницы даёт запись коллекции.
    template: z.boolean().default(false),
    // Типы JSON-LD страницы — `seo.structured_data` плана (head-kit `page_types` её типа): страница печатает ровно их.
    // Заголовок страницы — слот `<секция>.<слот>` (`seo.h1`): по нему форма называет документ политики.
    seo: z
      .object({ structured_data: z.array(z.string()).default([]), h1: z.string().optional() })
      .default({ structured_data: [] }),
    // Правовые решения страницы: адрес политики ПДн и оператор — факт `fact:<id>`.
    legal: z
      .object({
        privacy_policy: z.string().optional(),
        operator_ref: z
          .string()
          .regex(/^(?:fact|missing):/)
          .optional(),
      })
      .optional(),
  }),
  sections: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      block: z.string(),
      // Раскладку блока называет план: вариант по умолчанию знает только каталог, а его чтение не грузит.
      variant: z.string(),
      slots: z
        .object({
          text: z.array(PlanSlot).default([]),
          action: z
            .array(
              PlanSlot.extend({
                target: Target.optional(),
                label: z.string().optional(),
                form: PlanForm.optional(),
              }),
            )
            .default([]),
          // `binds` — тексты секции, которые показывают факт; без них факт показывает сам блок.
          data: z
            .array(
              PlanSlot.extend({
                fact: z.string().regex(/^(?:fact|missing):/),
                binds: z.array(z.string()).default([]),
              }),
            )
            .default([]),
          // Медиа-слоты: файл — манифест пакета дизайна; у шаблона коллекции медиа-слот (обложка записи) даёт запись.
          media: z.array(PlanSlot).default([]),
        })
        .default({ text: [], action: [], data: [], media: [] }),
    }),
  ),
})

const Variant = z.object({ id: z.string(), text: z.string() })

// Факты, на которых стоит текст copy deck (`fact:<id>`; пробел — `missing:<id>`): их называет страница.
const FactIds = z.array(z.string().regex(/^(?:fact|missing):/)).default([])

// Непустые списки — кортежем с хвостом: первый элемент есть и у типа.
const DeckSlot = z.object({
  slot_id: z.string(),
  variants: z.tuple([Variant], Variant),
  chosen: z.string().optional(),
  fact_ids: FactIds,
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
            fact_ids: FactIds,
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
    hours: z.array(
      z.object({
        days: z.array(z.enum(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'])),
        opens: z.string(),
        closes: z.string(),
      }),
    ),
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
  templates: z
    .array(
      z.object({
        id: z.string(),
        breadcrumbs: z.boolean().default(false),
        // Правило «связанных» страниц шаблона — id правила linking.related_rules.
        related: z.string().optional(),
      }),
    )
    .default([]),
  pages: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      parent: z.string().nullable(),
      template: z.string().optional(),
      lang_versions: z.array(z.string()).optional(),
    }),
  ),
  // Меню шапки — страницы карты по порядку; подписи пунктов — copy deck (элемент nav-link шапки).
  chrome: z
    .object({
      header: z.object({ items: z.array(z.object({ page: z.string() })).default([]) }).optional(),
    })
    .optional(),
  // «Связанные»: по какому признаку и сколько страниц коллекции показывает страница шаблона.
  linking: z
    .object({
      related_rules: z
        .array(z.object({ id: z.string(), by: z.string(), max: z.number() }))
        .default([]),
    })
    .optional(),
})

// head-kit базы: типы JSON-LD по типу страницы — `page_types` (типы и подтипы, допустимые вместо типа).
export const HeadKitSchema = z.object({
  page_types: z.record(
    z.string(),
    z.object({
      structured_data: z.array(z.string()).default([]),
      structured_data_subtypes: z.record(z.string(), z.array(z.string())).default({}),
    }),
  ),
})

// Каталог форм базы `lead-forms.yaml`: ловушка и скрытые поля без JS, запись согласия, библиотека полей и наборы.
export const LeadFormsSchema = z.object({
  defaults: z.object({
    consent: z.object({ record: z.array(z.string()) }),
    antispam: z.object({ honeypot: z.object({ field: z.string() }) }),
    hidden_fields_without_js: z.object({ build: z.array(z.string()), server: z.array(z.string()) }),
  }),
  fields: z.record(
    z.string(),
    z.object({
      type: z.string(),
      autocomplete: z.string().optional(),
      inputmode: z
        .enum(['none', 'text', 'decimal', 'numeric', 'tel', 'search', 'email', 'url'])
        .optional(),
      spellcheck: z.boolean().optional(),
      // Варианты — список id; строка — варианты из фактов заказчика (`by-offer`), их форма без JS не знает.
      options: z.union([z.array(z.string()), z.string()]).optional(),
      options_ru_2026: z.array(z.string()).optional(),
    }),
  ),
  form_sets: z.array(
    z.object({
      id: z.string(),
      fields: z.array(z.object({ field: z.string(), required: z.boolean() })).default([]),
      one_of_required: z.array(z.string()).default([]),
      steps: z.number().default(1),
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
export type HeadKit = z.infer<typeof HeadKitSchema>
export type PlanFormValue = z.infer<typeof PlanForm>
export type LeadForms = z.infer<typeof LeadFormsSchema>

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

// Данные strategy одного проекта в раскладке снимка: карта, планы и copy deck поверхности, факты по языкам.
export interface Project {
  map: SiteMap | undefined
  plans: Plan[]
  decks: CopyDeck[]
  facts: Facts[]
}

// Пути — от корня снимка: `facts.yaml`, `facts.en.yaml`, `site/<поверхность>/{site-map.yaml,plans/…,copy/…}`. Проект
// собирают сборка (модули снимка) и скрипты гейта (файлы с диска).
export function projectOf(files: Readonly<Record<string, unknown>>): Project {
  const project: Project = { map: undefined, plans: [], decks: [], facts: [] }
  const surfaces = new Set<string | undefined>()
  for (const [path, data] of Object.entries(files)) {
    const [root, surface, kind] = path.split('/')
    if (root !== 'site') {
      project.facts.push(parseFile(FactsSchema, data, path))
      continue
    }
    surfaces.add(surface)
    if (kind === 'site-map.yaml') project.map = parseFile(SiteMapSchema, data, path)
    else if (kind === 'plans') project.plans.push(parseFile(PlanSchema, data, path))
    else project.decks.push(parseFile(CopyDeckSchema, data, path))
  }
  if (surfaces.size > 1) {
    throw new Error(`strategy/site: поверхностей ${surfaces.size} — сайт собирается из одной`)
  }
  return project
}

// Язык файла — первый подтег BCP 47: copy deck и факты пишут `ru`, `ru-RU` или `fil-PH`.
export const langOf = (lang: string): string => lang.replace(/-.*/, '')

// Страница copy deck на языке: тексты и мета страницы плана.
export const deckPageOf = (project: Project, id: string, lang: string) =>
  project.decks
    .filter((deck) => langOf(deck.copy_deck.lang) === lang)
    .flatMap((deck) => deck.copy_deck.pages)
    .find((page) => page.page_id === id)

// Что читает у политики ПДн ссылка согласия формы — проекция документа, а не его данные: адрес страницы по карте (у
// лендинга без карты — `page.url` плана), заголовок (`seo.h1` плана) на языке каждого copy deck и факт даты редакции,
// который план связывает с датой (`binds: [date]`) в секции заголовка. Её собирает сборка — модуль
// `virtual:strategy/consent/<page-id>` (плагин yaml-modules): ответ формы на запросе везёт её, а не план и тексты политики.
export const ConsentSchema = z.object({
  id: z.string(),
  url: z.string(),
  titles: z.record(z.string(), z.string()),
  revision: z.string().regex(/^(?:fact|missing):/),
})

export type Consent = z.infer<typeof ConsentSchema>

export function consentOf(project: Project, id: string): Consent {
  const plan = project.plans.find((candidate) => candidate.page.id === id) ?? fail(id, 'нет плана')
  const h1 = plan.page.seo.h1 ?? fail(`${id}/seo/h1`, 'у документа нет заголовка')
  const section = h1.slice(0, h1.indexOf('.'))
  const slot = h1.slice(h1.indexOf('.') + 1)
  const key = `${id}/${section}/${slot}`
  const planned = plan.sections.find((candidate) => candidate.id === section)
  if (!planned?.slots.text.some((candidate) => candidate.id === slot)) {
    fail(key, 'заголовок документа — не текст секции')
  }
  const titles = project.decks.flatMap((deck): Array<[string, string]> => {
    const page = deck.copy_deck.pages.find((candidate) => candidate.page_id === id)
    if (page === undefined) return []
    const lang = langOf(deck.copy_deck.lang)
    const found = page.sections
      .find((candidate) => candidate.section_id === section)
      ?.slots.find((candidate) => candidate.slot_id === slot)
    return [[lang, chosenText(found ?? fail(key, `нет текста в copy deck ${lang}`), key)]]
  })
  const revision =
    planned.slots.data.find((candidate) => candidate.binds.includes('date'))?.fact ??
    fail(`${id}/${section}/date`, 'у даты редакции документа нет факта')
  const url = project.map
    ? mapPage(project.map, id).url
    : (plan.page.url ?? fail(id, 'у страницы без карты нет page.url в плане'))
  return { id, url, titles: Object.fromEntries(titles), revision }
}

// Страница проекта по адресу без префикса языка: строка карты с этим адресом (`{x}` — любой сегмент) или страница 2…N
// списка строки (`<адрес>/page/<n>`, номер — `list`); у лендинга без карты — `page.url` его плана (план без него адреса
// не даёт). Адреса нет ни у одной страницы — страницы нет.
export function pageAt(project: Project, route: string): { id: string; list?: number } | undefined {
  const pages =
    project.map?.pages ??
    project.plans.flatMap(({ page: { id, url } }) => (url === undefined ? [] : [{ id, url }]))
  const at = (path: string) =>
    pages.find(({ url }) => {
      const want = url.split('/')
      const have = path.split('/')
      return (
        want.length === have.length &&
        want.every((segment, index) =>
          /^\{[^}]+\}$/.test(segment) ? have[index] !== '' : segment === have[index],
        )
      )
    })
  const own = at(route)
  if (own !== undefined) return { id: own.id }
  const [, base = '', number = ''] = /^(.*)\/page\/(\d+)$/.exec(route) ?? []
  const list = number === '' ? undefined : at(base || '/')
  return list === undefined ? undefined : { id: list.id, list: Number(number) }
}

// Типы JSON-LD, которые head-kit допускает в плане страницы этого типа (`plan_fields.structured_data`): типы строки
// `page_types` и подтипы её `structured_data_subtypes`. BreadcrumbList ставят видимые крошки страницы
// (`recipes.breadcrumb`), а не её тип: он есть у любого типа. У типа словаря strategy без строки head-kit разрешённых
// типов, кроме крошек, нет.
export function headKitTypes(headKit: HeadKit, pageType: string): Set<string> {
  const row = headKit.page_types[pageType]
  return new Set([
    ...(row?.structured_data ?? []),
    ...Object.values(row?.structured_data_subtypes ?? {}).flat(),
    'BreadcrumbList',
  ])
}

// Языки карты: основной — первым, затем версии в порядке карты.
export function mapLanguages(map: SiteMap): string[] {
  const { primary, versions } = map.languages
  return [...new Set([primary, ...versions.map((version) => version.lang)].map(langOf))]
}

const versionOf = (map: SiteMap, lang: string) =>
  map.languages.versions.find((version) => langOf(version.lang) === lang)

export const mapPage = (map: SiteMap, id: string) =>
  map.pages.find((page) => page.id === id) ?? fail(id, 'страницы нет в карте')

// Родители страницы карты — от корня к ближайшему; родителя нет в карте или цепочка замкнулась — ошибка с ключом.
export function parentsOf(map: SiteMap, id: string): SiteMap['pages'] {
  const pages = new Map(map.pages.map((page) => [page.id, page]))
  const parents: SiteMap['pages'] = []
  const seen = new Set([id])
  for (let parent = mapPage(map, id).parent; parent !== null; ) {
    const entry = pages.get(parent) ?? fail(id, `родителя ${parent} нет в карте`)
    if (seen.has(entry.id)) fail(id, `родители в карте замкнулись на ${entry.id}`)
    seen.add(entry.id)
    parents.unshift(entry)
    parent = entry.parent
  }
  return parents
}

// Крошки страницы карты — у шаблона с `breadcrumbs: true` и только с глубины 2 (site 06/02 §2.1, SM-20): глубина —
// от главной, у главной 0, у страницы без родителя — 1.
export function hasBreadcrumbs(map: SiteMap, id: string): boolean {
  const page = mapPage(map, id)
  const template = map.templates.find((candidate) => candidate.id === page.template)
  if (template?.breadcrumbs !== true || page.url === '/') return false
  const parents = parentsOf(map, id)
  return parents.length + (parents[0]?.url === '/' ? 0 : 1) >= 2
}

// «Связанные» страницы карты — правило linking.related_rules её шаблона (templates[].related): признак связи и сколько
// страниц показать. Правила у шаблона или в карте нет — ошибка с ключом.
export function relatedRule(map: SiteMap, id: string) {
  const { template } = mapPage(map, id)
  const rule = map.templates.find((candidate) => candidate.id === template)?.related
  return (
    map.linking?.related_rules.find((candidate) => candidate.id === rule) ??
    fail(id, 'у шаблона нет правила связанных в linking.related_rules карты')
  )
}

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

export type SlotKind = 'text' | 'action' | 'data' | 'media'

// Элемент анатомии блока, который заполняет слот плана (сопоставление site_validate.py strategy): у слота группы —
// экземпляр «card-1» набора card и элемент «title» из анатомии «card.title»; у прочих — анатомия, по умолчанию id слота.
// Слот данных без анатомии элемент не заполняет: это факт секции для её текстов (binds).
export function elementOf(slot: PlanSlot, kind: SlotKind) {
  if (slot.group !== undefined) {
    const group = slot.group.replace(/-\d+$/, '')
    return { element: slot.anatomy?.split('.')[1] ?? slot.id, group, instance: slot.group }
  }
  const element = slot.anatomy ?? (kind === 'data' ? undefined : slot.id)
  return element === undefined ? undefined : { element, group: undefined, instance: undefined }
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
