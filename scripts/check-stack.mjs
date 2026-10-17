// Стек проекта (до сборки): артефакт docs/stack/<kind>.md — по форме docs/stack/_templates/<kind>.md. Kinds — формы
// (условный — с пометкой «Условный kind.» до первой секции): список не дублируется. У артефакта — frontmatter формы: id
// stack.<kind>, kind и name — имя файла, status draft или stable. У stable — каждая секция формы на месте и в ней
// решение. Заглушка формы — её курсив (кроме пометки _нет_ — это решение «нет»), плейсхолдер, который форма пишет
// только в курсиве (<site>, <Бренд>), и <org>, <domain> — организация и домен проекта, их называет service.md; TBD,
// TODO, FIXME, прочерк, многоточие, вопросы и таблица без строк — тоже не решение.
// --stable — вход /de-template: все обязательные kinds и заведённые условные — stable. Иначе стек «промоутится» одной
// заменой статуса, и разворот берёт из формы <org> в registry и _<Бренд>_ в идентичность.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'

const args = process.argv.slice(2)
const stable = args.includes('--stable')
// Корень проекта; другой корень — мини-проект фикстуры check:gate (.gate-fixtures/stack).
const root = resolve(
  args.find((arg) => !arg.startsWith('--')) ?? resolve(import.meta.dirname, '..'),
)
const STACK = 'docs/stack'
const markdown = (dir) =>
  existsSync(resolve(root, dir))
    ? readdirSync(resolve(root, dir))
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .sort()
    : []
const text = (file) => readFileSync(resolve(root, file), 'utf8')

// Код в бэктиках — не разметка: подчёркивание в `/_<name>/` курсив не открывает. Код маскируется знаками той же длины,
// и курсив вокруг кода (_Zod в `<x>`_) остаётся курсивом.
const masked = (line) => line.replace(/`[^`]*`/g, (code) => 'x'.repeat(code.length))
// Курсив подчёркиваниями — как в CommonMark: открывает `_` не после буквы или цифры, закрывает — не перед ними.
const ITALIC = /(?<![\p{L}\p{N}_\\])_(?![\s_])(?:.*?[^\s_\\])?_(?![\p{L}\p{N}_])/gu
const italics = (line) =>
  [...masked(line).matchAll(ITALIC)].map((match) =>
    line.slice(match.index, match.index + match[0].length),
  )
const NONE = '_нет_'
const ORG_AND_DOMAIN = ['<org>', '<domain>']
const ANGLE = /<[^<>\s][^<>]*>/g

// Секции — заголовки `## `: строки документа с номерами под своим заголовком.
function sectionsOf(source) {
  const sections = new Map()
  let current
  source.split('\n').forEach((line, index) => {
    const title = /^## (.+?)\s*$/.exec(line)?.[1]
    if (title === undefined) {
      current?.push({ line, number: index + 1 })
      return
    }
    current = []
    sections.set(title, current)
  })
  return sections
}
function frontmatter(source) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(source)
  try {
    return match ? load(match[1]) : undefined
  } catch {
    return undefined
  }
}

// Заглушка вместо решения: TBD, TODO или FIXME словом (с хвостом или без), прочерк, многоточие, вопросы. Регистр,
// `_*` и скобки не в счёт; Todoist и TODO-лист — слова, а не заглушки.
function stub(value) {
  const bare = value
    .toUpperCase()
    .replace(/[_*`()]/g, '')
    .trim()
  return (
    /^(?:TBD|TODO|FIXME)(?:[^\p{L}\p{N}-].*)?$/u.test(bare) ||
    /^(?:—|–|-|\.\.\.|…|\?+)?[.:;!]?$/.test(bare)
  )
}
// Решение в секции: строка, пункт, чекбокс или цитата не из одних заглушек; у таблицы — строка под разделителем, где
// хоть одна ячейка — не заглушка. Заглушки формы из строки вычтены.
// Заглушки формы в строке — её курсив и плейсхолдеры вне него; остаток — то, что написал архитектор.
function stubsIn(line, form) {
  let rest = line
  const found = []
  for (const span of italics(line)) {
    if (!form.stubs.has(span)) continue
    found.push(span)
    rest = rest.replace(span, '')
  }
  for (const placeholder of form.placeholders) {
    if (!rest.includes(placeholder)) continue
    found.push(placeholder)
    rest = rest.replaceAll(placeholder, '')
  }
  return { found, rest }
}
function decided(rows, form) {
  let tableRows = false
  for (const { line } of rows) {
    const value = stubsIn(line, form).rest.trim()
    if (!value.startsWith('|')) tableRows = false
    if (value === '' || value.startsWith('#')) continue
    if (/^\|[-:|\s]*$/.test(value)) {
      tableRows = true
      continue
    }
    if (value.startsWith('|')) {
      if (tableRows && value.split('|').some((cell) => cell.trim() !== '' && !stub(cell))) {
        return true
      }
      continue
    }
    const item = value.replace(/^(?:[-*+]|\d+[.)])\s+/, '').replace(/^(?:\[[ xX]\]|>)\s*/, '')
    if (!stub(item)) return true
  }
  return false
}

const forms = new Map(
  markdown(`${STACK}/_templates`).map((name) => {
    const source = text(`${STACK}/_templates/${name}`)
    const lines = source.split('\n')
    const stubs = new Set(lines.flatMap((line) => italics(line)).filter((span) => span !== NONE))
    // Плейсхолдер формы — тот, что она пишет только в курсиве: `<slug>` пути в тексте формы — шаблон адреса, а не
    // заглушка.
    const inStubs = new Set([...stubs].flatMap((span) => span.match(ANGLE) ?? []))
    const outside = new Set(
      lines.flatMap((line) => {
        let rest = line
        for (const span of italics(line)) if (stubs.has(span)) rest = rest.replace(span, '')
        return rest.match(ANGLE) ?? []
      }),
    )
    return [
      name.slice(0, -'.md'.length),
      {
        sections: [...sectionsOf(source).keys()],
        stubs,
        placeholders: [...ORG_AND_DOMAIN, ...[...inStubs].filter((token) => !outside.has(token))],
        conditional: source.split(/^## /m)[0].includes('Условный kind.'),
      },
    ]
  }),
)

const problems = []
const statuses = new Map()
for (const name of markdown(STACK)) {
  const file = `${STACK}/${name}`
  const kind = name.slice(0, -'.md'.length)
  const form = forms.get(kind)
  if (form === undefined) {
    problems.push(`${file}: kind ${kind} — формы ${STACK}/_templates/${name} нет`)
    continue
  }
  const source = text(file)
  const meta = frontmatter(source)
  if (meta === null || typeof meta !== 'object') {
    problems.push(`${file}: frontmatter формы — id, kind, name, status между строками ---`)
    continue
  }
  for (const [field, want] of [
    ['id', `stack.${kind}`],
    ['kind', kind],
    ['name', kind],
  ]) {
    if (meta[field] !== want) {
      problems.push(`${file}: ${field}: ${meta[field] ?? '—'} — у артефакта ${want}`)
    }
  }
  if (meta.status !== 'draft' && meta.status !== 'stable') {
    problems.push(`${file}: status: ${meta.status ?? '—'} — draft или stable`)
  }
  statuses.set(kind, meta.status)
  if (meta.status !== 'stable') continue

  const sections = sectionsOf(source)
  for (const title of form.sections) {
    const rows = sections.get(title)
    if (rows === undefined) problems.push(`${file}: нет секции формы «${title}»`)
    else if (!decided(rows, form)) {
      problems.push(
        `${file}: секция «${title}» — без решения: stable ждёт решение в каждой секции формы`,
      )
    }
  }
  source.split('\n').forEach((line, index) => {
    for (const span of stubsIn(line, form).found) {
      problems.push(`${file}:${index + 1}: ${span} — заглушка формы, а не решение`)
    }
  })
}

if (stable) {
  for (const [kind, form] of forms) {
    const status = statuses.get(kind)
    if (status === undefined && !form.conditional) {
      problems.push(`${STACK}/${kind}.md: нет — обязательный kind: /stack-deep-dive`)
    } else if (status !== undefined && status !== 'stable') {
      problems.push(`${STACK}/${kind}.md: status: ${status} — /de-template ждёт stable`)
    }
  }
}

if (problems.length > 0) {
  console.error(`check:stack: ${problems.length} нарушений\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
const stableCount = [...statuses.values()].filter((status) => status === 'stable').length
console.info(
  statuses.size === 0 && !stable
    ? 'check:stack: артефактов стека нет — ok'
    : `check:stack${stable ? ' --stable' : ''}: артефактов ${statuses.size}, stable ${stableCount} — ok`,
)
