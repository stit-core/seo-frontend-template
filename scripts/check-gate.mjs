// Гейт на гейт: негативные фикстуры .gate-fixtures/ обязаны валить ESLint, Steiger и Biome
// теми же конфигами, что и src/. Иначе деградация (Steiger fail-open, пустой a11y-конфиг,
// потерянный резолвер boundaries) остаётся незамеченной: прогон зелёный, границы никто не держит.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cwd = resolve(root, '.gate-fixtures')
const bin = (name) => resolve(root, 'node_modules/.bin', name)
const expected = JSON.parse(readFileSync(resolve(cwd, 'expected.json'), 'utf8'))

function run(name, args) {
  const result = spawnSync(bin(name), args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.error) throw result.error
  // Ненулевой код здесь ожидаем (нарушения найдены); важен только разбираемый JSON.
  const start = Math.min(...['{', '['].map((c) => result.stdout.indexOf(c)).filter((i) => i >= 0))
  if (!Number.isFinite(start)) {
    throw new Error(`${name}: нет JSON в выводе\n${result.stdout}\n${result.stderr}`)
  }
  return JSON.parse(result.stdout.slice(start))
}

const rel = (path) => (isAbsolute(path) ? relative(cwd, path) : path)

function countBy(pairs) {
  const map = new Map()
  for (const [file, rule] of pairs) {
    const key = `${file}|${rule}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

const eslint = run('eslint', ['--format', 'json', '--config', 'eslint.config.js', 'src'])
const fatal = eslint.flatMap((f) =>
  f.messages.filter((m) => m.fatal).map((m) => `${rel(f.filePath)}: ${m.message}`),
)
if (fatal.length > 0) {
  console.error(`check:gate: ESLint не смог разобрать фикстуры:\n  ${fatal.join('\n  ')}`)
  process.exit(1)
}

// Считаются только ошибки: правило, понижённое до warn, гейт не валит — значит, не поймано.
const found = {
  eslint: countBy(
    eslint.flatMap((f) =>
      f.messages
        .filter((m) => m.ruleId && m.severity === 2)
        .map((m) => [rel(f.filePath), m.ruleId]),
    ),
  ),
  steiger: countBy(
    run('steiger', ['src', '--reporter', 'json'])
      .filter((d) => d.severity === 'error')
      .map((d) => [rel(d.location.path), d.ruleName]),
  ),
  biome: countBy(
    run('biome', ['lint', '--config-path', 'biome.gate.json', '--reporter', 'json', 'src'])
      .diagnostics.filter((d) => d.severity === 'error')
      .map((d) => [rel(d.location.path), d.category]),
  ),
}

let missing = 0
for (const [tool, rules] of Object.entries(expected)) {
  console.info(`${tool}:`)
  for (const { file, rule, min = 1 } of rules) {
    const actual = found[tool].get(`${file}|${rule}`) ?? 0
    const ok = actual >= min
    if (!ok) missing++
    console.info(
      `  ${ok ? '✓' : '✗'} ${file}  ${rule}${min > 1 ? ` ×${min}` : ''}${ok ? '' : ` — поймано ${actual}`}`,
    )
  }
}

if (missing > 0) {
  console.error(`\ncheck:gate: ${missing} ожидаемых нарушений не поймано — гейт деградировал`)
  process.exit(1)
}
console.info('\ncheck:gate: все ожидаемые нарушения пойманы')
