import { z } from 'zod'

// Корневой путь без query, хвостового слеша и заглавных: ровно то, что middleware ищет в
// таблице после среза хвостового слеша у запрошенного пути.
const INTERNAL_PATH = /^\/(?:[a-z0-9._~-]+(?:\/[a-z0-9._~-]+)*)?$/

const internalPath = z
  .string()
  .regex(INTERNAL_PATH, 'корневой путь в нижнем регистре, без query и хвостового слеша')

const target = z.union(
  [internalPath, z.url({ protocol: /^https?$/ })],
  'корневой путь или абсолютный http(s) URL',
)

export type RedirectRule =
  | { from: string; to: string; status: 301 | 308; note?: string }
  | { from: string; status: 410; note?: string }

// Одна strict-мапа + superRefine вместо union'а: у ошибок точные путь и текст
// («у 410 нет to»), а не «Invalid input».
const RedirectRuleSchema = z
  .strictObject({
    from: internalPath,
    to: target.optional(),
    status: z.literal([301, 308, 410]),
    note: z.string().optional(),
  })
  .superRefine((rule, ctx) => {
    if (rule.status === 410 && rule.to !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'у 410 цели нет' })
    }
    if (rule.status !== 410 && rule.to === undefined) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: `у ${rule.status} нужна цель to` })
    }
    if (rule.to === rule.from) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'ведёт сам на себя' })
    }
  })
  .transform((rule): RedirectRule => {
    const note = rule.note === undefined ? {} : { note: rule.note }
    return rule.status === 410
      ? { from: rule.from, status: 410, ...note }
      : { from: rule.from, to: rule.to as string, status: rule.status, ...note }
  })

export const RedirectsSchema = z.array(RedirectRuleSchema)
export type RedirectTable = ReadonlyMap<string, RedirectRule>

export function isExternalTarget(to: string): boolean {
  return !to.startsWith('/')
}

// Query переезжает вместе с адресом (UTM-метки, параметры ссылок из рассылок): у внутренней
// цели своей query нет по схеме, у внешней — дописывается после её собственной.
export function redirectLocation(to: string, search: string): string {
  if (search === '') return to
  if (!isExternalTarget(to)) return `${to}${search}`
  const url = new URL(to)
  for (const [key, value] of new URLSearchParams(search)) url.searchParams.append(key, value)
  return url.href
}

// Один хоп по построению: цель никогда не совпадает ни с чьим `from`, значит ни цепочек,
// ни циклов быть не может. Существование целевого маршрута проверяет `check:content`.
// Все нарушения собираются в одну ошибку — гейту нужен полный список, не первое попавшееся.
// Пустой redirects.yaml (или только комментарии) парсится в null — это пустая таблица.
export function buildRedirectTable(data: unknown): RedirectTable {
  const rules = RedirectsSchema.parse(data ?? [])
  const table = new Map<string, RedirectRule>()
  const problems: string[] = []
  for (const rule of rules) {
    if (table.has(rule.from)) problems.push(`дубль from ${rule.from}`)
    table.set(rule.from, rule)
  }
  for (const rule of rules) {
    if ('to' in rule && table.has(rule.to)) {
      problems.push(
        `цепочка ${rule.from} → ${rule.to} → …: правило должно вести сразу на конечный адрес`,
      )
    }
  }
  if (problems.length > 0) throw new Error(`redirects: ${problems.join('; ')}`)
  return table
}
