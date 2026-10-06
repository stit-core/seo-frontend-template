// Гейт на гейт: негативные фикстуры .gate-fixtures/ обязаны валить линтеры (ESLint, Steiger,
// Biome — теми же конфигами, что и src/) и собственные скрипты гейта (seo:check, check:links,
// check:content, plan:check) — ровно нарушениями из expected.json, не больше и не меньше. Иначе
// деградация (Steiger fail-open, пустой a11y-конфиг, потерянный резолвер boundaries, ослабленная
// проверка скрипта) остаётся незамеченной: прогон зелёный, а держать нечем. Пустая или урезанная
// секция expected.json — тоже деградация: её ловит точное совпадение. Периметр — так же: guard-хук
// Claude Code обязан отказать каждому обходу из .gate-fixtures/guard.json и пропустить работу.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

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
for (const [section, script] of Object.entries(SCRIPTS)) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, 'scripts', script), resolve(fixtures, section)],
    { encoding: 'utf8' },
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
for (const section of [...LINTERS, ...Object.keys(SCRIPTS), 'plans']) {
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
  console.info(
    lines.length === 0
      ? `✓ ${section}: нарушений ${want[section].length} — ровно ожидаемые`
      : `✗ ${section}:\n${lines.join('\n')}`,
  )
}

if (problems > 0) {
  console.error(`\ncheck:gate: ${problems} расхождений с expected.json — гейт деградировал`)
  process.exit(1)
}
console.info('\ncheck:gate: каждая фикстура поймана ровно ожидаемыми нарушениями')
