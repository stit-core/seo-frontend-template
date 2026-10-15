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
  type Fact,
  type Facts,
  FactsSchema,
  fail,
  langOf,
  type Machine,
  mapPage,
  type Plan,
  PlanSchema,
  type PlanSlot,
  type PlanTarget,
  pageLanguages,
  parseFile,
  type SiteMap,
  SiteMapSchema,
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

export interface Action {
  // Нет цели в плане — адрес собирает код (переключатель языка).
  href: string | undefined
  label: string | undefined
}

// Факт слота данных: видимая формулировка и значение для кода. Пробел `missing:` — без значения.
export interface FactValue {
  id: string
  text: string
  machine: Machine | undefined
}

// Слоты секции по id плана; в экземпляре группы — по элементу анатомии («card.title» → title).
export interface Slots {
  text: Record<string, string>
  actions: Record<string, Action>
  data: Record<string, FactValue | undefined>
}

export interface Section extends Slots {
  id: string
  role: string
  block: string
  variant: string | undefined
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

const emptySlots = (): Slots => ({ text: {}, actions: {}, data: {} })

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
  // Язык цели, когда он не язык страницы: версии на нём нет, ссылка ведёт на версию основного языка.
  hreflang: Locale | undefined
}

// Ссылка со страницы на языке `locale` на страницу карты по её адресу: версия на этом языке, без неё — версия основного
// языка; страницы нет в карте или основной версии у неё нет — ссылки нет.
export function linkOf(project: Project, route: string, locale: Locale): PageLink | undefined {
  const page = project.map?.pages.find((candidate) => candidate.url === route)
  if (page === undefined) return undefined
  const locales = localesOf(project, page.id)
  if (locales.includes(locale)) return { href: localePath(locale, route), hreflang: undefined }
  if (!locales.includes(DEFAULT_LOCALE)) return undefined
  return { href: localePath(DEFAULT_LOCALE, route), hreflang: DEFAULT_LOCALE }
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

function placeOf(project: Project, plan: Plan, locale: Locale) {
  const { id } = plan.page
  if (project.map === undefined) {
    // У лендинга карты нет: адрес страницы — page.url её плана.
    const url = plan.page.url ?? fail(id, 'у страницы без карты нет page.url в плане')
    return { url: localePath(locale, url), parents: [] }
  }
  const pages = new Map(project.map.pages.map((page) => [page.id, page]))
  const page = pages.get(id) ?? fail(id, 'страницы нет в карте')
  const parents: MapEntry[] = []
  const seen = new Set([id])
  for (let parent = page.parent; parent !== null; ) {
    const entry = pages.get(parent) ?? fail(id, `родителя ${parent} нет в карте`)
    if (seen.has(entry.id)) fail(id, `родители в карте замкнулись на ${entry.id}`)
    seen.add(entry.id)
    parents.unshift({ id: entry.id, url: localePath(locale, entry.url) })
    parent = entry.parent
  }
  return { url: localePath(locale, page.url), parents }
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

  const sections = plan.sections.map((section): Section => {
    const copy = page.sections.find((candidate) => candidate.section_id === section.id)
    const textOf = (slot: string): string => {
      const key = `${id}/${section.id}/${slot}`
      const found = copy?.slots.find((candidate) => candidate.slot_id === slot)
      return chosenText(found ?? fail(key, `нет текста в copy deck ${locale}`), key)
    }
    const address = (target: PlanTarget, key: string): string =>
      target.kind === 'route' ? localePath(locale, target.value) : targetAddress(target, facts, key)

    const own = emptySlots()
    const instances = new Map<string, Slots>()
    // Слот группы ложится в свой экземпляр под именем элемента анатомии, прочие — в секцию под id плана.
    const place = (slot: PlanSlot) => {
      if (slot.group === undefined) return { slots: own, name: slot.id }
      const slots = instances.get(slot.group) ?? emptySlots()
      instances.set(slot.group, slots)
      return { slots, name: slot.anatomy?.split('.')[1] ?? slot.id }
    }

    for (const slot of section.slots.text) {
      const { slots, name } = place(slot)
      slots.text[name] = textOf(slot.id)
    }
    for (const slot of section.slots.action) {
      const { slots, name } = place(slot)
      const key = `${id}/${section.id}/${slot.id}`
      slots.actions[name] = {
        href: slot.target === undefined ? undefined : address(slot.target, key),
        label: slot.label === undefined ? undefined : textOf(slot.label),
      }
    }
    for (const slot of section.slots.data) {
      const { slots, name } = place(slot)
      const fact = slot.fact.startsWith('missing:')
        ? undefined
        : (facts.get(slot.fact.slice('fact:'.length)) ??
          fail(`${id}/${section.id}/${slot.id}`, `${slot.fact} нет в фактах ${locale}`))
      slots.data[name] =
        fact === undefined
          ? undefined
          : { id: fact.id, text: fact.verbatim[0], machine: fact.machine }
    }

    const groups: Record<string, Slots[]> = {}
    for (const [instance, slots] of instances) {
      const group = instance.replace(/-\d+$/, '')
      groups[group] = [...(groups[group] ?? []), slots]
    }
    return {
      id: section.id,
      role: section.role,
      block: section.block,
      variant: section.variant,
      ...own,
      groups,
    }
  })

  const meta = page.meta
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
  }
}

// Снимок strategy сайта — `strategy/` в корне репозитория. YAML — модулем сборки (плагин yaml-modules
// astro.config.ts): в бандле данные, а не парсер, и страницы на запросе читают то же, что на сборке. Карту читает
// каркас любой страницы, в том числе on-demand; планы, copy deck и факты — только чтение страницы: снимок целиком
// собирается при первом чтении, и серверный бандл маршрутов, которые страницу не читают, их не везёт.
const ROOT = '../../../strategy/'
const mapFiles = import.meta.glob<unknown>('../../../strategy/site/*/site-map.yaml', {
  eager: true,
  import: 'default',
})
const pageFiles = import.meta.glob<unknown>(
  [
    '../../../strategy/facts*.yaml',
    '../../../strategy/site/*/plans/*.yaml',
    '../../../strategy/site/*/copy/*.yaml',
  ],
  { eager: true, import: 'default' },
)
const projectOfFiles = (files: Readonly<Record<string, unknown>>) =>
  projectOf(
    Object.fromEntries(
      Object.entries(files).map(([path, data]) => [path.slice(ROOT.length), data]),
    ),
  )

let full: Project | undefined
export const snapshot = (): Project => (full ??= projectOfFiles({ ...mapFiles, ...pageFiles }))

// Языки, версии и ссылки страниц карты — по проекту: у сайта это карта снимка, у тестов — проект фикстуры (как правила
// адреса — по списку локалей).
export function siteOf(project: Project) {
  const pageLocales = (id: string): Locale[] => localesOf(project, id)
  return {
    pageLocales,
    pageVersions: (id: string): Translations => versionsOf(project, id),
    pageLink: (route: string, locale: Locale): PageLink | undefined =>
      linkOf(project, route, locale),
    languageLinks: (locale: Locale, translations: Translations): LanguageLink[] =>
      languagesOf(project, locale, translations),
    // Пути маршрута `[...locale]` страницы карты: по пути на локаль её версии, у дефолтной сегмента нет.
    localeRoutes: (id: string) =>
      pageLocales(id).map((locale) => ({
        params: { locale: localeParam(locale) },
        props: { locale },
      })),
  }
}

export const { pageLocales, pageVersions, pageLink, languageLinks, localeRoutes } = siteOf(
  projectOfFiles(mapFiles),
)
export const strategyPage = (id: string, locale: Locale): StrategyPage =>
  readPage(snapshot(), id, locale)
