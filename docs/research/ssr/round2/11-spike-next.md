# 11 · Spike: Next.js 16 (App Router, RSC, Turbopack) — контрольная точка React-first

Дата прогона: 2026-09-16. Каталог кода: `scratchpad/spike-next/`. Порт 3204 (контейнеры — 3210).
Все цифры получены на машине Node v24.9.0 / pnpm 10.0.0 / Docker 29.8 / 20 CPU / Linux 6.12.
Спецификация спайка и таблица измерений — `brief-v2.md`. Пометки: **[П]** — проверено
эмпирически в этом прогоне, **[Д]** — цитата документации (URL рядом), **[?]** — оценка.

---

## 1. TL;DR

1. **Всё из спецификации собирается и работает**, включая сложные вещи: `output: 'standalone'`
   одним Node-процессом без nginx, ISR с fs-кешем и `revalidatePath`, `next/image` с AVIF/WebP
   и `sharp` на alpine, `ImageResponse` (satori) на alpine, i18n «дефолтная локаль без префикса»
   через `proxy.ts`, Server Action с прогрессивным улучшением (форма работает без JS), полный
   гейт `typecheck + eslint + biome + vitest + steiger + size-limit + playwright` — зелёный **[П]**.
2. **Цена — 137,7 КБ gzip JavaScript на странице `/about`, где нет ни одного обработчика
   события** (в браузере фактически 145,7 КБ gzip, потому что `<Link>` догружает чанки
   пререфетченных маршрутов). Плюс **17,3 КБ gzip RSC-префетчей на каждый просмотр** — Next
   дёргает `?_rsc=` для каждой ссылки в шапке/подвале. Для контент-first сайта без CDN это
   прямой счёт за трафик **[П]**.
3. **Честный 404 с разметкой — не дефолт, а рецепт из четырёх правил.** `notFound()`, вызванный
   внутри страницы, отдаёт 404 с **пустым `<body>`** (React error-shell `<html id="__next_error__">`),
   контент живёт только в RSC-пейлоаде — бот и пользователь без JS видят белый экран.
   Воспроизведено и на нашем `[lang]`-layout, и на голом проекте с обычным `app/layout.tsx` **[П]**.
   Рабочая комбинация: `dynamicParams = false` + `experimental.globalNotFound` +
   `app/global-not-found.tsx` + запрет `loading.tsx` на индексируемых маршрутах.
4. **Ловушка эксплуатации:** `revalidatePath()` на маршруте с `dynamicParams = false`
   **навсегда (до рестарта контейнера) отдаёт 404** — в логах `Error: Internal: NoFallbackError`.
   Док прямо говорит: чтобы ISR работал в рантайме, `generateStaticParams` должен возвращать
   пустой массив или нужен `dynamic = 'force-static'` **[Д]**. То есть «честный 404» и
   «вебхук-инвалидация постов» в Next 16 **взаимоисключающи** на одном и том же маршруте **[П]**.
5. **Развилка runtime `SITE_URL` закрывается штамповкой и это дёшево.** Пререндер запекает
   origin в canonical/og/hreflang/JSON-LD; `robots.txt`/`sitemap.xml`/`rss.xml`/`force-dynamic`
   читают env на запрос. Entrypoint с `sed` по `.next/server/app/**` (152 файла) отработал за
   **<1 мс**, гидрация без ошибок, ETag пересчитался. Альтернатива, специфичная для Next:
   `revalidatePath()` перерисовывает даже чисто статические страницы с текущим `process.env` **[П]**.
6. **FSD стоит дорого и частично не работает.** `src/pages` — зарезервированный каталог Pages
   Router: любой файл в нём валит сборку (`found pages without a React Component as default
   export`); корневой `app/` + `src/pages` — `Error: 'pages' and 'app' directories should be
   under the same folder`. Обход `pageExtensions: ['page.tsx', …]` работает, но заставляет
   назвать все служебные файлы `page.page.tsx`/`layout.page.tsx`/`route.route.ts` и **ломает
   метаданные-конвенции** (`robots.ts`/`sitemap.ts` начинают типизироваться как страницы).
   Мы оставили слой в `src/views` — и **Steiger перестаёт его видеть вообще**: кросс-слайсовый
   импорт внутри `views` не ловится, слайсы, на которые ссылаются только `views`, помечаются
   `insignificant-slice`. Границы FSD держит только `eslint-plugin-boundaries` **[П]**.
7. **`cacheComponents: true` (PPR) в 16.3.5 стабилен как флаг, но для нас это шаг назад:**
   он запрещает `revalidate`, `dynamicParams`, `dynamic = 'force-dynamic'` — то есть ломает и
   рецепт честного 404, и runtime-`SITE_URL` у `robots.txt`/`sitemap.xml`/`rss.xml` (они
   становятся `○ Static` и запекают origin билда) **[П]**.
8. **Эксплуатация ровная**: образ 233 МБ, холодный старт 348 мс, RSS 107 МБ на старте /
   324 МБ после серии по 200 параллельных, TTFB медиана 2,7–3,5 мс на пререндере и 5,4 мс на
   `force-dynamic`, `KEEP_ALIVE_TIMEOUT` настраивается (65 с против дефолтных 5 с), SIGTERM
   обрабатывается. Но: **`read_only: true` несовместим с ISR** (ISR пишет в `.next/server/app`,
   а не в `.next/cache`), и **дренаж при SIGTERM неполный** — 24 из 40 запросов «в полёте»
   получили обрыв соединения **[П]**.
9. **Общий вердикт для контент-first сайта в нашей экосистеме: технически годен, архитектурно
   чужероден.** Next даёт лучший в подборке SEO-инструментарий, единственный настоящий ISR без
   CDN и формальный LTS — но платит 138 КБ JS на статической странице, конфликтом `app`/`pages`
   с FSD и набором взаимоисключающих настроек, которые надо знать заранее. Как «контрольная
   точка React-first» — зафиксирована; как база `ssr-frontend-template` — уступает
   HTML-first-кандидатам по главному критерию (качество выдачи, вес 25).

---

## 2. Версии (`pnpm ls --depth 0`, факт после установки)

```
dependencies:
gray-matter 4.0.3          next 16.3.5              react 19.3.0
react-dom 19.3.0           rehype-stringify 10.0.1  remark-gfm 4.0.1
remark-parse 11.0.0        remark-rehype 11.1.2     sharp 0.35.4
unified 11.0.5             zod 4.6.5

devDependencies:
@biomejs/biome 2.5.13                  @feature-sliced/steiger-plugin 0.7.0
@fontsource-variable/inter 5.3.0       @playwright/test 1.63.0
@size-limit/file 11.2.0                @tailwindcss/postcss 4.3.3
@types/node 24.13.4                    @types/react 19.3.0
@types/react-dom 19.3.0                @vitejs/plugin-react 5.2.0
babel-plugin-react-compiler 1.0.0      eslint 9.39.5
eslint-config-next 16.3.5              eslint-plugin-boundaries 7.2.0
size-limit 11.2.0                      steiger 0.6.0
tailwindcss 4.3.3                      typescript 6.0.3
vitest 4.1.11
```

Установка: `pnpm install --frozen-lockfile` прошла **без изменений лока** (`Done in 791ms`,
store был тёплый). Единственное предупреждение — `unrs-resolver` в `pnpm.onlyBuiltDependencies`
(build script проигнорирован, на работу не влияет). Позже добавлен `eslint-plugin-boundaries@7.2.0`
(`pnpm add -D`) — при этом всплыл unmet peer `tsconfck 3.1.6 → typescript@^5` при
установленном TypeScript 6.0.3 (тянет `@feature-sliced/steiger-plugin`; на работу Steiger не влияет).

Замечания по версиям, важные для шаблона:

- **`eslint-config-next@16.3.5` умеет flat config нативно**: экспорты `.`, `./core-web-vitals`,
  `./typescript`, `./parser`; peer — `eslint >=9.0.0`. `FlatCompat`/`@eslint/eslintrc` **не нужны**
  (и не установлены — прошлый прогон падал на `Cannot find package '@eslint/eslintrc'`) **[П]**.
  `next/core-web-vitals` — массив из 4 конфигов, плагины `react`, `react-hooks`, `import`,
  `jsx-a11y`, `@next/next`; `next/typescript` добавляет `@typescript-eslint`.
- **`eslint-plugin-boundaries` 7.x поменял API**: `boundaries/element-types` → `boundaries/dependencies`,
  `rules` → `policies`, селекторы стали объектными (`{ element: { type } }`), `allow`-записи
  требуют обёртку `{ to: … }`. Конфиг SPA-шаблона (там стоит `^5.0.0`) под 7.x печатает четыре
  deprecation-предупреждения **[П]**.
- **Biome 2.5.13**: `linter.rules.recommended` deprecated → `linter.rules.preset: "recommended"`;
  Tailwind v4 `@theme` в CSS парсится только с `css.parser.tailwindDirectives: true` **[П]**.
- `react`/`react-dom` подтянулись как **19.3.0** (в `package.json` стоит `^19.2.0`).

---

## 3. Как воспроизвести

```sh
cd scratchpad/spike-next
pnpm install --frozen-lockfile

SITE_URL=http://127.0.0.1:3204 pnpm build        # 7,6 с «вхолодную», 4,2 с с тёплым turbopack-кешем
./srv.sh sync                                     # копирует .next/static и public в .next/standalone
SITE_URL=http://127.0.0.1:3204 ./srv.sh start     # поднимает node .next/standalone/server.js
./srv.sh stop

pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm steiger && pnpm size
pnpm test:e2e                                     # Playwright сам поднимет standalone-сервер

./measure.sh next/about http://127.0.0.1:3204/about          # статический разбор HTML
node measure-browser.mjs http://127.0.0.1:3204 / /about      # что реально тянет браузер

docker build -f docker/Dockerfile -t spike-next:test .
docker run -d --name c -p 127.0.0.1:3210:3000 -e SITE_URL=https://demo.example.org spike-next:test
```

`srv.sh` — обёртка вокруг standalone-сервера (PID в `server.pid`, лог в `server.log`, оба внутри
каталога спайка). `measure.sh` — клон `scratchpad/bench/measure.sh` (ради сопоставимости со
спайками 08–10) с одной правкой: отдельно считается `<script noModule>`, который современный
браузер не грузит (в исходном скрипте он попадал в «JS страницы» и завышал цифру на 39 КБ gzip).

---

## 4. Итоговые конфиги

### 4.1 `next.config.ts`

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Один self-contained Node-выход: .next/standalone/server.js
  output: 'standalone',
  reactStrictMode: true,
  trailingSlash: false,
  poweredByHeader: false,
  reactCompiler: true,

  experimental: {
    // Корневой layout живёт под [lang], поэтому обычный not-found.tsx не даёт
    // серверной разметки для несовпавших URL.
    globalNotFound: true,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    // Дисковый кеш оптимизатора: .next/cache/images
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },

  // Markdown читается через fs — nft его не видит, приходится дотрейсить руками.
  outputFileTracingIncludes: {
    '/**': ['./src/entities/post/content/**/*'],
  },

  async redirects() {
    return [
      { source: '/old', destination: '/', statusCode: 301 },
      { source: '/old-permanent', destination: '/about', permanent: true },
    ]
  },

  async headers() {
    return [
      {
        source: '/covers/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
```

### 4.2 `src/proxy.ts` (в Next 16 это замена `middleware.ts`)

```ts
import { type NextRequest, NextResponse } from 'next/server'
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n'

// NextResponse.rewrite() на self-host запускает proxy повторно — уже с переписанным
// путём. Маркер в заголовке запроса разрывает второй проход, иначе внутренний
// /ru/* попадает под редирект ниже и получается петля.
const REWRITE_MARK = 'x-locale-rewritten'
const LOCALE_HEADER = 'x-locale'

function requestHeaders(request: NextRequest, locale: string, rewritten: boolean) {
  const headers = new Headers(request.headers)
  headers.set(LOCALE_HEADER, locale)
  if (rewritten) headers.set(REWRITE_MARK, '1')
  return headers
}

export function proxy(request: NextRequest) {
  if (request.headers.get(REWRITE_MARK) === '1') return NextResponse.next()

  const { pathname, search } = request.nextUrl
  const first = pathname.split('/')[1] ?? ''

  // Внутренний префикс дефолтной локали наружу не выдаём: /ru/blog → 301 /blog.
  if (first === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || '/'
    return NextResponse.redirect(url, 301)
  }

  // global-not-found.tsx не получает params (он вне layout), локаль отдаём ему
  // заголовком запроса.
  const locale = isLocale(first) ? first : DEFAULT_LOCALE

  let response: NextResponse
  if (isLocale(first)) {
    response = NextResponse.next({ request: { headers: requestHeaders(request, locale, false) } })
  } else {
    response = NextResponse.rewrite(
      new URL(`/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}${search}`, request.url),
      { request: { headers: requestHeaders(request, locale, true) } },
    )
  }

  // Заголовки из next.config#headers() фиксируются на билде; политика индексации
  // обязана читаться из env контейнера — поэтому она здесь.
  if (process.env.ROBOTS_POLICY === 'noindex') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next|api|healthz|revalidate|opengraph-image|robots\\.txt|sitemap\\.xml|rss\\.xml|covers|favicon\\.ico).*)',
  ],
}
```

### 4.3 `steiger.config.ts` (три исключения — все вынужденные)

```ts
import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // src/app — маршруты Next (page.tsx/layout.tsx/route.ts) плюс сегменты
    // styles/fonts. Public API и «сегменты по назначению» здесь неприменимы:
    // имена файлов задаёт фреймворк.
    files: ['./src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off', 'fsd/public-api': 'off' },
  },
  {
    // Steiger не знает слоя `views`, поэтому не видит ссылок из него в widgets/
    // features. Без отключения эти слайсы вечно «без референсов».
    files: ['./src/widgets/**', './src/features/**'],
    rules: { 'fsd/insignificant-slice': 'off' },
  },
  {
    // shared/seo — сегмент sliceless-слоя; вложенный lib/ Steiger считает
    // зарезервированным именем.
    files: ['./src/shared/seo/**'],
    rules: { 'fsd/no-reserved-folder-names': 'off' },
  },
])
```

### 4.4 `eslint.config.mjs` (flat, без FlatCompat; границы FSD здесь и только здесь)

```js
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import boundaries from 'eslint-plugin-boundaries'

// FSD-слои. `views` — вынужденная замена слоя `pages`: каталог src/pages в Next
// зарезервирован под legacy Pages Router. Слой `app` здесь — маршруты Next:
// композиционный корень FSD и точка входа фреймворка совпали, поэтому app
// разрешён сам себе (сегменты styles/fonts лежат рядом с маршрутами).
const LAYERS = ['app', 'views', 'widgets', 'features', 'entities', 'shared']
const SLICELESS = new Set(['app', 'shared'])

const config = [
  {
    ignores: ['.next/**', '.probe/**', '.probe2/**', '.tmp/**', 'node_modules/**',
              'next-env.d.ts', 'playwright-report/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': LAYERS.map((layer) => ({ type: layer, pattern: `src/${layer}/*` })),
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: LAYERS.map((layer, index) => ({
            from: [{ element: { type: layer } }],
            allow: (SLICELESS.has(layer)
              ? [layer, ...LAYERS.slice(index + 1)]
              : LAYERS.slice(index + 1)
            ).map((to) => ({ to: { element: { type: to } } })),
          })),
        },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/*/*/*/*'], message: 'Импорт мимо public API слайса запрещён (FSD).' }] },
      ],
    },
  },
  { files: ['.size-limit.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  { files: ['postcss.config.mjs', 'eslint.config.mjs'], rules: { 'import/no-anonymous-default-export': 'off' } },
]

export default config
```

### 4.5 `biome.json`

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "files": {
    "includes": ["src/**", "e2e/**", "*.ts", "*.mjs", "*.json",
                 "!next-env.d.ts", "!**/.next", "!.probe", "!.probe2", "!.tmp"]
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } },
  "css": { "parser": { "tailwindDirectives": true } },
  "linter": { "enabled": true, "rules": { "preset": "recommended" } }
}
```

### 4.6 `vitest.config.ts`

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` — транзитивный пакет Next; вне RSC-графа его нет в resolve-пути
      // pnpm, а смысла в тесте у него нет. Глушим заглушкой.
      'server-only': fileURLToPath(new URL('./src/shared/lib/testing/noop.ts', import.meta.url)),
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
})
```

### 4.7 `.size-limit.cjs` — бюджет «на страницу», а не «на весь `.next/static`»

```js
// Next 16 убрал размеры бандлов из вывода `next build`, а `.next/static/chunks/**`
// содержит чанки ВСЕХ маршрутов сразу (плюс legacy-бандл под noModule, который
// современный браузер не грузит). Поэтому бюджет считаем «по странице»: берём
// пререндеренный HTML и суммируем только те чанки, на которые он ссылается.
const { readFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = __dirname
const APP = join(ROOT, '.next', 'server', 'app')

function chunksOf(htmlRelPath) {
  const file = join(APP, htmlRelPath)
  if (!existsSync(file)) throw new Error(`нет пререндера ${htmlRelPath} — сначала pnpm build`)
  const html = readFileSync(file, 'utf8')
  const urls = new Set()

  for (const m of html.matchAll(/<script([^>]*?)>/g)) {
    if (/\bnomodule\b/i.test(m[1])) continue
    const src = /\bsrc="([^"]+)"/.exec(m[1])
    if (src) urls.add(src[1])
  }
  for (const m of html.matchAll(/<link\b([^>]*?)>/g)) {
    const attrs = m[1]
    const rel = /\brel="([^"]+)"/.exec(attrs)
    const href = /\bhref="([^"]+)"/.exec(attrs)
    if (!rel || !href) continue
    const isScript = /\bas="script"/.test(attrs) || rel[1] === 'modulepreload'
    if (isScript) urls.add(href[1])
  }

  return [...urls]
    .filter((u) => u.startsWith('/_next/static/') && u.endsWith('.js'))
    .map((u) => join(ROOT, u.replace('/_next/', '.next/')))
}

function cssOf(htmlRelPath) {
  const html = readFileSync(join(APP, htmlRelPath), 'utf8')
  return [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map((m) => join(ROOT, m[1].replace('/_next/', '.next/')))
}

module.exports = [
  { name: 'JS: / (главная)', path: chunksOf('ru.html'), limit: '150 KB', gzip: true },
  { name: 'JS: /about (нет интерактива)', path: chunksOf('ru/about.html'), limit: '150 KB', gzip: true },
  { name: 'JS: /contact (остров формы)', path: chunksOf('ru/contact.html'), limit: '155 KB', gzip: true },
  { name: 'CSS: /', path: cssOf('ru.html'), limit: '10 KB', gzip: true },
  { name: 'legacy noModule-бандл (не грузится современным браузером)',
    path: '.next/static/chunks/*.js', limit: '250 KB', gzip: true },
]
```

### 4.8 `docker/Dockerfile` + `docker/docker-entrypoint.sh`

```dockerfile
# syntax=docker/dockerfile:1
# ── build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
# SITE_URL на билде нужен только чтобы prerender не взял дефолт localhost:3204.
# Плейсхолдер штампуется entrypoint'ом (см. docker-entrypoint.sh).
ENV SITE_URL=https://site-origin.invalid
RUN pnpm build

# ── runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    KEEP_ALIVE_TIMEOUT=65000

# standalone-сервер НЕ копирует public/ и .next/static сам — переносим руками.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

COPY --chown=node:node docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

```sh
#!/bin/sh
set -e

# Пререндер знает только плейсхолдер, подставленный на билде: абсолютные URL в
# <head>, JSON-LD и RSC-пейлоаде фиксируются в момент сборки. Штампуем их
# origin'ом контейнера — один образ едет по всем средам.
: "${SITE_URL:?SITE_URL is required}"
PLACEHOLDER="https://site-origin.invalid"
SITE_URL="${SITE_URL%/}"

if [ "$SITE_URL" != "$PLACEHOLDER" ]; then
  grep -rl "$PLACEHOLDER" /app/.next/server/app 2>/dev/null \
    | xargs -r sed -i "s|$PLACEHOLDER|$SITE_URL|g"
fi

exec "$@"
```

Важно: плейсхолдер обязан быть **валидным URL** — `metadataBase: new URL(getSiteUrl())` падает
на `__SITE_ORIGIN__` («Failed to collect page data»), поэтому взят `https://site-origin.invalid`
(зарезервированный TLD) **[П]**.

### 4.9 Ключевые файлы `shared/seo`

`src/shared/seo/lib/metadata.ts` — единственное место, где появляется origin:

```ts
import type { Metadata } from 'next'
import { getSiteUrl, isIndexable } from '@/shared/config'
import { DEFAULT_LOCALE, LOCALES, type Locale, localePath } from '@/shared/i18n'

export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path === '/' ? '' : path}` || getSiteUrl()
}

// hreflang: self + все локали + x-default на дефолтную.
export function alternatesFor(path: string): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {}
  for (const locale of LOCALES) languages[locale] = absoluteUrl(localePath(locale, path))
  languages['x-default'] = absoluteUrl(localePath(DEFAULT_LOCALE, path))
  return { languages }
}

export function robotsMeta(indexable = true): NonNullable<Metadata['robots']> {
  const allowed = indexable && isIndexable()
  return { index: allowed, follow: allowed }
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const { locale, path, title, description, type = 'website', image, indexable = true } = input
  const canonical = absoluteUrl(localePath(locale, path))

  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    description,
    alternates: { canonical, ...alternatesFor(path) },
    robots: robotsMeta(indexable),
    openGraph: {
      type, title, description, url: canonical, siteName: 'stit demo',
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
      ...(image ? { images: [{ url: image, width: 1600, height: 900, alt: title }] } : {}),
      ...(type === 'article' && input.publishedTime
        ? { publishedTime: input.publishedTime, modifiedTime: input.modifiedTime }
        : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title, description, ...(image ? { images: [image] } : {}),
    },
  }
}
```

`src/shared/config/runtime.ts` — контракт runtime-env:

```ts
import 'server-only'

// Читаем process.env на каждый вызов: значения должны приходить из env контейнера,
// а не запекаться в бандл. Для prerender это всё равно снимок времени сборки.
export function getSiteUrl(): string {
  return (process.env.SITE_URL ?? 'http://localhost:3204').replace(/\/$/, '')
}

export function isIndexable(): boolean {
  return process.env.ROBOTS_POLICY !== 'noindex'
}

export function getRuntimeConfig() {
  return {
    siteUrl: getSiteUrl(),
    indexable: isIndexable(),
    release: process.env.RELEASE ?? 'unknown',
  }
}
```

### 4.10 `src/app/sitemap.ts` и `src/app/robots.ts`

```ts
// sitemap.ts
import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/entities/post'
import { getSiteUrl } from '@/shared/config'
import { DEFAULT_LOCALE, LOCALES, localePath } from '@/shared/i18n'

export const dynamic = 'force-dynamic'   // ← без этого sitemap запекается на билде

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const abs = (path: string) => `${siteUrl}${path === '/' ? '' : path}`

  const languagesFor = (path: string) => {
    const languages: Record<string, string> = {}
    for (const locale of LOCALES) languages[locale] = abs(localePath(locale, path))
    languages['x-default'] = abs(localePath(DEFAULT_LOCALE, path))
    return languages
  }

  const staticPaths = ['/', '/blog', '/about', '/contact']
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: abs(localePath(DEFAULT_LOCALE, path)),
    alternates: { languages: languagesFor(path) },
  }))

  for (const post of await getAllPosts(DEFAULT_LOCALE)) {
    entries.push({
      url: abs(localePath(DEFAULT_LOCALE, `/blog/${post.slug}`)),
      lastModified: post.updatedDate,            // только честный lastmod (канон I-12)
      alternates: { languages: languagesFor(`/blog/${post.slug}`) },
    })
  }
  return entries
}
```

```ts
// robots.ts
import type { MetadataRoute } from 'next'
import { getSiteUrl, isIndexable } from '@/shared/config'

// force-dynamic: robots.txt обязан читать env контейнера, иначе политика
// staging/prod запекается на билде.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()
  if (!isIndexable()) return { rules: [{ userAgent: '*', disallow: '/' }] }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/now', '/api/'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
```

`MetadataRoute.Sitemap` штатно принимает `alternates.languages` и печатает `xhtml:link
rel="alternate" hreflang=…` **[П]** (проверено в выдаче). `MetadataRoute.Robots` в 16.3 имеет
поле `other` для нестандартных директив (в спайке не использовалось; для Яндекс-`Clean-param`
это штатный способ).

### 4.11 Server Action (`src/features/contact-form/api/submit.ts`)

```ts
'use server'

import { redirect } from 'next/navigation'
import { type Locale, localePath, t } from '@/shared/i18n'
import { ContactFormSchema, type ContactState, MIN_FILL_MS } from '../model/schema'

export async function submitContact(
  locale: Locale,
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot: поле скрыто от людей, заполняют его только боты — уводим на «спасибо»
  // молча, чтобы бот не подбирал обход.
  if (String(formData.get('website') ?? '') !== '') redirect(localePath(locale, '/contact/thanks'))

  // Time-trap работает только когда поле заполнил клиентский JS: на prerender-странице
  // серверного времени рендера нет (форма запечена на билде). Без JS проверка пропускается.
  const openedAt = Number(formData.get('openedAt') ?? 0)
  if (openedAt > 0 && Date.now() - openedAt < MIN_FILL_MS) {
    return { status: 'error', message: t(locale).formError }
  }

  const parsed = ContactFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  })
  if (!parsed.success) return { status: 'error', message: t(locale).formError }

  // PRG: и с JS, и без JS пользователь оказывается на отдельном URL «спасибо»,
  // повторный POST по F5 невозможен.
  redirect(localePath(locale, '/contact/thanks'))
}
```

---

## 5. Дерево `src/`

```
src/
  app/                              ← маршруты Next + FSD-сегменты styles/fonts
    [lang]/
      layout.tsx                    ← КОРНЕВОЙ layout (html/body), generateStaticParams: ru|en
      page.tsx  about/page.tsx  contact/page.tsx  contact/thanks/page.tsx
      blog/page.tsx  blog/[slug]/page.tsx  blog/page/[page]/page.tsx
      now/page.tsx                  ← dynamic = 'force-dynamic'
      not-found.tsx                 ← фактически не используется (см. §9)
    global-not-found.tsx            ← реальный 404 (experimental.globalNotFound)
    healthz/route.ts  revalidate/route.ts  rss.xml/route.ts
    robots.ts  sitemap.ts  opengraph-image.tsx
    fonts/inter-{latin,cyrillic}-wght-normal.woff2
    styles/index.css                ← Tailwind v4 @theme + data-scheme
  views/                            ← FSD-слой «pages» под другим именем (см. §10)
    home/ blog-list/ post/ about/ contact/ contact-thanks/ now/ not-found/
      index.ts  model/metadata.ts  ui/<name>-page.tsx
  widgets/  hero/ post-list/ site-header/ site-footer/   (index.ts + ui/)
  features/ contact-form/ { api/submit.ts, model/schema.ts, ui/contact-form.tsx, index.ts }
  entities/ post/ { api/posts.ts, model/schema.ts(+test), ui/post-card.tsx(+test),
                    content/{ru,en}/*.md — 12+12, index.ts }
  shared/
    config/{index.ts, runtime.ts}
    i18n/{index.ts, translate.ts, locales/{index,ru,en}.ts}
    lib/{cn.ts, format-date.ts, index.ts, testing/noop.ts}
    seo/{index.ts, lib/metadata.ts(+test), lib/json-ld.tsx}
    ui/{breadcrumbs,container,prose}/
  proxy.ts                          ← должен лежать рядом с app/, то есть в src/
e2e/seo.spec.ts                     ← 20 тестов
docker/{Dockerfile, docker-entrypoint.sh}
.probe/  .probe2/                   ← изолированные проекты-пробы (см. §10, §9)
```

## 6. Дерево `.next/standalone` (67 МБ, из них 59 МБ — `node_modules`)

```
.next/standalone/
  server.js                         8 КБ   — весь next.config инлайнится сюда строкой
  package.json                      4 КБ
  src/entities/post/content/**/*.md 96 КБ  — попало благодаря outputFileTracingIncludes
  .next/                            7,0 МБ
    BUILD_ID  build-manifest.json  prerender-manifest.json  routes-manifest.json
    required-server-files.json  app-path-routes-manifest.json
    server/
      middleware.js  middleware-manifest.json  next-font-manifest.{js,json}
      server-reference-manifest.{js,json}  prefetch-hints.json
      chunks/**                     — серверные чанки (в т.ч. @vercel/og)
      app/**                        — 43 пререндера: <route>.{html,rsc,meta} + <route>.segments/
  node_modules/                     59 МБ  (pnpm-симлинки внутрь собственного .pnpm)
    next → 20 МБ · react-dom 1,4 МБ · react 104 КБ · sharp 676 КБ
    @img/sharp-libvips-linux-x64 18 МБ  +  @img/sharp-libvips-linuxmusl-x64 19 МБ  ← обе libc!
  (+ вручную копируются) .next/static  696 КБ   и   public/  404 КБ
```

Внутри alpine-образа: `/app` 68,7 МБ (`node_modules` 59,5 МБ, `.next` 8,6 МБ, `public` 404 КБ,
`src` 120 КБ) + бинарь node 125,3 МБ → **итог 233 МБ** **[П]**. **37 МБ из 59 — две копии
libvips** (glibc + musl), потому что лок содержит обе опциональные зависимости `sharp`.
`pnpm.supportedArchitectures: { libc: ['musl'] }` срежет ~18 МБ **[?]** (в этом прогоне не проверено).

---

## 7. Единая таблица измерений (`brief-v2.md`)

| метрика | значение | как получено |
|---|---|---|
| время `build` (вхолодную, `rm -rf .next`) | **7,56 с** (compile 3,0 с; TypeScript 1,44 с; 43 страницы за 0,63 с) | `time pnpm build` |
| время `build` с тёплым turbopack-кешем | **4,19 с** (compile 285 мс) | `time pnpm build` |
| размер выхода сборки | `.next` 167 МБ · **`.next/standalone` 67 МБ** · `.next/static` 696 КБ · `.next/cache` 78 МБ | `du -sh` |
| размер Docker-образа | **233 МБ** (`/app` 68,7 МБ + node 125,3 МБ); сборка 14,7 с с тёплым кешем слоёв | `docker images` |
| HTML `/` | raw **24 890** Б · gzip **4 836** Б · по проводу 4 911 Б | `curl` + `gzip -9c` |
| HTML `/blog` | raw 29 313 · gzip 5 198 · провод 5 269 | " |
| HTML `/blog/<slug>` | raw **27 272** · gzip **5 699** · провод 5 793 | " |
| HTML `/about` | raw 14 660 · gzip 3 532 · провод 3 573 | " |
| HTML `/contact` | raw 15 654 · gzip 3 950 · провод 3 989 | " |
| HTML `/now` (dynamic) | raw 14 412 · gzip 3 560 · провод 4 201 | " |
| HTML `/en` | raw 23 452 · gzip 4 653 | " |
| **JS `/` (по ссылкам в HTML, gzip)** | **143,25 КБ** (9 чанков) | `size-limit`, `measure.sh` |
| **JS `/about` (ноль интерактива, gzip)** | **137,67 КБ** (8 чанков) | `size-limit` |
| **JS `/contact` (остров формы, gzip)** | **140,24 КБ** | `size-limit` |
| **JS фактически в браузере (любая страница), gzip** | **145,69 КБ** raw 483 395 Б — браузер догружает чанк `/contact` из-за префетча `<Link>` | Playwright `response.body()` |
| «ноль JS на странице без островов?» | **нет.** Минимум — рантайм React + app-router: `0zjtvyligjc1p.js` 228 924/71 415, `0968meqdmeu_c.js` 165 751/44 918, `2-*.js` 29 050/7 742, `3jecid*.js` 14 790/5 595, `3pq74*.js` 14 374/3 672, `32g51*.js` 8 870/3 598, `turbopack-*.js` 10 946/4 315, `154u*.js` 5 596/2 022 | `measure.sh` |
| инлайн-`<script>` (RSC-пейлоад в HTML) | `/about` 10 314 Б · `/` 15 093 Б · `/blog/<slug>` 18 145 Б | `measure.sh` |
| **RSC-префетчи `<Link>` на просмотр** | **11 запросов, 64 118 Б raw / 17,3 КБ gzip** — на каждой странице, включая `/about` | Playwright |
| legacy `noModule`-бандл | 112 594 Б raw / 39 384 Б gzip — **современный браузер не грузит** | Playwright (нет в списке запросов) |
| CSS | **8 930 Б raw / 2 790 Б gzip**, один файл на все страницы, `public,max-age=31536000,immutable` | `size-limit` |
| шрифты | 2 × WOFF2 preload: latin 48 256 Б + cyrillic 18 748 Б = **67 004 Б**; `display: swap`; `<link rel=preload as=font crossorigin>` в `<head>` **и** в заголовке `Link:` на dynamic-маршрутах | HTML + `curl -I` |
| изображения: `srcset` обложки | 8 кандидатов `640/750/828/1080/1200/1920/2048/3840` через `/_next/image?...&q=75`; `sizes` из пропа; fallback `src` = **самый большой кандидат (3840)** | HTML |
| изображения: форматы | AVIF **4 431 Б**, WebP **6 054 Б**, PNG-фолбэк 6 165 Б (исходник 32 456 Б) для w=828; переговоры через `Vary: Accept`, `<picture>` нет | `curl -H Accept:` |
| кеш оптимизатора | `.next/cache/images/<hash>`, `Cache-Control: public, max-age=31536000, must-revalidate`, `X-Nextjs-Cache: MISS→HIT` | `curl -I` |
| TTFB медиана 20 запросов | `/` **3,50 мс** · `/blog` 2,75 · `/blog/<slug>` **3,15** · `/about` 2,70 · `/contact` 2,80 · `/en` **1,74** · `/now` **5,37** · `/healthz` **1,56** · `/robots.txt` 1,37 · `/sitemap.xml` **9,41** · `/rss.xml` 9,20 · 404 5,54 | `curl -w %{time_starttransfer}` |
| RSS процесса idle | **107 МБ** сразу после старта; 110 МБ после 2 запросов | `/proc/<pid>/status` |
| RSS после 200 параллельных | 162 МБ (тёплый ISR) → 176 МБ (холодный) → 256 МБ (`/now`) → **324 МБ** (после `/sitemap.xml`) | " |
| 200 параллельных, тёплый ISR | 200 × 200 OK, все `x-nextjs-cache: HIT`; медиана `time_total` 104 мс, p95 183, max 210; **385 rps** (0,52 с) | `xargs -P 50 curl` |
| 200 параллельных на **холодный** ISR (сразу после `revalidatePath /ru/blog`) | 200 × 200 OK, **6 × `MISS` / 194 × `HIT`**, ETag один на все 200 ответов; медиана 103 мс, p95 182; **372 rps** (0,54 с); RSS 244 МБ | `xargs -P 50 curl -D -` |
| 200 параллельных, `force-dynamic` `/now` | 200 × 200 OK; медиана 218 мс, p95 225; **218 rps** (0,92 с) | " |
| 200 параллельных, `/sitemap.xml` (12 MD на запрос) | медиана 327 мс, p95 392; **136 rps** (1,47 с) | " |
| холодный старт процесса | **348 мс** до 200 на `/healthz` (в контейнере — те же порядки; Next печатает «Ready in 0ms», это неправда) | `date` вокруг `srv.sh start` |
| статусы | `/old` **301** · `/old-permanent` **308** · `/about/` **308** → `/about` · `/ru`,`/ru/blog` **301** · `/xx`,`/xx/about` **404** · `/blog/net-takogo` **404** · `/blog/page/99` **404** · `/healthz`,`/robots.txt`,`/sitemap.xml`,`/rss.xml`,`/opengraph-image` **200** | `curl -o /dev/null -w %{http_code}` |
| prerender отдаётся самим процессом? | **да**: `/` и `/about` — `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1, 1`, байт-в-байт стабильны; `/now` меняется каждый запрос | `curl` ×2 |
| статика отдаётся самим процессом? | **да**: `/_next/static/**` и `public/**` — `Cache-Control: public, max-age=31536000, immutable`, `Accept-Ranges: bytes`, weak `ETag W/"<size>-<mtime>"` | `curl -I` |
| `Cache-Control` на HTML | pure static: **`s-maxage=31536000`** (без `max-age`!) · ISR 60 с: `s-maxage=60, stale-while-revalidate=31535940` · ISR 3600: `s-maxage=3600, stale-while-revalidate=31532400` · dynamic: `private, no-cache, no-store, max-age=0, must-revalidate` | `curl -I` |
| ETag | на HTML — **strong** (`"16eic0zfpd3hyb"`), пересчитывается после штамповки; на статике — weak | `curl -I` |
| сжатие | **только gzip** (`compress: true`); `Accept-Encoding: br` в одиночку → ответ **без сжатия**; brotli Next не умеет | `curl -H 'Accept-Encoding: br'` |
| `Vary` | на HTML: `rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding`; на `/_next/image`: `Vary: Accept`; `Vary: Cookie`/`User-Agent` — нет | `curl -I` |
| `x-nextjs-cache` | `HIT` / `MISS` / (после истечения `revalidate`) `STALE`; плюс `x-nextjs-prerender`, `x-nextjs-stale-time: 300` | `curl -I` |
| keep-alive | дефолт Node **5 с**; `KEEP_ALIVE_TIMEOUT=65000` → `Keep-Alive: timeout=65` **[П]** | `curl -I` |
| контент до гидрации для `User-Agent: Googlebot` | **есть** h1, полный текст поста, JSON-LD, canonical, hreflang — тот же HTML, что и для браузера | `curl -A Googlebot` |
| hreflang / canonical / OG / JSON-LD в сыром HTML | **все есть.** Внимание: React печатает атрибут как `hrefLang="ru"` (HTML-парсер регистронезависим — валидно, но grep надо с `-i`) | `curl \| grep -a` |
| dev-опыт | `next dev --turbopack`: «Ready in 231 мс», первый отрендеренный `/` через **2,85 с**, первый `/blog/<slug>` 0,71 с, повторный 0,07 с; правка Markdown подхватывается без рестарта; слушает `0.0.0.0` по умолчанию (`--host` не нужен) | `time curl` |
| Steiger / Biome / ESLint / Vitest / Playwright / size-limit | **всё работает** (`.tsx` — родной формат), но Steiger не видит слой `views` — см. §10 | `pnpm <script>` |

---

## 8. Таблица проверок

| # | Требование (из `brief-v2.md` / канона `02` §3.2) | Итог | Команда / доказательство |
|---|---|---|---|
| 1 | `output: 'standalone'`, запуск `node server.js` | ✅ | `node .next/standalone/server.js`, «Ready» |
| 2 | Что копировать: `.next/standalone` + `.next/static` + `public` | ✅ | Dockerfile §4.8; без копирования — 404 на `/_next/static/**` |
| 3 | Статику отдаёт сам процесс с `immutable` | ✅ | `curl -I /_next/static/chunks/*.js` |
| 4 | Prerendered HTML отдаёт сам процесс | ✅ | `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1, 1` |
| 5 | `HOSTNAME` / `PORT` | ✅ | env в `srv.sh` и Dockerfile |
| 6 | `/healthz` route handler | ✅ | 200, `cache-control: no-store` |
| 7 | HEALTHCHECK в образе | ✅ | `docker inspect .State.Health` |
| 8 | graceful shutdown по SIGTERM | ⚠️ | обработчик есть (exit 143), idle keep-alive не мешает (0,5 с), но 24/40 запросов «в полёте» оборваны и `server.close()` не имеет таймаута — см. §14.1 |
| 9 | `KEEP_ALIVE_TIMEOUT` | ✅ | `Keep-Alive: timeout=65` |
| 10 | brotli | ❌ | только gzip |
| 11 | `generateStaticParams` — 43 страницы на билде | ✅ | вывод `next build` |
| 12 | ISR fs-кеш self-host | ✅ | `s-maxage`/`swr`, файлы в `.next/server/app` |
| 13 | `revalidatePath` через защищённый секретом route | ✅ | 401 на чужой секрет, HIT→MISS→HIT |
| 14 | `revalidatePath` + `dynamicParams=false` | ❌ | **вечный 404 + `NoFallbackError`** до рестарта |
| 15 | `/now` `force-dynamic` | ✅ | тело меняется, `private, no-store` |
| 16 | PPR / `cacheComponents` | ⚠️ | собирается, но ломает §14/§17 |
| 17 | 200 параллельных на холодный ISR | ✅ | 6 `MISS` из 200, один ETag на все ответы → ~6 рендеров вместо 200, 372 rps |
| 18 | `.next/cache` vs `read_only` | ❌ | ISR пишет в `.next/server/app`; `--read-only` → `EROFS` |
| 19 | Metadata API: canonical/languages/OG/robots | ✅ | §7, e2e `seo.spec.ts` |
| 20 | `app/sitemap.ts` c hreflang | ✅ | `xhtml:link rel=alternate hreflang` |
| 21 | `app/robots.ts` с runtime-политикой | ✅ | `ROBOTS_POLICY=noindex` → `Disallow: /` |
| 22 | **runtime `SITE_URL` на пререндере** | ❌ (обходится) | §9.1: запекается; лечится штамповкой |
| 23 | `metadataBase` | ⚠️ | ставится в layout, но Next всё равно варнит и для `/_not-found`/`opengraph-image` берёт хост запроса |
| 24 | `opengraph-image.tsx` (`ImageResponse`) на alpine | ✅ | PNG 1200×630, satori, Chromium не нужен |
| 25 | `redirects()` `/old` → 301 | ✅ | `statusCode: 301` даёт ровно 301 (`permanent: true` → 308) |
| 26 | `trailingSlash: false` → `/about/` | ✅ | **308** на `/about` |
| 27 | Честный 404 с разметкой | ⚠️ | только по рецепту §9.2; «из коробки» — пустой body |
| 28 | `X-Robots-Tag` по `ROBOTS_POLICY` на пререндере | ✅ | proxy ставит заголовок и на статике |
| 29 | `next/image` self-host, AVIF/WebP, `srcset` | ✅ | §7 |
| 30 | Markdown + Zod в RSC | ✅ | `entities/post/api/posts.ts` |
| 31 | `outputFileTracingIncludes` для `.md` в standalone | ✅ | `.next/standalone/src/entities/post/content/**` |
| 32 | i18n: `/` → ru без редиректа | ✅ | 200, `<html lang="ru">` |
| 33 | i18n: `/en/*` → en | ✅ | 200, `<html lang="en">` |
| 34 | i18n: `/xx/*` → 404 | ✅ | 404 + разметка |
| 35 | Нет авто-редиректа по `Accept-Language` | ✅ | `curl -H 'Accept-Language: en'` → ru |
| 36 | `alternates.languages` + `x-default` | ✅ | в `<head>` и в sitemap |
| 37 | Форма: Server Action + honeypot | ✅ | e2e |
| 38 | Форма без JS (нативный POST + PRG) | ✅ | e2e `javaScriptEnabled: false` → `/contact/thanks` |
| 39 | Time-trap | ⚠️ | работает только когда поле заполнил JS (пререндер не знает времени открытия) |
| 40 | FSD: `src/pages` как слой | ❌ | ломает сборку; обход — `src/views` или `pageExtensions` |
| 41 | Steiger видит слой `views` | ❌ | нарушения внутри `views` не ловятся |
| 42 | `eslint-plugin-boundaries` держит границы | ✅ | ловит `entities → features/widgets/views` и deep-import |
| 43 | Biome на `.tsx` + Tailwind CSS | ✅ | `css.parser.tailwindDirectives` |
| 44 | `eslint-config-next` на ESLint 9 | ✅ | flat-конфиг нативно, peer `>=9` |
| 45 | Vitest: схема + компонент + async RSC | ✅ | 13 тестов; нужен alias `server-only` |
| 46 | Playwright smoke | ✅ | 20/20 |
| 47 | `size-limit` «на страницу» | ✅ | §4.7 |
| 48 | `pnpm check`-аналог целиком | ✅ | typecheck+lint+format+test+steiger+size+e2e — зелёный |

Легенда: ✅ работает · ⚠️ работает с оговоркой/обходом · ❌ не работает как задумано.
⏭ (пропущено) — нет: всё из спецификации проверено.

---

## 9. Развилка «prerender ⊥ runtime `SITE_URL`» (`14` §2.2.2–2.2.4) — цифры

### 9.1 Что именно запекается

Эксперимент: сборка с `SITE_URL=http://127.0.0.1:3204`, запуск с
`SITE_URL=https://runtime.example.org ROBOTS_POLICY=noindex`.

| артефакт | источник значения | результат |
|---|---|---|
| `canonical`, `og:url`, `og:image`, `hreflang`, JSON-LD на `/`, `/about`, `/blog/<slug>`, `/contact` | **билд** | `http://127.0.0.1:3204/...` ❌ |
| `<meta name="robots">` на пререндере | **билд** | `index, follow` даже при `ROBOTS_POLICY=noindex` ❌ |
| `canonical` на `/now` (`force-dynamic`) | рантайм | `https://runtime.example.org/now` ✅ |
| `robots.txt` (`force-dynamic`) | рантайм | `Disallow: /` ✅ |
| `sitemap.xml` (`force-dynamic`) | рантайм | `https://runtime.example.org` ✅ |
| `rss.xml` (route handler) | рантайм | ✅ |
| `X-Robots-Tag` из `proxy.ts` | рантайм | ставится **и на пререндеренный HTML** ✅ |

Про расхождение `<meta robots: index>` vs `X-Robots-Tag: noindex` на staging: формально это
безопасно — Google: *«In the case of conflicting robots rules, the more restrictive rule
applies»* **[Д]** https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
(проверено 2026-09-16). Но полагаться на это в шаблоне не стоит: рецепт ниже убирает расхождение.

### 9.2 Три рабочих способа (все проверены)

| # | способ | цена | оценка |
|---|---|---|---|
| **C. Плейсхолдер + штамповка в entrypoint** | билд с `SITE_URL=https://site-origin.invalid`, entrypoint делает `grep -rl \| xargs sed -i` по `/app/.next/server/app`. **152 файла, время <1 мс**, гидрация без ошибок в консоли, ETag пересчитался, плейсхолдер не утёк (`grep -c` = 0 по трём страницам) | нужен валидный URL-плейсхолдер; ломается, если RSC начнёт писать длину строки (`<id>:T<hex>,`) — в этой сборке таких строк **нет ни одной** (`grep -aoE '^[0-9a-f]+:T[0-9a-f]+,'` пусто и в `.rsc`, и в инлайне `__next_f` в `.html`) | **рекомендую** |
| **G. Прогрев через `revalidatePath` при старте** (специфично для Next) | `revalidatePath('/ru/about')` **перерисовывает даже чисто статическую страницу** (без `revalidate`) и берёт текущий `process.env` → canonical стал `https://runtime.example.org/about` **[П]** | требует writable FS и одного рендера каждой страницы; **несовместим с `dynamicParams=false`** (см. §9.3) | запасной |
| **A. Свой образ на среду** (`--build-arg SITE_URL`) | 0 в рантайме | ломает «один образ на все среды» | только для одной среды |

Не годятся: **B** (prerender при старте — в Next это `next build`, тулчейн в рантайм-образ не
кладём), **E** (относительные canonical запрещены каноном), **F** (origin из `Host`) — как
самостоятельный способ не работает, потому что пререндер вообще не выполняется на запрос.

### 9.3 Смертельная комбинация: `revalidatePath` × `dynamicParams = false`

```
POST /revalidate?secret=…&path=/ru/blog/fsd-na-servere  → {"ok":true}
GET  /blog/fsd-na-servere                               → 404   (и дальше всегда 404)
server.log: Error: Internal: NoFallbackError
```

Восстанавливается **только рестартом контейнера** (файлы пререндера на диске целы —
повреждение в памяти процесса) **[П]**. Документация это объясняет:

> «You must return an empty array from `generateStaticParams` or utilize `export const dynamic
> = 'force-static'` in order to revalidate (ISR) paths at runtime.»
> «During revalidation (ISR), `generateStaticParams` will not be called again.»
> **[Д]** https://nextjs.org/docs/app/api-reference/functions/generate-static-params (16.3.5, 2026-08-25)

Известная проблема с непонятным сообщением: https://github.com/vercel/next.js/issues/87738.

**Вывод для шаблона:** выбирать надо один из двух режимов и записывать выбор в `rendering.md`:

- **git-контент** (посты в репозитории, публикация = релиз): `dynamicParams = false`, честные 404,
  инвалидация — новый образ. Штамповка (способ C) закрывает `SITE_URL`.
- **CMS-контент** (вебхук на публикацию): `dynamicParams = true` + `generateStaticParams` возвращает
  пустой массив (или `dynamic = 'force-static'`), `revalidatePath`/`revalidateTag` работают,
  но 404 на несуществующем слаге снова становится пустым — его надо ловить в `proxy.ts`
  (см. §9.4).

### 9.4 Честный 404 — полный рецепт и что именно ломается

**Симптом.** `notFound()`, вызванный внутри страницы, отдаёт **404 + пустое тело**:

```html
<html id="__next_error__"><head>…<meta name="robots" content="noindex"/>…</head>
<body><div hidden=""><!--$--><!--/$--></div><script>self.__next_f.push(…)</script></body></html>
```

Разметка 404 присутствует **только в RSC-пейлоаде**. Воспроизводится одинаково:
для `User-Agent` браузера, Googlebot, YandexBot, Twitterbot, curl; для `notFound()` после `await`
и **без единого `await`**; на маршруте с ISR и на `force-dynamic` **[П]**.

Это **не** следствие нашего `[lang]`-layout: изолированная проба `.probe2/` (обычный
`src/app/layout.tsx`, `src/app/not-found.tsx`, страница `src/app/x/page.tsx` с
`notFound()`) даёт ровно то же: `/x` → 404 + `__next_error__` без `<h1>`, тогда как несовпавший
URL `/zzz` → 404 + нормальная разметка `not-found.tsx` **[П]**.

Документация описывает соседний, но связанный эффект:

> «When streaming, a `200` status code will be returned… Because the response headers have already
> been sent to the client, the status code of the response cannot be updated… If you need a 404
> status… ensure the resource exists before the response body is streamed… You can run this check
> in `proxy` to rewrite missing slugs to a not-found route, or produce a 404 response.»
> **[Д]** https://nextjs.org/docs/app/api-reference/file-conventions/loading (16.3.5)

**Рабочий рецепт (проверен, все пять пунктов обязательны):**

1. `export const dynamicParams = false` на **каждом** динамическом сегменте
   (`[slug]`, `[page]`) — неизвестный параметр отсекается маршрутизацией, страница не рендерится.
2. `experimental: { globalNotFound: true }` + `src/app/global-not-found.tsx` со своим `<html>`,
   своим импортом стилей и `robots: { index: false }`. Нужен потому, что корневой layout живёт
   под `[lang]`: док прямо называет этот случай — *«Your root layout is defined using top-level
   dynamic segments (e.g. `app/[country]/layout.tsx`)»* **[Д]**
   https://nextjs.org/docs/app/api-reference/file-conventions/not-found.
   Без него несовпавшие URL отдают **встроенную** страницу Next «404 This page could not be found.»,
   а `src/app/[lang]/not-found.tsx` не используется вовсе.
3. Локаль в `global-not-found.tsx` передаётся **заголовком запроса** из `proxy.ts`
   (`NextResponse.next({ request: { headers } })` + `await headers()`), иначе 404 всегда на
   дефолтной локали. Проверено: `/en/blog/net-takogo` → `<html lang="en">`, «404 — page not found» **[П]**.
4. **Никаких `loading.tsx`** на индексируемых маршрутах: он создаёт Suspense-границу, стрим
   начинается, и 404 превращается в 200 soft-404.
5. `t(locale)` (и любой словарь по ключу локали) обязан иметь фолбэк: `generateMetadata`
   выполняется **раньше**, чем `layout` успевает вызвать `notFound()`, и на `lang='__xx__'`
   падает 500 вместо 404 **[П]**.

Что **не** работает:
- `NextResponse.rewrite(url, { status: 404 })` — статус игнорируется, ответ 200 (soft-404) **[П]**.
  Док: «To produce a response from Proxy, you can: 1. rewrite to a route… 2. return a
  `NextResponse` directly» — статуса у rewrite нет.
- Рерайт на заведомо несуществующий путь (`/__not-found__`) — он всё равно матчится на `[lang]`
  и приложение падает в 500 **[П]**.

Итоговое поведение (финальная сборка): `/blog/net-takogo` **404** + `<h1>404 — страница не найдена</h1>`,
`/blog/page/99` **404**, `/xx/about` **404**, `/en/blog/net-takogo` **404** на английском.
В логе при этом остаётся служебное `Error: Internal: NoFallbackError` — шум, но не ошибка.

---

## 10. FSD в Next — честная цена

### 10.1 `src/pages` — эксперимент

| вариант | результат |
|---|---|
| **пустой** каталог `src/pages/` | `pnpm build` **проходит** (exit 0), маршруты App Router не тронуты **[П]** |
| `src/pages/home/{index.ts, ui/home-page.tsx}` (FSD-слайс, named export) | **сборка падает**: `> Build optimization failed: found pages without a React Component as default export in  pages/home/ui/home-page  pages/home` **[П]** |
| корневой `app/` (маршруты) + `src/pages/` (FSD) | **сборка падает**: ``Error: `pages` and `app` directories should be under the same folder`` **[П]** |
| `pageExtensions: ['page.tsx','page.ts','route.ts']` + обычные имена | App Router **исчезает целиком** — остаётся только Pages-роут `/404`; `src/pages/**` при этом перестаёт считаться маршрутами **[П]** |
| `pageExtensions` + переименование служебных файлов (`layout.page.tsx`, `page.page.tsx`, `not-found.page.tsx`, `route.route.ts`) | **работает**: проба `.probe/` собирается, `/` рендерит компонент из `src/pages/home`, `/healthz`, `/_not-found` на месте **[П]** |
| то же + `robots.page.ts` / `sitemap.page.ts` | **typecheck падает**: `.next/types/validator.ts … Type 'typeof import(".../robots.page")' does not satisfy the constraint 'AppPageConfig<"/robots.txt">'` — метаданные-конвенции воспринимаются как страницы **[П]** |
| то же + `robots.txt/route.route.ts` и `sitemap.xml/route.route.ts` | **работает** — но `robots.ts`/`sitemap.ts`/`opengraph-image.tsx` как конвенции потеряны, их надо писать руками route-хендлерами **[П]** |

Итого две честные развилки:

- **(а) `src/views`** (выбрано в спайке): один нестандартный слой, всё остальное каноничное.
  Минус — Steiger слепнет (см. 10.2), и FSD-карта из `<org>/strategy` (`pages.md`) разворачивается
  не в `src/pages`, а в `src/views` — надо править `/scaffold`.
- **(б) `pageExtensions`**: слой `pages` остаётся на своём месте, но каждый служебный файл
  Next получает удвоенный суффикс (`page.page.tsx`, `layout.page.tsx`, `route.route.ts`),
  а `robots`/`sitemap`/`opengraph-image` переписываются на route-хендлеры. Любой пример из
  документации Next и любой codemod после этого неприменим без перевода.

### 10.2 Что видит Steiger

```
$ pnpm steiger        # ДО настройки конфига
┌ src/features/contact-form   ✘ This slice has no references. Consider removing it.
┌ src/widgets/hero            ✘ This slice has no references.
┌ src/widgets/post-list       ✘ This slice has no references.
┌ src/shared/seo/lib          ✘ … folder with the name "lib" inside a segment … no-reserved-folder-names
```

`features/contact-form`, `widgets/hero`, `widgets/post-list` используются **только** из `src/views/*`
— Steiger этот каталог не считает слоем и не строит по нему граф. `widgets/site-header` и
`site-footer` не попали в список только потому, что их импортирует `src/app/[lang]/layout.tsx`
(`app` Steiger знает).

Прямая проверка: временно добавленный кросс-слайсовый импорт `@/views/blog-list` **внутрь**
`src/views/about/ui/about-page.tsx` Steiger **не заметил** (`✔ No problems found!`), а
`eslint-plugin-boundaries` поймал: `There is no policy allowing dependencies from elements of
type "views" to elements of type "views"` **[П]**. `typo-in-layer-name` на `views` не срабатывает
(правило реагирует на опечатки известных имён, а не на чужие слои).

**Вывод:** при раскладке `src/views` архитектурный контроль FSD держится **только ESLint'ом**.
Steiger превращается в проверку `shared`/`entities`/`app` и структурных правил. Это надо либо
принять и записать, либо перейти на вариант (б) с `pageExtensions`.

### 10.3 FSD `app` vs Next `app`

`src/app` — это одновременно маршруты Next и композиционный корень FSD. Внутри лежат
`styles/index.css` и `fonts/*.woff2` (сегменты FSD-слоя `app`) рядом с `[lang]/page.tsx`.
Steiger на `src/app/**` ругается на `segments-by-purpose` (сегмент `[lang]` — не `ui/model/api/lib/config`)
и на `public-api` (нет `index.ts` — и не может быть: имена файлов задаёт фреймворк). Оба правила
пришлось выключить для `./src/app/**`. В `boundaries` слой `app` пришлось разрешить сам себе,
иначе `layout.tsx` не может импортировать `../styles/index.css`.

`proxy.ts` обязан лежать «на одном уровне с `app`» **[Д]** — то есть в `src/`, вне всяких слоёв.
Это ещё один файл вне FSD-графа (как `routeTree.gen.ts` в SPA-шаблоне).

### 10.4 Что пришлось бы выдумать самим

| # | что | почему |
|---|---|---|
| 1 | Конвенция «тонкий `page.tsx` → реэкспорт из `views/<slug>`» + шаблон в `/scaffold` | `src/pages` занят |
| 2 | Свой `steiger.config.ts` с тремя выключенными правилами (§4.3) и понимание, что `views` не покрыт | Steiger не знает слоя |
| 3 | `eslint-plugin-boundaries` как **единственный** страж FSD + перевод конфига SPA-шаблона на API v7 | boundaries 7.x |
| 4 | `.size-limit.cjs`, считающий чанки по HTML страницы (§4.7) | `next build` в 16.0 перестал печатать размеры бандлов |
| 5 | Alias `server-only` → пустышка в `vitest.config.ts` | `server-only` не резолвится вне RSC-графа под pnpm |
| 6 | `docker-entrypoint.sh` со штамповкой + e2e-ассерт «в ответе нет плейсхолдера» | §9.2 |
| 7 | `global-not-found.tsx` + передача локали заголовком из proxy + правило «никаких `loading.tsx`» | §9.4 |
| 8 | Выбор режима «git-контент vs CMS-контент» и запрет их смешивать | §9.3 |
| 9 | Контент-слой целиком: `gray-matter` + `unified` + Zod + индекс коллекций | у Next нет content layer |
| 10 | `pnpm.supportedArchitectures` (musl) для `sharp` | −18 МБ образа |
| 11 | Переопределение `Cache-Control` на HTML (Next ставит `s-maxage=31536000` без `max-age`) | канон P-15 требует `no-cache` + ETag |
| 12 | Зачистка `x-middleware-rewrite` в ответах (см. §13) | утечка внутреннего пути и хоста |

---

## 11. Контент-пайплайн

Реализация: `src/entities/post/api/posts.ts` — `readdir`/`readFile` → `gray-matter` →
`unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify)` → Zod-схема
frontmatter → объект `Post` с `html` и `readingMinutes`. Всё выполняется **в RSC на билде**
(через `generateStaticParams` + пререндер) и в рантайме на `force-dynamic` маршрутах
(`sitemap.xml`, `rss.xml`).

- **`outputFileTracingIncludes` работает**: `.md` доехали в `.next/standalone/src/entities/post/content/**`
  (96 КБ) и читаются `process.cwd()`-относительно **[П]**. Без этой настройки standalone падает
  на `ENOENT` — nft не видит путей, собранных через `path.join`.
- **Стоимость.** 43 страницы (24 поста ×2 локали + списки + статика) генерируются за **0,63 с**
  на 17 воркерах. Но `sitemap.xml` и `rss.xml` — `force-dynamic` и парсят 12 файлов **на каждый
  запрос**: TTFB 9,4 и 9,2 мс против 2,7 мс у пререндера, под 200 параллельных — 136 rps против
  385. Для продакшена контент-индекс надо строить один раз (`14` §2.2.6) или закрыть эти маршруты
  `unstable_cache`/`'use cache'`.
- **Валидация.** Ошибка Zod в frontmatter валит `next build` (red build) — то, что нужно.
- **Альтернативы** (по докам, **[Д]**, в спайке не ставились):
  - `@content-collections/core@0.5.0` + `@content-collections/next@0.2.11` (обе опубликованы
    2026-02-14, https://www.npmjs.com/package/@content-collections/next): типобезопасный
    content layer на Zod, совместим с App Router и RSC, подключается обёрткой
    `withContentCollections` в `next.config` + alias `content-collections` в `tsconfig`.
    Фактически «Contentlayer, который жив». Даёт ровно то, чего у Next нет.
  - `next-mdx-remote` — рендер MDX из произвольного источника (строка/CMS) на сервере; не даёт
    ни индекса коллекций, ни типизации — это кирпич, а не слой.
  - `@next/mdx` — MDX как страницы App Router; для блога с frontmatter и списками не подходит
    (нет индекса), пригоден для доков.

---

## 12. i18n

Схема: **корневой layout под `[lang]`** (`src/app/[lang]/layout.tsx` рендерит `<html lang>`),
`generateStaticParams` возвращает `[{lang:'ru'},{lang:'en'}]`, `proxy.ts` переписывает пути без
префикса на `/ru/*` и редиректит явный `/ru/*` наружу 301-м.

Проверено **[П]**:

| требование канона | факт |
|---|---|
| L-1 дефолтная локаль без префикса | `/` → 200, ru, без редиректа; `/ru` → **301** `/`; `/ru/blog` → **301** `/blog` |
| L-2 невалидный префикс → 404 | `/xx`, `/xx/about` → **404** с разметкой |
| L-3 взаимный hreflang + x-default | в `<head>` каждой страницы и в `sitemap.xml` |
| L-4 нет авто-редиректа по `Accept-Language` | `curl -H 'Accept-Language: en'` на `/` → ru |
| L-5 canonical внутри локали | `/en/about` → `…/en/about` |
| M-7 `<html lang>` | `ru` / `en` |

Две ловушки, стоившие отладки:

1. **`NextResponse.rewrite()` на self-host запускает `proxy` повторно** — уже с переписанным
   путём `/ru/...`, который тут же попадает под правило «301 на путь без префикса» → петля.
   Лечится маркером в **request**-заголовке (`NextResponse.rewrite(url, { request: { headers } })`)
   и ранним `return` на втором проходе.
2. **Рерайт стоит денег**: TTFB `/` (через рерайт) — **3,50 мс**, TTFB `/en` (без рерайта) —
   **1,74 мс**. То есть дефолтная локаль вдвое дороже прочих. На фоне 2 мс это неважно, но
   в бюджете «TTFB на VPS» стоит помнить.
3. `matcher` обязан исключать `_next`, `healthz`, `robots.txt`, `sitemap.xml`, `rss.xml`,
   `opengraph-image`, `covers` — иначе proxy выполняется и для них: *«Without a `matcher`,
   Proxy runs on every request, including static files»* **[Д]**.

---

## 13. SEO-выдача — что реально в HTML

`<head>` главной (сокращённо, порядок сохранён):

```html
<!DOCTYPE html><html lang="ru" class="inter_…__variable"><head>
<meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="preload" href="/_next/static/media/inter_cyrillic…woff2" as="font" crossorigin="" type="font/woff2"/>
<link rel="preload" href="/_next/static/media/inter_latin…woff2" as="font" crossorigin="" type="font/woff2"/>
<link rel="stylesheet" href="/_next/static/chunks/….css" data-precedence="next"/>
<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/154u….js"/>
<script src="…/2-….js" async=""></script>  … ещё 6 async-скриптов …
<meta name="theme-color" content="#fbfbfa" media="(prefers-color-scheme: light)"/>
<title>stit demo — Эталонный контент-сайт…</title>
<meta name="description" content="…"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="https://demo.example.org"/>
<link rel="alternate" hrefLang="ru" href="https://demo.example.org"/>
<link rel="alternate" hrefLang="en" href="https://demo.example.org/en"/>
<link rel="alternate" hrefLang="x-default" href="https://demo.example.org"/>
<meta property="og:title" …/><meta property="og:description" …/><meta property="og:url" …/>
<meta property="og:site_name" content="stit demo"/><meta property="og:locale" content="ru_RU"/>
<meta property="og:image" content="https://demo.example.org/covers/ssr-i-indeksatsiya.png"/>
<meta property="og:image:width" content="1600"/><meta property="og:image:height" content="900"/>
<meta property="og:image:alt" …/><meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>…
<meta name="next-size-adjust" content=""/>
<script src="…/0cz1….js" noModule=""></script>
</head>
```

Наблюдения:

- **`hrefLang`, а не `hreflang`.** React сериализует имя пропа как есть; HTML-парсер
  регистронезависим, так что это валидно и Google/Яндекс прочитают. Но e2e-ассерты и `grep`
  надо писать регистронезависимо (та же ловушка была в спайке `06`, §7.13).
- **canonical главной — `https://demo.example.org` без завершающего `/`.** Это наша функция
  `absoluteUrl('/')`, а не Next. Формально валидно (URL резолвится в `/`), но в шаблоне лучше
  нормализовать до `…/`.
- Семь `<script async>` в `<head>` — не `defer`, не в конце `<body>`. Порядок «контент → состояние»
  (канон I-25) App Router не соблюдает: RSC-пейлоад раскидан по `<script>self.__next_f.push(...)`
  внутри `<body>`, вперемешку с разметкой.
- **Бюджет HTML (канон I-24 ≤300 КБ)** соблюдается с большим запасом: максимум 29,3 КБ на `/blog`.
- `JsonLd` рендерится сервером; на посте два блока — `Article` и `BreadcrumbList`, на главной —
  `@graph` с `Organization` + `WebSite`.
- **`X-Robots-Tag` из `proxy.ts` доезжает и до пререндеренных ответов** — то есть staging-режим
  закрывается одним env без пересборки **[П]**.
- **Утечка `x-middleware-rewrite`.** Каждый ответ, прошедший через рерайт, несёт
  `x-middleware-rewrite: http://localhost:3204/ru` — наружу уезжает внутренний путь **и внутренний
  хост** (`localhost:3204`, а не публичный домен). На `/en` заголовка нет. В шаблоне это надо
  снимать — либо `response.headers.delete(...)` нельзя (заголовок ставит рантайм после proxy),
  либо `secure-headers`-middleware Traefik'а с `customResponseHeaders: { x-middleware-rewrite: "" }` **[?]**.

---

## 14. Режимы рендеринга, кеш и ISR

| маршрут | режим | `Cache-Control` | `x-nextjs-cache` |
|---|---|---|---|
| `/`, `/en`, `/about`, `/contact`, `/contact/thanks` | SSG (`generateStaticParams`) | `s-maxage=31536000` | `HIT` |
| `/blog`, `/blog/page/N` | ISR `revalidate = 60` | `s-maxage=60, stale-while-revalidate=31535940` | `HIT`/`MISS` |
| `/blog/<slug>` | ISR `revalidate = 3600` | `s-maxage=3600, stale-while-revalidate=31532400` | `HIT`/`MISS` |
| `/now` | `dynamic = 'force-dynamic'` | `private, no-cache, no-store, max-age=0, must-revalidate` | — |
| `/robots.txt`, `/sitemap.xml` | `force-dynamic` | `public, max-age=0, must-revalidate` | — |
| `/rss.xml` | route handler `force-dynamic` + свой заголовок | `public, max-age=600` | — |
| `/healthz` | route handler | `no-store` | — |

- **Где физически лежит ISR.** Регенерация пишет **не** в `.next/cache`, а обратно в
  `.next/server/app/<route>.{html,rsc,meta}` и `<route>.segments/**` (проверено по mtime) **[П]**.
  `.next/cache` в рантайме содержит только `images/`. Это ключевой факт для `read_only`.
- **`revalidatePath`** работает: `HIT → MISS → HIT`, контент перегенерирован с текущим env.
  Секрет проверяется в route-хендлере (`401` на чужой). `revalidateTag` в спайке не гонялся
  (для fs-кеша страниц он эквивалентен; в 16.0 второй аргумент — профиль — стал обязательным **[Д]**).
- **200 параллельных на «холодный» ISR** (сразу после `revalidatePath('/ru/blog')`): 200 × 200 OK
  за 0,54 с (372 rps), из них **6 ответов с `x-nextjs-cache: MISS` и 194 с `HIT`**, ETag —
  **один на все 200**. То есть коалесинг есть, но неполный: вместо одного рендера их около
  шести (окно, пока первый ещё не записал результат). Для дорогого рендера это надо иметь
  в виду; лавины на 200 рендеров не будет **[П]**.
- **`Cache-Control` пререндера — проблема канона.** `s-maxage=31536000` **без** `max-age`:
  shared-кеш (если появится) закеширует HTML на год, а браузер получит право на эвристическую
  свежесть. Канон P-15 требует `no-cache` + ETag. Лечится `headers()` в `next.config.ts` —
  но осторожно: ISR-ответам нужен свой `s-maxage`.
- **`read_only: true`** (проверено тремя вариантами):
  - без tmpfs: страницы и картинки отдаются, но в логах `unhandledRejection: ENOENT … mkdir
    '/app/.next/cache'` (кеш оптимизатора) и `EROFS … open '/app/.next/server/app/ru/blog.html'`
    при ISR-регенерации;
  - `--tmpfs /app/.next/cache` → чисто: 0 ошибок FS, кеш картинок `MISS → HIT` работает,
    но ISR-запись по-прежнему упрётся в EROFS;
  - `--tmpfs /app/.next/server/app` → **всё ломается (500)**: tmpfs закрывает собой пререндеры.

  **Вывод: `read_only: true` + ISR несовместимы.** Варианты: (а) отказаться от `read_only`,
  (б) `read_only` + tmpfs на `.next/cache` и маршруты **без** `revalidate` (чистый SSG + релиз
  как инвалидация), (в) `experimental.isrFlushToDisk: false` — в спайке не проверено **[?]**.

### 14.1 Graceful shutdown — что именно происходит

Исходник `node_modules/next/dist/server/lib/start-server.js` (16.3.5):

```js
const cleanup = (signal) => { …
  await new Promise((res) => {
    server.close((err) => { … res() })
    if (isDev) {                       // ← ТОЛЬКО в dev
      server.closeAllConnections()
      closeUpgraded?.()
    }
  })
  await Promise.all([nextServer?.close(), cleanupListeners?.runAll()])
  await flushAllTraces()
  switch (signal) { case 'SIGINT': process.exit(130); case 'SIGTERM': process.exit(143) … }
}
if (!process.env.NEXT_MANUAL_SIG_HANDLE) {
  process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup)
}
```

Измерено **[П]**:

| сценарий | результат |
|---|---|
| простаивающее keep-alive соединение висит, SIGTERM | процесс вышел за **0,5 с**, exit 143 |
| 40 запросов «в полёте» (`/sitemap.xml`, все соединения установлены), SIGTERM через 120 мс | **16 завершились 200, 24 получили обрыв соединения** (`%{http_code}` = 000) |
| 150 запросов с наращиванием параллелизма, SIGTERM через 350 мс | 30 × 200, 120 × обрыв |
| `docker stop -t 30` при том же сценарии | вернулся за **0,33 с**, `ExitCode=143` |
| один раз после аварийно убитого Playwright-клиента | процесс **не вышел за 5 минут** (у `server.close()` нет таймаута; `closeAllConnections()` в prod не вызывается) — снят `kill -9` |

**Практический вывод для `<org>/infra`:** всегда `docker stop -t 15…30` (Docker досылает SIGKILL
по истечении grace period) и не рассчитывать, что процесс уйдёт сам. Кастомный дренаж — через
`NEXT_MANUAL_SIG_HANDLE=true` + свой обработчик (док показывает `_document.js` Pages Router;
для App Router — `instrumentation.ts#register`). Окно недоступности при `make bump` остаётся
принятым компромиссом (`04` §6).

---

## 15. `cacheComponents` / PPR — статус и вердикт

Флаг **top-level и стабильный**: `cacheComponents: true` (не `experimental.*`), version history —
«16.0.0 `cacheComponents` introduced. This flag controls the `ppr`, `useCache`, and `dynamicIO`
flags as a single, unified configuration» **[Д]**
https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents.

Что произошло при включении на нашем коде **[П]**:

1. Сборка падает на **каждом** route segment config: `Route segment config "revalidate" is not
   compatible with 'nextConfig.cacheComponents'. Please remove it.` — то же для `dynamicParams`
   и `dynamic`. То есть §9.3 и §9.4 (весь рецепт честного 404) становятся невозможны.
2. `unstable_cacheLife`/`unstable_cacheTag` **стабилизированы**: `Error: 'unstable_cacheTag' was
   recently stabilized and should be imported as 'cacheTag'`. Импорт — `import { cacheLife,
   cacheTag } from 'next/cache'`.
3. Любое недетерминированное значение в пререндере — ошибка сборки:
   `Next.js encountered the unstable value 'new Date()' while prerendering` (у нас — год в
   подвале и время на `/now`). Варианты из сообщения: `await connection()`, `'use cache'`,
   `'use client'`, `performance.now()`.
4. Дальше — `Next.js encountered uncached or runtime data during prerendering … accessed outside
   of <Suspense>` с новым сегмент-конфигом в подсказке: **`export const instant = false`**
   («allow a blocking route»). Пришлось поставить и на `/now`, и на `global-not-found.tsx`.
5. После этого сборка проходит: в таблице маршрутов появляются `◐ (Partial Prerender)` и колонки
   `Revalidate / Expire` (`1d / 1w` от `cacheLife('days')`), `/now` отдаёт `x-nextjs-postponed: 1`.

**Но**: `robots.txt`, `sitemap.xml`, `rss.xml` стали `○ (Static)` и **запекли origin билда** —
при запуске с `SITE_URL=https://ppr.example.org` они продолжали отдавать `http://127.0.0.1:3204`.
И `/blog/net-takogo` вернулся к 404 с пустым телом.

**Вердикт.** Для контент-сайта, где 95 % маршрутов полностью статичны, PPR не даёт ничего
(нечего стримить), а забирает route segment configs, на которых держатся честный 404 и
runtime-`SITE_URL`. Включать не надо. Если когда-нибудь понадобится — это отдельная миграция
с `'use cache'`, `cacheLife`, `instant` и переписанными `robots`/`sitemap` на
`connection()`-маршруты.

---

## 16. Гейт: инструменты наследия

| инструмент | статус | детали |
|---|---|---|
| **TypeScript 6.0.3** `tsc --noEmit` | ✅ 7,4 с | Плагин `next` в `tsconfig#plugins`; `next-env.d.ts` в 16 импортирует `./.next/types/routes.d.ts` и `root-params.d.ts` — файл **генерируется**, из форматтера/линтера исключать |
| **ESLint 9.39.5** + `eslint-config-next@16.3.5` | ✅ 8–10 с | flat-конфиг нативный; `next lint` удалён в 16 — запускать `eslint .` |
| **eslint-plugin-boundaries 7.2.0** | ✅ | ловит `entities→features`, `entities→widgets`, `entities→views`, cross-slice внутри `views`, deep-import `@/*/*/*/*` |
| **Biome 2.5.13** | ✅ 1 с | `.tsx` родной; CSS с `@theme` — только с `css.parser.tailwindDirectives: true`; `linter.rules.recommended` → `preset` |
| **Vitest 4.1.11** | ✅ 13 тестов / 0,4 с | схема Zod (4), `shared/seo` инварианты (5), `PostCard` (3, `renderToStaticMarkup`), **async RSC** (1) |
| **Playwright 1.63.0** | ✅ 20 тестов / 3,3 с | `webServer` поднимает **standalone**-сервер, а не `next dev` — тестируется артефакт релиза |
| **Steiger 0.6.0 / plugin 0.7.0** | ⚠️ 4,6 с | работает, но слой `views` невидим (§10.2); три выключенных правила |
| **size-limit 11.2.0** | ✅ | только со своим `.size-limit.cjs` (§4.7) |

### Как тестировать async RSC в Vitest

```tsx
// src/views/home/ui/home-page.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePage } from './home-page'

// async RSC не рендерится renderToStaticMarkup напрямую: вызываем как функцию,
// ждём промис и рендерим уже готовое дерево.
describe('HomePage (async RSC)', () => {
  it('содержит h1 и три последних поста', async () => {
    const tree = await HomePage({ locale: 'ru' })
    const html = renderToStaticMarkup(tree)
    expect(html).toContain('<h1')
    expect((html.match(/<article/g) ?? []).length).toBe(3)
    expect(html).toContain('application/ld+json')
  })
})
```

Работает без `@testing-library/react` и без jsdom (`environment: 'node'`). Синхронные серверные
компоненты (`PostCard`) рендерятся напрямую; `next/image` и `next/link` внутри `renderToStaticMarkup`
отрабатывают штатно и дают настоящий `srcset` оптимизатора и `loading="lazy"` **[П]**.
Единственное препятствие — `import 'server-only'`: пакет транзитивный, под pnpm вне RSC-графа
не резолвится (`Cannot find package 'server-only'`), лечится alias'ом (§4.6).

`e2e/seo.spec.ts` (20 тестов) покрывает: сырой HTML (h1 + canonical + hreflang + JSON-LD +
`<html lang>`), `Article`-разметку и абсолютный og:image, en-зеркало, 6 статус-кейсов,
`robots.txt`/`sitemap.xml`/`rss.xml` (только свой origin, без `changefreq`), **работу без JS**
(чтение, навигация, нативный POST формы с PRG, honeypot), работу с JS (Server Action + time-trap),
и запрос от Googlebot.

---

## 17. Форма: прогрессивное улучшение

- Форма — client-компонент (`'use client'`) с `useActionState(submitContact.bind(null, locale))`.
  Единственный клиентский чанк `/contact` — **5 094 Б raw / 2 431 Б gzip**; вся остальная разница
  с `/about` — рантайм React, который и так грузится.
- **Без JS работает.** Playwright с `javaScriptEnabled: false`: заполнение → submit → браузер
  оказывается на `/contact/thanks`, виден блок «Спасибо!» **[П]**. Next сериализует Server Action
  в скрытые поля формы, нативный POST уходит на текущий URL, `redirect()` внутри экшена даёт PRG.
- **Honeypot** (`website`, спрятан offscreen) уводит на «спасибо» молча — бот не получает сигнала.
- **Time-trap — половинчатый.** Страница `/contact` пререндерена, серверного «времени открытия»
  в разметке нет; поле `openedAt` заполняет `useEffect`. Значит без JS проверка **не работает**
  (и это правильно — иначе легитимный пользователь без JS был бы забанен). Честные варианты для
  шаблона: (а) оставить как есть и полагаться на honeypot + rate-limit Traefik; (б) сделать
  `/contact` динамической и выдавать подписанный токен с TTL (теряется пререндер); (в) выдавать
  токен отдельным `force-dynamic` эндпоинтом и подтягивать его JS-ом (то же, что (а), но сложнее).
- PRG сделан отдельным маршрутом `/contact/thanks` (пререндеренным, `noindex`), а не
  `?sent=1` — иначе чтение `searchParams` сделало бы `/contact` динамической.

---

## 18. Подводные камни (сводно, с адресами)

| # | камень | где проявилось | ссылка |
|---|---|---|---|
| 1 | `notFound()` из страницы → 404 с **пустым body** | §9.4 | https://nextjs.org/docs/app/api-reference/file-conventions/loading (Status Codes) |
| 2 | `loading.tsx` превращает 404 в 200 soft-404 | там же | там же |
| 3 | `revalidatePath` + `dynamicParams=false` → вечный 404 (`NoFallbackError`) | §9.3 | https://nextjs.org/docs/app/api-reference/functions/generate-static-params · https://github.com/vercel/next.js/issues/87738 |
| 4 | `NextResponse.rewrite(url, { status })` — статус игнорируется | §9.4 | https://nextjs.org/docs/app/api-reference/file-conventions/proxy (Producing a response) |
| 5 | `NextResponse.rewrite()` повторно запускает `proxy` → петля с локалью | §12 | (эмпирика; в докe не описано) |
| 6 | `proxy` без `matcher` выполняется на `_next/static` и `public/` | §12 | https://nextjs.org/docs/app/api-reference/file-conventions/proxy |
| 7 | `x-middleware-rewrite` с внутренним хостом уезжает клиенту | §13 | (эмпирика) |
| 8 | `src/pages` с любым файлом ломает сборку | §10.1 | https://nextjs.org/docs/messages/page-without-valid-component |
| 9 | `app` и `pages` обязаны быть в одном каталоге | §10.1 | (сообщение сборки) |
| 10 | `pageExtensions` ломает `robots.ts`/`sitemap.ts` (они типизируются как страницы) | §10.1 | (эмпирика, `.next/types/validator.ts`) |
| 11 | standalone не копирует `public/` и `.next/static` | §4.8 | https://nextjs.org/docs/app/api-reference/config/next-config-js/output |
| 12 | `metadataBase: new URL(...)` падает на невалидном плейсхолдере | §4.8 | (эмпирика) |
| 13 | Warning `metadataBase is not set` остаётся даже когда он задан в layout (для `/_not-found`, `/opengraph-image`) | §8 п.23 | https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase |
| 14 | `read_only: true` несовместим с ISR (пишет в `.next/server/app`) | §14 | https://nextjs.org/docs/app/guides/self-hosting |
| 15 | `compress: true` — только gzip, brotli нет | §7 | (эмпирика) |
| 16 | `Cache-Control: s-maxage=31536000` на статике без `max-age` | §14 | https://nextjs.org/docs/app/guides/self-hosting (Automatic Caching) |
| 17 | keep-alive по умолчанию 5 с (риск 502 за Traefik) | §7 | `KEEP_ALIVE_TIMEOUT` в `server.js` |
| 18 | SIGTERM: соединения, принятые но не начавшие обработку, рвутся | §8 п.8 | https://nextjs.org/docs/app/guides/self-hosting (`after`) |
| 19 | `sharp` в образе тянет libvips для **обеих** libc (+18 МБ) | §6 | https://nextjs.org/docs/messages/sharp-missing-in-production |
| 20 | `minimumCacheTTL` картинок: «There is no mechanism to invalidate the cache at this time» | §7 | https://nextjs.org/docs/app/api-reference/components/image#minimumcachettl |
| 21 | `server-only` не резолвится в Vitest под pnpm | §16 | (эмпирика) |
| 22 | `next build` больше не печатает размеры бандлов (с 16.0) | §4.7 | version history CLI |
| 23 | `cacheComponents` запрещает `revalidate`/`dynamicParams`/`dynamic` | §15 | https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents |
| 24 | `unstable_cacheTag`/`unstable_cacheLife` переименованы | §15 | (сообщение сборки) |
| 25 | `<Link>` префетчит RSC-пейлоад всех ссылок в шапке (+17 КБ gzip на просмотр) | §7 | (эмпирика, Playwright) |
| 26 | React печатает `hrefLang`, а не `hreflang` | §13 | (эмпирика; валидно, но ломает наивный grep) |
| 27 | Словарь по ключу локали падает в `generateMetadata` раньше, чем layout вызовет `notFound()` | §9.4 п.5 | (эмпирика, 500 вместо 404) |
| 28 | Дефолтная локаль (через рерайт) вдвое дороже по TTFB, чем префиксная | §12 | (эмпирика) |
| 29 | Забытый `SITE_URL` на билде тихо запекает дефолт из кода в canonical всех пререндеров; сборка зелёная, e2e краснеет через час | §9 | (эмпирика: один `pnpm build` без env стоил получаса отладки) |
| 30 | `pnpm test:e2e` с `reuseExistingServer: true` подхватывает **устаревший** запущенный сервер и тестирует старую сборку | §16 | (эмпирика) |
| 31 | **`next dev` сам пишет в `CLAUDE.md` / `AGENTS.md` проекта** | §18.1 | `node_modules/next/dist/server/lib/generate-agent-files.js` |

### 18.1 `next dev` правит агентную обвязку репозитория

Во время прогона `pnpm dev` в корне спайка появились файлы, которых мы не создавали:

```
AGENTS.md   ← блок между <!-- BEGIN:nextjs-agent-rules --> и <!-- END:… -->
CLAUDE.md   ← ровно одна строка: @AGENTS.md
```

Исходник — `node_modules/next/dist/server/lib/generate-agent-files.js` (16.3.5), заголовок
файла: *«Auto-generate AGENTS.md / CLAUDE.md with the managed Next.js agent-rules block when
`next dev` detects an AI coding agent but the block is missing»*. Логика `writeAgentFiles()`:

| состояние репозитория | что делает `next dev` |
|---|---|
| нет ни `AGENTS.md`, ни `CLAUDE.md` | **создаёт оба**: `AGENTS.md` с блоком, `CLAUDE.md` = `@AGENTS.md` |
| есть `AGENTS.md` | **upsert блока в `AGENTS.md`**, `CLAUDE.md` не трогает |
| есть только `CLAUDE.md` | **upsert блока прямо в `CLAUDE.md`** |

Сам блок про себя пишет: *«This block is written and re-added by `next dev`. Removing it from a
diff only re-creates the uncommitted change»*.

**Для нашей экосистемы это прямой конфликт**: в шаблонах `CLAUDE.md` — ядро агентной обвязки и
единственный источник правил, `AGENTS.md` нет. Значит при первом же `pnpm dev` Next допишет свой
блок **внутрь `CLAUDE.md`** и будет восстанавливать его после каждого удаления → вечный
незакоммиченный diff и чужой текст в файле, который читают все агенты.

Митигация (если Next всё-таки берут): **закоммитить собственный `AGENTS.md`** — тогда Next пишет
туда, а `CLAUDE.md` остаётся нетронутым; в `CLAUDE.md` добавить строку-роутер на `AGENTS.md` и
правило «блок `nextjs-agent-rules` — управляемый Next, руками не править».

---

## 19. Вердикт: насколько это грамотно для контент-first сайта в нашей экосистеме

**Сильные стороны (объективно лучшие в подборке):**

- **Единственный настоящий ISR без CDN** с fs-кешем, `x-nextjs-cache`, `revalidatePath`/`revalidateTag`
  и заголовками `s-maxage`/`swr` — из коробки, без единой строки своего кода.
- **Самый полный SEO-инструментарий как API фреймворка**: `generateMetadata` с
  `alternates.canonical`/`languages`, `metadataBase`, OG/Twitter, `app/sitemap.ts` с hreflang,
  `app/robots.ts` (в 16.3 с полем `other` под `Clean-param`), `opengraph-image.tsx` на satori
  (без Chromium, работает на alpine), `next/font` с self-host и `size-adjust`, `redirects()`
  с произвольными кодами, `trailingSlash`.
- **`next/image` на self-host** — AVIF/WebP с переговорами по `Accept`, дисковый кеш, `sharp`
  ставится сам под musl. 4,4 КБ AVIF против 32 КБ PNG.
- **Зрелость**: Active LTS до 2027 (https://nextjs.org/support-policy), годовой каденс, `llms.txt`,
  документация, которая отвечает на вопросы этого спайка почти дословно.
- **Инструменты наследия заводятся полностью** — `.tsx` родной формат для Biome/ESLint/Vitest/
  Steiger, никаких tree-sitter-парсеров и «partial support».

**Слабые стороны, критичные именно для контент-first:**

1. **138 КБ gzip JS на странице без интерактива** — это плата за RSC-модель, её нельзя снизить
   конфигом. Для сравнения (мини-бенч `07` §7.1 на такой же странице): Eleventy 0 Б, SolidStart
   15,3 КБ, Qwik 42,7 КБ, React Router 8 106,9 КБ. Плюс 17,3 КБ RSC-префетчей на каждый просмотр.
   На VPS без CDN и на мобильном RU-трафике это прямой минус к LCP/INP и к счёту за трафик.
   HTTP Archive 2026-08: Next App Router — 38,3 % origin'ов с хорошим CWV на мобильном при
   медианных 664 КБ JS (`07` §2.9).
2. **Честный 404 — не дефолт, а рецепт из пяти правил**, и один из них (`dynamicParams = false`)
   взаимоисключает вебхук-инвалидацию. Для шаблона, который форкают, это очень дорогая мина:
   ошибка не видна на билде и проявляется как «страница пропала после публикации в CMS».
3. **FSD стоит либо слепого Steiger'а (вариант `src/views`), либо удвоенных суффиксов у всех
   файлов маршрутов и потери метаданных-конвенций (вариант `pageExtensions`).** Оба варианта
   требуют правок `/scaffold`, `steiger.config.ts`, `eslint.config.mjs` и объяснений в
   `.claude/rules/fsd-architecture.md`.
4. **Нет контент-слоя.** `content-collections` (0.5.0) закрывает дыру, но это ещё одна внешняя
   зависимость на 0.x в фундаменте шаблона.
5. **`read_only: true` придётся снять** (или отказаться от ISR) — регресс относительно текущего
   nginx-образа SPA.
6. **Turbopack вместо Vite** — вся экосистема плагинов SPA-шаблона (Rolldown-группы, `size-limit`
   по чанкам, `analyze`) не переносится; пришлось писать свой счётчик бюджета.

**Где Next всё-таки правильный выбор** (совпадает с `07` §4.2): если у проекта >50 % маршрутов
за логином, если нужен ISR с общим кешем на нескольких инстансах (`cacheHandler` + `refreshTags`),
если требуется письменный LTS для тендера, или если у заказчика уже есть `<org>/frontend` на
`spa-frontend-template` и общая ментальная модель React дороже килобайтов.

**Для профиля «лендинги, блоги, каталоги, доки; интерактив точечный» — не рекомендую.** Next
выигрывает по инструментарию (вес 20) и зрелости (15), но проигрывает по главному критерию —
качество выдачи (вес 25) — на два порядка по JS и заметно по CWV в поле, и вдобавок дороже всех
по «совместимости с наследием» (вес 15). Спайк выполнил свою роль контрольной точки: он показывает
**потолок React-first** и даёт цифры, относительно которых надо читать спайки 08–10.

---

## 20. Что осталось непроверенным (вопросы владельцу и следующему прогону)

1. **`experimental.isrFlushToDisk: false`** как способ помирить `read_only: true` с ISR — не
   проверялось (нужен ещё один цикл сборки образа).
2. **`pnpm.supportedArchitectures: { libc: ['musl'] }`** — ожидаемая экономия ~18 МБ образа,
   не проверялось.
3. **`revalidateTag` + профиль** (обязательный второй аргумент с 16.0) — не гонялся; для fs-кеша
   страниц должен быть эквивалентен `revalidatePath`.
4. **Поведение за Traefik**: двойное сжатие (Traefik `compress` поверх gzip Next), буферизация
   стрима, `x-middleware-rewrite` в `customResponseHeaders` — требует живого стенда.
5. **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` и `deploymentId`** — нужны только при >1 реплики;
   в нашей инфре одна реплика, но `deploymentId` полезен против version skew при rolling-обновлении.
6. **Решение владельца**: если Next всё-таки берут, надо зафиксировать режим контента
   (git vs CMS, §9.3) и вариант FSD (`views` vs `pageExtensions`, §10.1) **до** написания скиллов —
   они разворачивают разные деревья.

---

## 21. Источники

**Документация Next.js (версия страниц 16.3.5, все проверены 2026-09-16)**
- https://nextjs.org/docs/app/guides/self-hosting
- https://nextjs.org/docs/app/api-reference/file-conventions/not-found
- https://nextjs.org/docs/app/api-reference/file-conventions/loading (Status Codes, SEO)
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- https://nextjs.org/docs/app/api-reference/functions/generate-static-params
- https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
- https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
- https://nextjs.org/docs/app/api-reference/components/image#minimumcachettl
- https://nextjs.org/docs/messages/sharp-missing-in-production
- https://nextjs.org/docs/messages/page-without-valid-component
- https://nextjs.org/docs/messages/blocking-prerender-current-time
- https://nextjs.org/docs/messages/blocking-prerender-dynamic
- https://nextjs.org/support-policy

**Прочее**
- https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (конфликт директив)
- https://github.com/vercel/next.js/issues/87738 (`dynamicParams=false` и NoFallbackError)
- https://www.npmjs.com/package/@content-collections/next · https://www.npmjs.com/package/@content-collections/core
- https://www.jsboundaries.dev/docs/releases/migration-guides/v5-to-v6/ и v6-to-v7 (API boundaries)

**Локальные артефакты этого прогона**
- `scratchpad/spike-next/` — код, конфиги, `measure.sh`, `measure-browser.mjs`, `srv.sh`,
  `docker/`, `.probe/` (проба `pageExtensions`), `.probe2/` (проба `notFound()` на голом проекте)
- смежные отчёты: `research/07-landscape-v2.md` §2.4 и §5.4 (оценки Next — подтверждены,
  см. §22), `research/02-seo-canon.md` §3.2, `research/04-runtime-deploy.md` §3.1,
  `research/14-content-architecture.md` §2.2.2–2.2.6

---

## 22. Сверка с оценками `07-landscape-v2.md` §2.4

| утверждение отчёта 07 | эмпирика спайка |
|---|---|
| «`cacheComponents` — top-level опция, не `experimental.*`, стабильна, но не дефолт» | **подтверждено** |
| «ISR без CDN работает, `.next/cache`, заголовок `x-nextjs-cache`» | **частично**: заголовок и механика — да; **но страницы пишутся в `.next/server/app`, а не в `.next/cache`** (в `.next/cache` — только `images/`) |
| «`public/` и `.next/static` надо копировать руками» | **подтверждено** |
| «`proxy.ts` — Node runtime, без `matcher` работает на `_next/static`» | **подтверждено** |
| «`redirects()`: `permanent` → 308/307, 301/302 — через `statusCode`» | **подтверждено** (301 и 308 получены) |
| «`ImageResponse` через satori, Chromium не нужен» | **подтверждено на alpine** |
| «`sharp` ставится вручную для standalone» | **подтверждено**, и в образ едут обе libc |
| «метрики размера JS убраны из `next build` в 16.0 → бюджет считать самим» | **подтверждено**, написан свой `.size-limit.cjs` |
| «`'use cache'` роняет рантайм, а не билд, если внутри `cookies()`/`headers()`» | **не воспроизводилось**: в 16.3.5 все наши нарушения поймались **на билде** (`blocking-prerender-*`) |
| «спайк 11 был вынужден положить FSD-слой pages в `src/views/`» | **подтверждено и дообъяснено**: есть второй путь (`pageExtensions`) со своей ценой |
| «`revalidateTag` без второго аргумента deprecated с 16.0» | не проверялось |
| JS «выглядел высоким, проверялось» | **измерено точно**: 137,7 КБ gzip на `/about`, из них 39,4 КБ — legacy-бандл, который браузер **не** грузит; «честные» 137,7 КБ — это modern-набор |
