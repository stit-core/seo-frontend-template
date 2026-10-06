// Контентный гейт (до build): каждый .md коллекции проходит Zod-схему слайса, тело держит
// инварианты (h1 только из title, alt у картинок, корневые ссылки на существующие маршруты),
// переводы и content/redirects.yaml согласованы с маршрутами. Падает раньше и понятнее сборки.
// YAML читает js-yaml (им же Astro читает frontmatter); TS-модули — только «листовые»
// (без alias-импортов), их Node исполняет напрямую. Реестр коллекций — scripts/lib/content.mjs
// проверяемого корня.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { load, YAMLException } from 'js-yaml'
import { z } from 'zod'
import { SLUG_RE } from '../src/entities/post/model/schema.ts'
import { SITE_ORIGIN_PLACEHOLDER } from '../src/shared/config/runtime.ts'
import { localePath, SUPPORTED_LOCALES } from '../src/shared/i18n/locale.ts'
import { buildRedirectTable, isExternalTarget } from '../src/shared/redirects/table.ts'
import { collectionsOf, splitFrontmatter } from './lib/content.mjs'
import { pageRoutes, walk } from './lib/routes.mjs'

// Корень проекта; другой корень — негативные фикстуры check:gate (`.gate-fixtures/<скрипт>`).
const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
const collections = await collectionsOf(root)
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif'])
// Голый хост плейсхолдера: ловит и полный URL, и упоминание без схемы.
const PLACEHOLDER = new URL(SITE_ORIGIN_PLACEHOLDER).hostname

const errors = []
const fail = (where, message) => {
  errors.push(`${where}: ${message}`)
}
const rel = (path) => relative(root, path).split(sep).join('/')

// js-yaml нумерует строки от нуля внутри фрагмента; frontmatter начинается со второй строки файла.
function yamlFailure(where, err, lineOffset) {
  if (err instanceof YAMLException) {
    const line = err.mark ? `:${err.mark.line + 1 + lineOffset}` : ''
    fail(`${where}${line}`, `YAML: ${err.reason}`)
  } else fail(where, err instanceof Error ? err.message : String(err))
}

// Заглушка image(): реальная резолвит файл на сборке, здесь достаточно проверить путь.
function imageStub(dir) {
  return () =>
    z.string().superRefine((value, ctx) => {
      const path = resolve(dir, value)
      if (!value.startsWith('.'))
        ctx.addIssue({ code: 'custom', message: 'путь к картинке — относительный от файла' })
      else if (!existsSync(path))
        ctx.addIssue({ code: 'custom', message: `файл ${value} не найден` })
      else if (!IMAGE_EXT.has(extname(path).toLowerCase())) {
        ctx.addIssue({ code: 'custom', message: `${value}: неподдерживаемый формат` })
      }
    })
}

// ---------- реестр против каталогов ----------
// Контент живёт в src/entities/<слайс>/content; каталог вне реестра не проверяет ни один гейт.
const entitiesDir = resolve(root, 'src/entities')
const registered = new Set(collections.map((collection) => resolve(root, collection.dir)))
for (const slice of existsSync(entitiesDir) ? readdirSync(entitiesDir) : []) {
  const dir = resolve(entitiesDir, slice, 'content')
  if (existsSync(dir) && !registered.has(dir)) {
    fail(rel(dir), 'каталог контента без записи в реестре коллекций scripts/lib/content.mjs')
  }
}

// ---------- документы ----------
const docs = []
for (const collection of collections) {
  const dir = resolve(root, collection.dir)
  if (!existsSync(dir)) {
    fail(collection.dir, 'каталога коллекции нет — поправьте реестр scripts/lib/content.mjs')
    continue
  }
  for (const file of walk(dir).filter((path) => path.endsWith('.md'))) {
    const where = rel(file)
    const [locale, name, ...deeper] = relative(dir, file).split(sep)
    if (!name || deeper.length > 0 || !SUPPORTED_LOCALES.includes(locale)) {
      fail(where, `путь должен быть <locale>/<slug>.md, локали: ${SUPPORTED_LOCALES.join(', ')}`)
      continue
    }
    const slug = name.slice(0, -'.md'.length)
    if (!SLUG_RE.test(slug)) fail(where, `slug «${slug}»: только a-z, 0-9 и дефисы`)

    const source = readFileSync(file, 'utf8')
    // Во frontmatter и в теле: штамповка origin при старте контейнера переписала бы его в HTML.
    source.split('\n').forEach((line, index) => {
      if (line.includes(PLACEHOLDER)) {
        fail(`${where}:${index + 1}`, `литерал плейсхолдера ${PLACEHOLDER} — описывайте словами`)
      }
    })

    const parts = splitFrontmatter(source)
    if (!parts) {
      fail(where, 'нет frontmatter между строками ---')
      continue
    }
    let raw
    try {
      raw = load(parts.frontmatter)
    } catch (err) {
      yamlFailure(where, err, 1)
      continue
    }
    // Тело проверяется и при невалидном frontmatter — редактор видит все проблемы за один прогон;
    // в маршруты и переводы такая запись не попадает.
    const result = collection.schema({ image: imageStub(dirname(file)) }).safeParse(raw)
    if (!result.success) {
      for (const issue of result.error.issues) {
        fail(where, `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`)
      }
    }
    docs.push({
      file: where,
      dir: dirname(file),
      collection: collection.name,
      locale,
      slug,
      data: result.success ? result.data : undefined,
      body: parts.body,
      // Строка тела i соответствует строке файла offset + i (две строки `---` + frontmatter).
      offset: parts.frontmatter.split('\n').length + 2,
    })
  }
}

// ---------- тело: заголовки, картинки, ссылки ----------
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const LINK_RE = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const HREF_RE = /\bhref=("([^"]*)"|'([^']*)')/gi
const internalLinks = []

const classify = (url) => {
  if (/^(#|mailto:|tel:)/i.test(url)) return 'skip'
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return 'external'
  return url.startsWith('/') ? 'internal' : 'relative'
}

for (const doc of docs) {
  let inFence = false
  let previousLevel = 1
  doc.body.split('\n').forEach((line, index) => {
    const where = `${doc.file}:${doc.offset + index + 1}`
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return
    // Inline-код — текст, а не разметка: упоминание `<img>` или `<meta http-equiv>` допустимо.
    const markup = line.replace(/`[^`]*`/g, '')

    const heading = /^(#{1,6})\s/.exec(line)
    if (heading) {
      const level = heading[1].length
      if (level === 1) fail(where, 'h1 в теле — заголовок страницы берётся из title')
      else if (level > previousLevel + 1) {
        fail(where, `скачок уровня заголовков: h${previousLevel} → h${level}`)
      }
      previousLevel = Math.max(level, 2)
    }
    if (/<h1\b/i.test(markup)) fail(where, 'h1 в теле — заголовок страницы берётся из title')

    for (const [, alt, src] of markup.matchAll(IMAGE_RE)) {
      if (alt.trim() === '') fail(where, `картинка ${src} без alt`)
      const kind = classify(src)
      if (kind === 'relative' && !existsSync(resolve(doc.dir, src)))
        fail(where, `картинка ${src} не найдена`)
      if (kind === 'internal') internalLinks.push({ where, url: src })
    }
    if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(markup)) fail(where, '<img> без alt')
    if (/<script\b/i.test(markup)) fail(where, '<script> в теле — контентная страница без JS')
    if (/http-equiv/i.test(markup))
      fail(where, 'meta refresh запрещён — редиректы в content/redirects.yaml')

    const urls = [
      ...[...markup.matchAll(LINK_RE)].map((match) => match[1]),
      ...[...markup.matchAll(HREF_RE)].map((match) => match[2] ?? match[3] ?? ''),
    ]
    for (const url of urls) {
      const kind = classify(url)
      if (kind === 'relative') fail(where, `ссылка ${url}: относительная, нужен корневой путь`)
      if (kind === 'internal') internalLinks.push({ where, url })
    }
  })
}

// ---------- переводы и сниппеты ----------
const valid = docs.filter((item) => item.data)
const keys = new Map()
for (const doc of valid) {
  const key = `${doc.collection}:${doc.locale}:${doc.data.translationKey}`
  const seen = keys.get(key)
  if (seen) fail(doc.file, `translationKey «${doc.data.translationKey}» уже у ${seen}`)
  else keys.set(key, doc.file)
}
// title и description — сниппет выдачи: двум страницам одной локали один сниппет не положен.
for (const field of ['title', 'description']) {
  const seen = new Map()
  for (const doc of valid) {
    const key = `${doc.collection}:${doc.locale}:${doc.data[field]}`
    const other = seen.get(key)
    if (other) fail(doc.file, `${field} совпадает с ${other}`)
    else seen.set(key, doc.file)
  }
}

// ---------- маршруты ----------
const routes = new Set(
  pageRoutes(resolve(root, 'src/pages'))
    .filter((page) => !page.parametrized)
    .map((page) => page.route),
)
const publicDir = resolve(root, 'public')
for (const file of existsSync(publicDir) ? walk(publicDir) : []) {
  routes.add(`/${relative(publicDir, file).split(sep).join('/')}`)
}
const draftRoutes = new Set()
for (const collection of collections) {
  for (const locale of SUPPORTED_LOCALES) {
    const own = valid.filter((doc) => doc.collection === collection.name && doc.locale === locale)
    const published = own.filter((doc) => !doc.data.draft)
    const tags = [...new Set(published.flatMap((doc) => doc.data.tags))]
    for (const route of collection.routes({ slugs: published.map((doc) => doc.slug), tags })) {
      routes.add(localePath(locale, route))
    }
    for (const doc of own.filter((item) => item.data.draft)) {
      draftRoutes.add(localePath(locale, collection.entryRoute(doc.slug)))
    }
  }
}

for (const { where, url } of internalLinks) {
  const path = url.replace(/[?#].*$/, '')
  if (path !== '/' && path.endsWith('/'))
    fail(where, `${url}: хвостовой слеш — это лишний редирект`)
  else if (path.endsWith('.html')) fail(where, `${url}: .html — дубль маршрута`)
  else if (draftRoutes.has(path)) fail(where, `${url}: ссылка на черновик`)
  else if (!routes.has(path)) fail(where, `${url}: маршрута не существует`)
}

// ---------- redirects.yaml ----------
const redirectsFile = 'content/redirects.yaml'
let table
try {
  table = buildRedirectTable(load(readFileSync(resolve(root, redirectsFile), 'utf8')))
} catch (err) {
  if (err instanceof z.ZodError) fail(redirectsFile, z.prettifyError(err))
  else yamlFailure(redirectsFile, err, 0)
}
for (const rule of table?.values() ?? []) {
  if (routes.has(rule.from))
    fail(redirectsFile, `from ${rule.from} совпадает с существующим маршрутом`)
  if ('to' in rule && !isExternalTarget(rule.to) && !routes.has(rule.to)) {
    fail(redirectsFile, `to ${rule.to} не существует`)
  }
}

// ---------- итог ----------
if (errors.length > 0) {
  console.error(`check:content: ${errors.length} нарушений\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
const byLocale = SUPPORTED_LOCALES.map(
  (locale) => `${locale} ${docs.filter((doc) => doc.locale === locale).length}`,
).join(', ')
const drafts = docs.filter((doc) => doc.data?.draft).length
console.info(
  `check:content: ${docs.length} записей (${byLocale}; черновиков ${drafts}), ${table?.size ?? 0} редиректов, ${internalLinks.length} внутренних ссылок — ok`,
)
