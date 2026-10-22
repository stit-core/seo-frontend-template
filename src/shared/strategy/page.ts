import {
  DEFAULT_LOCALE,
  type Locale,
  localeOf,
  localeParam,
  localePath,
  SUPPORTED_LOCALES,
  type Translations,
} from '@/shared/i18n'
import catalog from '../../../strategy/kb/site/05-conversion-funnels/lead-forms.yaml'
import {
  ConsentSchema,
  chosenText,
  deckPageOf,
  elementOf,
  type Fact,
  fail,
  hasBreadcrumbs,
  headingOf,
  LeadFormsSchema,
  langOf,
  type Machine,
  mapPage,
  type Plan,
  type PlanFormValue,
  type PlanSlot,
  type PlanTarget,
  type Project,
  pageLanguages,
  parentsOf,
  parseFile,
  projectOf,
  relatedRule,
  type SiteMap,
  type SlotKind,
  targetAddress,
  untranslatedFallback,
} from './contract'

// Ссылка на цель плана: адрес и язык цели, когда это версия страницы на другом языке.
export interface Link {
  href: string
  hreflang?: Locale
}

// Действие плана — адрес цели; подпись — свой текстовый элемент анатомии (`cta` ↔ `cta-label`). Нет цели в плане —
// адрес собирает код (переключатель языка).
export interface Action {
  href: string | undefined
  // Язык цели, когда это версия страницы на другом языке: на языке страницы версии нет.
  hreflang?: Locale
}

// Факт слота данных: видимая формулировка, значение для кода и тексты секции, которые его показывают (`binds` плана; без
// них факт показывает сам блок). Пробел `missing:` — без значения.
export interface FactValue {
  id: string
  text: string
  machine: Machine | undefined
  binds: readonly string[]
}

// Поле набора формы: id каталога, вид ввода, обязательность, подсказки браузеру и варианты выбора.
export interface FormField {
  id: string
  type: 'text' | 'textarea' | 'email' | 'tel' | 'radio'
  required: boolean
  autocomplete: string | undefined
  inputmode:
    | 'none'
    | 'text'
    | 'decimal'
    | 'numeric'
    | 'tel'
    | 'search'
    | 'email'
    | 'url'
    | undefined
  spellcheck: boolean | undefined
  options: string[]
}

// Форма действия плана — набор каталога `lead-forms.yaml` по `form.ref`: поля по порядку, «хотя бы одно из», ловушка,
// скрытые поля, которые без JS ставит сервер, и страница «спасибо» на языке страницы.
export interface LeadForm {
  // form_id заявки — `<страница>/<секция>`.
  id: string
  set: string
  fields: FormField[]
  oneOf: string[]
  honeypot: string
  server: string[]
  // page_url заявки — адрес страницы с формой на её языке.
  page: string
  thankYou: Link
  marketingConsent: boolean
}

// Значение слота: текст copy deck, действие плана, факт, форма.
export type SlotValue = string | Action | FactValue | LeadForm | undefined

// Слоты по элементу анатомии блока («headline»; в экземпляре группы — «title» из «card.title»). Элемент, который план
// заполняет не раз (пункты меню), — список значений по порядку плана.
export type Slots = Record<string, SlotValue | SlotValue[]>

export interface Section {
  id: string
  role: string
  block: string
  variant: string
  slots: Slots
  // Экземпляры повторяемого набора по порядку плана: «card-1», «card-2» → groups.card.
  groups: Record<string, Slots[]>
  // У шаблона коллекции — слоты записи: элементы плана без значения (текста нет в copy deck шаблона, медиа-слот) — их
  // кладёт запись третьим аргументом пропсов блока. У страницы одного плана их нет.
  blank?: string[]
}

export interface Meta {
  title: string
  description: string
  ogTitle: string | undefined
  ogDescription: string | undefined
}

export interface MapEntry {
  id: string
  url: string
}

export interface StrategyPage extends MapEntry {
  // Родители по карте — от корня к ближайшему.
  parents: MapEntry[]
  // Мета copy deck; у шаблона коллекции заголовок и описание страницы даёт запись — меты нет.
  meta: Meta | undefined
  sections: Section[]
  // Заголовок страницы — текст слота `seo.h1` плана на языке страницы; у шаблона коллекции его даёт запись, у плана без
  // `seo.h1` его нет.
  h1: string | undefined
  // Правовое плана: политика ПДн (`legal.privacy_policy`) — ссылка на её версию по карте, оператор ПДн и продавец
  // (`legal.operator_ref`) — факт языка страницы.
  policy: Link | undefined
  operator: FactValue | undefined
  // Типы JSON-LD страницы — `seo.structured_data` плана.
  structuredData: string[]
  // Факты, которые называет страница: `fact:<id>` плана (слоты данных, оператор) и `fact_ids` её текстов copy deck, — в
  // порядке файла фактов языка страницы; из их `machine` — свойства её организации (head-kit `fields_from_facts`).
  facts: FactValue[]
}

// Страница своего плана — с метой copy deck.
export type PlanPage = StrategyPage & { meta: Meta }

const mapOf = (project: Project, id: string): SiteMap => project.map ?? fail(id, 'нет карты сайта')

// Локали страницы карты — языки её версий; язык карты вне дескриптора локалей — ошибка сборки.
export function localesOf(project: Project, id: string): Locale[] {
  return pageLanguages(mapOf(project, id), id).map(
    (lang) =>
      SUPPORTED_LOCALES.find((locale) => locale === lang) ??
      fail(id, `язык ${lang} карты вне дескриптора локалей`),
  )
}

// Версии страницы карты по локалям — её карта переводов: адрес с префиксом языка.
export function versionsOf(project: Project, id: string): Translations {
  const { url } = mapPage(mapOf(project, id), id)
  return Object.fromEntries(
    localesOf(project, id).map((locale) => [locale, localePath(locale, url)]),
  )
}

export interface PageLink {
  href: string
  // Язык цели, когда он не язык страницы: версии на нём нет, ссылка ведёт на версию другого языка.
  hreflang: Locale | undefined
}

// Ссылка со страницы на языке `locale` на страницу карты по её адресу: версия на этом языке, без неё — версия основного
// языка, без неё — первая версия страницы (политика только на ru у сайта с основным en); ссылка на версию другого языка
// называет его. Страницы нет в карте или версий у неё нет — ссылки нет.
export function linkOf(project: Project, route: string, locale: Locale): PageLink | undefined {
  const page = project.map?.pages.find((candidate) => candidate.url === route)
  if (page === undefined) return undefined
  const locales = localesOf(project, page.id)
  const target = [locale, DEFAULT_LOCALE, ...locales].find((candidate) =>
    locales.includes(candidate),
  )
  if (target === undefined) return undefined
  return { href: localePath(target, route), hreflang: target === locale ? undefined : target }
}

export interface LanguageLink {
  locale: Locale
  href: string
  // Ссылка — перевод этой страницы, а не главная языка.
  translation: boolean
}

// Переключатель языка (site 06 §5.3): на каждый другой язык — эта страница на нём, без перевода — главная языка или
// ничего, как решает `untranslated_fallback` его версии в карте.
export function languagesOf(
  project: Project,
  locale: Locale,
  translations: Translations,
): LanguageLink[] {
  return SUPPORTED_LOCALES.flatMap((other): LanguageLink[] => {
    if (other === locale) return []
    const href = translations[other]
    if (href !== undefined) return [{ locale: other, href, translation: true }]
    const home = linkOf(project, '/', other)
    if (project.map === undefined || home === undefined || home.hreflang !== undefined) return []
    return untranslatedFallback(project.map, other) === 'language-home'
      ? [{ locale: other, href: home.href, translation: false }]
      : []
  })
}

// Пункты меню шапки — страницы `chrome.header.items` карты по порядку, подписи — элементы `nav-link` секции плана в том
// же порядке: адреса у элемента анатомии нет, его страница — пункт карты. Число подписей не то — ошибка сборки. Меню
// версии — её разделы: страницы без версии на языке страницы в нём нет.
function menuOf(project: Project, labels: readonly string[], locale: Locale, key: string) {
  const items = project.map?.chrome?.header?.items ?? []
  const mismatch = () =>
    fail(key, `подписей меню ${labels.length}, а пунктов chrome.header.items карты ${items.length}`)
  if (labels.length > items.length) mismatch()
  return items.flatMap((item, index) => {
    const label = labels[index] ?? mismatch()
    const page = mapPage(mapOf(project, key), item.page)
    return localesOf(project, page.id).includes(locale)
      ? [{ href: localePath(locale, page.url), label }]
      : []
  })
}

function placeOf(project: Project, plan: Plan, locale: Locale) {
  const { id } = plan.page
  if (project.map === undefined) {
    // У лендинга карты нет: адрес страницы — page.url её плана.
    const url = plan.page.url ?? fail(id, 'у страницы без карты нет page.url в плане')
    return { url: localePath(locale, url), parents: [] }
  }
  const parents = parentsOf(project.map, id).map(
    (entry): MapEntry => ({ id: entry.id, url: localePath(locale, entry.url) }),
  )
  return { url: localePath(locale, mapPage(project.map, id).url), parents }
}

const LEAD_FORMS = parseFile(
  LeadFormsSchema,
  catalog,
  'kb/site/05-conversion-funnels/lead-forms.yaml',
)
const FIELD_TYPES = new Set<string>(['text', 'textarea', 'email', 'tel', 'radio'])

// Каналы связи, которые бизнес ведёт (fields.contact-channel каталога): звонок и почта — факты с machine telephone и
// email, мессенджер — факт messenger своей сети.
function channelOf(option: string, facts: ReadonlyMap<string, Fact>): boolean {
  const machines = [...facts.values()].flatMap((fact) => (fact.machine ? [fact.machine] : []))
  if (option === 'call') return machines.some((machine) => machine.type === 'telephone')
  if (option === 'email') return machines.some((machine) => machine.type === 'email')
  return machines.some((machine) => machine.type === 'messenger' && machine.network === option)
}

// Набор формы `form.ref` — поля каталога по порядку набора. Форма без JS: успех — страница «спасибо», согласие —
// отдельная галочка, один шаг; поле вида, который форма без JS не собирает, — ошибка с ключом действия.
function formOf(
  form: PlanFormValue,
  key: string,
  facts: ReadonlyMap<string, Fact>,
  address: (route: string) => Link,
): Omit<LeadForm, 'id' | 'page'> {
  const id = form.ref.slice('lead-forms.yaml#'.length)
  const set =
    LEAD_FORMS.form_sets.find((candidate) => candidate.id === id) ??
    fail(key, `${form.ref} — набора нет в каталоге`)
  if ((form.success ?? 'thank-you-page') === 'inline') {
    fail(
      key,
      'form.success: inline — успех на месте формы только с JS: у формы без JS успех — страница «спасибо»',
    )
  }
  if ((form.consent ?? 'separate-checkbox') !== 'separate-checkbox') {
    fail(
      key,
      `form.consent: ${form.consent} — заявка с ПДн собирается только с отдельной галочкой согласия`,
    )
  }
  if (form.marketing_consent)
    fail(key, 'form.marketing_consent — текста согласия на рекламу у секции нет')
  if (Math.max(set.steps, form.steps ?? 1) > 1)
    fail(key, `${form.ref} — шагов больше одного: форма без JS — один шаг`)
  // Почта — канал ответа, только когда набор спрашивает адрес: без поля почты ответить письмом некуда.
  const asksEmail = set.fields.some(({ field }) => LEAD_FORMS.fields[field]?.type === 'email')
  const replies = (option: string) => channelOf(option, facts) && (option !== 'email' || asksEmail)
  const fields = set.fields.flatMap(({ field, required }): FormField[] => {
    const entry = LEAD_FORMS.fields[field] ?? fail(key, `${form.ref}: поля ${field} нет в каталоге`)
    if (!FIELD_TYPES.has(entry.type))
      fail(key, `${form.ref}: поле ${field} вида ${entry.type} форма без JS не собирает`)
    const listed = entry.options ?? entry.options_ru_2026 ?? []
    if (typeof listed === 'string')
      fail(key, `${form.ref}: варианты поля ${field} — ${listed}, а не список`)
    const options = field === 'contact-channel' ? listed.filter(replies) : listed
    if (entry.type === 'radio' && options.length === 0) return []
    return [
      {
        id: field,
        type: entry.type as FormField['type'],
        required,
        autocomplete: entry.autocomplete,
        inputmode: entry.inputmode,
        spellcheck: entry.spellcheck,
        options,
      },
    ]
  })
  return {
    set: set.id,
    fields,
    oneOf: set.one_of_required,
    honeypot: LEAD_FORMS.defaults.antispam.honeypot.field,
    server: LEAD_FORMS.defaults.hidden_fields_without_js.server,
    thankYou: address(
      form.thank_you_page ??
        fail(key, 'у формы без JS нет form.thank_you_page — страницы «спасибо»'),
    ),
    marketingConsent: form.marketing_consent,
  }
}

// Готовое первое сообщение мессенджера — параметр `text` адреса ссылки (wa.me, t.me): так его несёт ссылка действия.
const withPrefill = (href: string, text: string) =>
  `${href}${href.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`

// Страница сайта из снимка: секции плана по порядку, их тексты на языке страницы, адреса действий, факты слотов
// данных, мета copy deck и место в карте. Нет плана, страницы copy deck, текста слота или факта — ошибка с ключом.
// Шаблон коллекции (`page.template`) — страница записи: в copy deck — тексты шаблона, слот без текста и мету
// страницы даёт запись (её значения кладёт страница в пропсы блока).
export function readPage(project: Project, id: string, locale: Locale): StrategyPage {
  const plan = project.plans.find((candidate) => candidate.page.id === id) ?? fail(id, 'нет плана')
  const { template } = plan.page
  const page = deckPageOf(project, id, locale) ?? fail(id, `нет страницы в copy deck ${locale}`)
  const facts = new Map<string, Fact>(
    project.facts
      .filter((file) => langOf(file.lang) === locale)
      .flatMap((file) => file.facts)
      .map((fact) => [fact.id, fact]),
  )
  // Маршрут цели — страница карты: её версия на языке страницы, без неё — версия на другом языке с его кодом (как
  // ссылка со страницы); маршрут вне карты (у лендинга карты нет) — путь на языке страницы.
  const address = (target: PlanTarget, key: string): Link => {
    if (target.kind !== 'route') return { href: targetAddress(target, facts, key) }
    if (!project.map?.pages.some((candidate) => candidate.url === target.value)) {
      return { href: localePath(locale, target.value) }
    }
    const link =
      linkOf(project, target.value, locale) ??
      fail(key, `${target.value}: у страницы карты нет ни одной версии`)
    return link.hreflang === undefined
      ? { href: link.href }
      : { href: link.href, hreflang: link.hreflang }
  }

  // Факт по ссылке плана `fact:<id>` на языке страницы; пробел `missing:` — без значения.
  const factOf = (ref: string, key: string, binds: readonly string[]): FactValue | undefined => {
    if (ref.startsWith('missing:')) return undefined
    const fact = facts.get(ref.slice('fact:'.length)) ?? fail(key, `${ref} нет в фактах ${locale}`)
    return { id: fact.id, text: fact.verbatim[0], machine: fact.machine, binds }
  }

  // Заголовок страницы — слот `seo.h1` плана; у шаблона коллекции его даёт запись.
  const heading = template ? undefined : headingOf(plan)

  // Текст слота секции на языке страницы — выбранный вариант copy deck; у шаблона коллекции слот без текста даёт запись.
  const textOf = (section: string, slot: string): string | undefined => {
    const key = `${id}/${section}/${slot}`
    const found = page.sections
      .find((candidate) => candidate.section_id === section)
      ?.slots.find((candidate) => candidate.slot_id === slot)
    if (found === undefined && template) return undefined
    return chosenText(found ?? fail(key, `нет текста в copy deck ${locale}`), key)
  }

  const sections = plan.sections.map((section): Section => {
    const slots: Slots = {}
    const instances = new Map<string, { group: string; slots: Slots }>()
    const blank = new Set<string>()
    // Значение ложится под элемент анатомии — в секцию или в свой экземпляр группы. Без значения (текста нет в copy deck
    // шаблона, медиа-слот) элемент секции — слот записи: его кладёт запись; экземпляр набора план даёт целиком.
    const place = (slot: PlanSlot, kind: SlotKind, value: SlotValue, vacant: boolean) => {
      const at = elementOf(slot, kind)
      if (at === undefined) return
      if (vacant) {
        if (at.instance === undefined) blank.add(at.element)
        return
      }
      let target = slots
      if (at.instance !== undefined) {
        const instance = instances.get(at.instance) ?? { group: at.group, slots: {} }
        instances.set(at.instance, instance)
        target = instance.slots
      }
      const prior = target[at.element]
      target[at.element] =
        at.element in target ? [...(Array.isArray(prior) ? prior : [prior]), value] : value
    }

    for (const slot of section.slots.text) {
      const text = textOf(section.id, slot.id)
      place(slot, 'text', text, text === undefined)
    }
    for (const slot of section.slots.media) place(slot, 'media', undefined, true)
    for (const slot of section.slots.action) {
      const key = `${id}/${section.id}/${slot.id}`
      if (slot.form !== undefined) {
        // Ответ формы с ошибками без JS называет страницу её заголовком: без него его не из чего напечатать.
        if (heading === undefined) fail(`${id}/seo/h1`, 'у страницы с формой нет заголовка')
        const form = formOf(slot.form, key, facts, (route) =>
          address({ kind: 'route', value: route }, key),
        )
        place(
          slot,
          'action',
          { id: `${id}/${section.id}`, page: placeOf(project, plan, locale).url, ...form },
          false,
        )
        continue
      }
      if (slot.target === undefined) {
        place(slot, 'action', { href: undefined }, false)
        continue
      }
      const link = address(slot.target, key)
      const prefill = slot.target.prefill
      place(
        slot,
        'action',
        prefill === undefined
          ? link
          : {
              ...link,
              href: withPrefill(
                link.href,
                textOf(section.id, prefill) ?? fail(`${key}/prefill`, 'нет текста'),
              ),
            },
        false,
      )
    }
    for (const slot of section.slots.data) {
      place(slot, 'data', factOf(slot.fact, `${id}/${section.id}/${slot.id}`, slot.binds), false)
    }

    const groups: Record<string, Slots[]> = {}
    for (const { group, slots: instance } of instances.values()) {
      groups[group] = [...(groups[group] ?? []), instance]
    }
    return {
      id: section.id,
      role: section.role,
      block: section.block,
      variant: section.variant,
      slots,
      groups,
      ...(template ? { blank: [...blank] } : {}),
    }
  })

  const meta = page.meta
  const { privacy_policy: policy, operator_ref: operator } = plan.page.legal ?? {}
  // Факты, которые называет страница, — по месту ссылки: факта нет на языке страницы — ошибка с ключом этого места.
  const named = new Set(
    [
      ...plan.sections.flatMap((section) =>
        section.slots.data.map((slot) => [slot.fact, `${id}/${section.id}/${slot.id}`] as const),
      ),
      ...(operator === undefined ? [] : [[operator, `${id}/legal/operator_ref`] as const]),
      ...(meta?.fact_ids ?? []).map((ref) => [ref, `${id}/meta`] as const),
      ...page.sections.flatMap((section) =>
        section.slots.flatMap((slot) =>
          slot.fact_ids.map((ref) => [ref, `${id}/${section.section_id}/${slot.slot_id}`] as const),
        ),
      ),
    ].flatMap(([ref, key]) => factOf(ref, key, [])?.id ?? []),
  )
  return {
    id,
    ...placeOf(project, plan, locale),
    meta: template
      ? undefined
      : {
          title: meta?.title ?? fail(`${id}/meta/title`, `нет текста в copy deck ${locale}`),
          description:
            meta?.description ?? fail(`${id}/meta/description`, `нет текста в copy deck ${locale}`),
          ogTitle: meta?.og_title,
          ogDescription: meta?.og_description,
        },
    sections,
    h1: heading && textOf(heading.section.id, heading.slot),
    policy:
      policy === undefined
        ? undefined
        : address({ kind: 'route', value: policy }, `${id}/legal/privacy_policy`),
    operator: operator === undefined ? undefined : factOf(operator, `${id}/legal/operator_ref`, []),
    structuredData: plan.page.seo.structured_data,
    facts: [...facts.values()]
      .filter((fact) => named.has(fact.id))
      .map((fact) => ({ id: fact.id, text: fact.verbatim[0], machine: fact.machine, binds: [] })),
  }
}

// Политика ПДн, на которую ссылается согласие формы: её версия по карте, заголовок документа на языке версии и дата
// редакции — формулировка факта, который план документа связывает с его датой: дата одна — на странице политики и в
// записи согласия.
export interface Policy extends Link {
  title: string
  revision: string
}

// Политика согласия — по проекции документа (`consentOf`, модуль `virtual:strategy/consent/<id>`): ответ формы не везёт
// план и тексты политики. Проекция другой страницы, без заголовка или факта на языке версии — ошибка с ключом.
function readPolicy(project: Project, page: StrategyPage, data: unknown): Policy {
  const key = `${page.id}/legal/privacy_policy`
  const link = page.policy ?? fail(key, 'у страницы с формой нет политики ПДн')
  const parsed = ConsentSchema.safeParse(data)
  if (!parsed.success) fail(key, 'модуль согласия — не проекция политики consentOf')
  const consent = parsed.data
  const locale = link.hreflang ?? localeOf(page.url)
  if (localePath(locale, consent.url) !== link.href) {
    fail(key, `проекция страницы ${consent.id} — не политика плана ${link.href}`)
  }
  const title =
    consent.titles[locale] ?? fail(`${consent.id}/seo/h1`, `нет заголовка документа на ${locale}`)
  const fact = project.facts
    .filter((file) => langOf(file.lang) === locale)
    .flatMap((file) => file.facts)
    .find((candidate) => `fact:${candidate.id}` === consent.revision)
  if (fact === undefined) {
    fail(`${consent.id}/revision`, `${consent.revision} нет в фактах ${locale}`)
  }
  return { ...link, title, revision: fact.verbatim[0] }
}

// Снимок strategy сайта — `strategy/` в корне репозитория. YAML — модулем сборки (плагин yaml-modules
// astro.config.ts): в бандле — поля схем чтения, а не парсер, и страницы на запросе читают то же, что на сборке.
// Карта и факты — сразу: правила карты (языки, ссылки, меню, крошки) и факты нужны каждой странице; план и copy deck
// страница берёт своим модулем (`pageOf`), а снимок целиком собирают проверки по всем страницам (тесты).
const ROOT = '../../../strategy/'
const siteFiles = import.meta.glob<unknown>(
  ['../../../strategy/site/*/site-map.yaml', '../../../strategy/facts*.yaml'],
  { eager: true, import: 'default' },
)
const pageFiles = import.meta.glob<unknown>(
  ['../../../strategy/site/*/plans/*.yaml', '../../../strategy/site/*/copy/*.yaml'],
  { eager: true, import: 'default' },
)
const projectOfFiles = (files: Readonly<Record<string, unknown>>) =>
  projectOf(
    Object.fromEntries(
      Object.entries(files).map(([path, data]) => [path.slice(ROOT.length), data]),
    ),
  )
const site = projectOfFiles(siteFiles)

let full: Project | undefined
export const snapshot = (): Project => (full ??= projectOfFiles({ ...siteFiles, ...pageFiles }))

// Языки, версии, ссылки, меню и крошки страниц карты и сами страницы — по проекту: у сайта это карта и факты снимка, у
// тестов — проект фикстуры (как правила адреса — по списку локалей).
export function siteOf(project: Project) {
  const pageLocales = (id: string): Locale[] => localesOf(project, id)
  return {
    pageLocales,
    pageVersions: (id: string): Translations => versionsOf(project, id),
    pageLink: (route: string, locale: Locale): PageLink | undefined =>
      linkOf(project, route, locale),
    languageLinks: (locale: Locale, translations: Translations): LanguageLink[] =>
      languagesOf(project, locale, translations),
    menuLinks: (labels: readonly string[], locale: Locale, key: string) =>
      menuOf(project, labels, locale, key),
    breadcrumbsOn: (id: string): boolean => hasBreadcrumbs(mapOf(project, id), id),
    relatedOf: (id: string) => relatedRule(mapOf(project, id), id),
    // Пути маршрута `[...locale]` страницы карты: по пути на локаль её версии, у дефолтной сегмента нет.
    localeRoutes: (id: string) =>
      pageLocales(id).map((locale) => ({
        params: { locale: localeParam(locale) },
        props: { locale },
      })),
    strategyPage: (id: string, locale: Locale): StrategyPage => readPage(project, id, locale),
    // Политика согласия формы страницы — по проекции документа (`virtual:strategy/consent/<id>`).
    policyOf: (page: StrategyPage, consent: unknown): Policy => readPolicy(project, page, consent),
  }
}

export const {
  pageLocales,
  pageVersions,
  pageLink,
  languageLinks,
  menuLinks,
  breadcrumbsOn,
  relatedOf,
  localeRoutes,
  policyOf,
} = siteOf(site)

// Страница из снимка целиком — для проверок по всем страницам сайта.
export const strategyPage = (id: string, locale: Locale): StrategyPage =>
  readPage(snapshot(), id, locale)

// Данные одной страницы — модуль `virtual:strategy/<page-id>` (плагин yaml-modules astro.config.ts): её план и copy
// deck по языкам, пути — от корня снимка.
export type PageFiles = Readonly<Record<string, unknown>>

// Страница сайта по модулю своих данных — на карте и фактах снимка: страница везёт свои план и copy deck, а не снимок
// целиком, поэтому серверный бандл on-demand маршрута (404, ответ формы) несёт только их. План одной страницы читает
// `pageOf`, шаблон коллекции — `templateOf`: у шаблона слоты без текста и мету даёт запись.
function moduleOf(files: PageFiles, locale: Locale, template: boolean): StrategyPage {
  const { plans, decks } = projectOf(files)
  const [plan, ...more] = plans
  if (plan === undefined || more.length > 0) {
    throw new Error(`strategy: в модуле страницы планов ${plans.length}, а нужен один`)
  }
  if (plan.page.template !== template) {
    fail(
      plan.page.id,
      template
        ? 'план одной страницы — его читает pageOf'
        : 'план шаблона коллекции — его читает templateOf',
    )
  }
  return readPage({ ...site, plans, decks }, plan.page.id, locale)
}

// Мету плана одной страницы readPage читает всегда: без неё — ошибка с ключом.
export const pageOf = (files: PageFiles, locale: Locale): PlanPage =>
  moduleOf(files, locale, false) as PlanPage

export const templateOf = (files: PageFiles, locale: Locale): StrategyPage =>
  moduleOf(files, locale, true)
