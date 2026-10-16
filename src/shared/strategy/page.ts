import {
  DEFAULT_LOCALE,
  type Locale,
  localeParam,
  localePath,
  SUPPORTED_LOCALES,
  type Translations,
} from '@/shared/i18n'
import {
  type CopyDeck,
  CopyDeckSchema,
  chosenText,
  elementOf,
  type Fact,
  type Facts,
  FactsSchema,
  fail,
  hasBreadcrumbs,
  langOf,
  type Machine,
  mapPage,
  type Plan,
  PlanSchema,
  type PlanSlot,
  type PlanTarget,
  pageLanguages,
  parentsOf,
  parseFile,
  type SiteMap,
  SiteMapSchema,
  type SlotKind,
  targetAddress,
  untranslatedFallback,
} from './contract'

// Данные strategy одного проекта в раскладке снимка: карта, планы и copy deck поверхности, факты по языкам.
export interface Project {
  map: SiteMap | undefined
  plans: Plan[]
  decks: CopyDeck[]
  facts: Facts[]
}

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

// Значение слота: текст copy deck, действие плана, факт.
export type SlotValue = string | Action | FactValue | undefined

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
}

export interface Meta {
  title: string
  description: string
  ogTitle: string | undefined
  ogDescription: string | undefined
  ogImageAlt: string | undefined
}

export interface MapEntry {
  id: string
  url: string
}

export interface StrategyPage extends MapEntry {
  // Родители по карте — от корня к ближайшему.
  parents: MapEntry[]
  meta: Meta
  sections: Section[]
  // Правовое плана: политика ПДн (`legal.privacy_policy`) — ссылка на её версию по карте, оператор ПДн и продавец
  // (`legal.operator_ref`) — факт языка страницы.
  policy: Link | undefined
  operator: FactValue | undefined
}

// Пути — от корня снимка: `facts.yaml`, `facts.en.yaml`, `site/<поверхность>/{site-map.yaml,plans/…,copy/…}`.
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

// Страница сайта из снимка: секции плана по порядку, их тексты на языке страницы, адреса действий, факты слотов
// данных, мета copy deck и место в карте. Нет плана, страницы copy deck, текста слота или факта — ошибка с ключом.
export function readPage(project: Project, id: string, locale: Locale): StrategyPage {
  const plan = project.plans.find((candidate) => candidate.page.id === id) ?? fail(id, 'нет плана')
  const page =
    project.decks
      .filter((deck) => langOf(deck.copy_deck.lang) === locale)
      .flatMap((deck) => deck.copy_deck.pages)
      .find((candidate) => candidate.page_id === id) ??
    fail(id, `нет страницы в copy deck ${locale}`)
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

  const sections = plan.sections.map((section): Section => {
    const copy = page.sections.find((candidate) => candidate.section_id === section.id)
    const textOf = (slot: string): string => {
      const key = `${id}/${section.id}/${slot}`
      const found = copy?.slots.find((candidate) => candidate.slot_id === slot)
      return chosenText(found ?? fail(key, `нет текста в copy deck ${locale}`), key)
    }

    const slots: Slots = {}
    const instances = new Map<string, { group: string; slots: Slots }>()
    // Значение ложится под элемент анатомии — в секцию или в свой экземпляр группы.
    const place = (slot: PlanSlot, kind: SlotKind, value: SlotValue) => {
      const at = elementOf(slot, kind)
      if (at === undefined) return
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

    for (const slot of section.slots.text) place(slot, 'text', textOf(slot.id))
    for (const slot of section.slots.action) {
      const key = `${id}/${section.id}/${slot.id}`
      place(
        slot,
        'action',
        slot.target === undefined ? { href: undefined } : address(slot.target, key),
      )
    }
    for (const slot of section.slots.data) {
      place(slot, 'data', factOf(slot.fact, `${id}/${section.id}/${slot.id}`, slot.binds))
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
    }
  })

  const meta = page.meta
  const { privacy_policy: policy, operator_ref: operator } = plan.page.legal ?? {}
  return {
    id,
    ...placeOf(project, plan, locale),
    meta: {
      title: meta?.title ?? fail(`${id}/meta/title`, `нет текста в copy deck ${locale}`),
      description:
        meta?.description ?? fail(`${id}/meta/description`, `нет текста в copy deck ${locale}`),
      ogTitle: meta?.og_title,
      ogDescription: meta?.og_description,
      ogImageAlt: meta?.og_image_alt,
    },
    sections,
    policy:
      policy === undefined
        ? undefined
        : address({ kind: 'route', value: policy }, `${id}/legal/privacy_policy`),
    operator: operator === undefined ? undefined : factOf(operator, `${id}/legal/operator_ref`, []),
  }
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
    // Пути маршрута `[...locale]` страницы карты: по пути на локаль её версии, у дефолтной сегмента нет.
    localeRoutes: (id: string) =>
      pageLocales(id).map((locale) => ({
        params: { locale: localeParam(locale) },
        props: { locale },
      })),
    strategyPage: (id: string, locale: Locale): StrategyPage => readPage(project, id, locale),
  }
}

export const {
  pageLocales,
  pageVersions,
  pageLink,
  languageLinks,
  menuLinks,
  breadcrumbsOn,
  localeRoutes,
} = siteOf(site)

// Страница из снимка целиком — для проверок по всем страницам сайта.
export const strategyPage = (id: string, locale: Locale): StrategyPage =>
  readPage(snapshot(), id, locale)

// Данные одной страницы — модуль `virtual:strategy/<page-id>` (плагин yaml-modules astro.config.ts): её план и copy
// deck по языкам, пути — от корня снимка.
export type PageFiles = Readonly<Record<string, unknown>>

// Страница сайта по модулю своих данных — на карте и фактах снимка: страница везёт свои план и copy deck, а не снимок
// целиком, поэтому серверный бандл on-demand маршрута (404, ответ формы) несёт только их.
export function pageOf(files: PageFiles, locale: Locale): StrategyPage {
  const { plans, decks } = projectOf(files)
  const [plan, ...more] = plans
  if (plan === undefined || more.length > 0) {
    throw new Error(`strategy: в модуле страницы планов ${plans.length}, а нужен один`)
  }
  return readPage({ ...site, plans, decks }, plan.page.id, locale)
}
