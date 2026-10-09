// Флаги GEO-пробы базы strategy (geo_probe.py) глазами сайта: что чинить, что ожидаемо его же
// решением, что к сведению. Серьёзность флага — таблица `checks` head-kit.yaml базы: B и S —
// чинить. Ожидаемо только то, что следует из сборки (страница закрыта `noindex`) и из политики
// ИИ-ботов `deny-all`: её группа robots.txt и её мета — адресные, как их пишет реестр ботов.
import { headTags } from './html.mjs'

// Классический поиск и реклама: политика ИИ-ботов не закрывает их ни в одном режиме.
const NEVER_CLOSED = ['google-googlebot', 'yandex-yandexbot', 'microsoft-bingbot', 'google-adsbot']
// Флаги пробы о мета роботам и директивы, по которым она их ставит.
const META_FLAGS = { nosnippet: /nosnippet/, 'noarchive-or-nocache': /noarchive|nocache/ }

/**
 * Мета, которые политика ставит в `<head>`, — как их пишет реестр ботов (`other_controls`).
 * @param {{ policies: Record<string, { other_controls?: string[] }> }} registry — crawlers.yaml
 * @param {string} policy
 * @returns {{ name: string, content: string }[]}
 */
export const policyMeta = (registry, policy) =>
  headTags(`${(registry.policies[policy]?.other_controls ?? []).join('')}</head>`).flatMap(
    ({ name, content }) => (name && content ? [{ name, content }] : []),
  )

// Шаблоны флагов базы: `page-status-*`, `ua-<бот>-status-<код>`.
const severityOf = (checks, flag) =>
  checks.find(({ flag: pattern }) =>
    new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*|<[^>]+>/g, '.+')}$`,
    ).test(flag),
  )?.severity

/**
 * Директивы роботам, которые на странице стоят сверх мета политики: в заголовке `X-Robots-Tag`, у
 * всех роботов или у поисковика, которому политика их не ставит.
 * @param {{ robots_meta?: Record<string, string[]>, x_robots_tag?: string | null }} head
 * @param {{ name: string, content: string }[]} meta
 */
const beyondPolicy = (head, meta) =>
  [
    head.x_robots_tag ?? '',
    ...Object.entries(head.robots_meta ?? {}).flatMap(([name, contents]) =>
      contents.filter(
        (content) => !meta.some((own) => own.name === name && own.content === content),
      ),
    ),
  ]
    .join(' ')
    .toLowerCase()

/**
 * Флаги одной страницы по группам.
 * @param {{ flags: string[], head?: object }} result — результат geo_probe.py
 * @param {{ noindex: boolean }} page — страница сборки: закрыта ли она `noindex`
 * @param {{ policy: string, meta: { name: string, content: string }[], checks: { flag: string, severity: string }[] }} site
 *   — политика ИИ-ботов сайта, её мета и таблица серьёзности базы
 * @returns {Record<'чинить' | 'ожидаемо' | 'к сведению', string[]>}
 */
export function flagGroups(result, page, { policy, meta, checks }) {
  const expected = (/** @type {string} */ flag) => {
    if (page.noindex && (flag === 'noindex' || flag === 'no-canonical')) {
      return 'страница закрыта сборкой'
    }
    if (policy !== 'deny-all') return undefined
    const byPolicy = flag.startsWith('blocked-')
      ? !NEVER_CLOSED.includes(flag.slice('blocked-'.length))
      : META_FLAGS[flag] !== undefined &&
        !META_FLAGS[flag].test(beyondPolicy(result.head ?? {}, meta))
    return byPolicy ? 'политика deny-all' : undefined
  }
  const groups = { чинить: [], ожидаемо: [], 'к сведению': [] }
  for (const flag of result.flags) {
    const reason = expected(flag)
    const severity = severityOf(checks, flag)
    if (reason !== undefined) groups.ожидаемо.push(`${flag} (${reason})`)
    else if (severity === 'B' || severity === 'S') groups.чинить.push(`${severity} ${flag}`)
    else groups['к сведению'].push(`${severity ?? '·'} ${flag}`)
  }
  return groups
}
