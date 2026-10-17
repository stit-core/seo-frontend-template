// SEO-гейт на прод-сборке (после build) — по каждой prerendered-странице dist/client:
// - head: ровно один <title> и один <h1>, description с непустым content, self-canonical
//   абсолютным URL на плейсхолдере origin (один образ на все среды), lang по локали пути, полный
//   OG с существующей картинкой — файлом превью ссылки по норме OG_IMAGE (размер, формат, вес), без
//   keywords; title и description уникальны среди всех страниц; мета — copy deck страницы плана на её
//   языке (у записи — frontmatter), тексты превью ссылки — свои у copy deck или заголовок и описание;
// - иконка сайта: первая <link rel="icon"> — PNG не мельче ICON_MIN_SIDE, файл в сборке того же
//   размера; на главных она обязательна;
// - сниппет индексируемой страницы в бюджетах и не общий; noindex (в любой форме) — только у
//   служебных маршрутов из списка политики (scripts/lib/site-policy.mjs) и у страницы тега ниже
//   порога записей (а от порога тег обязан индексироваться), и тогда без canonical, OG и hreflang;
//   og:image и hreflang — на своём origin;
// - hreflang — полный взаимный набор (self + x-default) у каждой пары переводов из источника
//   (главные, списки и теги под префиксами локалей; записи — twin по translationKey) и только у
//   них; язык адреса и og:locale — по локалям проверяемого проекта;
// - JSON-LD (любой <script> этого типа, какие бы ещё атрибуты ни стояли у тега): типы — ровно
//   `seo.structured_data` плана страницы (снимок strategy проекта), план — в границах head-kit своего
//   типа страницы, у страницы без плана разметки нет; правильный BreadcrumbList, разметка = видимое
//   (headline = h1, даты = <time>, image — кадры 16:9, 4:3 и 1:1 мастера og:image, mainEntityOfPage =
//   canonical, крошки = BreadcrumbList, имена и контакты организации — на странице; видимое — без
//   поддеревьев под hidden и aria-hidden); организация одна — один @id у её узлов и ссылок на неё,
//   узел с этим @id — только типов ORG_TYPES, одно имя на всю сборку, издатель сайта и записи — она, чужая
//   организация (место работы автора, партнёр) — не её узел; автор-человек — со своим @id, подписан на
//   странице, подпись — его Person, имя у него на локали одно, а @id у человека — один; даты страницы
//   — только у записи коллекции и по её источнику; микроданных (itemscope, itemprop) нет — сущности
//   размечает только JSON-LD;
// - тело: ни плейсхолдера origin, ни HTML-комментариев; у картинок размеры, картинка над h1 (LCP) —
//   не lazy и с fetchpriority; фолбэк <picture> — не PNG-производная мастера; источник <source media>
//   другой пропорции — со своими размерами, и он достижим; ролик — с постером, по кнопке — preload none или metadata, с автозапуском —
//   ленивый, preload="none" и только под условием движения, над h1 (первый экран) — с preload постера и
//   fetchpriority;
//   ресурсов с чужих origin и data:-адресов нет (и в style="", и в CSS сборки): CSP их не пропустит;
//   @font-face — с font-display swap/fallback/optional;
// - шрифты — Fonts API по списку проекта: @font-face — семейства списка в <style> страницы (в CSS
//   сборки его нет), preload шрифтов — не больше FONT_PRELOAD_MAX;
// - острова — по реестру проекта: исполняемый код (<script>, on*=, javascript:) — только его
//   строки, остров — на своих страницах и в бюджете (brotli: инлайн — тег, файл — модуль и всё,
//   что он импортирует), разметка острова — только вместе с ним; у строки реестра есть основание,
//   бюджет и вид — инлайн или файл;
// - сборка против источника: страница у каждой опубликованной записи и prerendered-маршрута
//   (маршрута локалей — хоть на одной локали), страниц черновиков нет;
// - рантайм образа (dist/server и docker/*.mjs) импортирует ровно dependencies: пакета вне них,
//   зависимости без импорта и имени модуля, которого не прочесть, нет; серверный бандл — без
//   конвейера картинок Astro: модуля с импортом sharp в нём нет; данные страниц strategy в нём —
//   только страниц, которые читают модулем on-demand маршруты, а не снимок целиком;
// - карта сайта sitemap.xml: ровно индексируемые страницы сборки своим self-canonical, lastmod —
//   дата последнего изменения записи из frontmatter (правка, без неё — публикация), у остальных
//   страниц его нет.
// On-demand ответы (robots.txt, 404, ответ формы) и проштампованные карту и фиды проверяет HTTP-набор
// (`pnpm test:http`) — им нужен сервер.
import { existsSync, globSync, readFileSync, statSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { load } from 'js-yaml'
import sharp from 'sharp'
import ts from 'typescript'
import { SITE_ORIGIN_PLACEHOLDER } from '../src/shared/config/runtime.ts'
import { localeRules } from '../src/shared/i18n/locale.ts'
import {
  deckPageOf,
  HeadKitSchema,
  headKitTypes,
  pageAt,
  parseFile,
  projectOf,
} from '../src/shared/strategy/contract.ts'
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
  withoutHidden,
} from './lib/html.mjs'
import { localizedRoute, pageRoutes, routePattern, walk } from './lib/routes.mjs'
import {
  ARTICLE_IMAGE_RATIOS,
  brotliBytes,
  componentOf,
  DESCRIPTION_BUDGET,
  FONT_PRELOAD_MAX,
  GENERIC_TITLE,
  ICON_MIN_SIDE,
  NOINDEX_ROUTES,
  OG_IMAGE,
  ORG_TYPES,
  RESOURCE_ORIGINS,
  scriptsOf,
  scriptViolations,
  TAG_INDEX_MIN_POSTS,
  TITLE_BUDGET,
} from './lib/site-policy.mjs'
import { pageDateOf, sitemapUrls } from './lib/sitemap.mjs'

// Корень проекта; другой корень — негативные фикстуры check:gate (`.gate-fixtures/<скрипт>`).
const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
const collections = await collectionsOf(root)
// Реестр островов, список шрифтов и локали — тоже проверяемого проекта, из его политики сборки: у сайта
// она отдаёт данные приложения (src/shared/config/islands.ts, src/app/styles/fonts.ts,
// src/shared/i18n/locale.ts), у мини-проекта check:gate — свои, и гейт на гейт не зависит от островов,
// шрифтов и локалей сайта.
const {
  ISLANDS: islands,
  FONTS: fonts,
  LOCALES: locales,
  SITE_NAME: siteName,
} = await import(pathToFileURL(resolve(root, 'scripts/lib/site-policy.mjs')).href)
const { SUPPORTED_LOCALES, localeInfo, localeOf, localeParam, localePath, routeOf } =
  localeRules(locales)
// Сегменты `[...locale]` маршрутов — коды локалей с префиксом адреса (все, кроме дефолтной).
const LOCALE_PREFIXES = SUPPORTED_LOCALES.flatMap((locale) => localeParam(locale) ?? [])
const client = resolve(root, 'dist/client')
if (!existsSync(client)) {
  console.error('seo:check: dist/client не найден — сначала pnpm build')
  process.exit(1)
}

// Снимок strategy проверяемого проекта (`strategy/`): карта, планы и copy deck поверхности — схемами и правилами модуля
// контракта, как их читает сборка; head-kit — копия каталога базы. У мини-проекта check:gate снимок свой.
const snapshot = resolve(root, 'strategy')
const HEAD_KIT = 'kb/site/07-seo-geo-performance-analytics/head-kit.yaml'
if (!existsSync(resolve(snapshot, HEAD_KIT))) {
  console.error(`seo:check: нет strategy/${HEAD_KIT} — снимок strategy проекта неполный`)
  process.exit(1)
}
const snapshotFile = (path) => load(readFileSync(resolve(snapshot, path), 'utf8'))
const snapshotFiles = Object.fromEntries(
  globSync(['site/*/site-map.yaml', 'site/*/plans/*.yaml', 'site/*/copy/*.yaml'], {
    cwd: snapshot,
  })
    .sort()
    .map((path) => [path, snapshotFile(path)]),
)
const project = projectOf(snapshotFiles)
const headKit = parseFile(HeadKitSchema, snapshotFile(HEAD_KIT), HEAD_KIT)
const plans = new Map(project.plans.map((plan) => [plan.page.id, plan]))
// Файл плана в снимке — место нарушения плана.
const planFiles = new Map(
  Object.entries(snapshotFiles)
    .filter(([path]) => path.includes('/plans/'))
    .map(([path, data]) => [data.page.id, `strategy/${path}`]),
)

// Картинки сборки — размеры, формат и вес из самих файлов: с ними сверяются превью ссылки и кадры
// разметки, а не с обещанием мета-тегов. Файл, который не читается как картинка, в карте отсутствует.
const images = new Map()
for (const file of walk(client).filter((path) => /\.(png|jpe?g|webp|avif|gif)$/i.test(path))) {
  const meta = await sharp(file)
    .metadata()
    .catch(() => undefined)
  if (meta === undefined) continue
  images.set(`/${relative(client, file).split(sep).join('/')}`, {
    width: meta.width,
    height: meta.height,
    format: meta.format === 'heif' ? 'avif' : meta.format,
    bytes: statSync(file).size,
  })
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

const isLocaleHome = (path) => SUPPORTED_LOCALES.some((locale) => path === localePath(locale, '/'))

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
// Шрифт подключает Fonts API по строке списка: `@font-face` он печатает в <style> страницы под именем
// семейства списка с хешем сборки (`"Golos Text-1a2b…"`), метрический фолбэк — `"… fallback: Arial"`.
const FONT_FAMILIES = new Set(fonts.map(({ family }) => family))
const listedFamilyOf = (name) => /^(.+)-[\da-f]+(?: fallback: .+)?$/.exec(name)?.[1]

// Текст меты и её источник сравниваются в одной нормализации пробелов: неразрывный пробел типографики — пробел.
const sameText = (text, source) =>
  text !== undefined && source !== undefined && normalizeSpace(text) === normalizeSpace(source)

// Сниппет выдачи: title — мета copy deck как есть, бренд в нём пишет strategy («Контакты Бренда — Москва», «Блог —
// Бренд»). Длина — у заголовка целиком: его режет строка выдачи; «общий» и «меньше трёх слов» — о словах самой
// страницы, без имени сайта и разделителя рядом с ним.
function checkSnippet(where, title, description, siteName) {
  const core = siteName
    ? title
        .split(siteName)
        .join(' ')
        .replace(/^[\s|:—–-]+|[\s|:—–-]+$/g, '')
    : title
  const words = core.match(/[\p{L}\p{N}]+/gu)?.length ?? 0
  if (GENERIC_TITLE.test(core)) fail(where, `title «${core}» — общий: поисковик заменит его сам`)
  else if (words < TITLE_BUDGET.minWords) {
    fail(where, `title «${core}» — меньше ${TITLE_BUDGET.minWords} слов`)
  }
  const chars = [...title].length
  if (chars > TITLE_BUDGET.maxChars) {
    fail(where, `title — ${chars} знаков, бюджет ${TITLE_BUDGET.maxChars}`)
  }
  const length = [...(description ?? '')].length
  const { minChars, maxChars } = DESCRIPTION_BUDGET
  if (description && (length < minChars || length > maxChars)) {
    fail(where, `description — ${length} знаков, бюджет ${minChars}–${maxChars}`)
  }
}

// Шрифты, стили, скрипты и картинки грузятся со своего сайта: чужой origin — только из списка политики,
// data:-адрес — никогда. CSP сайта пропускает в директивах загрузки только свой сайт и origin из списка,
// и встроенный ресурс браузер не покажет.
function checkResourceUrl(where, url) {
  if (/^\s*data:/i.test(url)) {
    fail(
      where,
      `data:-адрес ресурса — CSP сайта его не пропустит, ресурс — файлом: ${url.slice(0, 40)}`,
    )
    return
  }
  if (!/^(https?:)?\/\//.test(url)) return
  const { origin } = new URL(url, OWN_ORIGIN)
  if (origin !== OWN_ORIGIN && !RESOURCE_ORIGINS.includes(origin)) {
    fail(where, `ресурс с чужого origin ${origin} вне RESOURCE_ORIGINS: ${url}`)
  }
}

// CSS сборки и инлайн-<style>: чужие ресурсы и шрифты — мимо списка и невидимые до загрузки.
// `@font-face` законен только в <style> страницы (`page`): CSS сборки Fonts API не трогает.
function checkCss(where, css, page = false) {
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
    const [, quoted, bare] = /font-family\s*:\s*(?:"([^"]*)"|([^;}]*))/.exec(block) ?? []
    const name = (quoted ?? bare ?? '').trim()
    if (!page || !FONT_FAMILIES.has(listedFamilyOf(name))) {
      fail(
        where,
        `@font-face ${name}: шрифт мимо списка src/app/styles/fonts.ts — его подключает Fonts API по строке списка`,
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
      const href = decode(/\bhref="([^"]*)"/.exec(attrs)?.[1] ?? '')
      if (rels.some((rel) => RESOURCE_LINK.test(rel))) checkResourceUrl(where, href)
      continue
    }
    for (const [, name, value = ''] of attrs.matchAll(/\b(src|srcset|poster|data)="([^"]*)"/g)) {
      const urls =
        name === 'srcset' ? value.split(',').map((item) => item.trim().split(/\s+/)[0]) : [value]
      for (const url of urls) checkResourceUrl(where, decode(url ?? ''))
    }
  }
  const blocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(([, css = '']) => css)
  const attributes = [...html.matchAll(/\sstyle="([^"]*)"/g)].map(([, css = '']) => decode(css))
  for (const css of blocks) checkCss(where, css, true)
  for (const css of attributes) checkCss(where, css)
}

// Картинки, видео и фреймы — с размерами (иначе сдвиг вёрстки); картинка над h1 — кандидат в
// LCP: грузится сразу и с приоритетом.
function checkMedia(where, html, body) {
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
  checkPictures(where, body)
  checkVideos(where, html)
}

// Источник с условием `media` — кадр под окно или вариант (тёмная тема). Браузер берёт первый подходящий
// источник: за источником без `media` источник того же типа недостижим — он перекрывает следующий.
function checkPictures(where, body) {
  for (const [, inner = ''] of body.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/g)) {
    const img = attributesOf(/<img\b([^>]*)>/.exec(inner)?.[1] ?? '')
    // Фолбэк <img> берут браузер без AVIF и поиск по картинкам. Сборка перекодирует мастер в формат фолбэка:
    // PNG фото в разы тяжелее WebP. Файл как есть (public/, плоская схема в PNG) — выбор автора.
    const fallback = img.get('src') ?? ''
    if (/\.png$/i.test(fallback) && derived(fallback)) {
      fail(where, `<picture>: фолбэк <img> — PNG-производная мастера, а не WebP: ${fallback}`)
    }
    const ratio = Number(img.get('width')) / Number(img.get('height'))
    const covered = new Set()
    for (const [, attrs = ''] of inner.matchAll(/<source\b([^>]*)>/g)) {
      const source = attributesOf(attrs)
      const type = source.get('type') ?? ''
      const srcset = source.get('srcset') ?? ''
      if (covered.has('') || covered.has(type)) {
        fail(
          where,
          `<source> ${type} недостижим: перед ним источник того же типа без media — ${srcset}`,
        )
      }
      if (!source.has('media')) covered.add(type)
      else if (!source.has('width') || !source.has('height')) {
        // Без своих размеров место под источником резервирует <img>: годится только кадр той же пропорции
        // (вариант для тёмной темы), другой — кадр под окно — растянет бокс, когда придёт файл.
        const file = images.get(decode(srcset.split(',')[0]?.trim().split(/\s+/)[0] ?? ''))
        if (!(file && Math.abs(file.width / file.height / ratio - 1) < 0.01)) {
          fail(
            where,
            `<source media> без width и height — кадр другой пропорции, чем <img>: ${srcset}`,
          )
        }
      }
    }
  }
}

// Ролик: постер — кадр до загрузки. Ролик по кнопке до запуска качает самое большее метаданные. Автозапуск
// сильнее preload: запущенный ролик качается целиком, — поэтому ролик с автозапуском ленивый (браузер
// запускает его у экрана, остров к тому времени снимает автозапуск при «меньше»), с `preload="none"` (снятый
// автозапуск оставляет его ждать, не качаясь) и только при разрешённом движении: у каждого источника условие
// prefers-reduced-motion: no-preference, у самого <video> адреса нет, — при сокращённом движении браузер не
// выбирает ни одного. Над h1 (между началом <main> и h1) — первый экран: постер, кандидат в LCP, грузится с
// приоритетом — preload.
function checkVideos(where, html) {
  const preloaded = new Set(
    [...html.matchAll(/<link\b([^>]*)>/g)]
      .map(([, tag = '']) => attributesOf(tag))
      .filter(
        (link) =>
          link.get('rel') === 'preload' &&
          link.get('as') === 'image' &&
          link.get('fetchpriority') === 'high',
      )
      .map((link) => link.get('href')),
  )
  const body = bodyOf(html)
  const mainAt = body.indexOf('<main')
  const h1At = mainAt < 0 ? -1 : body.slice(mainAt).search(/<h1[\s>]/) + mainAt
  for (const match of body.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/g)) {
    const [, attrs = '', inner = ''] = match
    const video = attributesOf(attrs)
    const sources = [...inner.matchAll(/<source\b([^>]*)>/g)].map(([, tag = '']) =>
      attributesOf(tag),
    )
    const name = video.get('src') ?? sources[0]?.get('src') ?? ''
    const preload = video.get('preload') ?? 'по умолчанию'
    if (!video.get('poster'))
      fail(where, `<video> без poster: первый экран ждёт кадр ролика — ${name}`)
    if (!video.has('autoplay')) {
      if (!['none', 'metadata'].includes(preload)) {
        fail(
          where,
          `<video> без автозапуска с preload ${preload}: до запуска — none или metadata, не сам ролик — ${name}`,
        )
      }
      continue
    }
    if (preload !== 'none') {
      fail(
        where,
        `<video autoplay> без preload="none": ролик со снятым автозапуском («меньше») качался бы — ${name}`,
      )
    }
    const firstScreen = match.index > mainAt && match.index < h1At
    if (firstScreen && !preloaded.has(video.get('poster'))) {
      fail(
        where,
        `<video autoplay> над h1 (первый экран) без preload постера с fetchpriority="high": постер — кандидат в LCP — ${name}`,
      )
    }
    if (video.get('loading') !== 'lazy') {
      fail(
        where,
        `<video autoplay> без loading="lazy": запущенный ролик качается целиком с загрузки страницы, где бы ни стоял — ${name}`,
      )
    }
    const ungated =
      video.has('src') ||
      sources.some(
        (source) => !/prefers-reduced-motion:\s*no-preference/.test(source.get('media') ?? ''),
      )
    if (ungated) {
      fail(
        where,
        `<video autoplay> качается при сокращённом движении: источник без условия prefers-reduced-motion: no-preference — ${name}`,
      )
    }
  }
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

// Сущности разметки — одни на сайт, где бы в блоке ни стоял узел или ссылка. Организация сайта (типы ORG_TYPES
// политики) — с одним @id, сайт и запись называют её издателем; имена собираются со всей сборки: второе имя — вторая
// сущность для поисковика. Автор-человек — со своим @id; его имя и роль видны на странице, подпись автора — его узел в
// разметке, у одного @id на одной локали имя одно, а у одного человека — один @id на весь сайт.
const ORG_ID = `${OWN_ORIGIN}/#org`
const WEBSITE_ID = `${OWN_ORIGIN}/#website`
const ownId = (id) => typeof id === 'string' && id.startsWith(`${OWN_ORIGIN}/`)
const orgNames = new Map()
const personNames = new Map()
// Человек по имени на языке и по адресу профиля → его @id и где он впервые встретился.
const personIds = new Map()

function checkPerson(where, label, node, { lang, visible }) {
  const id = node['@id']
  if (!ownId(id)) {
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
  // Один человек — один @id: тот же человек — то же имя на языке страницы или тот же профиль на любой локали.
  for (const [by, value] of [
    [`имени «${node.name}» на ${lang}`, node.name && `${lang} ${node.name}`],
    [`профиля ${node.url}`, node.url],
  ]) {
    if (!value) continue
    const seen = personIds.get(value)
    if (seen === undefined) personIds.set(value, { id, where })
    else if (seen.id !== id) {
      fail(
        where,
        `${label}: у ${by} второй @id ${id}, в ${seen.where} — ${seen.id}: один человек — один @id`,
      )
    }
  }
}

// Подпись автора — ссылка rel="author" в видимом теле страницы: имя и адрес профиля.
const bylinesOf = (body) =>
  [...withoutHidden(body).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].flatMap(
    ([, attrs = '', inner = '']) => {
      const link = attributesOf(attrs)
      return (link.get('rel') ?? '').toLowerCase().split(/\s+/).includes('author')
        ? [{ name: textOf(inner), href: decode(link.get('href') ?? '') }]
        : []
    },
  )

function checkEntities(where, blocks, page) {
  const persons = []
  const visit = (node, label, block) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, label, false)
    } else if (node !== null && typeof node === 'object') {
      if (ORG_TYPES.includes(node['@type'])) {
        // Узел организации сайта — блок типа организации, узел с @id на своём origin или с именем сайта. Чужая
        // организация (место работы автора, партнёр) — не узел сайта: правила организации её не судят.
        if (block || ownId(node['@id']) || node.name === siteName) {
          if (node['@id'] !== ORG_ID) {
            fail(
              where,
              `${label}: @id ${node['@id'] ?? 'нет'} — у организации сайта он один: ${ORG_ID}`,
            )
          }
          if (node.name && !orgNames.has(node.name)) orgNames.set(node.name, where)
        }
      } else if (node['@id'] === ORG_ID) {
        // Подтип (Dentist) с @id организации мимо списка типов выпал бы из всех правил сущности.
        fail(
          where,
          `${label}: узел с @id организации типа «${node['@type']}» вне ORG_TYPES (scripts/lib/site-policy.mjs)`,
        )
      }
      if (node['@type'] === 'Person') {
        checkPerson(where, label, node, page)
        persons.push(node)
      }
      for (const [key, value] of Object.entries(node)) visit(value, `${label}.${key}`, false)
    }
  }
  for (const data of blocks) {
    const type = data['@type']
    visit(data, type, true)
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
  // Подпись ⇒ Person: у подписи автора на странице — его узел в разметке с тем же именем и адресом профиля.
  const profileOf = (url) => URL.parse(url ?? '', OWN_ORIGIN)?.href
  for (const { name, href } of page.bylines) {
    const signed = persons.some(
      (person) => person.name === name && profileOf(person.url) === profileOf(href),
    )
    if (!signed) {
      fail(
        where,
        `подпись «${name}» (rel="author" → ${href}) — нет Person с этим именем и профилем в разметке`,
      )
    }
  }
}

// Превью ссылки — файл в рамке нормы (OG_IMAGE политики): размеры, формат и вес — из самого файла.
function checkOgImage(where, path, width, height) {
  const file = images.get(path)
  if (file === undefined) {
    fail(where, `og:image ${path} — не картинка: файл не читается`)
    return
  }
  if (file.width !== OG_IMAGE.width || file.height !== OG_IMAGE.height) {
    fail(
      where,
      `og:image ${path} — ${file.width}×${file.height}: превью ссылки — ${OG_IMAGE.width}×${OG_IMAGE.height}`,
    )
  }
  if (width !== String(file.width) || height !== String(file.height)) {
    fail(
      where,
      `og:image:width и og:image:height — ${width}×${height}, а файл ${path} — ${file.width}×${file.height}`,
    )
  }
  if (!OG_IMAGE.formats.includes(file.format)) {
    fail(where, `og:image ${path} — ${file.format}: превью ссылки читают JPEG и PNG`)
  }
  if (file.bytes > OG_IMAGE.maxBytes) {
    fail(
      where,
      `og:image ${path} — ${Math.round(file.bytes / 1024)} КБ, превью ссылки — до ${OG_IMAGE.maxBytes / 1024} КБ`,
    )
  }
}

// Мастер файла сборки: производную картинку Astro называет `<имя мастера>_<хеш>.<формат>`, мастер —
// `<имя>.<хеш>.<формат>`, файл public/ — своим именем.
const masterOf = (path) => path.replace(/(?:_[0-9A-Za-z]+)?\.\w+$/, '')
// Производная — файл, который сборка сделала из мастера.
const derived = (path) =>
  path.startsWith('/_astro/') && masterOf(path) !== path.replace(/\.\w+$/, '')

// Картинка статьи в разметке — кадры мастера её превью ссылки: разметка про картинку этой страницы.
// Google просит пропорции 16:9, 4:3 и 1:1 и для выдачи берёт нужную.
function checkArticleImages(where, type, image, ogImage) {
  const ratios = new Set()
  for (const url of [image].flat()) {
    if (typeof url !== 'string' || !absolute(url) || new URL(url).origin !== OWN_ORIGIN) {
      fail(where, `${type}.image ${url} — не абсолютный URL своего сайта`)
      continue
    }
    const { pathname } = new URL(url)
    if (absolute(ogImage) && masterOf(pathname) !== masterOf(new URL(ogImage).pathname)) {
      fail(
        where,
        `${type}.image ${pathname} — не кадр мастера og:image: разметка — про картинку этой страницы`,
      )
    }
    const file = images.get(pathname)
    if (file === undefined) fail(where, `${type}.image ${pathname} нет в dist/client`)
    else {
      ratios.add(
        Object.keys(ARTICLE_IMAGE_RATIOS).find(
          (ratio) => Math.abs(file.width / file.height / ARTICLE_IMAGE_RATIOS[ratio] - 1) < 0.01,
        ),
      )
    }
  }
  const missing = Object.keys(ARTICLE_IMAGE_RATIOS).filter((ratio) => !ratios.has(ratio))
  if (missing.length > 0) {
    fail(
      where,
      `${type}.image без кадров ${missing.join(', ')}: выдача просит 16:9, 4:3 и 1:1 одного мастера`,
    )
  }
}

// Разметка = видимое: JSON-LD не добавляет фактов, которых нет на странице.
function checkMarkupVisible(where, body, blocks, page) {
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
      if (data.image !== undefined) checkArticleImages(where, type, data.image, page.ogImage)
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

// ---------- планы ----------
// План — в границах head-kit своего типа страницы (plan_fields.structured_data): тип не из её page_types и не подтип —
// тип «на всякий случай»; FAQPage, HowTo и SearchAction нет ни у одного типа страницы.
for (const { page } of project.plans) {
  const where = planFiles.get(page.id) ?? `strategy: план ${page.id}`
  const allowed = headKitTypes(headKit, page.page_type)
  if (allowed === undefined) {
    fail(
      where,
      `тип страницы «${page.page_type}» — нет в head-kit page_types: типы JSON-LD не сверить`,
    )
    continue
  }
  for (const type of page.seo.structured_data) {
    if (!allowed.has(type)) {
      fail(
        where,
        `seo.structured_data: ${type} вне head-kit для ${page.page_type} (${[...allowed].join(', ')})`,
      )
    }
  }
}

// Типы JSON-LD страницы — ровно `seo.structured_data` её плана, каждый по разу; у страницы без плана разметки нет: тип
// разметки даёт только план.
function checkTypes(where, types, plan) {
  const missing = [...(plan?.page.seo.structured_data ?? [])]
  for (const type of types) {
    const index = missing.indexOf(type)
    if (index >= 0) missing.splice(index, 1)
    else if (plan === undefined) {
      fail(where, `JSON-LD «${type}» — у страницы нет плана strategy: тип разметки даёт план`)
    } else {
      fail(
        where,
        `JSON-LD «${type}» — не тип плана ${plan.page.id} (seo.structured_data: ${plan.page.seo.structured_data.join(', ') || 'пусто'})`,
      )
    }
  }
  for (const type of missing) fail(where, `нет JSON-LD «${type}» — тип плана ${plan?.page.id}`)
}

// ---------- источник: записи коллекций ----------
// Записи коллекций — источник, с которым сверяется сборка: страницы записей и черновиков, теги, даты, мета и пары
// переводов (twin по translationKey).
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
// Мета записи — её title и description из frontmatter: страница записи печатает их как есть.
const entryMeta = new Map()
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
    entryMeta.set(path, { title: data.title, description: data.description })
    const changed = data.updatedDate ?? data.pubDate
    if (changed !== undefined) entryDates.set(path, day(changed))
    for (const tag of collection.tagRoute ? (data.tags ?? []) : []) {
      const tagPath = localePath(locale, collection.tagRoute(tag))
      tagPosts.set(tagPath, (tagPosts.get(tagPath) ?? 0) + 1)
    }
    pair(`${collection.name}:${data.translationKey}`, locale, path)
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

  // Мета — copy deck как есть: у страницы плана одной страницы — мета её copy deck на языке страницы, у записи коллекции
  // — её title и description. Страницы 2…N списка дополняют мету номером (строка словаря), у тега и страницы без плана —
  // мета словаря: их держат правила сниппета. План страницы — строка карты по её адресу, у страниц 2…N — план списка.
  const at = pageAt(project, routeOf(path))
  const plan = at && plans.get(at.id)
  const deck =
    plan && !plan.page.template ? deckPageOf(project, plan.page.id, locale)?.meta : undefined
  if (plan && !plan.page.template && deck === undefined) {
    fail(where, `нет меты страницы ${plan.page.id} в copy deck ${locale}`)
  }
  const record = entryMeta.get(path)
  const source =
    deck && at.list === undefined
      ? { ...deck, of: `copy deck страницы ${plan.page.id}` }
      : record && { ...record, of: 'записи (frontmatter)' }
  for (const [label, value, want] of [
    ['<title>', title, source?.title],
    ['description', description, source?.description],
  ]) {
    if (value !== undefined && want !== undefined && !sameText(value, want)) {
      fail(where, `${label} «${value}» — не мета ${source.of}: «${want}»`)
    }
  }

  const h1 = html.match(/<h1[\s>]/g)?.length ?? 0
  if (h1 !== 1) fail(where, `h1: ожидается ровно один, найдено ${h1}`)
  const lang = /<html lang="([^"]*)"/.exec(html)?.[1]
  if (lang !== locale) fail(where, `<html lang="${lang}"> не совпадает с локалью пути (${locale})`)

  // Тело: абсолютных URL своего сайта нет (их штамповал бы entrypoint, а переезд домена трогал бы
  // контент), скрипты — только острова политики, ресурсы — свои, у медиа — размеры.
  const body = bodyOf(html)
  if (body.includes(OWN_HOST))
    fail(where, 'плейсхолдер origin в <body>: абсолютный URL своего сайта вне <head>')
  for (const message of scriptViolations(html, path, islands, routeOf)) fail(where, message)
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
  const fontPreloads = tags.filter(
    (item) =>
      item.tag === 'link' &&
      item.as === 'font' &&
      (item.rel ?? '').toLowerCase().split(/\s+/).includes('preload'),
  ).length
  if (fontPreloads > FONT_PRELOAD_MAX) {
    fail(
      where,
      `preload шрифтов — ${fontPreloads}: не больше ${FONT_PRELOAD_MAX}, это начертания первого экрана (preload строк src/app/styles/fonts.ts)`,
    )
  }
  checkMedia(where, html, body)
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
    // Тексты превью ссылки — свои у copy deck страницы (`og_title`, `og_description`), без них — заголовок и описание.
    const ogTitle = og('og:title')
    if (deck?.og_title !== undefined) {
      if (!sameText(ogTitle, deck.og_title)) {
        fail(
          where,
          `og:title «${ogTitle}» — не og_title copy deck страницы ${plan.page.id}: «${deck.og_title}»`,
        )
      }
    } else if (ogTitle !== title) fail(where, 'og:title не равен <title>')
    const ogDescription = og('og:description')
    if (!ogDescription) fail(where, 'og:description без content или пустой')
    else if (deck?.og_description !== undefined) {
      if (!sameText(ogDescription, deck.og_description)) {
        fail(where, `og:description — не og_description copy deck страницы ${plan.page.id}`)
      }
    } else if (ogDescription !== description) fail(where, 'og:description не равен description')
    const ogUrl = og('og:url')
    if (!ogUrl) fail(where, 'og:url пуст')
    else if (ogUrl !== canonical) fail(where, 'og:url не равен canonical')
    const siteName = og('og:site_name')
    if (!siteName) fail(where, 'og:site_name пуст')
    if (title) checkSnippet(where, title, description, siteName)
    const ogLocale = og('og:locale')
    if (ogLocale !== undefined && ogLocale !== localeInfo(locale).og) {
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
      else checkOgImage(where, new URL(image).pathname, og('og:image:width'), og('og:image:height'))
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
    if (data['@type'] === 'BreadcrumbList') checkBreadcrumbList(where, data, canonical)
    blocks.push(data)
  }
  checkTypes(
    where,
    blocks.map((data) => data['@type']),
    plan,
  )
  checkMarkupVisible(where, body, blocks, facts)
  // Даты — только у записи коллекции, и это даты её источника: правка, без неё — публикация frontmatter. Дату страницы
  // берут генератор карты (pageDateOf) и разметка записи; у страницы вне коллекций дат нет.
  const dates = [
    ['article:*_time', pageDateOf(tags)],
    ...blocks.map((data) => [data['@type'], data.dateModified ?? data.datePublished]),
  ].filter(([, date]) => date !== undefined)
  if (!entryPaths.has(path) && !draftPaths.has(path)) {
    if (dates.length > 0) {
      fail(
        where,
        `даты у страницы вне коллекций (${dates.map(([of, date]) => `${of} ${date}`).join(', ')}): даты публикации и правки — только у записи коллекции`,
      )
    }
  } else {
    for (const [of, date] of dates) {
      if (entryDates.has(path) && date !== entryDates.get(path)) {
        fail(
          where,
          `${of}: дата ${date}, а запись по источнику — ${entryDates.get(path)} (правка, без неё — публикация)`,
        )
      }
    }
  }
  checkEntities(where, blocks, { lang, visible: textOf(body), bylines: bylinesOf(body) })

  pages.set(path, { where, title, description, canonical, hrefs, noindex })
}

if (pages.size === 0) {
  console.error('seo:check: в dist/client нет ни одной страницы — сборка неполная')
  process.exit(1)
}

for (const file of walk(client).filter((path) => path.endsWith('.css'))) {
  checkCss(`dist/client/${relative(client, file).split(sep).join('/')}`, readFileSync(file, 'utf8'))
}

// Пакет по имени модуля: встроенный модуль, путь и адрес со схемой (`node:`, `data:`) — не пакет.
function packageOf(specifier) {
  if (isBuiltin(specifier) || /^[./#]|:/.test(specifier)) return undefined
  const [first, second] = specifier.split('/')
  return first.startsWith('@') ? `${first}/${second}` : first
}

// Что грузит модуль: import и export … from, import() и require() — под своим именем и с суффиксом
// бандлера (`__require$1`), результатом createRequire(…) и любым именем, которому модуль его
// присвоил. Функцию узнаёт её имя в модуле-источнике: импорт под другим именем и вызов через объект
// (`module.f(…)`) — та же функция. Разбор синтаксиса, а не текста: слово «import» или имя пакета в
// строке и комментарии — не импорт. Имя модуля не строкой и не путём к файлу прочесть нельзя —
// computed: нарушение, а не молчание.
function loadsOf(file) {
  const nodes = []
  const collect = (node) => {
    nodes.push(node)
    ts.forEachChild(node, collect)
  }
  collect(ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest))
  const imported = new Map(
    nodes
      .filter((node) => ts.isImportSpecifier(node))
      .map((node) => [node.name.text, (node.propertyName ?? node.name).text]),
  )
  // Имя функции в модуле-источнике: у `f(…)`, `obj.f(…)` и `g(…)` при `import { f as g }` — `f`.
  const nameOf = (node) =>
    ts.isIdentifier(node)
      ? (imported.get(node.text) ?? node.text)
      : ts.isPropertyAccessExpression(node)
        ? node.name.text
        : undefined
  const calls = (node, name) =>
    node !== undefined && ts.isCallExpression(node) && nameOf(node.expression) === name
  const isImportMetaUrl = (node) =>
    node !== undefined &&
    ts.isPropertyAccessExpression(node) &&
    ts.isMetaProperty(node.expression) &&
    node.name.text === 'url'
  // Путь к файлу, а не пакет: шаблон с ./, ../ или / в начале, pathToFileURL(…) и
  // new URL(…, import.meta.url) — и их href.
  const isFilePath = (node) => {
    if (ts.isTemplateExpression(node)) return /^\.{0,2}\//.test(node.head.text)
    const url = ts.isPropertyAccessExpression(node) ? node.expression : node
    return (
      calls(url, 'pathToFileURL') ||
      (ts.isNewExpression(url) &&
        nameOf(url.expression) === 'URL' &&
        isImportMetaUrl(url.arguments?.[1]))
    )
  }
  const requires = new Set()
  for (const node of nodes) {
    const [name, value] = ts.isVariableDeclaration(node)
      ? [node.name, node.initializer]
      : ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ? [node.left, node.right]
        : []
    if (name && ts.isIdentifier(name) && calls(value, 'createRequire')) requires.add(name.text)
  }
  const isLoad = (callee) =>
    callee.kind === ts.SyntaxKind.ImportKeyword ||
    calls(callee, 'createRequire') ||
    (ts.isIdentifier(callee) &&
      (/^_*require(\$\d+)?$/.test(callee.text) || requires.has(callee.text)))
  const packages = new Set()
  let computed = false
  for (const node of nodes) {
    const specifier =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) && isLoad(node.expression)
          ? node.arguments[0]
          : undefined
    if (specifier === undefined) continue
    if (ts.isStringLiteralLike(specifier)) {
      const name = packageOf(specifier.text)
      if (name) packages.add(name)
    } else if (!isFilePath(specifier)) computed = true
  }
  return { packages, computed }
}

// Рантайм образа — серверный бандл и обёртка процесса docker/*.mjs; стадия prod-deps ставит ему только
// dependencies. Импорт пакета вне них — модуль, который в контейнере не загрузится, хотя сборка, тесты
// и HTTP-набор зелёные: они берут node_modules репо со всеми зависимостями. Зависимость без импорта —
// вес образа: фреймворк и адаптер сборка встраивает в бандл, их место — devDependencies.
// Картинки на запросе не преобразуются (`/_image` закрыт), поэтому конвейер картинок Astro — getImage и
// сервис sharp — живёт только в модулях сборки: импорт sharp в dist/server значит, что on-demand маршрут
// дотянулся до него через общий модуль (баррель, `astro:assets`), — нарушение и при sharp в dependencies.
// Бюджет серверного бандла в size-limit ловит то же только по объёму.
const dependencies = new Set(
  Object.keys(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).dependencies ?? {}),
)
const imported = new Set()
for (const dir of ['dist/server', 'docker']) {
  const base = resolve(root, dir)
  for (const file of existsSync(base) ? walk(base).filter((path) => path.endsWith('.mjs')) : []) {
    const where = `${dir}/${relative(base, file).split(sep).join('/')}`
    const { packages, computed } = loadsOf(file)
    if (computed) {
      fail(
        where,
        'import() или require() с вычисляемым именем — пакет не проверить: имя модуля строкой',
      )
    }
    for (const name of packages) {
      imported.add(name)
      if (name === 'sharp' && dir === 'dist/server') {
        fail(
          where,
          'импорт sharp — конвейер картинок Astro в серверном бандле: getImage и astro:assets — только модулям сборки',
        )
      }
      if (!dependencies.has(name)) {
        fail(where, `импорт ${name} — пакета нет в dependencies, а образ ставит только их`)
      }
    }
  }
}
for (const name of dependencies) {
  if (!imported.has(name)) {
    fail(
      'package.json',
      `${name} в dependencies, а рантайм (dist/server, docker/*.mjs) его не импортирует — пакет сборки и инструментов живёт в devDependencies`,
    )
  }
}

// On-demand маршрут читает свою страницу strategy модулем `virtual:strategy/<id>` — сам, разметкой страницы или модулем,
// который импортирует, — а не снимок целиком: в серверном бандле — данные только этих страниц. Импорт — как его
// разрешают TS и Vite: `from '…'` и `import('…')`, путь без расширения — файл, `.ts`, `.astro`, `<каталог>/index.ts`.
// Данные страницы в бандле узнаются по пути её плана в снимке (`site/<поверхность>/plans/<id>.yaml`). Бюджет бандла в
// size-limit ловит снимок лишь по объёму: у сайта с одной локалью снимок в бюджет влезает.
const IMPORT = String.raw`(?:\bfrom\s+|\bimport\s*\(\s*)['"]`
const PAGE_MODULE = new RegExp(String.raw`${IMPORT}virtual:strategy/([\w-]+)['"]`, 'g')
const LOCAL_MODULE = new RegExp(String.raw`${IMPORT}(\.\.?/[^'"]+)['"]`, 'g')
const AS_IMPORTED = ['', '.ts', '.astro', '/index.ts']
const PAGE_PLAN = /\bsite\/[\w-]+\/plans\/([\w-]+)\.yaml\b/g
const onDemandPages = new Set()
const readSources = new Set()
const readPages = (file) => {
  if (readSources.has(file)) return
  readSources.add(file)
  const source = readFileSync(file, 'utf8')
  for (const [, id] of source.matchAll(PAGE_MODULE)) onDemandPages.add(id)
  for (const [, path] of source.matchAll(LOCAL_MODULE)) {
    const module = AS_IMPORTED.map((suffix) => resolve(dirname(file), `${path}${suffix}`)).find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    )
    if (module !== undefined) readPages(module)
  }
}
for (const { file, mode } of pageRoutes(resolve(root, 'src/pages'))) {
  if (mode === 'dynamic') readPages(file)
}
const serverDir = resolve(root, 'dist/server')
const strayPages = new Map()
for (const file of existsSync(serverDir)
  ? walk(serverDir).filter((path) => path.endsWith('.mjs'))
  : []) {
  for (const [, id] of readFileSync(file, 'utf8').matchAll(PAGE_PLAN)) {
    if (!onDemandPages.has(id) && !strayPages.has(id)) {
      strayPages.set(id, `dist/server/${relative(serverDir, file).split(sep).join('/')}`)
    }
  }
}
for (const [id, where] of strayPages) {
  fail(
    where,
    `данные страницы strategy ${id} — её не рендерит ни один on-demand маршрут: маршрут читает свою страницу модулем virtual:strategy/<id>, а не снимок целиком`,
  )
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
// списки и теги — один маршрут под префиксами локалей; записи — twin по translationKey из
// frontmatter (черновиков в сборке нет). Без неё страница, чей перевод выпал из карты переводов,
// теряет hreflang молча.
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
const builtFiles = walk(client).map((file) => `/${relative(client, file).split(sep).join('/')}`)
for (const { route, prerender, parametrized } of pageRoutes(resolve(root, 'src/pages'))) {
  if (!prerender) continue
  // Маршрут локалей (`[...locale]`) собирает страницу на языках её версий — хоть на одном.
  const localized = localizedRoute(route)
  if (localized !== undefined && !localized.includes('[')) {
    const pattern = routePattern(route, LOCALE_PREFIXES)
    if (![...pages.keys(), ...builtFiles].some((path) => pattern.test(path))) {
      fail(
        `dist/client${route}`,
        'страницы нет в сборке ни на одной локали, хотя маршрут есть в src/pages',
      )
    }
    continue
  }
  if (parametrized) continue
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
