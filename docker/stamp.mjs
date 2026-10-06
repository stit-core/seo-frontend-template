// Штамповка origin: сборка печёт в prerendered-выход плейсхолдер (`site` в astro.config.ts),
// здесь он заменяется на SITE_URL контейнера — так один образ едет во все среды, не теряя
// абсолютных canonical/og:url/sitemap.
//
// Только dist/client: on-demand маршруты берут origin из runtime SITE_URL, а в dist/server
// лежит и константа плейсхолдера, по которой конфиг отличает «не задано». HTML на сборке
// не предсжимается — иначе плейсхолдер уедет внутрь .br/.gz. DIST_DIR — та же штамповка копии
// сборки в HTTP-наборе (e2e/serve.mjs).
import { existsSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = process.env.DIST_DIR || '/app/dist'
const client = join(dist, 'client')

const fail = (message) => {
  console.error(`[entrypoint] ${message}`)
  process.exit(1)
}

// Выход сборки живёт в образе: пустой каталог на его месте (bind, tmpfs) поднял бы живой /healthz
// без единой страницы.
if (!existsSync(join(client, 'index.html'))) {
  fail(`${client}/index.html not found: build output is missing or empty`)
}

// Origin проверяет та же схема, что и старт сервера (shared/config): строка уходит в разметку
// дословно, а данные из env не исполняются — замена строкой, без sed и регулярных выражений.
const { SITE_ORIGIN_PLACEHOLDER, loadServerConfig } = await import(
  pathToFileURL(join(dist, 'server/runtime-config.mjs')).href
)
let origin = ''
try {
  origin = loadServerConfig().SITE_URL
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

const placeholder = Buffer.from(SITE_ORIGIN_PLACEHOLDER)
const files = readdirSync(client, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))

let stamped = 0
const leftovers = []
for (const file of files) {
  const content = readFileSync(file)
  if (!content.includes(placeholder)) continue
  // Остаток в css, js или бинаре — расширение не учтено: такой контейнер не должен попасть под
  // трафик.
  if (!['.html', '.xml', '.txt'].includes(extname(file))) {
    leftovers.push(relative(client, file))
    continue
  }
  // mtime сборки остаётся: от него Last-Modified и ETag статики, и рестарт не делает каждую
  // страницу «изменённой» для краулера. Повторный старт проштампованного выхода файлов не трогает.
  const { atime, mtime } = statSync(file)
  try {
    writeFileSync(file, content.toString('utf8').split(SITE_ORIGIN_PLACEHOLDER).join(origin))
    utimesSync(file, atime, mtime)
  } catch (error) {
    // EROFS, EACCES: read_only: true или чужой uid в compose — причина строкой, а не стеком.
    fail(
      `cannot stamp ${relative(client, file)}: ${error.code ?? error} — dist/client must be writable by the image user (no read_only: true, no user: override)`,
    )
  }
  stamped++
}

if (leftovers.length > 0) fail(`placeholder left after stamping:\n${leftovers.join('\n')}`)
console.info(
  `[entrypoint] stamped ${SITE_ORIGIN_PLACEHOLDER} -> ${origin} in ${client} (${stamped} files)`,
)
