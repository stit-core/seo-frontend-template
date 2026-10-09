import { z } from 'zod'

// Форма адреса страницы — без хвостового слеша. Настройку читает Astro (`trailingSlash` в
// astro.config.ts); канон пути ниже срезает слеш сам, без оглядки на неё: другая форма — правка
// обоих мест (их согласие держит тест таблицы).
export const TRAILING_SLASH = 'never'

// Разделитель пути, записанный процентами (`%2F`, `%5C`), и обратный слеш: браузер, прокси и
// статик-хендлер читают их по-разному, поэтому адреса с ними у сайта нет.
const HIDDEN_SEPARATOR = /%2f|%5c|\\/i

// Сегмент в одной записи: то, что в пути можно писать буквально, — буквально, остальное — UTF-8 в
// процентах прописными hex. `?` и `#` encodeURI оставляет как части URL, а в сегменте они — данные.
const encodeSegment = (segment: string): string =>
  encodeURI(segment).replace(/[?#]/g, (char) => (char === '?' ? '%3F' : '%23'))

/**
 * Канонический вид пути — один на адрес: без повторных и хвостового слеша, без сегментов `.` и
 * `..` и без `index.html` в конце, проценты — в одной записи. Регистр букв не трогается: адреса к
 * нему чувствительны. `undefined` — канонического вида нет: в пути спрятан разделитель или
 * кодировка битая, такого адреса сервер не обслуживает.
 */
export function canonicalPath(pathname: string): string | undefined {
  if (HIDDEN_SEPARATOR.test(pathname)) return undefined
  const segments: string[] = []
  try {
    for (const raw of pathname.split('/')) {
      const segment = decodeURIComponent(raw)
      if (segment === '..') segments.pop()
      else if (segment !== '' && segment !== '.') segments.push(encodeSegment(segment))
    }
  } catch {
    return undefined
  }
  while (segments.at(-1) === 'index.html') segments.pop()
  return `/${segments.join('/')}`
}

// Свой адрес — цель редиректа — уже в канонической форме.
const INTERNAL_PATH = /^\/(?:[a-z0-9._~-]+(?:\/[a-z0-9._~-]+)*)?$/

const internalPath = z
  .string()
  .regex(INTERNAL_PATH, 'корневой путь в нижнем регистре, без query и хвостового слеша')

const target = z.union(
  [internalPath, z.url({ protocol: /^https?$/ })],
  'свой корневой путь или абсолютный http(s) URL, который разбирается (с хостом, без пробелов)',
)

// Адрес старого сайта — как он был: с заглавными, кириллицей или процентами, хвостовым слешем,
// `index.php` и `?query`. К таблице он приводится тем же каноном пути, что и адрес запроса.
const legacyAddress = z.string().regex(/^\/[^\s#]*$/, 'адрес от корня сайта, без пробелов и #')

type QueryPair = readonly [key: string, value: string]

interface Address {
  // Адрес, как он записан в redirects.yaml.
  from: string
  // Канонический путь и пары query, по которым правило находит запрос.
  path: string
  query: readonly QueryPair[]
  note?: string
}

export type RedirectRule =
  | (Address & { status: 301 | 308; to: string })
  | (Address & { status: 410 })

function splitAddress(address: string): { path: string | undefined; query: QueryPair[] } {
  const cut = address.indexOf('?')
  return {
    path: canonicalPath(cut < 0 ? address : address.slice(0, cut)),
    query: [...new URLSearchParams(cut < 0 ? '' : address.slice(cut + 1))],
  }
}

// Одна strict-мапа + superRefine вместо union'а: у ошибок точные путь и текст
// («у 410 нет to»), а не «Invalid input».
const RedirectRuleSchema = z
  .strictObject({
    from: legacyAddress,
    to: target.optional(),
    status: z.literal([301, 308, 410]),
    note: z.string().optional(),
  })
  .superRefine((rule, ctx) => {
    const { path, query } = splitAddress(rule.from)
    if (path === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message:
          'закодированный слеш (%2F, %5C) или битая кодировка: такого адреса сервер не знает',
      })
    }
    if (rule.status === 410 && rule.to !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'у 410 цели нет' })
    }
    if (rule.status !== 410 && rule.to === undefined) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: `у ${rule.status} нужна цель to` })
    }
    if (rule.to === path && query.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'ведёт сам на себя' })
    }
  })
  .transform((rule): RedirectRule => {
    const { path, query } = splitAddress(rule.from)
    const address = {
      from: rule.from,
      path: path as string,
      query,
      ...(rule.note === undefined ? {} : { note: rule.note }),
    }
    if (rule.status === 410) return { ...address, status: 410 }
    const to = rule.to as string
    // Чужой адрес — в одной записи, как его шлёт браузер: хост в punycode, путь и query в процентах.
    // Кириллицу (`https://пример.рф/раздел`) заголовок Location не принимает — ответ вышел бы 400.
    return { ...address, to: isExternalTarget(to) ? new URL(to).href : to, status: rule.status }
  })

export const RedirectsSchema = z.array(RedirectRuleSchema)

export interface RedirectTable {
  readonly rules: readonly RedirectRule[]
  // Правило для канонического пути и query запроса. Правило с `?query` срабатывает, когда в
  // запросе есть все его пары; из подходящих берётся самое точное — с наибольшим числом пар.
  find(path: string, search?: string): RedirectRule | undefined
}

export function isExternalTarget(to: string): boolean {
  return !to.startsWith('/')
}

// Query запроса без пар самого правила: они — адрес старой страницы, а не метка перехода.
function carriedSearch(own: readonly QueryPair[], search: string): string {
  if (own.length === 0) return search
  const left = [...own]
  const carried = search
    .slice(1)
    .split('&')
    .filter((part) => {
      const [pair] = new URLSearchParams(part)
      const at = left.findIndex(([key, value]) => key === pair?.[0] && value === pair[1])
      if (at < 0) return part !== ''
      left.splice(at, 1)
      return false
    })
  return carried.length > 0 ? `?${carried.join('&')}` : ''
}

// Query переезжает вместе с адресом (UTM-метки, параметры ссылок из рассылок): у внутренней
// цели своей query нет по схеме, у внешней — дописывается после её собственной.
export function redirectLocation(
  rule: Pick<Extract<RedirectRule, { to: string }>, 'to' | 'query'>,
  search: string,
): string {
  const carried = carriedSearch(rule.query, search)
  if (carried === '') return rule.to
  if (!isExternalTarget(rule.to)) return `${rule.to}${carried}`
  const url = new URL(rule.to)
  for (const [key, value] of new URLSearchParams(carried)) url.searchParams.append(key, value)
  return url.href
}

// Один хоп у каждого адреса таблицы: цель без query не совпадает ни с чьим `from` — ни цепочек, ни
// циклов. Правило с `?query` на пути чужой цели законно: второй хоп получит только запрос, который
// сам принёс его пары на адрес другого правила. Существование целевого маршрута проверяет
// `check:content`.
// Все нарушения собираются в одну ошибку — гейту нужен полный список, не первое попавшееся.
// Пустой redirects.yaml (или только комментарии) парсится в null — это пустая таблица.
export function buildRedirectTable(data: unknown): RedirectTable {
  const rules = RedirectsSchema.parse(data ?? [])
  const byPath = new Map<string, RedirectRule[]>()
  const seen = new Set<string>()
  const problems: string[] = []
  for (const rule of rules) {
    const key = `${rule.path}?${rule.query
      .map(([name, value]) => `${name}=${value}`)
      .sort()
      .join('&')}`
    if (seen.has(key)) problems.push(`дубль from ${rule.from}`)
    seen.add(key)
    byPath.set(rule.path, [...(byPath.get(rule.path) ?? []), rule])
  }
  for (const list of byPath.values()) list.sort((a, b) => b.query.length - a.query.length)
  const table: RedirectTable = {
    rules,
    find(path, search = '') {
      const pairs = [...new URLSearchParams(search)]
      return byPath
        .get(path)
        ?.find((rule) =>
          rule.query.every(([key, value]) => pairs.some(([k, v]) => k === key && v === value)),
        )
    },
  }
  for (const rule of rules) {
    if ('to' in rule && table.find(rule.to)) {
      problems.push(
        `цепочка ${rule.from} → ${rule.to} → …: правило должно вести сразу на конечный адрес`,
      )
    }
  }
  if (problems.length > 0) throw new Error(`redirects: ${problems.join('; ')}`)
  return table
}

// Что сервер отвечает на адрес, не открывая страницу: переезд (правило таблицы или канон пути),
// «удалено» или «такого адреса нет».
export type Resolution = { status: 301 | 308; location: string } | { status: 410 } | { status: 404 }

/**
 * Ответ на адрес запроса (путь с query) по таблице и канону пути. Любая форма адреса — один 301
 * сразу на конечный адрес: правило таблицы находится по каноническому пути, поэтому хвостовой
 * слеш, `//`, точки и `index.html` второго хопа не дают. Неканоническая форма без переезда — 301 на
 * каноническую: 410 удалённого адреса отвечает одна его форма. Спрятанный разделитель — 404;
 * `undefined` — адресу отвечает страница.
 */
export function resolveRedirect(table: RedirectTable, url: string): Resolution | undefined {
  // Фрагмент до сервера не доходит; пришедший в сыром запросе — не часть адреса.
  const [target = ''] = url.split('#')
  if (!target.startsWith('/')) return undefined
  const cut = target.indexOf('?')
  const raw = cut < 0 ? target : target.slice(0, cut)
  const search = cut < 0 || cut === target.length - 1 ? '' : target.slice(cut)
  const path = canonicalPath(raw)
  if (path === undefined) return { status: 404 }
  const rule = table.find(path, search)
  if (rule && 'to' in rule) return { status: rule.status, location: redirectLocation(rule, search) }
  if (path !== raw) return { status: 301, location: `${path}${search}` }
  return rule ? { status: 410 } : undefined
}
