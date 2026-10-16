import { z } from 'zod'
import type { FactValue, StrategyPage } from '@/shared/strategy'
import { parseHtml } from './dom'

type Contract = { slots: Readonly<Record<string, z.ZodType>> }
type Element = NonNullable<ReturnType<ReturnType<typeof parseHtml>['querySelector']>>

const shapeOf = (schema: z.ZodType | undefined) =>
  (schema === undefined ? {} : z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })) as {
    type?: string
    unshown?: unknown
  }

// Элементы, которые блок принимает и не показывает (вид `unshown` контракта): метка вида переживает `.optional()`.
export function unshownOf(block: Contract): Set<string> {
  return new Set(
    Object.entries(block.slots)
      .filter(([, schema]) => shapeOf(schema).unshown === true)
      .map(([element]) => element),
  )
}

// Видимый текст элемента: без поддеревьев под `hidden` и `aria-hidden="true"`, пробелы сжаты.
function visibleText(element: Element): string {
  const copy = element.cloneNode(true)
  for (const hidden of copy.querySelectorAll('[hidden], [aria-hidden="true"]')) hidden.remove()
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

// Что блок обязан показать по секции плана страницы: каждый текст её слотов и экземпляров набора — целым текстом своего
// элемента, каждое действие с адресом — ссылкой на этот адрес (и язык цели), факт без текстов секции (`binds`) — своей
// формулировкой внутри секции, которую подписывает её заголовок. Каркас — внутри лендмарка каталога (`landmark`: `header`, `footer`); места плана, которых нет на языке
// страницы (`elsewhere`: пункт меню `nav-link[2]`, раздел подвала `nav[1]`), он не показывает. Ответ — расхождения:
// пустой список — секция показана целиком.
export function sectionFaults(
  html: string,
  page: StrategyPage,
  id: string,
  block: Contract,
  {
    landmark,
    elsewhere = new Set(),
  }: { landmark?: string | undefined; elsewhere?: ReadonlySet<string> } = {},
): string[] {
  const section = page.sections.find((candidate) => candidate.id === id)
  if (section === undefined) return [`${page.id}/${id}: секции нет в плане`]
  const root = parseHtml(html).querySelector(landmark ?? `[aria-labelledby="${id}"]`)
  if (root === null) {
    return [
      `${page.id}/${id}: нет ${landmark ? `<${landmark}>` : 'секции, подписанной её заголовком'}`,
    ]
  }
  const texts = new Set([root, ...root.querySelectorAll('*')].map(visibleText))
  const shown = visibleText(root)
  const links = new Set(
    [...root.querySelectorAll('a[href]')].map(
      (link) => `${link.getAttribute('href') ?? ''} ${link.getAttribute('hreflang') ?? ''}`,
    ),
  )
  const hidden = unshownOf(block)
  const faults: string[] = []
  const check = (where: string, value: unknown): void => {
    if (elsewhere.has(where)) return
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        check(`${where}[${index}]`, item)
      })
    } else if (typeof value === 'string') {
      const text = value.replace(/\s+/g, ' ').trim()
      if (!texts.has(text)) faults.push(`${page.id}/${id}/${where}: нет текста «${text}»`)
    } else if (typeof value === 'object' && value !== null && 'href' in value) {
      const { href, hreflang } = value as { href?: unknown; hreflang?: unknown }
      const link = `${String(href)} ${typeof hreflang === 'string' ? hreflang : ''}`
      if (typeof href === 'string' && !links.has(link)) {
        faults.push(`${page.id}/${id}/${where}: нет ссылки ${link.trim()}`)
      }
    } else if (typeof value === 'object' && value !== null && 'binds' in value) {
      // Факт, который не показывает ни один текст секции (`binds` пуст), показывает сам блок: его формулировка — в
      // видимом тексте секции. Факт с `binds` виден через свои тексты — их судят как тексты.
      const { text, binds } = value as FactValue
      const fact = text.replace(/\s+/g, ' ').trim()
      if (binds.length === 0 && !shown.includes(fact)) {
        faults.push(`${page.id}/${id}/${where}: факт «${fact}» не виден`)
      }
    }
  }
  for (const [element, value] of Object.entries(section.slots)) {
    // Место в элементе-списке — по номеру и при одном значении: `nav-link[0]`.
    const listed = shapeOf(block.slots[element]).type === 'array' ? [value].flat() : value
    if (!hidden.has(element)) check(element, listed)
  }
  for (const [group, instances] of Object.entries(section.groups)) {
    instances.forEach((slots, index) => {
      if (elsewhere.has(`${group}[${index}]`)) return
      for (const [element, value] of Object.entries(slots))
        check(`${group}[${index}].${element}`, value)
    })
  }
  return faults
}
