// Advisory-сверка родства с spa-frontend-template (docs/reference/kinship.md).
// Не входит в pnpm check: соседа может не быть, а «почти идентичное» расходится по замыслу.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sibling = resolve(root, process.env.SPA_TEMPLATE_PATH ?? '../spa-frontend-template')
const doc = readFileSync(resolve(root, 'docs/reference/kinship.md'), 'utf8')

function listFrom(block) {
  const match = doc.match(new RegExp(`\`\`\`${block}\\n([\\s\\S]*?)\`\`\``))
  if (!match) throw new Error(`kinship.md: блок \`\`\`${block} не найден`)
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

if (!existsSync(sibling)) {
  console.info(
    `kin:diff: соседа нет (${sibling}); next step — клонировать spa-frontend-template рядом или задать SPA_TEMPLATE_PATH`,
  )
  process.exit(0)
}

function lineDiff(a, b) {
  const left = a.split('\n')
  const right = new Set(b.split('\n'))
  return left.filter((line) => !right.has(line)).length
}

let drift = 0
console.info(`kin:diff: сверка с ${sibling}\n`)

console.info('идентично:')
for (const path of listFrom('identical')) {
  const here = resolve(root, path)
  const there = resolve(sibling, path)
  if (!existsSync(here) || !existsSync(there)) {
    drift++
    console.info(`  ✗ ${path} — ${existsSync(here) ? 'нет у соседа' : 'нет здесь'}`)
    continue
  }
  const same = readFileSync(here).equals(readFileSync(there))
  if (!same) drift++
  console.info(`  ${same ? '✓' : '✗'} ${path}${same ? '' : ' — расходится'}`)
}

console.info('\nпочти идентично (расхождение ожидаемо; число — строк, которых нет у соседа):')
for (const path of listFrom('near-identical')) {
  const here = resolve(root, path)
  const there = resolve(sibling, path)
  if (!existsSync(here) || !existsSync(there)) {
    console.info(`  ≈ ${path} — ${existsSync(here) ? 'нет у соседа' : 'нет здесь'}`)
    continue
  }
  const diff = lineDiff(readFileSync(here, 'utf8'), readFileSync(there, 'utf8'))
  console.info(`  ${diff === 0 ? '=' : '≈'} ${path}${diff === 0 ? '' : ` — ${diff}`}`)
}

if (drift > 0) {
  console.error(
    `\nkin:diff: ${drift} расхождений в корзине «идентично» — синхронизировать с каноном`,
  )
  process.exit(1)
}
console.info('\nkin:diff: корзина «идентично» совпадает')
