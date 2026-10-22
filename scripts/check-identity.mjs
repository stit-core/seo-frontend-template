// Лицо шаблона (до сборки) — список .template/face: строки (имя шаблона, бренд и профили сайта, проект брифа, имя
// оператора, его реквизиты, контакты и улица из демо-фактов strategy/) и отпечатки файлов (знак, иконки, превью и
// manifest public/, демо-записи и обложки коллекций, content/redirects.yaml). Канон (origin — репо шаблона,
// scripts/lib/template.mjs) лицо хранит: имя пакета — шаблона, артефактов стека нет, список свеж — его собирает
// --write из данных канона. Форк его не несёт: в своих файлах — вне путей шаблона .template/paths, копий каталогов
// базы strategy/kb/ и рабочих документов — ни строки лица, ни в одном файле — файла лица байт в байт (кроме копии
// шаблона на её пути), в имени пакета — ни имени шаблона. Иначе сайт клиента выходит в прод с лицом шаблона — именем
// и иконками в выдаче, превью в соцкарточках, демо-реквизитами в подвале и политике ПДн, — а гейт зелёный.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { load } from 'js-yaml'
import { isCanonical, TEMPLATE_NAME, TEMPLATE_PACKAGE } from './lib/template.mjs'

const args = process.argv.slice(2)
const write = args.includes('--write')
// Корень проекта; другой корень — мини-репо фикстуры check:gate (.gate-fixtures/identity).
const root = resolve(
  args.find((arg) => !arg.startsWith('--')) ?? resolve(import.meta.dirname, '..'),
)
const git = (...gitArgs) =>
  execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
const read = (file) => readFileSync(resolve(root, file))
// Файлы индекса, которые есть в дереве: удалённый — уже не след лица.
const listed = (...pathspecs) =>
  [...new Set(git('ls-files', '-z', '--', ...pathspecs).split('\0'))].filter((file) => {
    const path = resolve(root, file)
    return file !== '' && existsSync(path) && lstatSync(path).isFile()
  })
const files = listed()

const FACE = '.template/face'
const HEADER = [
  '# Лицо шаблона — строки и файлы, которых нет в файлах форка (pnpm check:identity); файл на пути шаблона — его',
  '# копия файла лица. Собирает pnpm check:identity --write на каноне из его данных; руками не правится.',
]
// Реквизит и контакт оператора — значение, по которому его узнают. Часы работы, координаты, сроки и даты — не лицо:
// их законно повторит любой форк.
const IDENTIFYING = {
  telephone: 'value',
  email: 'value',
  url: 'value',
  messenger: 'value',
  'legal-id': 'value',
  'postal-address': 'street',
}
// Файлы лица: знак, иконки, превью и manifest; демо-записи и обложки коллекций; редиректы.
const FACE_FILE = /^(?:public\/|src\/entities\/[^/]+\/content\/|content\/redirects\.yaml$)/

// Пробельная последовательность — один пробел: перенос строки в свёрнутом скаляре YAML и неразрывный пробел типографики
// строку лица не прячут. Строка лица хранится сведённой, текст сверяется как есть.
const spaced = (text) => text.replace(/\s+/g, ' ').trim()
const WORD = /[\p{L}\p{N}]/u
// Строка лица входит в текст словом: «site-template» — не в «website-template», а имя шаблона — и в имени пакета
// «@stit/ssr-frontend-template». Смещения — в тексте как есть: по ним номер строки.
function hits(text, face) {
  const body = face
    .split(' ')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  const left = WORD.test(face[0]) ? '(?<![\\p{L}\\p{N}])' : ''
  const right = WORD.test(face.at(-1)) ? '(?![\\p{L}\\p{N}])' : ''
  return [...text.matchAll(new RegExp(`${left}${body}${right}`, 'gu'))].map(({ index }) => index)
}

const yamlFiles = (pattern) =>
  files.filter((file) => pattern.test(file)).map((file) => load(read(file).toString('utf8')))
const sha256 = (file) => createHash('sha256').update(read(file)).digest('hex')

// Лицо из данных канона — строки списка .template/face.
async function faceOf() {
  const site = await import(pathToFileURL(resolve(root, 'src/shared/config/site.ts')).href)
  const texts = [TEMPLATE_NAME, site.SITE_NAME, ...site.SITE_SAME_AS]
  for (const brief of yamlFiles(/^strategy\/site\/[^/]+\/site-brief\.yaml$/)) {
    texts.push(brief?.business?.name, brief?.project?.slug)
  }
  const operators = new Set(
    yamlFiles(/^strategy\/site\/[^/]+\/plans\/[^/]+\.yaml$/)
      .map((plan) => plan?.page?.legal?.operator_ref)
      .filter((ref) => typeof ref === 'string' && ref.startsWith('fact:'))
      .map((ref) => ref.slice('fact:'.length)),
  )
  for (const file of yamlFiles(/^strategy\/facts[^/]*\.yaml$/)) {
    for (const fact of file?.facts ?? []) {
      const field = IDENTIFYING[fact.machine?.type]
      if (fact.example !== true || (field === undefined && !operators.has(fact.id))) continue
      const value = field === undefined ? undefined : fact.machine[field]
      texts.push(...fact.verbatim, value)
      // Улица узнаётся и короткой формой — первым сегментом: «ул. Примерная», «1 Primernaya st.» без дома и офиса.
      if (field === 'street' && typeof value === 'string') texts.push(value.split(',')[0])
    }
  }
  const strings = [...new Set(texts.filter((text) => typeof text === 'string').map(spaced))].filter(
    (text) => text !== '',
  )
  // Строка, в которой словом стоит другая строка лица, лишняя: её место находит та.
  const minimal = strings.filter(
    (text) => !strings.some((other) => other !== text && hits(text, other).length > 0),
  )
  const hashes = new Map(files.map((file) => [file, sha256(file)]))
  const prints = new Set(
    files.filter((file) => FACE_FILE.test(file)).map((file) => hashes.get(file)),
  )
  return [
    ...minimal.sort().map((text) => `text ${text}`),
    // Тот же файл на пути шаблона (картинка в снимке сборки фикстуры seo) — копия шаблона: форк держит её законно.
    ...files
      .filter((file) => prints.has(hashes.get(file)))
      .map((file) => `file ${hashes.get(file)} ${file}`),
  ]
}

const entriesOf = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
const count = (entries) => {
  const texts = entries.filter((entry) => entry.startsWith('text ')).length
  return `строк ${texts}, файлов ${entries.length - texts}`
}

const canon = isCanonical(root)
const problems = []
const name = JSON.parse(read('package.json').toString('utf8')).name

if (canon) {
  if (name !== TEMPLATE_PACKAGE) {
    problems.push(
      `package.json: имя пакета ${name} — у канона шаблона ${TEMPLATE_PACKAGE}: разворот — в форке`,
    )
  }
  for (const file of files) {
    if (/^docs\/stack\/[^/]+\.md$/.test(file) && file !== 'docs/stack/README.md') {
      problems.push(`${file}: артефакт стека на каноне — стек проектирует форк`)
    }
  }
  const face = await faceOf()
  if (write) {
    writeFileSync(resolve(root, FACE), `${[...HEADER, ...face].join('\n')}\n`)
    console.info(`check:identity --write: ${FACE} — ${count(face)}`)
  }
  if (!existsSync(resolve(root, FACE))) {
    problems.push(`${FACE}: файла нет — pnpm check:identity --write`)
  } else {
    const stored = entriesOf(read(FACE).toString('utf8'))
    for (const entry of face.filter((line) => !stored.includes(line))) {
      problems.push(`${FACE}: нет «${entry}» — лицо канона сменилось: pnpm check:identity --write`)
    }
    for (const entry of stored.filter((line) => !face.includes(line))) {
      problems.push(`${FACE}: «${entry}» — этого у канона нет: pnpm check:identity --write`)
    }
  }
  if (problems.length === 0) {
    console.info(
      `check:identity: канон шаблона — лицо на месте (${count(face)}), имя пакета шаблона, артефактов стека нет — ok`,
    )
  }
} else {
  if (write) {
    console.error(
      'check:identity --write: форк — лицо шаблона собирает его канон, форк сверяет с ним свои файлы',
    )
    process.exit(1)
  }
  // Имя шаблона под своим scope (@acme/ssr-frontend-template) — тоже не своё имя.
  if (hits(String(name ?? ''), TEMPLATE_NAME).length > 0) {
    problems.push(
      `package.json: имя пакета ${name} — с именем шаблона: своё — scope из docs/stack/service.md`,
    )
  }
  if (!existsSync(resolve(root, FACE))) {
    problems.push(`${FACE}: файла нет — лицо шаблона приходит с его обвязкой: pnpm template:update`)
  } else {
    const face = entriesOf(read(FACE).toString('utf8'))
    const texts = face.filter((entry) => entry.startsWith('text ')).map((entry) => entry.slice(5))
    const prints = new Map()
    for (const entry of face.filter((line) => line.startsWith('file '))) {
      const [hash, ...path] = entry.slice(5).split(' ')
      prints.set(hash, [...(prints.get(hash) ?? []), path.join(' ')])
    }
    const paths = existsSync(resolve(root, '.template/paths'))
      ? entriesOf(read('.template/paths').toString('utf8'))
      : []
    const template = new Set(paths.length > 0 ? listed(...paths) : [])
    // Не файлы форка: пути шаблона (его обвязка законно называет шаблон), копии каталогов базы strategy/kb/ (данные
    // базы, а не проекта) и рабочие документы — планы и память stack-deep-dive (называют шаблон законно: перенос
    // обвязки, происхождение форка).
    const NOT_OWN = ['strategy/kb/', '.claude/plans/', '.claude/skills/stack-deep-dive/state/']
    const own = new Set(
      files.filter((file) => !template.has(file) && !NOT_OWN.some((dir) => file.startsWith(dir))),
    )
    for (const file of files) {
      const bytes = read(file)
      // Файл лица — в любом файле форка: и свой файл в каталоге пути шаблона (знак в src/app) — файл форка. Законна
      // только копия самого шаблона на её пути шаблона.
      const copies = prints.get(createHash('sha256').update(bytes).digest('hex'))
      if (copies !== undefined && !(template.has(file) && copies.includes(file))) {
        const print = copies.find((path) => FACE_FILE.test(path)) ?? copies[0]
        problems.push(
          `${file}: файл лица шаблона байт в байт${print === file ? '' : ` (${print})`}`,
        )
      }
      if (!own.has(file)) continue
      const text = bytes.toString('utf8')
      const lines = []
      for (const face of texts) {
        const found = hits(text, face)
        if (found.length === 0) continue
        const line = text.slice(0, found[0]).split('\n').length
        const times = found.length > 1 ? ` (×${found.length})` : ''
        lines.push([line, `${file}:${line}: «${face}» — строка лица шаблона${times}`])
      }
      problems.push(...lines.sort(([a], [b]) => a - b).map(([, problem]) => problem))
    }
    if (problems.length === 0) {
      console.info(
        `check:identity: форк — лица шаблона нет: строк в ${own.size} своих файлах, файлов в ${files.length} (${count(face)}) — ok`,
      )
    }
  }
}

if (problems.length > 0) {
  console.error(
    `check:identity: ${problems.length} нарушений — ${
      canon
        ? 'канон шаблона'
        : 'форк несёт лицо шаблона: онбординг начинается с идентичности — /init-service'
    }\n  ${problems.join('\n  ')}`,
  )
  process.exit(1)
}
