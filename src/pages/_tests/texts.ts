import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { SITE_NAME } from '@/shared/config'
import {
  BUTTON_TYPES,
  DICTS,
  formatDate,
  type Locale,
  localeInfo,
  SUPPORTED_LOCALES,
  TEXT_ATTRIBUTES,
} from '@/shared/i18n'
import { parseHtml } from '@/shared/lib/testing'
import { pageLocales, snapshot, strategyPage } from '@/shared/strategy'
import { AUTHORS, POSTS } from './fixtures'
import PostBody from './post-body.astro'

type Element = NonNullable<ReturnType<ReturnType<typeof parseHtml>['querySelector']>>

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()
const LETTER = /\p{L}/u

// Строчные элементы продолжают текст своего блока: «Пн–Пт <time>10:00</time>–…» человек читает одной строкой.
const INLINE = new Set(
  'A ABBR B BDI BDO CITE CODE DATA DFN EM I KBD MARK Q S SAMP SMALL SPAN STRONG SUB SUP TIME U VAR'.split(
    ' ',
  ),
)

// Участки текста `<body>`: текст блочного элемента вместе со строчными детьми и текстовые атрибуты — каждый своим
// участком. Скрытое (`hidden`, `aria-hidden`, `sr-only`) — тоже текст страницы: его читают поиск и чтец экрана.
function runsOf(root: Element): string[] {
  const runs: string[] = []
  let run = ''
  const flush = () => {
    if (LETTER.test(run)) runs.push(normalize(run))
    run = ''
  }
  const walk = (node: Element) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        run += child.textContent ?? ''
        continue
      }
      if (child.nodeType !== 1) continue
      const element = child as Element
      if (['SCRIPT', 'STYLE', 'TEMPLATE'].includes(element.tagName)) continue
      const button =
        element.tagName === 'INPUT' &&
        BUTTON_TYPES.includes((element.getAttribute('type') ?? '').toLowerCase())
      for (const name of button ? [...TEXT_ATTRIBUTES, 'value'] : TEXT_ATTRIBUTES) {
        const value = element.getAttribute(name)
        if (value !== null && LETTER.test(value)) runs.push(normalize(value))
      }
      const inline = INLINE.has(element.tagName)
      if (!inline) flush()
      walk(element)
      if (!inline) flush()
    }
  }
  walk(root)
  flush()
  return runs
}

// Слова страницы мимо данных: из каждого участка вычитаются тексты данных — длинные первыми, чтобы короткая строка не
// разрезала длинную; остаток с буквами — текст, которого нет ни в одном источнике. Ответ — остатки с участком.
export function strayText(html: string, texts: Iterable<string>): string[] {
  const known = [...new Set([...texts].map(normalize).filter((text) => LETTER.test(text)))].sort(
    (a, b) => b.length - a.length,
  )
  return runsOf(parseHtml(html).body).flatMap((run) => {
    const rest = known.reduce((left, text) => left.split(text).join('\u0000'), run)
    const stray = rest
      .split('\u0000')
      .map(normalize)
      .filter((part) => LETTER.test(part))
    return stray.length > 0 ? [`«${stray.join(' … ')}» в «${run.slice(0, 120)}»`] : []
  })
}

// Значения слотов секции: тексты copy deck, формулировки фактов, адрес канала без подписи (почта, телефон — ссылка
// показывает свой адрес).
function valuesOf(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(valuesOf)
  if (typeof value !== 'object' || value === null) return []
  if ('binds' in value && 'text' in value) return [String(value.text)]
  if ('href' in value && typeof value.href === 'string' && /^(?:mailto|tel):/.test(value.href)) {
    return [value.href.replace(/^(?:mailto|tel):/, '')]
  }
  return []
}

const container = await AstroContainer.create()
// Тело записи фикстуры — её Markdown: текст коллекции, а не разметки страницы.
const body = runsOf(parseHtml(await container.renderToString(PostBody)).body)

// Что может стоять на странице языка словами — данные: тексты страниц снимка на этом языке (copy deck по ключу, факты,
// адреса каналов, мета), строки словаря без подстановок (подстановка — сама данные: тег, номер страницы, заголовок),
// самоназвания языков (переключатель), имя сайта (знак шапки) и записи коллекции фикстур этого языка — заголовок,
// анонс, теги, автор, даты в формате сайта, альтернатива обложки, тело.
export function pageTexts(locale: Locale): string[] {
  const pages = snapshot()
    .plans.map(({ page }) => page.id)
    .filter((id) => pageLocales(id).includes(locale))
    .map((id) => strategyPage(id, locale))
  const strategy = pages.flatMap((page) => [
    ...Object.values(page.meta ?? {}).filter((text): text is string => typeof text === 'string'),
    ...page.sections.flatMap((section) => [
      ...valuesOf(Object.values(section.slots)),
      ...valuesOf(
        Object.values(section.groups)
          .flat()
          .flatMap((slots) => Object.values(slots)),
      ),
    ]),
    ...valuesOf(page.operator),
  ])
  const dictionary = Object.values(DICTS[locale]).flatMap((text) => text.split(/\{\w+\}/))
  const records = POSTS.filter(
    ({ id, data }) => id.startsWith(`${locale}/`) && !data.draft,
  ).flatMap(({ data }) => {
    const author = data.author === undefined ? undefined : AUTHORS[data.author]
    return [
      data.title,
      data.description,
      ...data.tags,
      formatDate(locale, data.pubDate),
      ...(data.updatedDate ? [formatDate(locale, data.updatedDate)] : []),
      ...(data.coverAlt ? [data.coverAlt] : []),
      ...(author ? [author.name[locale], author.jobTitle?.[locale] ?? ''] : []),
    ]
  })
  return [
    ...strategy,
    ...dictionary,
    ...SUPPORTED_LOCALES.map((other) => localeInfo(other).name),
    SITE_NAME,
    ...records,
    ...body,
  ]
}
