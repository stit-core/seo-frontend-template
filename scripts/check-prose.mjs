// Самопроверка прозы (до сборки): обвязка ссылается на существующее. В коде прозы — `…` и ограды ``` в CLAUDE.md,
// README, docs/ и .claude (правила и скиллы) — есть в репо пути (от корня, от каталога документа, слой FSD — от src/;
// <…> — плейсхолдер, а не ссылка, glob — хотя бы один файл), pnpm-скрипты, скиллы (`/имя`, skill `имя`) и правила
// (rule `имя` и каждое имя перечня после); маркеров конфликта нет ни в одном файле репо; строки .template/paths —
// пути репо без пробела и CR по краю, .template/version — vX.Y.Z; на каноне тег v* на HEAD равен версии и аннотирован.
// Иначе агент идёт по мёртвой ссылке, а форк — по сорванному переносу. Репо — то, что отслеживает git:
// неотслеживаемого файла в клоне нет.
// `/имя`, которое не скилл, — адрес сайта (маршрут src/pages на любой локали, переезд redirects.yaml), встроенная
// команда, скилл соседнего strategy или корень файловой системы. Проза путей шаблона адрес не первой локали проверяемого
// проекта пишет плейсхолдером `/<lang>`: перенос несёт её в форк, а локали у форка свои.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { load } from 'js-yaml'
import { pageRoutes, routePattern } from './lib/routes.mjs'
import { isCanonical } from './lib/template.mjs'

// Корень проекта; другой корень — мини-репо фикстуры check:gate (.gate-fixtures/prose).
const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })

// Файлы индекса, которые есть в дереве (удалённый — уже не ссылка); стадии конфликта в индексе — одной строкой.
const files = [...new Set(git('ls-files', '-z').split('\0'))].filter(
  (file) => file !== '' && existsSync(resolve(root, file)),
)
const tracked = new Set(files)
const dirs = new Set()
for (const file of files) {
  for (let dir = posix.dirname(file); dir !== '.'; dir = posix.dirname(dir)) dirs.add(dir)
}
const names = new Set(files.map((file) => posix.basename(file)))
const inRepo = (path) => tracked.has(path) || dirs.has(path)

// Мини-проекты фикстур гейта (.gate-fixtures/<каталог>/) несут заведомые нарушения: их проверяет check:gate своим
// корнем. Рабочие документы (планы, память stack-deep-dive) описывают и то, чего ещё нет; docs/stack/<kind>.md —
// решения проекта; src/ — тексты сайта (их ссылки держит check:content).
const MINI_PROJECT = /^\.gate-fixtures\/[^/]+\//
const NOT_PROSE = ['.claude/plans/', '.claude/skills/stack-deep-dive/state/', 'src/']
const prose = files.filter(
  (file) =>
    file.endsWith('.md') &&
    !MINI_PROJECT.test(file) &&
    !NOT_PROSE.some((dir) => file.startsWith(dir)) &&
    !(posix.dirname(file) === 'docs/stack' && file !== 'docs/stack/README.md'),
)

const scripts = new Set(
  Object.keys(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts ?? {}),
)
// Команды pnpm и бинарники пакетов (`pnpm vitest` — их exec), а не скрипты package.json.
const PNPM_COMMANDS = new Set([
  'add',
  'audit',
  'dedupe',
  'dlx',
  'exec',
  'i',
  'install',
  'licenses',
  'list',
  'ls',
  'outdated',
  'rebuild',
  'remove',
  'rm',
  'run',
  'store',
  'up',
  'update',
  'view',
  'why',
])
const pnpmTarget = (name) =>
  scripts.has(name) ||
  PNPM_COMMANDS.has(name) ||
  existsSync(resolve(root, 'node_modules/.bin', name))
const PNPM_CALL = /\bpnpm\s+(?:run\s+)?([a-z][\w:.-]*)/g

const skill = (name) => tracked.has(`.claude/skills/${name}/SKILL.md`)
// Встроенные команды Claude Code и скилл соседнего strategy (карта сайта проектируется там): не скиллы репо.
const NOT_REPO_SKILLS = new Set(['clear', 'code-review', 'security-review', 'fsd-deep-dive'])
// Корни файловой системы — `/app` образа, `/tmp`: пути, а не скиллы.
const FS_ROOTS = new Set([
  'app',
  'bin',
  'dev',
  'etc',
  'home',
  'mnt',
  'opt',
  'proc',
  'root',
  'run',
  'srv',
  'tmp',
  'usr',
  'var',
])
const SLASH_NAME = /^\/(\p{Ll}[\p{Ll}\p{N}-]*)$/u

// Адрес сайта — маршрут src/pages на любой локали проверяемого проекта (его политика сборки) или from переезда
// content/redirects.yaml.
const policy = resolve(root, 'scripts/lib/site-policy.mjs')
const prefixes = existsSync(policy)
  ? (await import(pathToFileURL(policy).href)).LOCALES.slice(1).map(({ code }) => code)
  : []
const pagesDir = resolve(root, 'src/pages')
const routes = existsSync(pagesDir)
  ? pageRoutes(pagesDir).map(({ route }) => routePattern(route, prefixes))
  : []
const redirectsFile = resolve(root, 'content/redirects.yaml')
// Таблица, которая не разбирается (маркер конфликта, опечатка YAML), переездов не даёт: её ошибку называет
// check:content, а маркер — эта проверка ниже.
const redirects = () => {
  try {
    const table = load(readFileSync(redirectsFile, 'utf8'))
    return Array.isArray(table) ? table : []
  } catch {
    return []
  }
}
const moved = new Set(
  (existsSync(redirectsFile) ? redirects() : []).map(({ from }) =>
    String(from)
      .split('?')[0]
      .replace(/(?<=.)\/+$/, ''),
  ),
)
const address = (path) => moved.has(path) || routes.some((pattern) => pattern.test(path))

// Пути шаблона — строки .template/paths (`:(exclude)<путь>` — вычет): их прозу template:update переносит в форк как
// есть. Адрес на префиксе не первой локали проверяемого проекта в ней называет локаль шаблона, которой у форка может не
// быть: в одноязычном форке `/en` — мёртвая ссылка.
const templateLines = tracked.has('.template/paths')
  ? readFileSync(resolve(root, '.template/paths'), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
  : []
const templatePaths = templateLines.map((line) => line.trim())
const EXCLUDE = ':(exclude)'
const covers = (entry, file) => {
  const path = entry.replace(/\/+$/, '')
  return file === path || file.startsWith(`${path}/`)
}
const ofTemplate = (file) =>
  templatePaths.some((entry) => !entry.startsWith(EXCLUDE) && covers(entry, file)) &&
  !templatePaths.some(
    (entry) => entry.startsWith(EXCLUDE) && covers(entry.slice(EXCLUDE.length), file),
  )
const LOCALE_ADDRESS =
  prefixes.length === 0 ? undefined : new RegExp(`^/(?:${prefixes.join('|')})(?:/|$)`)

// Слово перед `имя`: rule или правило — .claude/rules/<имя>.md, skill или скилл — скилл.
const NAMED_BY = /(?:^|[\s(«"])(rules?|правил\p{L}*|skills?|скилл\p{L}*)\s+$/iu
// Между именами перечня после rule или skill: «правила `a`, `b` и `c`».
const LIST_SEP = /^(?:\s*,\s*(?:(?:и|или)\s+)?|\s+(?:и|или)\s+|\s*\/\s*)$/u
const KEBAB = /^\p{Ll}[\p{Ll}\p{N}-]*$/u
const CODE = /```[\s\S]*?```|`[^`\n]+`/g

const FSD_LAYERS = new Set(['app', 'pages', 'widgets', 'features', 'entities', 'shared'])
// Модуль без расширения (`shared/seo/robots`, импорт `@/app/middleware`) — файл с расширением кода или каталог.
const EXTENSIONS = ['', '.ts', '.astro', '.mjs', '.js']
// Плейсхолдер — не ссылка: <…>, $, |, …, многоточие вне сегмента маршрута [...x], {x} без перечня.
const PLACEHOLDER = /[<>$|…]|(?<!\[)\.\.\.|\{[^,}]*\}/

// {a,b} — каждое имя перечня.
function expand(ref) {
  const match = /\{([^{}]*,[^{}]*)\}/.exec(ref)
  if (!match) return [ref]
  return match[1]
    .split(',')
    .flatMap((part) =>
      expand(ref.slice(0, match.index) + part + ref.slice(match.index + match[0].length)),
    )
}

const globSource = (pattern) =>
  pattern
    .split(/(\*\*\/?|\*)/)
    .map((part) => {
      if (part === '**/') return '(?:.*/)?'
      if (part === '**') return '.*'
      if (part === '*') return '[^/]*'
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
const globbed = (pattern) => {
  const source = new RegExp(`^${globSource(pattern)}$`)
  return files.some((file) => source.test(file)) || [...dirs].some((dir) => source.test(dir))
}
// Артефакт стека docs/stack/<kind>.md появляется у форка — по форме _templates/<kind>.md.
const stackArtifact = (path) => {
  const kind = /^docs\/stack\/([^/]+\.md)$/.exec(path)?.[1]
  return kind !== undefined && tracked.has(`docs/stack/_templates/${kind}`)
}
const found = (path) =>
  path.includes('*')
    ? globbed(path)
    : EXTENSIONS.some((ext) => inRepo(path + ext)) || stackArtifact(path)

// Пути, от которых ссылка читается: корень, каталог документа, у слоя FSD — src/ корня и каталога документа; нет ни
// одного — не путь репо.
function bases(doc, ref) {
  const [top] = ref.split('/')
  const dir = posix.dirname(doc)
  const near = dir === '.' ? '' : `${dir}/`
  return [
    ...(inRepo(top) ? [''] : []),
    ...(near !== '' && inRepo(near + top) ? [near] : []),
    ...(FSD_LAYERS.has(top)
      ? ['src/', ...(near !== '' && inRepo(`${near}src`) ? [`${near}src/`] : [])]
      : []),
  ]
}

const problems = []
const deadPaths = []
let references = 0
for (const doc of prose) {
  const text = readFileSync(resolve(root, doc), 'utf8')
  const templateDoc = ofTemplate(doc)
  let listKind = ''
  let previousEnd = 0
  for (const match of text.matchAll(CODE)) {
    const start = match.index
    const span = match[0].replace(/^`+|`+$/g, '')
    for (const call of span.matchAll(PNPM_CALL)) {
      const name = call[1].replace(/[.:]+$/, '')
      references++
      if (!pnpmTarget(name)) problems.push(`${doc}: pnpm ${name} — скрипта нет в package.json`)
    }
    let kind = ''
    let listed = false
    const named = NAMED_BY.exec(text.slice(Math.max(0, start - 64), start))
    if (named) kind = /^(?:rule|правил)/iu.test(named[1]) ? 'rule' : 'skill'
    else if (listKind !== '' && LIST_SEP.test(text.slice(previousEnd, start))) {
      kind = listKind
      listed = true
    }
    listKind = ''
    previousEnd = start + match[0].length
    if (kind !== '' && KEBAB.test(span)) {
      listKind = kind
      references++
      const missing =
        kind === 'rule'
          ? !tracked.has(`.claude/rules/${span}.md`)
          : !skill(span) && !NOT_REPO_SKILLS.has(span)
      // Имя дальше по перечню, которое называет каталог или файл репо, — не правило и не скилл: «правило `comments` и
      // `scripts`».
      const other = listed && (inRepo(span) || names.has(span) || names.has(`${span}.md`))
      if (missing && !other) {
        problems.push(
          kind === 'rule'
            ? `${doc}: rule ${span} — нет .claude/rules/${span}.md`
            : `${doc}: skill ${span} — нет .claude/skills/${span}/SKILL.md`,
        )
      }
    }
    for (const word of span.split(/\s+/)) {
      let ref = word.replace(/^["'(«]+/, '').replace(/["'.,;:()»]+$/, '')
      ref = ref.split('#')[0].split(':')[0]
      if (ref.startsWith('./')) ref = ref.slice(2)
      if (ref.startsWith('@/')) ref = `src/${ref.slice(2)}`
      // В ограде код в бэктиках — текст: адрес в нём (комментарий примера) — тоже адрес.
      const bare = ref.replace(/^`+|`+$/g, '')
      if (templateDoc && LOCALE_ADDRESS?.test(bare)) {
        references++
        problems.push(`${doc}: ${bare} — адрес локали в прозе шаблона — /<lang>`)
        continue
      }
      const slash = SLASH_NAME.exec(ref)
      if (slash) {
        const [, name] = slash
        references++
        if (!skill(name) && !NOT_REPO_SKILLS.has(name) && !FS_ROOTS.has(name) && !address(ref)) {
          problems.push(`${doc}: ${ref} — не скилл репо и не адрес сайта`)
        }
        continue
      }
      if (!ref.includes('/') || /^(?:\/|~|\.\.)/.test(ref) || PLACEHOLDER.test(ref)) continue
      // Glob с перечнем (`*.{test,spec}.ts`) жив, когда ложится хоть одним именем; перечень путей (`{index,about}`) —
      // каждое имя.
      const glob = ref.replace(/\{[^{}]*\}/g, '').includes('*')
      for (const group of glob ? [expand(ref)] : expand(ref).map((path) => [path])) {
        const candidates = group.map((path) => path.replace(/\/+$/, ''))
        const from = bases(doc, candidates[0])
        if (from.length === 0) continue
        references++
        const paths = from.flatMap((base) => candidates.map((path) => base + path))
        if (!paths.some(found)) deadPaths.push({ doc, ref: glob ? ref : group[0], paths })
      }
    }
  }
}

// Путь, который игнорирует git, — локальный (сборка, кеш), а не ссылка на репо; есть на диске, но не в git — забыли
// git add.
const candidates = deadPaths.flatMap(({ paths }) => paths)
const ignored = new Set(
  candidates.length === 0
    ? []
    : spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
        cwd: root,
        input: candidates.join('\n'),
        encoding: 'utf8',
      }).stdout.split('\n'),
)
for (const { doc, ref, paths } of deadPaths) {
  if (paths.some((path) => ignored.has(path))) continue
  const onDisk = paths.some((path) => existsSync(resolve(root, path)))
  problems.push(
    `${doc}: ${ref} — пути нет в репо${onDisk ? ' (на диске есть, не в git: git add)' : ''}`,
  )
}

// Маркер конфликта переноса в прозе, данных или скрипте сборку не ломает — без проверки он прошёл бы гейт.
const MARKER = /^(?:<{7}|>{7})(?: |$)/m
let scanned = 0
for (const file of files) {
  if (MINI_PROJECT.test(file) || !lstatSync(resolve(root, file)).isFile()) continue
  scanned++
  const text = readFileSync(resolve(root, file), 'utf8')
  const marker = MARKER.exec(text)
  if (marker)
    problems.push(`${file}:${text.slice(0, marker.index).split('\n').length}: маркер конфликта`)
}

// .template — версия обвязки и пути шаблона: от версии идёт перенос, строку путей без файлов он пропустил бы молча.
const version = tracked.has('.template/version')
  ? readFileSync(resolve(root, '.template/version'), 'utf8').replace(/\n$/, '')
  : undefined
if (version === undefined)
  problems.push('.template/version: файла нет — от версии обвязки идёт перенос')
else if (!/^v\d+\.\d+\.\d+$/.test(version))
  problems.push(`.template/version: «${version}» — не vX.Y.Z`)
if (!tracked.has('.template/paths'))
  problems.push('.template/paths: файла нет — пути шаблона, их переносит template:update')
else {
  for (const line of templateLines) {
    const entry = line.trim()
    // Перенос берёт строку как есть: с пробелом или CR по краю путь ничего не выбирает, и его правки молча теряются.
    if (entry !== line) {
      problems.push(
        `.template/paths: ${JSON.stringify(line)} — пробел или CR по краю строки: перенос её молча потеряет`,
      )
      continue
    }
    if (!inRepo(entry.replace(/^:\(exclude\)/, '').replace(/\/+$/, ''))) {
      problems.push(`.template/paths: ${entry} — пути нет в репо`)
    }
  }
}

// Канон: тег v* на HEAD — выпуск версии обвязки; форк с этого коммита начнёт перенос с неё, а перенос в форке
// показывает аннотацию тега. Тега нет — норма до выпуска. В форке v* — его релизы.
if (version !== undefined && isCanonical(root)) {
  for (const tag of git('tag', '--points-at', 'HEAD', '--list', 'v*').split('\n').filter(Boolean)) {
    if (tag !== version) problems.push(`тег ${tag} на HEAD ≠ .template/version ${version}`)
    if (git('cat-file', '-t', `refs/tags/${tag}`).trim() !== 'tag') {
      problems.push(`тег ${tag} на HEAD — лёгкий: перенос в форке не покажет его аннотацию`)
    }
  }
}

const unique = [...new Set(problems)]
if (unique.length > 0) {
  console.error(`check:prose: ${unique.length} нарушений\n  ${unique.join('\n  ')}`)
  process.exit(1)
}
console.info(
  `check:prose: документов ${prose.length}, ссылок в коде прозы ${references}, файлов без маркеров конфликта ${scanned} — ok`,
)
