// GEO-шаг /seo-audit: доступность страниц для поисковых и ИИ-ботов глазами базы соседнего strategy.
// Её утилита geo_probe.py с UA-пробой идёт по шаблонам страниц сборки, реестр ботов — копия сайта;
// серьёзность флага — таблица checks её head-kit.yaml: B и S — чинить, D — к сведению. Флаг,
// который даёт решение самого сайта (страница закрыта сборкой, политика deny-all), — не дефект.
// Заодно копия реестра ботов сверяется с файлом базы. Шаг внешний (Python соседа, сеть) и в гейт не
// входит: соседа или окружения его утилит нет — строка пропуска и код 0.
// usage: pnpm geo:probe <origin> [strategy-path]
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { load } from 'js-yaml'
import { AI_BOTS_POLICY } from '../src/shared/config/site.ts'
import { headTags, isNoindex } from './lib/html.mjs'
import { pageTemplates } from './lib/routes.mjs'

const root = resolve(import.meta.dirname, '..')
const KB = 'kb/site/07-seo-geo-performance-analytics'
// Классический поиск и реклама: политика ИИ-ботов не закрывает их ни в одном режиме.
const NEVER_CLOSED = ['google-googlebot', 'yandex-yandexbot', 'microsoft-bingbot', 'google-adsbot']
// Мета `bingbot noarchive` и `applebot nosnippet` политики deny-all.
const DENY_ALL_META = ['noarchive-or-nocache', 'nosnippet']

const [origin, strategyArg] = process.argv.slice(2)
if (origin === undefined || !URL.canParse(origin)) {
  console.error('usage: pnpm geo:probe <origin> [strategy-path]')
  process.exit(2)
}
const site = new URL(origin).origin

// Сосед — strategy-path артефакта стека service; у шаблона артефакта нет — путь по умолчанию.
function strategyPath() {
  const service = resolve(root, 'docs/stack/service.md')
  const row = existsSync(service)
    ? /^\|\s*strategy-path\s*\|\s*`([^`]+)`/m.exec(readFileSync(service, 'utf8'))
    : null
  return row?.[1] ?? '../strategy'
}
const strategy = resolve(root, strategyArg ?? strategyPath())
const base = join(strategy, '.claude/skills/design-deep-dive')
const probe = join(base, 'scripts/site/geo_probe.py')
const python = join(
  process.env.DDD_HOME ?? join(homedir(), '.cache/design-deep-dive'),
  'venv/bin/python',
)
const skip = (reason) => {
  console.info(`geo:probe: пропуск — ${reason}`)
  process.exit(0)
}
if (!existsSync(probe)) skip(`соседнего strategy нет (${strategy})`)
if (!existsSync(python)) skip(`окружение утилит strategy не установлено (${python})`)

const client = resolve(root, 'dist/client')
if (!existsSync(client)) {
  console.error('geo:probe: dist/client не найден — сначала pnpm build')
  process.exit(1)
}

let fix = 0
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const registry = resolve(root, 'src/shared/seo/crawlers.yaml')
const copy = sha256(registry)
if (copy === sha256(join(base, KB, 'crawlers.yaml'))) {
  console.info(`geo:probe: реестр ботов — копия равна базе (sha256 ${copy.slice(0, 12)})`)
} else {
  fix++
  console.info(
    'geo:probe: реестр ботов — копия расходится с базой: заменить файлом базы вместе с CRAWLERS_SHA256',
  )
}

const pages = pageTemplates(resolve(root, 'src/pages'), client).map((path, index) => ({
  id: `page-${String(index + 1).padStart(2, '0')}`,
  path,
  noindex: isNoindex(headTags(readFileSync(join(client, path, 'index.html'), 'utf8'))),
}))
const out = mkdtempSync(join(tmpdir(), 'geo-probe-'))
const list = join(out, 'pages.tsv')
writeFileSync(
  list,
  ['id\turl', ...pages.map(({ id, path }) => `${id}\t${site}${path}`), ''].join('\n'),
)
console.info(`geo:probe: ${site} — шаблонов страниц ${pages.length}, UA-проба ботов`)
// Сосед читается, но не меняется: кеш байт-кода Python в его дерево не пишется.
const run = spawnSync(
  python,
  [probe, '--batch', list, '--out', out, '--ua-probe', '--crawlers', registry],
  { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } },
)
if (run.status !== 0) {
  console.error(`geo:probe: geo_probe.py завершился с кодом ${run.status}`)
  process.exit(1)
}

// Шаблоны флагов базы: `page-status-*`, `ua-<бот>-status-<код>`.
const { checks } = load(readFileSync(join(base, KB, 'head-kit.yaml'), 'utf8'))
const severityOf = (flag) =>
  checks.find(({ flag: pattern }) =>
    new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*|<[^>]+>/g, '.+')}$`,
    ).test(flag),
  )?.severity

function expected(flag, page) {
  if (page.noindex && (flag === 'noindex' || flag === 'no-canonical')) {
    return 'страница закрыта сборкой'
  }
  const blocked = flag.startsWith('blocked-') ? flag.slice('blocked-'.length) : undefined
  const byPolicy =
    blocked === undefined ? DENY_ALL_META.includes(flag) : !NEVER_CLOSED.includes(blocked)
  return AI_BOTS_POLICY === 'deny-all' && byPolicy ? 'политика deny-all' : undefined
}

for (const page of pages) {
  const file = join(out, `${page.id}.json`)
  const result = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  const error = result.error ?? result.page?.error ?? (result.flags ? undefined : 'нет результата')
  if (error !== undefined) {
    fix++
    console.info(`  ${page.path} — чинить: проба не прошла (${error})`)
    continue
  }
  const groups = { чинить: [], ожидаемо: [], 'к сведению': [] }
  for (const flag of result.flags) {
    const reason = expected(flag, page)
    const severity = severityOf(flag)
    if (reason !== undefined) groups.ожидаемо.push(`${flag} (${reason})`)
    else if (severity === 'B' || severity === 'S') groups.чинить.push(`${severity} ${flag}`)
    else groups['к сведению'].push(`${severity ?? '·'} ${flag}`)
  }
  fix += groups.чинить.length
  const line = Object.entries(groups)
    .filter(([, flags]) => flags.length > 0)
    .map(([name, flags]) => `${name}: ${flags.join(', ')}`)
  console.info(`  ${page.path} — ${line.join(' · ') || 'флагов нет'}`)
}
rmSync(out, { recursive: true, force: true })

console.info(
  fix === 0
    ? 'geo:probe: чинить нечего — флагов B и S нет, кроме ожидаемых политикой сайта'
    : `geo:probe: чинить — ${fix}: строки «чинить» выше`,
)
process.exit(fix === 0 ? 0 : 1)
