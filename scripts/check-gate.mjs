// Гейт на гейт: негативные фикстуры .gate-fixtures/ обязаны валить линтеры (ESLint, Steiger,
// Biome — теми же конфигами, что и src/) и собственные скрипты гейта (seo:check, check:links,
// check:content, plan:check, check:prose, check:stack) — ровно нарушениями из expected.json, не больше и
// не меньше. Иначе деградация (Steiger fail-open, выключенная a11y-группа Biome, потерянный резолвер boundaries,
// ослабленная проверка скрипта) остаётся незамеченной: прогон зелёный, а держать нечем. Пустая или
// урезанная секция expected.json — тоже деградация: её ловит точное совпадение. Периметр — так же:
// guard-хук Claude Code обязан отказать каждому обходу из .gate-fixtures/guard.json и пропустить
// работу. Скрипт релиза indexnow — сценариями на локальной заглушке, перенос обвязки
// template:update и лицо шаблона check:identity — сценариями на мини-репо: исходы — те же строки expected.json.
import { spawn, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const fixtures = resolve(root, '.gate-fixtures')
const expected = JSON.parse(readFileSync(resolve(fixtures, 'expected.json'), 'utf8'))

const LINTERS = ['eslint', 'steiger', 'biome']
// Скрипт гейта и корень его фикстуры: мини-проект в .gate-fixtures/<секция>.
const SCRIPTS = { seo: 'seo-check.mjs', links: 'check-links.mjs', content: 'check-content.mjs' }

function lint(name, args) {
  const bin = resolve(root, 'node_modules/.bin', name)
  const result = spawnSync(bin, args, { cwd: fixtures, encoding: 'utf8', maxBuffer: 64 << 20 })
  if (result.error) throw result.error
  // Ненулевой код здесь ожидаем (нарушения найдены); важен только разбираемый JSON.
  const start = Math.min(...['{', '['].map((c) => result.stdout.indexOf(c)).filter((i) => i >= 0))
  if (!Number.isFinite(start)) {
    throw new Error(`${name}: нет JSON в выводе\n${result.stdout}\n${result.stderr}`)
  }
  return JSON.parse(result.stdout.slice(start))
}

const rel = (path) => (isAbsolute(path) ? relative(fixtures, path) : path)

function countBy(keys) {
  const map = new Map()
  for (const key of keys) map.set(key, (map.get(key) ?? 0) + 1)
  return map
}

const eslint = lint('eslint', [
  '--no-error-on-unmatched-pattern',
  '--format',
  'json',
  '--config',
  'eslint.config.js',
  'src',
  '.claude',
])
const fatal = eslint.flatMap((f) =>
  f.messages.filter((m) => m.fatal).map((m) => `${rel(f.filePath)}: ${m.message}`),
)
if (fatal.length > 0) {
  console.error(`check:gate: ESLint не смог разобрать фикстуры:\n  ${fatal.join('\n  ')}`)
  process.exit(1)
}

// Линтеры: считаются только ошибки — правило, понижённое до warn, гейт не валит, значит, не
// поймано. Ключ — «файл  правило», ожидание — их число.
const found = {
  eslint: eslint.flatMap((f) =>
    f.messages
      .filter((m) => m.ruleId && m.severity === 2)
      .map((m) => `${rel(f.filePath)}  ${m.ruleId}`),
  ),
  steiger: lint('steiger', ['src', '--reporter', 'json'])
    .filter((d) => d.severity === 'error')
    .map((d) => `${rel(d.location.path)}  ${d.ruleName}`),
  biome: lint('biome', ['lint', '--config-path', 'biome.gate.json', '--reporter', 'json', 'src'])
    .diagnostics.filter((d) => d.severity === 'error')
    .map((d) => `${rel(d.location.path)}  ${d.category}`),
}
const want = {}
for (const tool of LINTERS) {
  want[tool] = (expected[tool] ?? []).flatMap(({ file, rule, count = 1 }) =>
    Array.from({ length: count }, () => `${file}  ${rule}`),
  )
}

// Строка ожидания с «…» на конце сверяется по началу: дальше — текст сторонней библиотеки (Zod,
// js-yaml), его меняет обновление зависимости, а не регресс скрипта.
const expectedKey = (line, keys) =>
  keys.find((key) => key.endsWith('…') && line.startsWith(key.slice(0, -1))) ?? line

// Скрипты гейта: свой корень у каждого, код выхода 1, строки нарушений — те, что под заголовком.
// Часы у фикстур свои (clock.mjs), пояс — позади UTC: «день проверки» дат записей не зависит ни
// от дня прогона, ни от пояса машины — запись с датой дня, который на Земле уже начался, законна и
// там, где по местным часам ещё вчера.
for (const [section, script] of Object.entries(SCRIPTS)) {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      resolve(fixtures, 'clock.mjs'),
      resolve(root, 'scripts', script),
      resolve(fixtures, section),
    ],
    { encoding: 'utf8', env: { ...process.env, TZ: 'America/New_York' } },
  )
  if (result.error) throw result.error
  if (result.status !== 1) {
    console.error(
      `check:gate: ${script} на фикстурах вышел с кодом ${result.status}, а не 1\n${result.stdout}${result.stderr}`,
    )
    process.exit(1)
  }
  want[section] = expected[section] ?? []
  found[section] = result.stderr
    .split('\n')
    .filter((line) => line.startsWith('  '))
    .map((line) => expectedKey(line.slice(2), want[section]))
}

// Валидатор планов берёт корень из git: фикстура — свой проект, git не поднимается выше неё.
const plans = spawnSync('bash', [resolve(root, 'scripts/validate-plan.sh')], {
  cwd: resolve(fixtures, 'plans'),
  env: { ...process.env, GIT_CEILING_DIRECTORIES: fixtures },
  encoding: 'utf8',
})
if (plans.error) throw plans.error
if (plans.status !== 1) {
  console.error(
    `check:gate: validate-plan.sh на фикстуре вышел с кодом ${plans.status}, а не 1\n${plans.stdout}`,
  )
  process.exit(1)
}
want.plans = expected.plans ?? []
found.plans = plans.stdout.split('\n').filter((line) => /^[EW] /.test(line))

// IndexNow (scripts/indexnow.mjs) ходит по сети: сайт — карта и файл ключа — и приёмник адресов
// здесь один локальный сервер, наружу гейт не ходит. Карты фикстуры несут плейсхолдер origin,
// заглушка ставит в них свой адрес — как контейнер при старте. Исход сценария — код выхода, адреса,
// которые скрипт назвал изменёнными, и то, что дошло до приёмника.
const INDEXNOW_KEY = 'gate-indexnow-key-0123'
// Адрес приёмника, на котором заглушка отвечает 403 — как поисковик на неподтверждённый ключ.
const REFUSING = '/indexnow/403'
const ORIGIN_PLACEHOLDER = 'https://__site_origin__'

function run(args) {
  return new Promise((done) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'ignore'] })
    let stdout = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    // Срок: зависший скрипт роняет сценарий, а не подвешивает гейт.
    const timer = setTimeout(() => child.kill(), 30_000)
    child.on('close', (code) => {
      clearTimeout(timer)
      done({ code, stdout })
    })
  })
}

async function indexNowOutcomes() {
  const map = (name) => readFileSync(resolve(fixtures, 'indexnow', name), 'utf8')
  let live = ''
  let posts = []
  const server = createServer((request, response) => {
    const origin = `http://${request.headers.host}`
    if (request.method === 'POST' && request.url.startsWith('/indexnow')) {
      let body = ''
      request.on('data', (chunk) => {
        body += chunk
      })
      request.on('end', () => {
        posts.push(JSON.parse(body))
        // Приёмник протокола читает только JSON: запрос без этого Content-Type он отклоняет.
        const json = /^application\/json\b/.test(request.headers['content-type'] ?? '')
        response.writeHead(request.url === REFUSING ? 403 : json ? 200 : 400).end()
      })
    } else if (request.url === '/sitemap.xml') {
      response.end(live.replaceAll(ORIGIN_PLACEHOLDER, origin))
    } else if (request.url === `/${INDEXNOW_KEY}.txt`) response.end(INDEXNOW_KEY)
    else response.writeHead(404).end('Not found')
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const origin = `http://127.0.0.1:${server.address().port}`
  const temp = mkdtempSync(join(tmpdir(), 'gate-indexnow-'))
  const before = join(temp, 'before.xml')
  writeFileSync(before, map('before.xml').replaceAll(ORIGIN_PLACEHOLDER, origin))

  const lines = []
  const scenario = async (name, liveMap, args, endpoint = '/indexnow') => {
    live = map(liveMap)
    posts = []
    const { code, stdout } = await run([
      resolve(root, 'scripts/indexnow.mjs'),
      origin,
      ...args,
      '--endpoint',
      `${origin}${endpoint}`,
    ])
    lines.push(`${name}: код ${code}`)
    for (const line of stdout.split('\n').filter((text) => /^ {2}[+~-] /.test(text))) {
      lines.push(`${name}: ${line.trim().replace(origin, '')}`)
    }
    for (const post of posts) {
      const own =
        post.host === new URL(origin).host &&
        post.key === INDEXNOW_KEY &&
        post.keyLocation === `${origin}/${INDEXNOW_KEY}.txt`
      lines.push(`${name}: запрос приёмнику — host, key и keyLocation ${own ? 'сайта' : 'ЧУЖИЕ'}`)
      for (const url of post.urlList) lines.push(`${name}: → ${url.replace(origin, '')}`)
    }
  }
  const key = ['--key', INDEXNOW_KEY]
  await scenario('отправка', 'after.xml', [before, ...key, '--send'])
  await scenario('сухой прогон', 'after.xml', [before, ...key])
  await scenario('без ключа', 'after.xml', [before, '--send'])
  await scenario('чужой ключ', 'after.xml', [before, '--key', 'another-key-0123456789', '--send'])
  await scenario('карта не изменилась', 'before.xml', [before, ...key, '--send'])
  await scenario('первый выкат', 'before.xml', [...key, '--send'])
  // Карта «до» с плейсхолдером — снятая с другого origin.
  await scenario('карта «до» с другого сайта', 'after.xml', [
    resolve(fixtures, 'indexnow/before.xml'),
    ...key,
    '--send',
  ])
  await scenario('карта «до» без адресов', 'after.xml', [
    resolve(fixtures, 'indexnow/ne-karta.html'),
    ...key,
    '--send',
  ])
  await scenario('приёмник отказал', 'after.xml', [before, ...key, '--send'], REFUSING)
  server.close()
  rmSync(temp, { recursive: true, force: true })
  return lines
}
want.indexnow = expected.indexnow ?? []
found.indexnow = await indexNowOutcomes()

// Перенос обвязки (scripts/template-update.sh) — сценариями на мини-репо во временном каталоге: шаблон с
// аннотированными тегами и форк из дерева его коммита («Use this template») с remote template. Git — без окружения
// и конфигов вызывающего (хук git задаёт GIT_DIR своего репо) и с одним временем коммитов: хеши у каждого прогона те
// же, а в строке исхода коммит шаблона назван по имени. Исход шага — код выхода и вывод движка; состояние форка —
// файлы, индекс и ссылки: его релизы — в refs/tags, теги шаблона — в refs/template.
const TEMPLATE_UPDATE = resolve(root, 'scripts/template-update.sh')
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'gate',
  GIT_AUTHOR_EMAIL: 'gate@example.com',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
  GIT_COMMITTER_NAME: 'gate',
  GIT_COMMITTER_EMAIL: 'gate@example.com',
  GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
  LC_ALL: 'C',
}
const CANONICAL_ORIGIN = 'git@git.stit.tech:stit-core/ssr-frontend-template.git'
const FORK_ORIGIN = 'git@git.stit.tech:acme/site.git'
const gitIn = (cwd, args) => {
  const result = spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`check:gate: git ${args.join(' ')}: ${result.stderr}`)
  return result.stdout
}

function templateOutcomes() {
  const temp = mkdtempSync(join(tmpdir(), 'gate-template-'))
  const lines = []
  const labels = new Map()
  const repo = (name) => {
    const dir = join(temp, name)
    mkdirSync(dir)
    gitIn(dir, ['init', '-q', '-b', 'main'])
    return dir
  }
  // Коммит: файлы (null — удалить); с именем — коммит шаблона, его хеш в выводе движка заменит имя.
  const commit = (dir, files, label) => {
    for (const [file, content] of Object.entries(files)) {
      const path = join(dir, file)
      if (content === null) rmSync(path)
      else {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, content)
      }
    }
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', label ?? 'commit'])
    if (label) labels.set(gitIn(dir, ['rev-parse', 'HEAD']).trim(), `{${label}}`)
  }
  const tag = (dir, name, message = name) => gitIn(dir, ['tag', '-a', name, '-m', message])
  // Форк — новый репо из дерева коммита шаблона одним коммитом, как «Use this template»; extra — правки до него.
  const fork = (name, template, rev, extra = {}) => {
    const dir = repo(name)
    const archive = spawnSync('git', ['archive', rev], { cwd: template, env: GIT_ENV })
    if (archive.status !== 0) throw new Error(`check:gate: git archive ${rev}: ${archive.stderr}`)
    const tar = spawnSync('tar', ['-x', '-C', dir], { input: archive.stdout })
    if (tar.status !== 0) throw new Error(`check:gate: tar: ${tar.stderr}`)
    commit(dir, extra)
    return dir
  }
  const update = (step, dir, ...args) => {
    const result = spawnSync('bash', ['-c', 'bash "$0" "$@" 2>&1', TEMPLATE_UPDATE, ...args], {
      cwd: dir,
      env: GIT_ENV,
      encoding: 'utf8',
    })
    if (result.error) throw result.error
    lines.push(`${step}: код ${result.status}`)
    for (const line of result.stdout.split('\n')) {
      if (line.trim() === '') continue
      lines.push(
        `${step}: ${line.trimEnd().replace(/\b[0-9a-f]{40}\b/g, (sha) => labels.get(sha) ?? sha)}`,
      )
    }
  }
  const state = (step, dir, files = []) => {
    for (const file of files) {
      const path = join(dir, file)
      const content = existsSync(path)
        ? readFileSync(path, 'utf8').trimEnd().replaceAll('\n', '⏎')
        : 'нет'
      lines.push(`${step}: ${file} — ${content}`)
    }
    const index = gitIn(dir, ['-c', 'core.quotePath=false', 'status', '--porcelain'])
    for (const line of index.split('\n').filter(Boolean)) lines.push(`${step}: индекс ${line}`)
  }
  const refs = (step, dir) => {
    const all = gitIn(dir, ['for-each-ref', '--format=%(refname)', 'refs/tags', 'refs/template'])
    lines.push(`${step}: ссылки — ${all.trim().split('\n').filter(Boolean).join(' ') || 'нет'}`)
  }
  const remote = (dir, template) => gitIn(dir, ['remote', 'add', '--no-tags', 'template', template])

  // Перенос: правки форка целы (трёхстороннее слияние), конфликт — в индексе, «нет в форке» и «шаблон удалил, форк
  // менял» названы, путь :(exclude) и код вне путей шаблона — форка; имена со скобками маршрута и не в ASCII — как
  // есть. Релизы форка v1.0.0 и v2.0.0 — его теги, а не версии шаблона: ни базой, ни целью переноса они не становятся.
  {
    const t = repo('t1')
    commit(t, {
      '.template/paths': '# пути шаблона\n.template\nh\n:(exclude)h/own\n',
      '.template/version': 'v1.0.0\n',
      'h/rule.md': 'r1\nr2\nr3\n',
      'h/merged.md': 'm1\nm2\nm3\nm4\nm5\nm6\nm7\nm8\n',
      'h/conflict.md': 'c1\nc2\nc3\n',
      'h/dropped.md': 'd1\n',
      'h/[key].md': 'k1\n',
      'h/цены.md': 'ц1\n',
      'h/removed.md': 'x1\n',
      'h/edited.md': 'e1\n',
      'h/gone.md': 'g1\n',
      'h/own/local.md': 'o1\n',
      'c/page.md': 'p1\n',
    })
    tag(t, 'v1.0.0', 'v1.0.0\n\nОбвязка:\n- первая версия')
    commit(t, {
      '.template/version': 'v1.1.0\n',
      'h/rule.md': 'r1\nr2 v2\nr3\n',
      'h/merged.md': 'm1\nm2 v2\nm3\nm4\nm5\nm6\nm7\nm8\n',
      'h/conflict.md': 'c1\nc2 template\nc3\n',
      'h/dropped.md': 'd1 v2\n',
      'h/[key].md': 'k2\n',
      'h/цены.md': 'ц2\n',
      'h/own/local.md': 'o1 v2\n',
      'h/new.md': 'n1\n',
      'h/removed.md': null,
      'h/edited.md': null,
      'h/gone.md': null,
      'c/page.md': 'p2\n',
    })
    tag(t, 'v1.1.0', 'v1.1.0\n\nBreaking:\n- h/rule.md → правка форка')
    const f = fork('f1', t, 'v1.0.0')
    commit(f, {
      'h/merged.md': 'm1\nm2\nm3\nm4\nm5\nm6\nm7 fork\nm8\n',
      'h/conflict.md': 'c1\nc2 fork\nc3\n',
      'h/edited.md': 'e1 fork\n',
      'h/own/local.md': 'o1 fork\n',
      'c/page.md': 'p1 fork\n',
      'h/dropped.md': null,
      'h/gone.md': null,
      'h/[key].md': null,
    })
    tag(f, 'v1.0.0', 'релиз форка')
    tag(f, 'v2.0.0', 'релиз форка')
    gitIn(f, ['remote', 'add', 'origin', FORK_ORIGIN])
    remote(f, t)
    update('перенос: статус', f, '--status')
    update('перенос: превью', f)
    update('перенос: статус после превью', f, '--status')
    update('перенос: до релиза форка', f, 'TO=v2.0.0')
    update('перенос', f, 'TO=v1.1.0')
    state('перенос', f, [
      '.template/version',
      'h/rule.md',
      'h/merged.md',
      'h/edited.md',
      'h/new.md',
      'h/цены.md',
      'h/dropped.md',
      'h/[key].md',
      'h/removed.md',
      'h/own/local.md',
      'c/page.md',
    ])
    refs('перенос', f)
  }

  // Первая база — коммит шаблона с деревом первого коммита форка: форк с кончика main между тегами — без ложных
  // конфликтов, форк до .template получает её тем же переносом, форк с тега — от тега; форк, правленный до первого
  // коммита, переносится от тега версии, и движок это называет.
  {
    const t = repo('t2')
    commit(t, { 'h/l.md': 'l0\n' }, 'до .template')
    commit(t, { '.template/paths': '.template\nh\n', '.template/version': 'v1.0.0\n' })
    tag(t, 'v1.0.0')
    commit(t, { 'h/l.md': 'l1\n', 'h/n.md': 'n1\n' }, 'между тегами')
    commit(t, { '.template/version': 'v1.1.0\n', 'h/l.md': 'l2\n', 'h/n.md': 'n2\n' })
    tag(t, 'v1.1.0')
    // Превью — у форка не с тега: его база и где сверить, что из пунктов тега у форка уже есть.
    const cases = [
      ['между тегами', 'HEAD~1', {}, true],
      ['до .template', 'HEAD~3', {}, true],
      ['с тега', 'v1.0.0', {}, false],
      ['правлен до первого коммита', 'v1.0.0', { 'x.md': 'fork\n' }, false],
    ]
    for (const [index, [name, rev, extra, preview]] of cases.entries()) {
      const f = fork(`f2-${index}`, t, rev, extra)
      commit(f, { 'own.md': 'fork\n' })
      remote(f, t)
      if (preview) update(`первая база, ${name}: превью`, f)
      update(`первая база, ${name}`, f, 'TO=v1.1.0')
      state(`первая база, ${name}`, f, ['.template/version', 'h/l.md', 'h/n.md'])
    }
  }

  // TO не новее версии форка — отказ: перенос до своей версии её не сдвинул бы, и следующий повторил бы те же
  // правки. Форк, созданный раньше тега своей версии, получает их переносом до следующего тега.
  {
    const t = repo('t3')
    commit(t, {
      '.template/paths': '.template\nh\n',
      '.template/version': 'v1.0.0\n',
      'h/k.md': 'k0\n',
    })
    tag(t, 'v1.0.0')
    commit(t, { '.template/version': 'v1.1.0\n' }, 'выпуск v1.1.0')
    commit(t, { 'h/k.md': 'k1\n' })
    tag(t, 'v1.1.0')
    commit(t, { '.template/version': 'v1.2.0\n', 'h/q.md': 'q1\n' })
    tag(t, 'v1.2.0')
    const f = fork('f3', t, 'HEAD~2')
    commit(f, { 'own.md': 'fork\n' })
    remote(f, t)
    update('до тега версии: превью', f)
    update('до тега версии', f, 'TO=v1.1.0')
    state('до тега версии', f)
    update('после тега версии', f, 'TO=v1.2.0')
    state('после тега версии', f, ['.template/version', 'h/k.md', 'h/q.md'])
  }

  // PATHS — код форка вне путей шаблона тем же трёхсторонним слиянием: пункты «Безопасность» и «Платформа»
  // решаются до переноса (без PATHS — отказ с ними, PATHS=- — код не едет), опечатка и путь, который исключает
  // .template/paths, — отказ до переноса.
  {
    const t = repo('t4')
    commit(t, {
      '.template/paths': '.template\nh\n:(exclude)h/spec\n',
      '.template/version': 'v1.0.0\n',
      'h/rule.md': 'r1\n',
      'h/spec/mutants.md': 'm1\n',
      'c/auth/login.md': 'weak\n',
      'c/auth/limit.md': 'A1\n\nB2\n\nC3\n',
      'c/cmd/main.md': 'main\n',
    })
    tag(t, 'v1.0.0')
    commit(t, {
      '.template/version': 'v1.1.0\n',
      'h/rule.md': 'r2\n',
      'h/spec/mutants.md': 'm2\n',
      'c/auth/login.md': 'strict\n',
      'c/auth/limit.md': 'A10\n\nB2\n\nC3\n',
      'c/cmd/main.md': 'main run\n',
    })
    tag(
      t,
      'v1.1.0',
      "v1.1.0\n\nБезопасность:\n- c/auth: строгая проверка входа\n  → PATHS='c/auth'\n\nОбвязка:\n- h/rule.md: r2",
    )
    const code = [
      'h/rule.md',
      'h/spec/mutants.md',
      'c/auth/login.md',
      'c/auth/limit.md',
      'c/cmd/main.md',
    ]
    const cases = [
      ['без решения', [], []],
      ['PATHS=-', ['PATHS=-'], code],
      ['по запросу', ['PATHS=c/auth c/cmd'], code],
      ['опечатка', ['PATHS=c/auth c/autth'], []],
      ['исключённый путь', ['PATHS=c/auth h/spec'], []],
    ]
    for (const [index, [name, args, files]] of cases.entries()) {
      const f = fork(`f4-${index}`, t, 'v1.0.0')
      commit(f, { 'c/auth/limit.md': 'A1\n\nB2\n\nC30\n' })
      remote(f, t)
      update(`PATHS, ${name}`, f, 'TO=v1.1.0', ...args)
      state(`PATHS, ${name}`, f, files)
    }
  }

  // --remote — теги remote template через ls-remote, без записи в форк; нет remote — 1, не ответил — 2. Канон — по
  // origin: remote не спрашивает, а до тега своей версии статус так и говорит.
  {
    const t = repo('t5')
    commit(t, { '.template/paths': '.template\n', '.template/version': 'v1.0.0\n' })
    tag(t, 'v1.0.0')
    commit(t, { '.template/version': 'v1.1.0\n' })
    tag(t, 'v1.1.0')
    const f = fork('f5', t, 'v1.0.0')
    commit(f, { 'own.md': 'fork\n' })
    tag(f, 'v3.0.0', 'релиз форка')
    update('remote: нет remote template', f, '--remote')
    remote(f, t)
    update('remote: в шаблоне новее', f, '--remote')
    refs('remote: в шаблоне новее', f)
    gitIn(f, ['remote', 'set-url', 'template', join(temp, 'net-takogo.git')])
    update('remote: не ответил', f, '--remote')
    gitIn(f, ['remote', 'set-url', 'template', t])
    commit(f, { '.template/version': 'v1.1.0\n' })
    update('remote: новее нет', f, '--remote')
    gitIn(t, ['remote', 'add', 'origin', CANONICAL_ORIGIN])
    update('канон: remote', t, '--remote')
    update('канон: статус', t, '--status')
    commit(t, { '.template/version': 'v1.2.0\n' })
    update('канон: статус до тега', t, '--status')
  }

  rmSync(temp, { recursive: true, force: true })
  return lines
}
want.template = expected.template ?? []
found.template = templateOutcomes()

// check:prose — на мини-репо из .gate-fixtures/prose во временном каталоге: у проверки свой git (что отслеживается,
// origin, теги на HEAD), файл вне git дописывается после коммита, строки путей с пробелом и CR по краю — до него (CR в
// файле фикстуры не удержать: его снимет первый же редактор). Канон (origin — репо шаблона) несёт на HEAD тег другой
// версии и лёгкий тег своей; тот же репо с origin форка — теги на HEAD его релизы: строки «только канон» — правило
// тега, «только форк» быть не должно.
function proseOutcomes() {
  const temp = mkdtempSync(join(tmpdir(), 'gate-prose-'))
  cpSync(resolve(fixtures, 'prose'), temp, { recursive: true })
  appendFileSync(join(temp, '.template/paths'), 'docs/guide.md \nREADME.md\r\n')
  gitIn(temp, ['init', '-q', '-b', 'main'])
  gitIn(temp, ['add', '-A'])
  gitIn(temp, ['commit', '-q', '-m', 'prose'])
  gitIn(temp, ['tag', '-a', 'v9.9.9', '-m', 'v9.9.9'])
  gitIn(temp, ['tag', 'v1.0.0'])
  writeFileSync(join(temp, 'docs/ne-v-git.md'), '# Вне git\n')
  const check = (origin) => {
    gitIn(temp, ['remote', 'add', 'origin', origin])
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/check-prose.mjs'), temp], {
      env: GIT_ENV,
      encoding: 'utf8',
    })
    gitIn(temp, ['remote', 'remove', 'origin'])
    if (result.error) throw result.error
    return result
  }
  const runs = { canon: check(CANONICAL_ORIGIN), fork: check(FORK_ORIGIN) }
  rmSync(temp, { recursive: true, force: true })
  const lines = {}
  for (const [mode, result] of Object.entries(runs)) {
    if (result.status !== 1) {
      console.error(
        `check:gate: check-prose.mjs на фикстуре (${mode}) вышел с кодом ${result.status}, а не 1\n${result.stdout}${result.stderr}`,
      )
      process.exit(1)
    }
    lines[mode] = result.stderr
      .split('\n')
      .filter((line) => line.startsWith('  '))
      .map((line) => line.slice(2))
  }
  return [
    ...lines.canon,
    ...lines.canon
      .filter((line) => !lines.fork.includes(line))
      .map((line) => `только канон: ${line}`),
    ...lines.fork
      .filter((line) => !lines.canon.includes(line))
      .map((line) => `только форк: ${line}`),
  ]
}
want.prose = expected.prose ?? []
found.prose = proseOutcomes()

// check:identity — сценариями на мини-репо из слоёв .gate-fixtures/identity: canon/ — шаблон с лицом и свежим
// .template/face, fork/ поверх — свои файлы форка, traces/ поверх них — след лица каждого вида; правки сценария — до
// коммита. Канон и форк — по origin, как у check:prose. Исход шага — код выхода и каждая строка вывода.
function identityOutcomes() {
  const temp = mkdtempSync(join(tmpdir(), 'gate-identity-'))
  const lines = []
  let repos = 0
  const repo = (origin, layers, edits = {}) => {
    const dir = join(temp, String(repos++))
    for (const layer of layers) {
      cpSync(resolve(fixtures, 'identity', layer), dir, { recursive: true })
    }
    for (const [file, content] of Object.entries(edits)) {
      mkdirSync(dirname(join(dir, file)), { recursive: true })
      writeFileSync(join(dir, file), content)
    }
    gitIn(dir, ['init', '-q', '-b', 'main'])
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'identity'])
    gitIn(dir, ['remote', 'add', 'origin', origin])
    return dir
  }
  const check = (step, dir, ...args) => {
    const result = spawnSync(
      process.execPath,
      [resolve(root, 'scripts/check-identity.mjs'), dir, ...args],
      { env: GIT_ENV, encoding: 'utf8' },
    )
    if (result.error) throw result.error
    lines.push(`${step}: код ${result.status}`)
    for (const line of `${result.stdout}${result.stderr}`.split('\n')) {
      if (line.trim() !== '') lines.push(`${step}: ${line.trim()}`)
    }
  }
  const facts = readFileSync(resolve(fixtures, 'identity/canon/strategy/facts.yaml'), 'utf8')
  // Демо-факт канона сменился: почта оператора.
  const moved = { 'strategy/facts.yaml': facts.replaceAll('hello@example.com', 'team@example.org') }

  check('канон', repo(CANONICAL_ORIGIN, ['canon']))
  check(
    'канон: разворот',
    repo(CANONICAL_ORIGIN, ['canon'], {
      ...moved,
      'package.json': '{ "name": "@acme/site", "private": true, "type": "module" }\n',
      'docs/stack/service.md':
        '---\nid: stack.service\nkind: service\nname: service\nstatus: draft\n---\n',
    }),
  )
  check('канон: --write', repo(CANONICAL_ORIGIN, ['canon'], moved), '--write')
  check('свежий форк', repo(FORK_ORIGIN, ['canon']))
  check('форк', repo(FORK_ORIGIN, ['canon', 'fork']))
  check('форк со следами лица', repo(FORK_ORIGIN, ['canon', 'fork', 'traces']))
  check('форк: --write', repo(FORK_ORIGIN, ['canon', 'fork']), '--write')
  rmSync(temp, { recursive: true, force: true })
  return lines
}
want.identity = expected.identity ?? []
found.identity = identityOutcomes()

// check:stack — на мини-проекте .gate-fixtures/stack: обычный прогон и --stable (строки «--stable:» — только его), и
// формы шаблона docs/stack/_templates как есть со status: stable — каждую валидатор отвергает: одна замена статуса
// заглушки формы решением не делает.
function stackOutcomes() {
  const run = (...args) => {
    const result = spawnSync(
      process.execPath,
      [resolve(root, 'scripts/check-stack.mjs'), ...args],
      {
        encoding: 'utf8',
      },
    )
    if (result.error) throw result.error
    const lines = result.stderr
      .split('\n')
      .filter((line) => line.startsWith('  '))
      .map((line) => line.slice(2))
    return { code: result.status, lines }
  }
  const plain = run(resolve(fixtures, 'stack'))
  const strict = run('--stable', resolve(fixtures, 'stack'))
  const temp = mkdtempSync(join(tmpdir(), 'gate-stack-'))
  const forms = resolve(root, 'docs/stack/_templates')
  cpSync(forms, join(temp, 'docs/stack/_templates'), { recursive: true })
  const kinds = readdirSync(forms)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -'.md'.length))
    .sort()
  for (const kind of kinds) {
    const form = readFileSync(join(forms, `${kind}.md`), 'utf8')
    writeFileSync(
      join(temp, `docs/stack/${kind}.md`),
      form.replace(/^status: draft$/m, 'status: stable'),
    )
  }
  const asIs = run(temp)
  rmSync(temp, { recursive: true, force: true })
  return [
    `фикстура: код ${plain.code}`,
    ...plain.lines,
    `--stable: код ${strict.code}`,
    ...strict.lines
      .filter((line) => !plain.lines.includes(line))
      .map((line) => `--stable: ${line}`),
    ...kinds.map(
      (kind) =>
        `форма ${kind} как есть со status: stable — ${
          asIs.lines.some((line) => line.startsWith(`docs/stack/${kind}.md`)) ? 'отказ' : 'ПРИНЯТА'
        }`,
    ),
  ]
}
want.stack = expected.stack ?? []
found.stack = stackOutcomes()

// Guard-хук: отказ — код 2 (так Claude Code блокирует вызов), пропуск — 0.
const guard = JSON.parse(readFileSync(resolve(fixtures, 'guard.json'), 'utf8'))
const guardCode = (command) =>
  spawnSync('bash', [resolve(root, '.claude/hooks/guard-bash.sh')], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  }).status
const guardLines = [
  ...(guard.block ?? [])
    .filter((command) => guardCode(command) !== 2)
    .map((command) => `  ✗ обход не заблокирован: ${JSON.stringify(command)}`),
  ...(guard.allow ?? [])
    .filter((command) => guardCode(command) !== 0)
    .map((command) => `  ✗ обычная работа заблокирована: ${JSON.stringify(command)}`),
]
if ((guard.block ?? []).length === 0)
  guardLines.push('  ✗ guard.json без обходов — периметр не проверен')

let problems = guardLines.length
console.info(
  guardLines.length === 0
    ? `✓ guard: обходов ${guard.block.length} — отказ, обычных команд ${guard.allow?.length ?? 0} — пропуск`
    : `✗ guard:\n${guardLines.join('\n')}`,
)
for (const section of [
  ...LINTERS,
  ...Object.keys(SCRIPTS),
  'plans',
  'prose',
  'identity',
  'stack',
  'indexnow',
  'template',
]) {
  if (want[section].length === 0) {
    console.error(`✗ ${section}: секция expected.json пуста — гейт на гейт выключен`)
    problems++
    continue
  }
  const wanted = countBy(want[section])
  const got = countBy(found[section])
  const lines = []
  for (const [key, count] of wanted) {
    const actual = got.get(key) ?? 0
    if (actual !== count) lines.push(`  ✗ ${key} — ожидалось ${count}, поймано ${actual}`)
  }
  for (const [key, count] of got) {
    if (!wanted.has(key)) lines.push(`  ✗ ${key} — нет в expected.json (×${count})`)
  }
  problems += lines.length
  const noun = ['identity', 'indexnow', 'template'].includes(section) ? 'исходов' : 'нарушений'
  console.info(
    lines.length === 0
      ? `✓ ${section}: ${noun} ${want[section].length} — ровно ожидаемые`
      : `✗ ${section}:\n${lines.join('\n')}`,
  )
}

if (problems > 0) {
  console.error(`\ncheck:gate: ${problems} расхождений с expected.json — гейт деградировал`)
  process.exit(1)
}
console.info('\ncheck:gate: каждая фикстура поймана ровно ожидаемыми нарушениями')
