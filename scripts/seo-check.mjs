// SEO-гейт на прод-сборке (после build) — по каждой prerendered-странице dist/client:
// - head: ровно один <title> и один <h1>, description с непустым content, self-canonical
//   абсолютным URL на плейсхолдере origin (один образ на все среды), lang по локали пути, полный
//   OG с существующей картинкой, без keywords; title и description уникальны среди всех страниц;
// - иконка сайта: первая <link rel="icon"> — PNG не мельче ICON_MIN_SIDE, файл в сборке того же
//   размера; на главных она обязательна;
// - сниппет индексируемой страницы в бюджетах и не общий; noindex (в любой форме) — только у
//   служебных маршрутов из списка политики (scripts/lib/site-policy.mjs) и у страницы тега ниже
//   порога записей (а от порога тег обязан индексироваться), и тогда без canonical, OG и hreflang;
//   og:image и hreflang — на своём origin;
// - hreflang — полный взаимный набор (self + x-default) у каждой пары переводов из источника
//   (главные, списки и теги под обоими префиксами локалей; записи — twin по translationKey) и
//   только у них;
// - JSON-LD (любой <script> этого типа, какие бы ещё атрибуты ни стояли у тега): типы из списка
//   политики, Organization/WebSite только на главной, правильный BreadcrumbList, разметка = видимое
//   (headline = h1, даты = <time>, image = og:image, mainEntityOfPage = canonical, крошки =
//   BreadcrumbList, имена и контакты организации — на странице; видимое — без поддеревьев под
//   hidden и aria-hidden); организация одна — один @id у её узлов и ссылок на неё, узел с этим @id —
//   только типов ORG_TYPES, одно имя на всю сборку, издатель сайта и записи — она; автор-человек —
//   со своим @id, подписан на странице, и имя у него на локали одно; микроданных (itemscope,
//   itemprop) нет — сущности размечает только JSON-LD;
// - тело: ни плейсхолдера origin, ни HTML-комментариев; у картинок размеры, картинка над h1 (LCP) —
//   не lazy и с fetchpriority; ресурсов с чужих origin нет (и в style=""), @font-face — с
//   font-display swap/fallback/optional (и в CSS сборки);
// - острова — по реестру проекта: исполняемый код (<script>, on*=, javascript:) — только его
//   строки, остров — на своих страницах и в бюджете (brotli: инлайн — тег, файл — модуль и всё,
//   что он импортирует), разметка острова — только вместе с ним; у строки реестра есть основание,
//   бюджет и вид — инлайн или файл;
// - сборка против источника: страница у каждой опубликованной записи и prerendered-маршрута,
//   страниц черновиков нет;
// - карта сайта sitemap.xml: ровно индексируемые страницы сборки своим self-canonical, lastmod —
//   дата последнего изменения записи из frontmatter (правка, без неё — публикация), у остальных
//   страниц его нет.
// On-demand ответы (robots.txt, /now, 404) и проштампованные карту и фиды проверяет HTTP-набор
// (`pnpm test:http`) — им нужен сервер.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { load } from 'js-yaml'
import { SITE_ORIGIN_PLACEHOLDER } from '../src/shared/config/runtime.ts'
import {
  DEFAULT_LOCALE,
  localeOf,
  localePath,
  routeOf,
  SUPPORTED_LOCALES,
} from '../src/shared/i18n/locale.ts'
import { collectionsOf, splitFrontmatter } from './lib/content.mjs'
import {
  attributesOf,
  bodyOf,
  decode,
  headTags,
  isNoindex,
  jsonLdBlocks,
  normalizeSpace,
  textOf,
} from './lib/html.mjs'
import { pageRoutes, walk } from './lib/routes.mjs'
import {
  brotliBytes,
  componentOf,
  DESCRIPTION_BUDGET,
  GENERIC_TITLE,
  ICON_MIN_SIDE,
  JSON_LD_FORBIDDEN,
  JSON_LD_TYPES,
  NOINDEX_ROUTES,
  ORG_TYPES,
  RESOURCE_ORIGINS,
  scriptsOf,
  scriptViolations,
  TAG_INDEX_MIN_POSTS,
  TITLE_BUDGET,
} from './lib/site-policy.mjs'
import { sitemapUrls } from './lib/sitemap.mjs'

// Корень проекта; другой корень — негативные фикстуры check:gate (`.gate-fixtures/<скрипт>`).
const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
const collections = await collectionsOf(root)
// Реестр островов — тоже проверяемого проекта, из его политики сборки: у сайта она отдаёт реестр
// приложения (src/shared/config/islands.ts), у мини-проекта check:gate — свой, и гейт на гейт не
// зависит от островов сайта.
const { ISLANDS: islands } = await import(
  pathToFileURL(resolve(root, 'scripts/lib/site-policy.mjs')).href
)
const client = resolve(root, 'dist/client')
if (!existsSync(client)) {
  console.error('seo:check: dist/client не найден — сначала pnpm build')
  process.exit(1)
}

const errors = []
const fail = (where, message) => {
  errors.push(`${where}: ${message}`)
}

const absolute = (value) => /^https?:\/\/[^/]+/.test(value ?? '')
const pathOf = (url) => {
  const { pathname } = new URL(url)
  return pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}
const fileInDist = (path) => {
  const file = resolve(client, `.${path}`)
  return file.startsWith(client + sep) && existsSync(file) && statSync(file).isFile()
}

const isLocaleHome = (path) =>
  SUPPORTED_LOCALES.some((locale) => path === (locale === DEFAULT_LOCALE ? '/' : `/${locale}`))

// Сторона PNG из заголовка файла (IHDR); не PNG или не квадрат — undefined.
function pngSide(path) {
  const head = readFileSync(resolve(client, `.${path}`)).subarray(0, 24)
  const png = head.length === 24 && head.readUInt32BE(0) === 0x89504e47
  const [width, height] = png ? [head.readUInt32BE(16), head.readUInt32BE(20)] : []
  return width === height ? width : undefined
}

// Какую из нескольких иконок страницы возьмёт выдача, справка Google не говорит: первой стоит
// та, что ему подходит, — растр рекомендованного размера. Остальные — браузерам (ICO, SVG) — следом.
function checkIcon(where, tags, home) {
  const icon = tags.find(
    (item) => item.tag === 'link' && (item.rel ?? '').toLowerCase().split(/\s+/).includes('icon'),
  )
  if (icon === undefined) {
    if (home)
      fail(where, 'нет <link rel="icon">: иконку сайта для выдачи поисковик берёт с главной')
    return
  }
  const href = icon.href ?? ''
  const side = Number(/^(\d+)x\1$/i.exec(icon.sizes ?? '')?.[1])
  if (icon.type !== 'image/png') {
    fail(where, `первая иконка ${href} — не PNG: SVG выдача Google не читает, ICO 32×32 ей мал`)
  } else if (!(side >= ICON_MIN_SIDE)) {
    fail(
      where,
      `первая иконка ${href}: sizes «${icon.sizes ?? ''}» — нужен квадрат от ${ICON_MIN_SIDE} px`,
    )
  } else if (!fileInDist(href)) fail(where, `первая иконка ${href}: файла нет в dist/client`)
  else if (pngSide(href) !== side) {
    fail(where, `первая иконка ${href}: файл — не PNG ${side}×${side}, как обещает sizes`)
  }
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

// Связи <link>, по которым браузер сам что-то загружает; canonical, alternate, me, author, next и
// прочие — ссылки, а не ресурсы.
const RESOURCE_LINK =
  /^(stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|manifest|icon|apple-touch-icon|mask-icon)$/i

// Ресурсы документа: что браузер скачает сам (src, srcset, poster, data; ресурсные link; CSS в
// <style> и в атрибутах style).
function checkResources(where, html) {
  for (const [, tag, attrs = ''] of html.matchAll(
    /<(link|script|img|source|video|audio|iframe|embed|object|track)\b([^>]*)>/g,
  )) {
    if (tag === 'link') {
      const rels = (/\brel="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/)
      if (rels.some((rel) => RESOURCE_LINK.test(rel))) {
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
  for (const [, css = ''] of html.matchAll(/\sstyle="([^"]*)"/g)) checkCss(where, decode(css))
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

// Сущности размечает только JSON-LD в <head>: микроданные в теле — вторая разметка мимо правил
// сущности. Смотрятся имена атрибутов: слово в тексте или в значении атрибута — не разметка.
const MICRODATA = ['itemscope', 'itemtype', 'itemprop']
function checkMicrodata(where, html) {
  const found = new Set()
  for (const [, attrs = ''] of html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .matchAll(/<[a-z][\w:-]*\b([^>]*)>/gi)) {
    for (const name of attributesOf(attrs).keys()) if (MICRODATA.includes(name)) found.add(name)
  }
  if (found.size > 0) {
    fail(
      where,
      `микроданные в разметке (${[...found].join(', ')}): сущности размечает только JSON-LD в <head>`,
    )
  }
}

// Видимые крошки — паттерн WAI-ARIA Breadcrumb: <nav> с упорядоченным списком, последний пункт —
// текущая страница с aria-current="page" без ссылки. Оглавление (текущего пункта нет) и
// нумерованная пагинация (в пунктах ни слова — номера, «…», стрелки) в <nav><ol> — не крошки.
// Пункт — имя и корневой путь.
function visibleCrumbs(body) {
  const list = [...body.matchAll(/<nav\b[^>]*>\s*<ol\b[^>]*>([\s\S]*?)<\/ol>/g)]
    .map(([, items = '']) => items)
    .find(
      (items) =>
        /\baria-current="page"/.test(items.slice(items.lastIndexOf('<li'))) &&
        /\p{L}/u.test(textOf(items)),
    )
  if (list === undefined) return undefined
  return [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, item = '']) => {
    const link = /<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(item)
    return link
      ? { name: textOf(link[2] ?? ''), path: decode(link[1] ?? '') }
      : { name: textOf(item) }
  })
}

// Сущности разметки — одни на сайт, где бы в блоке ни стоял узел или ссылка. Организация (типы
// ORG_TYPES политики) — с одним @id, сайт и запись называют её издателем; имена собираются со всей
// сборки: второе имя — вторая сущность для поисковика. Автор-человек — со своим @id; его имя и
// роль видны на странице (подпись), и у одного @id на одной локали имя одно.
const ORG_ID = `${OWN_ORIGIN}/#org`
const WEBSITE_ID = `${OWN_ORIGIN}/#website`
const orgNames = new Map()
const personNames = new Map()

function checkPerson(where, label, node, { lang, visible }) {
  const id = node['@id']
  if (typeof id !== 'string' || !id.startsWith(`${OWN_ORIGIN}/`)) {
    fail(where, `${label}: Person без своего @id на своём origin (${id ?? 'нет'})`)
    return
  }
  for (const field of ['name', 'jobTitle']) {
    if (node[field] && !visible.includes(node[field])) {
      fail(
        where,
        `${label}: Person.${field} «${node[field]}» не виден — автор в разметке подписан на странице`,
      )
    }
  }
  const key = `${id} ${lang}`
  const known = personNames.get(key)
  if (known === undefined) personNames.set(key, { name: node.name, where })
  else if (known.name !== node.name) {
    fail(
      where,
      `${label}: у автора ${id} здесь имя «${node.name}», а в ${known.where} — «${known.name}»`,
    )
  }
}

function checkEntities(where, blocks, page) {
  const visit = (node, label) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, label)
    } else if (node !== null && typeof node === 'object') {
      if (ORG_TYPES.includes(node['@type'])) {
        if (node['@id'] !== ORG_ID) {
          fail(
            where,
            `${label}: @id ${node['@id'] ?? 'нет'} — у организации сайта он один: ${ORG_ID}`,
          )
        }
        if (node.name && !orgNames.has(node.name)) orgNames.set(node.name, where)
      } else if (node['@id'] === ORG_ID) {
        // Подтип (Dentist) с @id организации мимо списка типов выпал бы из всех правил сущности.
        fail(
          where,
          `${label}: узел с @id организации типа «${node['@type']}» вне ORG_TYPES (scripts/lib/site-policy.mjs)`,
        )
      }
      if (node['@type'] === 'Person') checkPerson(where, label, node, page)
      for (const [key, value] of Object.entries(node)) visit(value, `${label}.${key}`)
    }
  }
  for (const data of blocks) {
    const type = data['@type']
    visit(data, type)
    if (type === 'WebSite' && data['@id'] !== WEBSITE_ID) {
      fail(where, `WebSite: @id ${data['@id'] ?? 'нет'}, а не ${WEBSITE_ID}`)
    }
    const published = type === 'WebSite' || typeof data.headline === 'string'
    if (published && !ORG_TYPES.includes(data.publisher?.['@type'])) {
      fail(
        where,
        `${type}.publisher — не Organization: издатель сайта и записи — организация по @id`,
      )
    }
  }
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
    if (ORG_TYPES.includes(type)) {
      for (const field of ['name', 'legalName', 'email']) {
        if (data[field] && !visible.includes(data[field]))
          fail(where, `${type}.${field} «${data[field]}» не виден на странице`)
      }
      if (data.telephone && !tels.includes(data.telephone.replace(/[^\d+]/g, ''))) {
        fail(where, `${type}.telephone «${data.telephone}» — нет ссылки tel: с этим номером`)
      }
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
// Остров — решение с основанием и ценой: строка реестра без них — код без решения.
for (const [name, island] of Object.entries(islands)) {
  const where = `ISLANDS.${name} (src/shared/config/islands.ts)`
  if (typeof island.basis !== 'string' || island.basis.trim() === '') {
    fail(where, 'нет основания (basis): момент спецификации движения или плана страницы')
  }
  if (!Number.isInteger(island.budget) || island.budget <= 0) {
    fail(where, 'нет бюджета (budget): вес в brotli, байт')
  }
  if ((island.hash === undefined) === (island.file === undefined)) {
    fail(where, 'остров — инлайн (hash) или файл (file): ровно одно из двух')
  }
}

// Вес острова — то, что страница грузит ради него: инлайн — тег целиком, файл — модуль и всё, что
// он импортирует сразу или отложенно (имена модулей сборки в его тексте).
const modules = new Map(
  walk(client)
    .filter((file) => file.endsWith('.js'))
    .map((file) => [basename(file), file]),
)
// Остров-файл узнаётся по имени компонента в имени модуля: второй модуль с тем же именем — одноимённый
// компонент со скриптом или второй <script> — прошёл бы островом.
for (const [name, island] of Object.entries(islands)) {
  const component = island.file?.split('/').at(-1)
  if (component === undefined) continue
  const named = [...modules.keys()].filter(
    (module) => componentOf(`/_astro/${module}`) === component,
  )
  if (named.length > 1) {
    fail(
      `ISLANDS.${name} (src/shared/config/islands.ts)`,
      `модулей компонента ${component} в сборке ${named.length}: у острова-файла он один — одноимённый компонент со скриптом или второй <script> прошёл бы островом`,
    )
  }
}

function loadOf({ tag, src }) {
  if (src === undefined) return { weight: brotliBytes(tag), imports: [] }
  const graph = new Set()
  const queue = [basename(src)]
  for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
    if (graph.has(name) || !modules.has(name)) continue
    graph.add(name)
    const code = readFileSync(modules.get(name), 'utf8')
    queue.push(...[...modules.keys()].filter((other) => code.includes(other)))
  }
  const [, ...imports] = graph
  return {
    weight: [...graph].reduce((sum, name) => sum + brotliBytes(readFileSync(modules.get(name))), 0),
    imports,
  }
}
const weighed = new Set()

// Страница сборки — каталог с index.html или страница ошибки `<код>.html` в корне (её Astro
// пишет файлом, адаптер отдаёт при сбое рендера).
const isPage = (rel) => rel.endsWith('index.html') || /^\d{3}\.html$/.test(rel)
const pages = new Map()
for (const file of walk(client)) {
  const rel = relative(client, file).split(sep).join('/')
  if (!isPage(rel)) continue
  const path = `/${rel.replace(/\/?index\.html$/, '').replace(/\.html$/, '')}`
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
  for (const message of scriptViolations(html, path, islands)) fail(where, message)
  for (const script of scriptsOf(html, islands)) {
    const island = islands[script.island]
    if (island === undefined || weighed.has(script.src ?? script.tag)) continue
    weighed.add(script.src ?? script.tag)
    const { weight, imports } = loadOf(script)
    if (weight > island.budget) {
      fail(
        where,
        `остров ${script.island}: ${weight} Б в brotli, бюджет ${island.budget}${imports.length > 0 ? ` — с импортами ${imports.join(', ')}` : ''}`,
      )
    }
  }
  checkResources(where, html)
  checkMedia(where, body)
  checkMicrodata(where, html)

  // Закрытая страница — один noindex, без canonical, OG и hreflang: разрешающие и запрещающие
  // директивы не смешиваются. Кому noindex положен, решается ниже, когда прочитан источник.
  const noindex = isNoindex(tags)
  if (meta('keywords').length > 0) fail(where, 'meta keywords не используется никогда')
  checkIcon(where, tags, isLocaleHome(path))

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
      else if (new URL(href).origin !== OWN_ORIGIN) {
        fail(where, `hreflang ${hreflang} на чужом origin: ${href}`)
      }
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
      else if (new URL(image).origin !== OWN_ORIGIN) {
        fail(where, `og:image на чужом origin: ${image}`)
      } else if (!fileInDist(new URL(image).pathname))
        fail(where, `og:image ${new URL(image).pathname} нет в dist/client`)
    }
    for (const side of ['og:image:width', 'og:image:height']) {
      if (!/^[1-9]\d*$/.test(og(side) ?? '')) fail(where, `${side} не целое число`)
    }
    if (!og('og:image:alt')) fail(where, 'og:image:alt пуст')
    if (!meta('twitter:card')[0]?.content) fail(where, 'twitter:card отсутствует')
  }

  const blocks = []
  for (const json of jsonLdBlocks(html)) {
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
    if (!JSON_LD_TYPES.includes(data['@type'])) {
      fail(
        where,
        `JSON-LD @type «${data['@type']}» вне JSON_LD_TYPES (scripts/lib/site-policy.mjs)`,
      )
    }
    for (const forbidden of JSON_LD_FORBIDDEN) {
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
  checkEntities(where, blocks, { lang, visible: textOf(body) })

  pages.set(path, { where, title, description, canonical, hrefs, noindex })
}

if (pages.size === 0) {
  console.error('seo:check: в dist/client нет ни одной страницы — сборка неполная')
  process.exit(1)
}

for (const file of walk(client).filter((path) => path.endsWith('.css'))) {
  checkCss(`dist/client/${relative(client, file).split(sep).join('/')}`, readFileSync(file, 'utf8'))
}

// ---------- между страницами: имя организации, уникальность сниппета, hreflang ----------
if (orgNames.size > 1) {
  const names = [...orgNames].map(([name, where]) => `«${name}» (${where})`).join(', ')
  fail(
    'dist/client',
    `у организации несколько имён в JSON-LD: ${names} — имя одно, бренд; юрлицо — в legalName`,
  )
}

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
// Страницы тегов коллекций: адрес → число опубликованных записей локали с этим тегом.
const tagPosts = new Map()
// Дата последнего изменения записи — правка, без неё публикация: ею карта сайта датирует страницу.
const entryDates = new Map()
const day = (date) => new Date(date).toISOString().slice(0, 10)
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
    const changed = data.updatedDate ?? data.pubDate
    if (changed !== undefined) entryDates.set(path, day(changed))
    for (const tag of collection.tagRoute ? (data.tags ?? []) : []) {
      const tagPath = localePath(locale, collection.tagRoute(tag))
      tagPosts.set(tagPath, (tagPosts.get(tagPath) ?? 0) + 1)
    }
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
  // Страницы ошибок Astro пишет файлом `<код>.html`, prerendered-эндпоинт (`feed.json.ts`) — самим
  // файлом, остальные — каталогом с index.html.
  const built = pages.has(route) || fileInDist(`${route}.html`) || fileInDist(route)
  if (!built) fail(`dist/client${route}`, 'страницы нет в сборке, хотя маршрут есть в src/pages')
}

// ---------- кому положен noindex ----------
// Prerendered-страница индексируется; noindex — у служебных маршрутов из списка политики и у
// тонкой страницы тега: ниже порога записей она почти повторяет список. Порог — в обе стороны:
// тонкий тег в индексе и закрытый тег от порога — оба нарушения.
for (const [path, page] of pages) {
  const posts = tagPosts.get(path)
  if (posts === undefined) {
    if (page.noindex && !NOINDEX_ROUTES.includes(routeOf(path))) {
      fail(
        page.where,
        'noindex вне NOINDEX_ROUTES (scripts/lib/site-policy.mjs): страница выпадает из выдачи',
      )
    }
  } else if (posts < TAG_INDEX_MIN_POSTS && !page.noindex) {
    fail(
      page.where,
      `тег с ${posts} записями индексируется, а порог — ${TAG_INDEX_MIN_POSTS} (TAG_INDEX_MIN_POSTS): тонкой странице нужен noindex`,
    )
  } else if (posts >= TAG_INDEX_MIN_POSTS && page.noindex) {
    fail(
      page.where,
      `тег с ${posts} записями закрыт noindex, а порог индексации — ${TAG_INDEX_MIN_POSTS} (TAG_INDEX_MIN_POSTS)`,
    )
  }
}

// ---------- карта сайта ----------
// Карта — файл сборки (scripts/lib/sitemap.mjs): в ней ровно индексируемые страницы — те, что без
// noindex, — своим адресом на плейсхолдере origin; lastmod — дата последнего изменения записи из
// источника, у страницы вне коллекций его нет. Адрес считается от пути страницы, а не от её
// canonical: генератор и проверка сходятся только на self-canonical.
const sitemap = 'dist/client/sitemap.xml'
if (!fileInDist('/sitemap.xml')) fail(sitemap, 'карты сайта нет в сборке')
else {
  const listed = new Map()
  for (const { loc, lastmod } of sitemapUrls(
    readFileSync(resolve(client, 'sitemap.xml'), 'utf8'),
  )) {
    if (listed.has(loc)) fail(sitemap, `${loc} — в карте дважды`)
    listed.set(loc, lastmod)
  }
  const own = new Set()
  for (const [path, page] of pages) {
    const url = `${OWN_ORIGIN}${path}`
    own.add(url)
    if (page.noindex) {
      if (listed.has(url)) fail(page.where, 'noindex-страница в карте сайта')
    } else if (!listed.has(url)) {
      fail(page.where, 'индексируемой страницы нет в карте сайта: адрес карты — её self-canonical')
    } else if (listed.get(url) !== entryDates.get(path)) {
      fail(
        sitemap,
        `${url}: lastmod ${listed.get(url) ?? 'нет'}, а дата последнего изменения по источнику — ${entryDates.get(path) ?? 'нет: страница не запись коллекции'}`,
      )
    }
  }
  for (const url of listed.keys()) {
    if (!own.has(url)) fail(sitemap, `${url} — в карте адрес без страницы сборки`)
  }
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
