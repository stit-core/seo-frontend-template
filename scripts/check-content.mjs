// Контентный гейт (до build): каждый .md коллекции проходит Zod-схему слайса, дата опубликованной
// записи — не позже дня проверки, тело держит инварианты (h1 только из title, alt у картинок,
// корневые ссылки на существующие маршруты, ни скрытой разметки, ни своего оформления), переводы и
// content/redirects.yaml согласованы с маршрутами, у каждого on-demand маршрута — строка в карте
// docs/reference/rendering.md. Падает раньше и понятнее сборки.
// YAML читает js-yaml, тело записи — satteri (ими же запись читает Astro); TS-модули — только
// «листовые» (без alias-импортов), их Node исполняет напрямую. Реестр коллекций —
// scripts/lib/content.mjs проверяемого корня.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { load, YAMLException } from 'js-yaml'
import { htmlToHast, markdownToMdast } from 'satteri'
import { z } from 'zod'
import { SLUG_RE } from '../src/entities/post/model/schema.ts'
import { SITE_ORIGIN_PLACEHOLDER } from '../src/shared/config/runtime.ts'
import { localeRules } from '../src/shared/i18n/locale.ts'
import { buildRedirectTable, isExternalTarget } from '../src/shared/redirects/table.ts'
import { collectionsOf, splitFrontmatter } from './lib/content.mjs'
import { localizedRoute, pageRoutes, walk } from './lib/routes.mjs'

// Корень проекта; другой корень — негативные фикстуры check:gate (`.gate-fixtures/<скрипт>`).
const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
const collections = await collectionsOf(root)
// Локали — проверяемого проекта, из его политики сборки: гейт на гейт не зависит от локалей сайта.
const { LOCALES } = await import(pathToFileURL(resolve(root, 'scripts/lib/site-policy.mjs')).href)
const { SUPPORTED_LOCALES, localePath } = localeRules(LOCALES)
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif'])
// Голый хост плейсхолдера: ловит и полный URL, и упоминание без схемы.
const PLACEHOLDER = new URL(SITE_ORIGIN_PLACEHOLDER).hostname

const errors = []
const fail = (where, message) => {
  errors.push(`${where}: ${message}`)
}
const rel = (path) => relative(root, path).split(sep).join('/')

// День проверки — самый поздний календарный день, который уже наступил где-то на Земле (пояс
// UTC+14): ответ один на любой машине, а сегодняшняя дата автора из любого пояса — не будущее.
const TODAY = new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10)
const DATE_FIELDS = ['pubDate', 'updatedDate']

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
    // Дата из будущего — в разметке, карте сайта и фиде: поисковик читает её как признак подделки
    // свежести. Запланированная запись ждёт своего дня черновиком.
    for (const field of result.success && !result.data.draft ? DATE_FIELDS : []) {
      const date = result.data[field]
      const day = date instanceof Date ? date.toISOString().slice(0, 10) : undefined
      if (day !== undefined && day > TODAY) {
        fail(where, `${field} ${day} — позже дня проверки: отложенная публикация — это draft: true`)
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

// ---------- тело: заголовки, картинки, ссылки, сырой HTML ----------
// Тело читает разборщик сборки (satteri — им Astro собирает записи): что в нём код, а что разметка,
// гейт знает из того же дерева, что и страница. Сырой HTML — узлы `html` дерева; их теги и атрибуты
// разбирает HTML-разборщик той же библиотеки — как браузер.
const internalLinks = []
// Свойства элемента (имена дерева hast), которыми текст прячут от читателя или оформляют мимо
// стилей статьи, — атрибут и причина. Скрытый текст — текст только для роботов (спам для
// поисковика), а инлайн-стиль ещё и блокирует CSP страницы: в гейте это видел бы только браузерный
// набор.
const HIDING = {
  style: ['style', 'инлайн-стиль блокирует CSP страницы, а скрытый им текст читатель не видит'],
  className: [
    'class',
    'вид записи задаёт статья, а класс (hidden, sr-only) прячет текст от читателя',
  ],
  hidden: ['hidden', 'текст, которого читатель не видит, — текст только для роботов'],
  ariaHidden: ['aria-hidden', 'текст, которого читатель не видит, — текст только для роботов'],
}

const classify = (url) => {
  if (/^(#|mailto:|tel:)/i.test(url)) return 'skip'
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return 'external'
  return url.startsWith('/') ? 'internal' : 'relative'
}

function* nodesOf(node) {
  yield node
  for (const child of node.children ?? []) yield* nodesOf(child)
}

for (const doc of docs) {
  const nodes = [...nodesOf(markdownToMdast(doc.body))]
  // Ссылка и картинка по метке (`[текст][метка]`) — те же ссылка и картинка: адрес — у определения.
  const definitions = new Map(
    nodes.filter((node) => node.type === 'definition').map((node) => [node.identifier, node.url]),
  )
  let previousLevel = 1
  for (const node of nodes) {
    const where = `${doc.file}:${doc.offset + node.position.start.line}`
    const link = (url) => {
      const kind = classify(url)
      if (kind === 'relative') fail(where, `ссылка ${url}: относительная, нужен корневой путь`)
      if (kind === 'internal') internalLinks.push({ where, url })
    }
    if (node.type === 'heading') {
      if (node.depth === 1) fail(where, 'h1 в теле — заголовок страницы берётся из title')
      else if (node.depth > previousLevel + 1) {
        fail(where, `скачок уровня заголовков: h${previousLevel} → h${node.depth}`)
      }
      previousLevel = Math.max(node.depth, 2)
    } else if (node.type === 'image' || node.type === 'imageReference') {
      const src = node.url ?? definitions.get(node.identifier)
      if (!node.alt?.trim()) fail(where, `картинка ${src} без alt`)
      const kind = classify(src)
      if (kind === 'relative' && !existsSync(resolve(doc.dir, src)))
        fail(where, `картинка ${src} не найдена`)
      if (kind === 'internal') internalLinks.push({ where, url: src })
    } else if (node.type === 'link' || node.type === 'linkReference') {
      link(node.url ?? definitions.get(node.identifier))
    } else if (node.type === 'table' && node.align.some(Boolean)) {
      // Выравнивание колонки (`:--`, `:-:`, `--:`) сборка печатает атрибутом style у каждой ячейки.
      fail(where, 'выравнивание колонок таблицы — инлайн-стиль, его блокирует CSP страницы')
    } else if (node.type === 'html') {
      for (const { tagName, properties = {} } of nodesOf(
        htmlToHast(node.value, { fragment: true }),
      )) {
        if (tagName === 'h1') fail(where, 'h1 в теле — заголовок страницы берётся из title')
        if (tagName === 'img' && !('alt' in properties)) fail(where, '<img> без alt')
        if (tagName === 'script') fail(where, '<script> в теле — контентная страница без JS')
        if ('httpEquiv' in properties)
          fail(where, 'meta refresh запрещён — редиректы в content/redirects.yaml')
        if (typeof properties.href === 'string') link(properties.href)
        for (const [property, [name, reason]] of Object.entries(HIDING)) {
          if (property in properties) fail(where, `атрибут ${name} в теле: ${reason}`)
        }
      }
    }
  }
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
const pagesDir = resolve(root, 'src/pages')
const pages = pageRoutes(pagesDir)
const routes = new Set(pages.filter((page) => !page.parametrized).map((page) => page.route))
// Маршрут локалей (`[...locale]`) — адрес на каждой локали; на каких из них страница есть на самом деле, знает
// сборка, и ссылку на несобранную версию ловит check:links.
for (const page of pages) {
  const route = localizedRoute(page.route)
  if (route === undefined || route.includes('[')) continue
  for (const locale of SUPPORTED_LOCALES) routes.add(localePath(locale, route))
}
// On-demand — решение о кеше и индексации: строка в карте маршрутов, а не только флаг в файле.
const renderMap = resolve(root, 'docs/reference/rendering.md')
const mapRows = (existsSync(renderMap) ? readFileSync(renderMap, 'utf8') : '')
  .split('\n')
  .filter((line) => line.startsWith('|'))
for (const page of pages.filter((item) => item.mode === 'dynamic')) {
  const file = relative(pagesDir, page.file).split(sep).join('/')
  if (!mapRows.some((row) => row.includes(`\`${file}\``))) {
    fail(`src/pages/${file}`, 'on-demand маршрут без строки в карте docs/reference/rendering.md')
  }
}
const publicDir = resolve(root, 'public')
for (const file of existsSync(publicDir) ? walk(publicDir) : []) {
  routes.add(`/${relative(publicDir, file).split(sep).join('/')}`)
}
// Карту сайта пишет сборка: файла маршрута у неё нет, а адрес занят.
routes.add('/sitemap.xml')
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

// Маршруты и файлы public/ названы буквами, а ссылка на файл с кириллицей в имени бывает записана
// и процентами (так её отдаёт адресная строка): путь сверяется в записи маршрута.
function routeOf(url) {
  const path = url.replace(/[?#].*$/, '')
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

for (const { where, url } of internalLinks) {
  const path = routeOf(url)
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
for (const rule of table?.rules ?? []) {
  // Переезд обёртка процесса отдаёт раньше страницы, поэтому правило с `?query` на пути живого
  // маршрута законно (`/?p=123` старого сайта). Без query оно закрыло бы саму страницу, а 410
  // отвечает приложение — после статик-хендлера, который отдаст страницу.
  if (routes.has(rule.path) && rule.query.length === 0) {
    fail(redirectsFile, `from ${rule.from} совпадает с существующим маршрутом`)
  } else if (routes.has(rule.path) && rule.status === 410) {
    fail(redirectsFile, `from ${rule.from}: 410 на пути существующего маршрута — ответит страница`)
  }
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
  `check:content: ${docs.length} записей (${byLocale}; черновиков ${drafts}), ${table?.rules.length ?? 0} редиректов, ${internalLinks.length} внутренних ссылок — ok`,
)
