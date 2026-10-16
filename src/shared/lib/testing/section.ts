import { z } from 'zod'
import type { StrategyPage } from '@/shared/strategy'
import { parseHtml } from './dom'

type Contract = { slots: Readonly<Record<string, z.ZodType>> }
type Element = NonNullable<ReturnType<ReturnType<typeof parseHtml>['querySelector']>>

// Элементы, которые блок принимает и не показывает (вид `unshown` контракта): метка вида переживает `.optional()`.
function unshownOf(block: Contract): Set<string> {
  return new Set(
    Object.entries(block.slots)
      .filter(([, schema]) => {
        const shape = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
        return (shape as { unshown?: unknown }).unshown === true
      })
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
// элемента, каждое действие с адресом — ссылкой на этот адрес (и язык цели) внутри секции, которую подписывает её
// заголовок. Ответ — расхождения: пустой список — секция показана целиком.
export function sectionFaults(
  html: string,
  page: StrategyPage,
  id: string,
  block: Contract,
): string[] {
  const section = page.sections.find((candidate) => candidate.id === id)
  if (section === undefined) return [`${page.id}/${id}: секции нет в плане`]
  const root = parseHtml(html).querySelector(`[aria-labelledby="${id}"]`)
  if (root === null) return [`${page.id}/${id}: нет секции, подписанной её заголовком`]
  const texts = new Set([root, ...root.querySelectorAll('*')].map(visibleText))
  const links = new Set(
    [...root.querySelectorAll('a[href]')].map(
      (link) => `${link.getAttribute('href') ?? ''} ${link.getAttribute('hreflang') ?? ''}`,
    ),
  )
  const hidden = unshownOf(block)
  const faults: string[] = []
  const check = (where: string, value: unknown): void => {
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
    }
  }
  for (const [element, value] of Object.entries(section.slots)) {
    if (!hidden.has(element)) check(element, value)
  }
  for (const [group, instances] of Object.entries(section.groups)) {
    instances.forEach((slots, index) => {
      for (const [element, value] of Object.entries(slots))
        check(`${group}[${index}].${element}`, value)
    })
  }
  return faults
}
