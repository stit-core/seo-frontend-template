// SEO-гейт на прод-сборке (после build) — по каждой prerendered-странице dist/client:
// - head: ровно один <title> и один <h1>, description с непустым content, self-canonical
//   абсолютным URL на плейсхолдере origin (один образ на все среды), lang по локали пути, полный
//   OG с существующей картинкой, без keywords; title и description уникальны среди всех страниц;
// - сниппет индексируемой страницы в бюджетах и не общий; noindex — только у служебных маршрутов
//   из списка политики (scripts/lib/site-policy.mjs), и тогда без canonical, OG и hreflang;
// - hreflang — полный взаимный набор (self + x-default) у каждой пары переводов из источника
//   (главные, списки и теги под обоими префиксами локалей; записи — twin по translationKey) и
//   только у них;
// - JSON-LD: допустимые типы, Organization/WebSite только на главной, правильный BreadcrumbList,
//   разметка = видимое (headline = h1, даты = <time>, image = og:image, mainEntityOfPage =
//   canonical, крошки = BreadcrumbList, контакты организации — на странице);
// - тело: ни плейсхолдера origin, ни HTML-комментариев; исполняемые скрипты — только острова из
//   списка; у картинок размеры, картинка над h1 (LCP) — не lazy и с fetchpriority; ресурсов с чужих
//   origin нет, @font-face — с font-display swap/fallback/optional (и в CSS сборки);
// - сборка против источника: страница у каждой опубликованной записи и prerendered-маршрута,
//   страниц черновиков нет.
// On-demand ответы (robots.txt, sitemap.xml, фиды, /now, 404) и карту сайта против сборки
// проверяет HTTP-набор (`pnpm test:http`) — им нужен сервер.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { load } from 'js-yaml'
import { SITE_ORIGIN_PLACEHOLDER } from '../src/shared/config/runtime.ts'
import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES } from '../src/shared/i18n/locale.ts'
import { collectionsOf, splitFrontmatter } from './lib/content.mjs'
import { bodyOf, decode, headTags, normalizeSpace, textOf } from './lib/html.mjs'
import { pageRoutes, walk } from './lib/routes.mjs'
import {
  DESCRIPTION_BUDGET,
  GENERIC_TITLE,
  NOINDEX_ROUTES,
  RESOURCE_ORIGINS,
  scriptViolations,
  TITLE_BUDGET,
} from './lib/site-policy.mjs'

// Корень проекта; другой корень — негативные фикстуры check:gate (`.gate-fixtures/<скрипт>`).
const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
const collections = await collectionsOf(root)
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

// Свой origin в выходе сборки — плейсхолдер: реальный ставит entrypoint при старте контейнера.
const OWN_ORIGIN = new URL(SITE_ORIGIN_PLACEHOLDER).origin
const OWN_HOST = new URL(SITE_ORIGIN_PLACEHOLDER).hostname
const FONT_DISPLAY = ['swap', 'fallback', 'optional']

// Сниппет выдачи: title без суффикса сайта и description — в бюджетах и не общие.
function checkSnippet(where, title, description, siteName) {
  const suffix = siteName ? ` — ${siteName}` : ''
  const core = suffix && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title
  const words = core.match(/[\p{L}\p{N}]+/gu)?.length ?? 0
  if (GENERIC_TITLE.test(core)) fail(where, `title «${core}» — общий: поисковик заменит его сам`)
  else if (words < TITLE_BUDGET.minWords) {
    fail(where, `title «${core}» — меньше ${TITLE_BUDGET.minWords} слов`)
  }
  const chars = [...core].length
  if (chars > TITLE_BUDGET.maxChars) {
    fail(where, `title — ${chars} знаков без суффикса сайта, бюджет ${TITLE_BUDGET.maxChars}`)
  }
  const length = [...(description ?? '')].length
  const { minChars, maxChars } = DESCRIPTION_BUDGET
  if (description && (length < minChars || length > maxChars)) {
    fail(where, `description — ${length} знаков, бюджет ${minChars}–${maxChars}`)
  }
}

// Абсолютный URL ресурса на чужом origin вне списка политики — ошибка: шрифты, стили, скрипты и
// картинки грузятся со своего сайта.
function checkResourceUrl(where, url) {
  if (!/^(https?:)?\/\//.test(url)) return
  const { origin } = new URL(url, OWN_ORIGIN)
  if (origin !== OWN_ORIGIN && !RESOURCE_ORIGINS.includes(origin)) {
    fail(where, `ресурс с чужого origin ${origin} вне RESOURCE_ORIGINS: ${url}`)
  }
}

// CSS сборки и инлайн-<style>: чужие ресурсы и шрифты, невидимые до загрузки.
function checkCss(where, css) {
  for (const [, url] of css.matchAll(/(?:url\(|@import\s+)\s*['"]?([^'")\s;]+)/g)) {
    checkResourceUrl(where, url ?? '')
  }
  for (const [block] of css.matchAll(/@font-face\s*\{[^}]*\}/g)) {
    const display = /font-display\s*:\s*([\w-]+)/.exec(block)?.[1]
    if (!FONT_DISPLAY.includes(display)) {
      fail(
        where,
        `@font-face с font-display ${display ?? 'по умолчанию (auto)'}: текст невидим, пока грузится шрифт`,
      )
    }
  }
}

// Ресурсы документа: что браузер скачает сам (src, srcset, poster, data; link кроме навигации).
function checkResources(where, html) {
  for (const [, tag, attrs = ''] of html.matchAll(
    /<(link|script|img|source|video|audio|iframe|embed|object|track)\b([^>]*)>/g,
  )) {
    if (tag === 'link') {
      const rel = /\brel="([^"]*)"/.exec(attrs)?.[1] ?? ''
      if (!/^(canonical|alternate)$/.test(rel)) {
        checkResourceUrl(where, decode(/\bhref="([^"]*)"/.exec(attrs)?.[1] ?? ''))
      }
      continue
    }
    for (const [, name, value = ''] of attrs.matchAll(/\b(src|srcset|poster|data)="([^"]*)"/g)) {
      const urls =
        name === 'srcset' ? value.split(',').map((item) => item.trim().split(/\s+/)[0]) : [value]
      for (const url of urls) checkResourceUrl(where, decode(url ?? ''))
    }
  }
  for (const [, css = ''] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g))
    checkCss(where, css)
}

// Картинки, видео и фреймы — с размерами (иначе сдвиг вёрстки); картинка над h1 — кандидат в
// LCP: грузится сразу и с приоритетом.
function checkMedia(where, body) {
  const imgs = [...body.matchAll(/<(img|video|iframe)\b[^>]*>/g)].map(([tag, name]) => ({
    tag,
    name,
  }))
  for (const { tag, name } of imgs) {
    if (!/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)) {
      const src = /\bsrc="([^"]*)"/.exec(tag)?.[1] ?? ''
      fail(where, `<${name}> без width и height: ${src}`)
    }
  }
  const lazy = (tag) => /\bloading="lazy"/.test(tag)
  const high = (tag) => /\bfetchpriority="high"/.test(tag)
  const main = body.slice(Math.max(body.indexOf('<main'), 0))
  const hero = /<img\b[^>]*>/.exec(main.slice(0, main.search(/<h1[\s>]/)))?.[0]
  if (hero && lazy(hero)) fail(where, 'картинка над h1 (кандидат в LCP) с loading="lazy"')
  if (hero && !high(hero)) fail(where, 'картинка над h1 (кандидат в LCP) без fetchpriority="high"')
  const priority = imgs.filter(({ tag }) => high(tag))
  if (priority.some(({ tag }) => lazy(tag)))
    fail(where, 'fetchpriority="high" вместе с loading="lazy"')
  if (priority.length > 2)
    fail(where, `fetchpriority="high" у ${priority.length} картинок, больше двух`)
}

// Видимые крошки — паттерн WAI-ARIA Breadcrumb: <nav> с упорядоченным списком, текущая
// страница без ссылки. Пункт — имя и корневой путь.
function visibleCrumbs(body) {
  const list = /<nav\b[^>]*>\s*<ol\b[^>]*>([\s\S]*?)<\/ol>/.exec(body)?.[1]
  if (list === undefined) return undefined
  return [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, item = '']) => {
    const link = /<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(item)
    return link
      ? { name: textOf(link[2] ?? ''), path: decode(link[1] ?? '') }
      : { name: textOf(item) }
  })
}

// Разметка = видимое: JSON-LD не добавляет фактов, которых нет на странице.
function checkMarkupVisible(where, path, body, blocks, page) {
  const visible = textOf(body)
  const times = new Set(
    [...body.matchAll(/<time\b[^>]*\bdatetime="([^"]+)"/g)].map(([, value]) => value),
  )
  const h1 = textOf(/<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(body)?.[1] ?? '')
  const tels = [...body.matchAll(/href="tel:([^"]+)"/g)].map(([, tel = '']) =>
    tel.replace(/[^\d+]/g, ''),
  )
  const crumbs = visibleCrumbs(body)
  let crumbLists = 0
  for (const data of blocks) {
    const type = data['@type']
    if (type === 'Organization' && !isLocaleHome(path)) {
      fail(where, 'JSON-LD Organization вне главной: организация размечается один раз')
    }
    if (type === 'WebSite' && path !== '/') fail(where, 'JSON-LD WebSite вне корня сайта')
    if (typeof data.headline === 'string') {
      if (data.headline !== h1)
        fail(where, `${type}.headline «${data.headline}» ≠ видимый h1 «${h1}»`)
      const id = data.mainEntityOfPage?.['@id']
      if (id !== page.canonical)
        fail(where, `${type}.mainEntityOfPage ${id} — не эта страница (${page.canonical})`)
      for (const field of ['datePublished', 'dateModified']) {
        if (data[field] !== undefined && !times.has(data[field])) {
          fail(where, `${type}.${field} ${data[field]} — нет такой <time datetime> на странице`)
        }
      }
      if (data.image !== undefined && data.image !== page.ogImage) {
        fail(where, `${type}.image ${data.image} ≠ og:image`)
      }
      if (data.inLanguage !== undefined && data.inLanguage !== page.lang) {
        fail(where, `${type}.inLanguage «${data.inLanguage}» ≠ язык страницы «${page.lang}»`)
      }
    }
    if (type === 'Organization' || type === 'LocalBusiness') {
      if (data.name && !visible.includes(data.name))
        fail(where, `${type}.name «${data.name}» не виден на странице`)
      if (data.telephone && !tels.includes(data.telephone.replace(/[^\d+]/g, ''))) {
        fail(where, `${type}.telephone «${data.telephone}» — нет ссылки tel: с этим номером`)
      }
      if (data.email && !visible.includes(data.email))
        fail(where, `${type}.email «${data.email}» не виден на странице`)
      for (const field of ['streetAddress', 'addressLocality', 'postalCode']) {
        const value = data.address?.[field]
        if (value && !visible.includes(value))
          fail(where, `${type}.address.${field} «${value}» не виден на странице`)
      }
    }
    if (type === 'BreadcrumbList') {
      crumbLists++
      // Последняя крошка — сама страница: без ссылки на экране, без item или self в разметке.
      const trail = (list) =>
        JSON.stringify(list.map((item, index) => (index < list.length - 1 ? item : item.name)))
      const items = (data.itemListElement ?? []).map((item) => ({
        name: item.name,
        ...(absolute(item.item) ? { path: pathOf(item.item) } : {}),
      }))
      if (!crumbs) fail(where, 'BreadcrumbList без видимых крошек на странице')
      else if (trail(items) !== trail(crumbs)) {
        fail(where, 'BreadcrumbList не совпадает с видимыми крошками (имена и адреса по порядку)')
      }
    }
  }
  if (crumbs && crumbLists === 0) fail(where, 'видимые крошки без BreadcrumbList')
  if (page.ogType === 'article') {
    for (const [name, time] of Object.entries(page.articleTimes)) {
      if (time !== undefined && !times.has(time))
        fail(where, `${name} ${time} — нет такой <time datetime> на странице`)
    }
  }
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

  // Тело: абсолютных URL своего сайта нет (их штамповал бы entrypoint, а переезд домена трогал бы
  // контент), скрипты — только острова политики, ресурсы — свои, у медиа — размеры.
  const body = bodyOf(html)
  if (body.includes(OWN_HOST))
    fail(where, 'плейсхолдер origin в <body>: абсолютный URL своего сайта вне <head>')
  for (const message of scriptViolations(html)) fail(where, message)
  checkResources(where, html)
  checkMedia(where, body)

  // Служебная prerendered-страница (подтверждение заявки, 500) закрыта одним noindex и не
  // печатает ни canonical, ни OG, ни hreflang: разрешающие и запрещающие директивы не
  // смешиваются. Всё остальное prerendered — индексируемое, и noindex там ошибка сборки.
  const noindex = meta('robots').some((robots) => /noindex|none/.test(robots.content ?? ''))
  if (noindex && !NOINDEX_ROUTES.includes(routeOf(path))) {
    fail(
      where,
      'noindex вне NOINDEX_ROUTES (scripts/lib/site-policy.mjs): страница выпадает из выдачи',
    )
  }
  if (meta('keywords').length > 0) fail(where, 'meta keywords не используется никогда')

  const canonicalTags = tags.filter((item) => item.tag === 'link' && item.rel === 'canonical')
  const canonical = noindex ? undefined : single(canonicalTags, 'canonical')?.href
  if (canonical !== undefined) {
    if (!absolute(canonical)) fail(where, `canonical не абсолютный: ${canonical}`)
    else if (pathOf(canonical) !== path) fail(where, `canonical ${canonical} не self (${path})`)
    else if (new URL(canonical).origin !== OWN_ORIGIN) {
      fail(
        where,
        `canonical на ${new URL(canonical).origin}, а не на плейсхолдере: сборка шла с SITE_URL`,
      )
    }
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
  const facts = { canonical, lang, ogImage: undefined, ogType: undefined, articleTimes: {} }
  if (noindex) {
    if (canonicalTags.length > 0) fail(where, 'noindex-страница с canonical')
    if (hrefs.size > 0) fail(where, 'noindex-страница с hreflang')
    if (tags.some((item) => item.property?.startsWith('og:'))) fail(where, 'noindex-страница с OG')
  } else {
    const ogType = og('og:type')
    if (ogType !== undefined && !['website', 'article'].includes(ogType))
      fail(where, `og:type «${ogType}»`)
    facts.ogType = ogType
    if (ogType === 'article') {
      facts.articleTimes = {
        'article:published_time': og('article:published_time'),
        'article:modified_time': property('article:modified_time')[0]?.content,
      }
    }
    if (og('og:title') !== title) fail(where, 'og:title не равен <title>')
    const ogDescription = og('og:description')
    if (!ogDescription) fail(where, 'og:description без content или пустой')
    else if (ogDescription !== description) fail(where, 'og:description не равен description')
    const ogUrl = og('og:url')
    if (!ogUrl) fail(where, 'og:url пуст')
    else if (ogUrl !== canonical) fail(where, 'og:url не равен canonical')
    const siteName = og('og:site_name')
    if (!siteName) fail(where, 'og:site_name пуст')
    if (title) checkSnippet(where, title, description, siteName)
    const ogLocale = og('og:locale')
    if (ogLocale !== undefined && !new RegExp(`^${locale}_[A-Z]{2}$`).test(ogLocale)) {
      fail(where, `og:locale «${ogLocale}» не соответствует локали ${locale}`)
    }
    const image = og('og:image')
    facts.ogImage = image
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

  const blocks = []
  for (const [, json] of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    let data
    try {
      // Строки разметки — в нормализации видимого текста: «разметка = видимое» не краснеет на
      // неразрывном пробеле, который textOf на странице уже сделал обычным.
      data = JSON.parse(json, (_, value) =>
        typeof value === 'string' ? normalizeSpace(value) : value,
      )
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
    blocks.push(data)
  }
  if (isLocaleHome(path)) {
    for (const type of ['Organization', ...(path === '/' ? ['WebSite'] : [])]) {
      if (!blocks.some((data) => data['@type'] === type)) fail(where, `нет JSON-LD ${type}`)
    }
  }
  checkMarkupVisible(where, path, body, blocks, facts)

  pages.set(path, { where, title, description, canonical, hrefs, noindex })
}

if (pages.size === 0) {
  console.error('seo:check: в dist/client нет ни одной страницы — сборка неполная')
  process.exit(1)
}

for (const file of walk(client).filter((path) => path.endsWith('.css'))) {
  checkCss(`dist/client/${relative(client, file).split(sep).join('/')}`, readFileSync(file, 'utf8'))
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
const draftPaths = new Set()
for (const collection of collections) {
  const dir = resolve(root, collection.dir)
  if (!existsSync(dir)) {
    fail(collection.dir, 'каталога коллекции нет — поправьте реестр scripts/lib/content.mjs')
    continue
  }
  for (const file of walk(dir).filter((name) => name.endsWith('.md'))) {
    const [locale, name] = relative(dir, file).split(sep)
    const data = load(splitFrontmatter(readFileSync(file, 'utf8')).frontmatter)
    const path = localePath(locale, collection.entryRoute(name.replace(/\.md$/, '')))
    if (data.draft === true) {
      draftPaths.add(path)
      continue
    }
    entryPaths.add(path)
    pair(`${collection.name}:${data.translationKey}`, locale, path)
  }
}
for (const [path, page] of pages) {
  // Служебные страницы hreflang не выводят: у пары noindex-страниц нечего сверять.
  if (!entryPaths.has(path) && !page.noindex) pair(`route:${routeOf(path)}`, localeOf(path), path)
}

// Сборка против источника: страница у каждой опубликованной записи и у каждого
// prerendered-маршрута src/pages — частичная сборка не проходит молча; черновика в сборке нет.
for (const path of entryPaths) {
  if (!pages.has(path)) fail(`dist/client${path}`, 'страницы нет в сборке, хотя запись не черновик')
}
for (const path of draftPaths) {
  const draft = pages.get(path)
  if (draft) fail(draft.where, 'страница черновика в сборке: черновик виден только в astro dev')
}
for (const { route, prerender, parametrized } of pageRoutes(resolve(root, 'src/pages'))) {
  if (!prerender || parametrized) continue
  // Страницы ошибок Astro пишет файлом `<код>.html`, остальные — каталогом с index.html.
  const built = pages.has(route) || existsSync(resolve(client, `.${route}.html`))
  if (!built) fail(`dist/client${route}`, 'страницы нет в сборке, хотя маршрут есть в src/pages')
}

let pairs = 0
const paired = new Set()
for (const group of groups.values()) {
  if (group.size < 2) continue
  pairs++
  for (const [, path] of group) {
    const page = pages.get(path)
    if (!page) continue
    paired.add(path)
    for (const [locale, twin] of group) {
      const href = page.hrefs.get(locale)
      if (href === undefined) fail(page.where, `нет hreflang ${locale} → ${twin}, а перевод есть`)
      else if (!absolute(href) || pathOf(href) !== twin) {
        fail(page.where, `hreflang ${locale} → ${href}, а перевод — ${twin}`)
      }
    }
  }
}
// И обратно: hreflang — только у страниц сверенных пар. Иначе перевод, которого источник не
// знает (или сверка, которая не прочитала источник), проходит молча.
for (const [path, page] of pages) {
  if (page.hrefs.size > 0 && !paired.has(path)) {
    fail(page.where, 'hreflang есть, а пары переводов в источнике нет')
  }
}

// ---------- итог ----------
if (errors.length > 0) {
  console.error(`seo:check: ${errors.length} нарушений\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.info(
  `seo:check: ${pages.size} страниц (записей ${entryPaths.size}, пар переводов ${pairs}, с hreflang ${paired.size}), title/description уникальны, JSON-LD валиден — ok`,
)
