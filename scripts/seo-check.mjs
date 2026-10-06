// SEO-гейт на прод-сборке (после build): у каждой prerendered-страницы dist/client — ровно один
// <title> и один <h1>, description с непустым content, self-canonical абсолютным URL, lang по
// локали пути, полный OG с существующей картинкой, без keywords. Служебная prerendered-страница
// (подтверждение заявки, 500) закрыта одним noindex — тогда canonical, OG и hreflang запрещены,
// и в пары переводов она не входит; title и description
// уникальны среди всех страниц; hreflang — полный взаимный набор (self + x-default) у каждой пары
// переводов (главные, списки и теги под обоими префиксами локалей; записи — twin по
// translationKey) и ни одной ссылки на отсутствующую страницу; JSON-LD парсится, содержит только
// допустимые типы, Organization/WebSite на главной и правильно устроенный BreadcrumbList там, где
// он есть, и ни одного HTML-комментария в разметке. On-demand ответы (robots.txt, sitemap.xml,
// фиды) проверяет HTTP-набор (`pnpm test:http`) — им нужен сервер.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { load } from 'js-yaml'
import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES } from '../src/shared/i18n/locale.ts'
import { collections, splitFrontmatter } from './lib/content.mjs'
import { decode, headTags } from './lib/html.mjs'
import { walk } from './lib/routes.mjs'

const root = resolve(import.meta.dirname, '..')
const client = resolve(root, 'dist/client')
if (!existsSync(client)) {
  console.error('seo:check: dist/client не найден — сначала pnpm build')
  process.exit(1)
}

// Reference-набор печатает только эти типы; FAQPage/HowTo/SearchAction — не «по умолчанию»
// (rich results сняты), их появление в шаблоне — ошибка.
const ALLOWED_TYPES = new Set([
  'Organization',
  'WebSite',
  'LocalBusiness',
  'BreadcrumbList',
  'BlogPosting',
])
const FORBIDDEN_TYPES = ['FAQPage', 'HowTo', 'SearchAction']

const errors = []
const fail = (where, message) => {
  errors.push(`${where}: ${message}`)
}

const absolute = (value) => /^https?:\/\/[^/]+/.test(value ?? '')
const pathOf = (url) => {
  const { pathname } = new URL(url)
  return pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}
const existsInDist = (url) => {
  const file = resolve(client, `.${new URL(url).pathname}`)
  return file.startsWith(client + sep) && existsSync(file) && statSync(file).isFile()
}

const localeOf = (path) => {
  const [, first] = path.split('/')
  return SUPPORTED_LOCALES.includes(first) ? first : DEFAULT_LOCALE
}
const isLocaleHome = (path) =>
  SUPPORTED_LOCALES.some((locale) => path === (locale === DEFAULT_LOCALE ? '/' : `/${locale}`))
// Путь без префикса локали: `/en/blog` → `/blog`, `/en` → `/`.
const routeOf = (path) => {
  const locale = localeOf(path)
  return locale === DEFAULT_LOCALE ? path : path.slice(locale.length + 1) || '/'
}

// Видимые крошки и data block — из одного массива на странице; здесь — форма списка: позиции
// с 1 подряд, у предков абсолютный item, последняя крошка — текущая страница (без item или self).
function checkBreadcrumbList(where, data, canonical) {
  const items = Array.isArray(data.itemListElement) ? data.itemListElement : []
  if (items.length === 0) fail(where, 'BreadcrumbList без элементов')
  items.forEach((item, index) => {
    if (item['@type'] !== 'ListItem' || item.position !== index + 1 || !item.name) {
      fail(
        where,
        `BreadcrumbList: элемент ${index + 1} — не ListItem с position ${index + 1} и name`,
      )
    }
    if (index === items.length - 1) {
      if (item.item !== undefined && item.item !== canonical) {
        fail(
          where,
          `BreadcrumbList: у последней крошки item либо нет, либо self, а не ${item.item}`,
        )
      }
    } else if (!absolute(item.item)) {
      fail(where, `BreadcrumbList: крошка ${index + 1} без абсолютного item`)
    }
  })
}

// ---------- страницы ----------
const pages = new Map()
for (const file of walk(client).filter((path) => path.endsWith('index.html'))) {
  const rel = relative(client, file).split(sep).join('/')
  const path = `/${rel.replace(/\/?index\.html$/, '')}`
  const where = `dist/client/${rel}`
  const html = readFileSync(file, 'utf8')
  // Комментарий в разметке уезжает в каждую страницу и виден в исходнике: они живут во frontmatter.
  if (html.includes('<!--')) fail(where, 'HTML-комментарий в выходе')
  const tags = headTags(html)
  const meta = (name) => tags.filter((item) => item.tag === 'meta' && item.name === name)
  const property = (name) => tags.filter((item) => item.tag === 'meta' && item.property === name)
  const single = (list, label) => {
    if (list.length !== 1) fail(where, `${label}: ожидается ровно один, найдено ${list.length}`)
    return list[0]
  }
  const locale = localeOf(path)

  const titles = [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((match) => decode(match[1]))
  const title = single(titles, '<title>')?.trim()
  if (title === '') fail(where, 'пустой <title>')
  // Astro печатает content={undefined} как <meta name="description"> без атрибута — это тоже пусто.
  const descriptionTag = single(meta('description'), 'meta description')
  const description = descriptionTag?.content?.trim()
  if (descriptionTag && !description) fail(where, 'description без content или пустой')

  const h1 = html.match(/<h1[\s>]/g)?.length ?? 0
  if (h1 !== 1) fail(where, `h1: ожидается ровно один, найдено ${h1}`)
  const lang = /<html lang="([^"]*)"/.exec(html)?.[1]
  if (lang !== locale) fail(where, `<html lang="${lang}"> не совпадает с локалью пути (${locale})`)

  // Служебная prerendered-страница (подтверждение заявки, 500) закрыта одним noindex и не
  // печатает ни canonical, ни OG, ни hreflang: разрешающие и запрещающие директивы не
  // смешиваются. Всё остальное prerendered — индексируемое, и noindex там ошибка сборки.
  const noindex = meta('robots').some((robots) => /noindex|none/.test(robots.content ?? ''))
  if (meta('keywords').length > 0) fail(where, 'meta keywords не используется никогда')

  const canonicalTags = tags.filter((item) => item.tag === 'link' && item.rel === 'canonical')
  const canonical = noindex ? undefined : single(canonicalTags, 'canonical')?.href
  if (canonical !== undefined) {
    if (!absolute(canonical)) fail(where, `canonical не абсолютный: ${canonical}`)
    else if (pathOf(canonical) !== path) fail(where, `canonical ${canonical} не self (${path})`)
  }

  const hrefs = new Map(
    tags
      .filter(
        (item) => item.tag === 'link' && item.rel === 'alternate' && item.hreflang !== undefined,
      )
      .map((item) => [item.hreflang, item.href]),
  )
  if (hrefs.size > 0) {
    if (!hrefs.has('x-default')) fail(where, 'hreflang без x-default')
    if (![...hrefs.values()].includes(canonical)) fail(where, 'hreflang без self-ссылки')
    for (const [hreflang, href] of hrefs) {
      if (!absolute(href)) fail(where, `hreflang ${hreflang}: не абсолютный URL ${href}`)
      if (hreflang !== 'x-default' && !SUPPORTED_LOCALES.includes(hreflang)) {
        fail(where, `hreflang «${hreflang}» вне SUPPORTED_LOCALES`)
      }
    }
    const xDefault = hrefs.get('x-default')
    if (
      xDefault !== undefined &&
      ![...hrefs].some(([hreflang, href]) => hreflang !== 'x-default' && href === xDefault)
    ) {
      fail(where, 'x-default не совпадает ни с одной локальной версией')
    }
  }

  const og = (name) => single(property(name), name)?.content
  if (noindex) {
    if (canonicalTags.length > 0) fail(where, 'noindex-страница с canonical')
    if (hrefs.size > 0) fail(where, 'noindex-страница с hreflang')
    if (tags.some((item) => item.property?.startsWith('og:'))) fail(where, 'noindex-страница с OG')
  } else {
    const ogType = og('og:type')
    if (ogType !== undefined && !['website', 'article'].includes(ogType))
      fail(where, `og:type «${ogType}»`)
    if (og('og:title') !== title) fail(where, 'og:title не равен <title>')
    const ogDescription = og('og:description')
    if (!ogDescription) fail(where, 'og:description без content или пустой')
    else if (ogDescription !== description) fail(where, 'og:description не равен description')
    const ogUrl = og('og:url')
    if (!ogUrl) fail(where, 'og:url пуст')
    else if (ogUrl !== canonical) fail(where, 'og:url не равен canonical')
    if (!og('og:site_name')) fail(where, 'og:site_name пуст')
    const ogLocale = og('og:locale')
    if (ogLocale !== undefined && !new RegExp(`^${locale}_[A-Z]{2}$`).test(ogLocale)) {
      fail(where, `og:locale «${ogLocale}» не соответствует локали ${locale}`)
    }
    const image = og('og:image')
    if (image !== undefined) {
      if (!absolute(image)) fail(where, `og:image не абсолютный: ${image}`)
      else if (!existsInDist(image))
        fail(where, `og:image ${new URL(image).pathname} нет в dist/client`)
    }
    for (const side of ['og:image:width', 'og:image:height']) {
      if (!/^[1-9]\d*$/.test(og(side) ?? '')) fail(where, `${side} не целое число`)
    }
    if (!og('og:image:alt')) fail(where, 'og:image:alt пуст')
    if (!meta('twitter:card')[0]?.content) fail(where, 'twitter:card отсутствует')
  }

  const types = []
  for (const [, json] of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    let data
    try {
      data = JSON.parse(json)
    } catch (err) {
      fail(where, `JSON-LD не парсится: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    if (data['@context'] !== 'https://schema.org')
      fail(where, `JSON-LD @context «${data['@context']}»`)
    if (!ALLOWED_TYPES.has(data['@type']))
      fail(where, `JSON-LD @type «${data['@type']}» вне списка`)
    for (const forbidden of FORBIDDEN_TYPES) {
      if (json.includes(`"${forbidden}"`)) fail(where, `JSON-LD содержит ${forbidden}`)
    }
    if (data['@type'] === 'BreadcrumbList') checkBreadcrumbList(where, data, canonical)
    types.push(data['@type'])
  }
  if (isLocaleHome(path)) {
    for (const type of ['Organization', ...(path === '/' ? ['WebSite'] : [])]) {
      if (!types.includes(type)) fail(where, `нет JSON-LD ${type}`)
    }
  }

  pages.set(path, { where, title, description, canonical, hrefs, noindex })
}

if (pages.size === 0) {
  console.error('seo:check: в dist/client нет ни одной страницы — сборка неполная')
  process.exit(1)
}

// ---------- между страницами: уникальность сниппета, взаимность и полнота hreflang ----------
for (const field of ['title', 'description']) {
  const seen = new Map()
  for (const [, page] of pages) {
    const value = page[field]
    if (!value) continue
    const other = seen.get(value)
    if (other) fail(page.where, `${field} совпадает с ${other}`)
    else seen.set(value, page.where)
  }
}

for (const [, page] of pages) {
  for (const [hreflang, href] of page.hrefs) {
    if (hreflang === 'x-default' || href === page.canonical || !absolute(href)) continue
    const target = pages.get(pathOf(href))
    if (!target) fail(page.where, `hreflang ${hreflang} → ${href}: страницы нет в сборке`)
    else if (![...target.hrefs.values()].includes(page.canonical)) {
      fail(page.where, `hreflang ${hreflang} → ${href} не взаимный`)
    }
  }
}

// Сломанный набор ловят проверки выше, пропавший — только сверка с источником пар: главные,
// списки и теги — один маршрут под обоими префиксами локалей; записи — twin по translationKey
// из frontmatter (черновиков в сборке нет). Без неё страница без alternatePath теряет hreflang молча.
const groups = new Map()
const pair = (key, locale, path) => {
  if (!groups.has(key)) groups.set(key, new Map())
  groups.get(key).set(locale, path)
}
const entryPaths = new Set()
for (const collection of collections) {
  const dir = resolve(root, collection.dir)
  for (const file of walk(dir).filter((name) => name.endsWith('.md'))) {
    const [locale, name] = relative(dir, file).split(sep)
    const data = load(splitFrontmatter(readFileSync(file, 'utf8')).frontmatter)
    if (data.draft === true) continue
    const path = localePath(locale, collection.entryRoute(name.replace(/\.md$/, '')))
    entryPaths.add(path)
    pair(`${collection.name}:${data.translationKey}`, locale, path)
  }
}
for (const [path, page] of pages) {
  // Служебные страницы hreflang не выводят: у пары noindex-страниц нечего сверять.
  if (!entryPaths.has(path) && !page.noindex) pair(`route:${routeOf(path)}`, localeOf(path), path)
}
let pairs = 0
for (const group of groups.values()) {
  if (group.size < 2) continue
  pairs++
  for (const [, path] of group) {
    const page = pages.get(path)
    if (!page) {
      fail(`dist/client${path}`, 'страницы нет в сборке, хотя запись не черновик')
      continue
    }
    for (const [locale, twin] of group) {
      const href = page.hrefs.get(locale)
      if (href === undefined) fail(page.where, `нет hreflang ${locale} → ${twin}, а перевод есть`)
      else if (!absolute(href) || pathOf(href) !== twin) {
        fail(page.where, `hreflang ${locale} → ${href}, а перевод — ${twin}`)
      }
    }
  }
}

// ---------- итог ----------
if (errors.length > 0) {
  console.error(`seo:check: ${errors.length} нарушений\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
const withAlternates = [...pages.values()].filter((page) => page.hrefs.size > 0).length
console.info(
  `seo:check: ${pages.size} страниц (с hreflang ${withAlternates}, пар переводов ${pairs}), title/description уникальны, JSON-LD валиден — ok`,
)
