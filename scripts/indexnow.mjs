// IndexNow после выката: сообщить поисковикам адреса, которые изменил релиз, — новые, изменённые
// (у записи сменился lastmod) и удалённые. Карта «до» — файл, снятый с домена перед выкатом
// (/release), карта «после» — живая /sitemap.xml; без файла «до» все адреса карты — новые (первый
// выкат). Ключ подтверждается живым файлом /<ключ>.txt: без него поисковик отвечает 403, а адреса
// под чужим ключом — попытка говорить за чужой сайт.
// По умолчанию — сухой прогон: проверяет ключ, печатает адреса и ничего не отправляет.
// usage: pnpm indexnow <origin> [карта-до-выката.xml] --key <ключ> [--send] [--endpoint <url>]
import { readFileSync } from 'node:fs'
import { sitemapUrls } from './lib/sitemap.mjs'

// Общий приёмник протокола: поисковики-участники (Яндекс, Bing и другие) делятся адресами.
const ENDPOINT = 'https://api.indexnow.org/indexnow'
// Предел одного запроса протокола.
const BATCH = 10_000
// Ключи вызова: true — со значением.
const OPTIONS = { '--key': true, '--endpoint': true, '--send': false }

function refuse(message, code = 1) {
  console.error(`indexnow: ${message}`)
  process.exit(code)
}

const given = {}
const positional = []
const args = process.argv.slice(2)
for (let index = 0; index < args.length; index++) {
  const arg = args[index] ?? ''
  if (!arg.startsWith('--')) positional.push(arg)
  else if (!Object.hasOwn(OPTIONS, arg)) refuse(`неизвестный ключ ${arg}`, 2)
  else given[arg] = OPTIONS[arg] ? args[++index] : true
}
const [origin, beforeFile] = positional
if (origin === undefined || positional.length > 2) {
  refuse('usage: pnpm indexnow <origin> [карта-до-выката.xml] --key <ключ> [--send]', 2)
}
if (!URL.canParse(origin)) refuse(`${origin} — не origin сайта (https://example.com)`, 2)
const site = new URL(origin).origin
const key = given['--key']
if (!key) {
  refuse(
    'ключ не задан (--key): без ключа адреса не отправляются. Нет ключа у проекта — шаг пропускается',
  )
}

// Редирект — не ответ сайта по этому адресу (origin назван не канонический), поэтому по нему
// запрос не идёт. Недоступная сеть — отказ с адресом, а не «fetch failed».
async function request(url, init = {}) {
  try {
    return await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), ...init })
  } catch (error) {
    return refuse(`${url} недоступен: ${error.cause?.message ?? error.message}`)
  }
}

// Адрес → дата последнего изменения. Адрес другого сайта в карте — отказ: за чужой хост
// отправлять нельзя, а карта «до» с другого домена дала бы «удалёнными» все его страницы.
function urlsOf(xml, where) {
  const urls = new Map(sitemapUrls(xml).map(({ loc, lastmod }) => [loc, lastmod]))
  const foreign = [...urls.keys()].find((url) => !url.startsWith(`${site}/`))
  if (foreign !== undefined) refuse(`${where}: адрес ${foreign} — не на ${site}`)
  return urls
}

const keyLocation = `${site}/${encodeURIComponent(key)}.txt`
const keyFile = await request(keyLocation)
if (keyFile.status !== 200 || (await keyFile.text()).trim() !== key) {
  refuse(
    `${keyLocation} не отвечает этим ключом (статус ${keyFile.status}): в env контейнера другой INDEXNOW_KEY или ключа нет`,
  )
}

const live = await request(`${site}/sitemap.xml`)
if (live.status !== 200) refuse(`${site}/sitemap.xml — статус ${live.status}`)
const after = urlsOf(await live.text(), `${site}/sitemap.xml`)
if (after.size === 0) refuse(`${site}/sitemap.xml — в карте нет адресов`)
let before = new Map()
if (beforeFile !== undefined) {
  try {
    before = urlsOf(readFileSync(beforeFile, 'utf8'), beforeFile)
  } catch (error) {
    refuse(`карта до выката не читается: ${error.message}`)
  }
  // Файл без адресов — страница ошибки или карта другого формата: с ним изменёнными стали бы все
  // адреса сайта.
  if (before.size === 0) {
    refuse(`${beforeFile} — в карте до выката нет адресов; первый выкат — вызов без файла карты`)
  }
}

const changes = [
  ...[...after.keys()].filter((url) => !before.has(url)).map((url) => ['+', url]),
  ...[...after]
    .filter(([url, lastmod]) => before.has(url) && before.get(url) !== lastmod)
    .map(([url]) => ['~', url]),
  ...[...before.keys()].filter((url) => !after.has(url)).map((url) => ['-', url]),
]
const count = (mark) => changes.filter(([kind]) => kind === mark).length
console.info(
  `indexnow: ${site} — новых ${count('+')}, изменённых ${count('~')}, удалённых ${count('-')}${beforeFile === undefined ? ' (карты до выката нет: все адреса — новые)' : ''}`,
)
for (const [mark, url] of changes) console.info(`  ${mark} ${url}`)

if (changes.length === 0) console.info('indexnow: карта не изменилась — отправлять нечего')
else if (!given['--send']) {
  console.info('indexnow: сухой прогон — ничего не отправлено; отправить — тот же вызов с --send')
} else {
  const endpoint = given['--endpoint'] ?? ENDPOINT
  const urlList = changes.map(([, url]) => url)
  for (let from = 0; from < urlList.length; from += BATCH) {
    const response = await request(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(site).host,
        key,
        keyLocation,
        urlList: urlList.slice(from, from + BATCH),
      }),
    })
    // 403 — ключ не подтверждён, 422 — адреса не этого хоста, 429 — слишком часто.
    if (!response.ok) refuse(`${endpoint} ответил ${response.status} — адреса не приняты`)
  }
  console.info(`indexnow: отправлено адресов — ${urlList.length}, приёмник ${endpoint}`)
}
