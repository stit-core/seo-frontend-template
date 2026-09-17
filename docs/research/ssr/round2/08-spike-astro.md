# 08 — Эмпирическая проверка (spike): Astro 7 как основа `ssr-frontend-template`

Каталог кода: `scratchpad/spike-astro/`. Все цифры получены прогоном 16.09.2026 на этой
машине: Node v24.9.0, pnpm 10.0.0, Docker 29.8.0, Linux 6.12, 20 CPU. Порт 3201
(контейнеры — 3211, вспомогательный процесс — 3212/3213).
Параллельно на машине работали другие спайки — там, где это влияет на цифру, помечено «шум».

## 1. TL;DR

- **Эталонный контент-сайт из `brief-v2.md` собран и работает целиком**: 12 постов
  Markdown + Zod-схема, пагинация, `/en/*`, контакт-форма (работает **без JS**), `/now`
  on-demand, `/healthz`, `robots.txt`, `sitemap.xml`, `rss.xml`, 301 на `/old`, честные
  404. Полный гейт зелёный: `pnpm check` (astro check + Biome + ESLint + Vitest + Steiger +
  build + size-limit) = **12 с, 0 ошибок**; Playwright — **9/9**.
- **Главное достижение по качеству выдачи: ноль байт JS.** На `/`, `/blog`,
  `/blog/<slug>`, `/about`, `/en` Playwright не зафиксировал **ни одного** script-ресурса.
  Документ главной — 8 037 B raw / **2 467 B gzip**, поста — 8 298 / **2 804 B gzip**.
  Единственная страница с JS — `/contact`: **93 КБ gzip** (React 19 + react-dom).
- **Node standalone отдаёт prerender сам** — провала Nitro из `06-spike.md` §7.2 нет:
  `GET /` = файл с диска, TTFB **медиана 0.85 мс**; `_astro/*` отдаётся с
  `Cache-Control: public, max-age=31536000, immutable`. Но **только на GET** — на HEAD
  адаптер теряет `immutable` (баг, §7.3).
- **Смертельная ловушка конфига**: `build.format: 'file'` + `@astrojs/node` ⇒ родительские
  маршруты с дочерними (`/blog`, `/en`) отдают **404**. Лечится только
  `build.format: 'directory'` (§7.1). Это ловушка «в проде, не в dev».
- **Развилка «один образ на все среды» решается вариантом C** (плейсхолдер + штамповка):
  32 файла штампуются за **0–10 мс** при старте контейнера, выдача идентична A,
  никакого runtime-оверхеда. Вариант D (`output: 'server'` + `memoryCache`) работает
  и даёт честный runtime-origin, но платит: картинки пересжимаются на каждый запрос
  (**+300 мс TTFB**, RSS **360 МБ** после 50 параллельных), кеш **не дедуплицирует**
  параллельные промахи (200 запросов на холодный ключ = **141 реальный рендер**).
- **Астро-специфичный провал SEO-контура staging**: на prerendered-страницы нельзя
  поставить runtime-заголовок **ничем** — ни middleware, ни новым `src/fetch.ts`
  (Advanced Routing), ни `staticHeaders` адаптера (он несёт только CSP). Остаётся
  Traefik `customResponseHeaders` или вариант D.
- **Гейт с FSD работает**, но с оговорками: Biome **линтит** `.astro` (и обязателен флаг
  `html.experimentalFullSupportEnabled: true`, иначе 1 ложный `noUnusedVariables` на
  каждый frontmatter-const) и **не форматирует** их вовсе; Steiger видит импорты в
  frontmatter и ловит cross-slice/выше-по-слою/deep-import, но **слеп к импортам,
  целью которых является `.astro`-файл**, и **к re-export'ам**.
- **FSD-конфликт №1 (важный)**: Astro Action, реэкспортированный из `index.ts` слайса,
  утаскивает `astro:actions` в клиентский чанк острова и **убивает гидрацию**
  (`defineAction() unexpectedly used on the client`). Server-only код нельзя класть в
  public API слайса — это прямой конфликт с правилом FSD.
- **Эксплуатация**: адаптер **не ставит ни graceful shutdown, ни keep-alive**
  (SIGTERM убивает процесс за 30 мс, рвёт запрос в полёте; `Keep-Alive: timeout=5`).
  Чинится 25-строчной обёрткой (`docker/server.mjs`) через `ASTRO_NODE_AUTOSTART=disabled`
  → `docker stop` за **0.26 с** с дренажем. Образ — **315.7 МБ** (из них node_modules 217 МБ:
  `astro` тянет vite/rolldown/esbuild/lightningcss в runtime-зависимости).
- **Вердикт: Astro 7 — сильнейший кандидат для контент-first сайта в нашей экосистеме**
  (см. §11), но требует ~10 «дописанных самими» вещей, все они дешёвые и перечислены в §12.

---

## 2. Версии (факт)

`pnpm ls --depth 0` в `scratchpad/spike-astro/`:

```
dependencies:
@astrojs/node 11.1.5      @astrojs/react 6.0.5     @astrojs/rss 4.0.19
@astrojs/sitemap 3.7.4    astro 7.3.2              react 19.3.0
react-dom 19.3.0          sharp 0.35.4             zod 4.6.5

devDependencies:
@astrojs/check 0.9.10          @biomejs/biome 2.5.13      @eslint/js 10.0.1
@feature-sliced/steiger-plugin 0.7.0                      @fontsource-variable/inter 5.3.0
@playwright/test 1.63.0        @size-limit/file 13.1.1    @tailwindcss/vite 4.3.3
@types/node 26.5.1             @types/react 19.3.0        @types/react-dom 19.3.0
astro-eslint-parser 3.1.0      eslint 10.10.0             eslint-plugin-astro 3.1.0
globals 17.12.0                size-limit 13.1.1          steiger 0.6.0
tailwindcss 4.3.3              typescript 6.0.3           typescript-eslint 8.70.0
vitest 5.0.1
```

Транзитивные, важные для понимания:

| пакет | версия | зачем важно |
|---|---|---|
| `vite` | **8.3.0** | Astro 7 стоит на Vite 8 (Rolldown) — тот же мажор, что в SPA-шаблоне |
| `rolldown` | 1.2.8 | бандлер; в образ едут **обе** нативные бинарки (gnu + musl), 37 МБ |
| `unstorage` | 1.17.5 | драйверы сессий (`sessionDrivers.fsLite`) |
| `lru-cache` | 11.5.2 | не используется кеш-провайдером: `memoryCache` имеет **свой** `LRUMap` |
| `@bruits/satteri` | 0.10.5 | Rust-процессор Markdown (Astro 6.4+), 8 МБ обеих бинарок |
| `@astrojs/compiler-binding-*` | 0.4.1 | Rust-компилятор `.astro` (Astro 7), 14 МБ обеих бинарок |
| `send` | 1.2.1 | статик-хендлер `@astrojs/node`; причина HEAD-бага (§7.3) |
| `shiki` + `@shikijs/langs` | 4.4.3 | подсветка кода в Markdown, 15 МБ в prod-деревe |

Установка воспроизводима: `pnpm install --frozen-lockfile` — **2.1 с**, лок не менялся
(после переноса `sharp` из `devDependencies` в `dependencies` — `pnpm install --lockfile-only`).

### Контекст экосистемы (проверено 2026-09-16)

- **Cloudflare купила The Astro Technology Company; объявлено 16.01.2026.** Пресс-релиз:
  *«Astro will remain open source to ensure the long-term growth and development of the
  project under Cloudflare's stewardship»*; Fred Schott: *«Astro will continue to be the
  best way for developers to build content-driven websites, whether they host on
  Cloudflare or elsewhere»*; обещан Astro Ecosystem Fund совместно с Webflow, Netlify,
  Wix, Sentry. **[П]**
  https://www.cloudflare.com/press/press-releases/2026/cloudflare-acquires-astro-to-accelerate-the-future-of-high-performance-web-development/
- **Astro 7.0 — 22.06.2026**: Vite 8, Rust-компилятор `.astro`, Advanced Routing
  (`src/fetch.ts`), Response Caching API (`Astro.cache`, `routeRules`, `memoryCache()`),
  background dev server (демон), structured logging. Сборки быстрее на 15–61 %.
  Ломающее: компилятор больше не чинит невалидный HTML, незакрытые теги — ошибка,
  JSX-правила переносов. **[П]** https://astro.build/blog/astro-7/
- **Astro 7.3 — 03.09.2026** (текущий на момент спайка). **[П]** https://astro.build/blog/
- **Astro 6.4 — 28.05.2026**: pluggable Markdown processor API + Rust-процессор (Sätteri).
  **[П]** https://astro.build/blog/

Риск «зрелости» после покупки Cloudflare — не в лицензии (MIT сохранён), а в приоритетах:
CDN-провайдеры кеша (`cacheNetlify`, `cacheVercel`, `cacheCloudflare`) в Astro 7 уже
first-class, а `memoryCache()` — единственный не-платформенный. Для self-host без CDN это
ровно то, что нужно, но развитие именно этой ветки не гарантировано. **[?]**

---

## 3. Итоговые конфиги

### `astro.config.ts`

```ts
import node from '@astrojs/node'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, memoryCache } from 'astro/config'

// Три варианта развилки «один образ на все среды»:
//  A (static)      — prerender всего; SITE_URL зашивается на сборке;
//  C (placeholder) — prerender с плейсхолдером, штамповка origin при старте;
//  D (server)      — рендер на запрос + кеш в памяти процесса, SITE_URL из env.
const VARIANT = (process.env.SPIKE_VARIANT ?? 'A') as 'A' | 'C' | 'D'

const SITE_URL =
  VARIANT === 'C' ? 'https://__site_origin__' : (process.env.SITE_URL ?? 'http://localhost:3201')

export default defineConfig({
  site: SITE_URL,
  output: VARIANT === 'D' ? 'server' : 'static',
  adapter: node({ mode: 'standalone', experimentalDisableStreaming: true }),

  trailingSlash: 'never',
  // 'file' ломает родительские маршруты, у которых есть дочерние (/blog, /en):
  // статик-хендлер видит каталог и ищет blog/index.html. Только 'directory'.
  build: { format: 'directory' },

  redirects: { '/old': { status: 301, destination: '/' } },

  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    routing: { prefixDefaultLocale: false },
  },

  image: { responsiveStyles: true, layout: 'constrained' },

  // Контентному сайту не нужны сессии; fs-драйвер адаптера пишет в cacheDir
  // и ломает read-only контейнер.
  session: false,

  // Без островов не должно быть ни байта JS — prefetch/view transitions выключены.
  prefetch: false,

  cache: { provider: memoryCache({ max: 500 }) },
  routeRules: {
    '/': { maxAge: 60, swr: 600, tags: ['page', 'blog'] },
    '/about': { maxAge: 300, swr: 3600, tags: ['page'] },
    '/blog': { maxAge: 60, swr: 600, tags: ['blog'] },
    '/blog/[...page]': { maxAge: 60, swr: 600, tags: ['blog'] },
    '/en': { maxAge: 60, swr: 600, tags: ['page', 'blog'] },
    '/en/[...path]': { maxAge: 60, swr: 600, tags: ['page'] },
    '/contact': { maxAge: 300, swr: 3600, tags: ['page'] },
    // /_image в on-demand режиме пересжимает картинку на КАЖДЫЙ запрос (~300 мс) —
    // без этого правила вариант D не годится для страниц с картинками.
    '/_image': { maxAge: 31536000, tags: ['image'] },
    '/rss.xml': { maxAge: 600, swr: 600, tags: ['blog'] },
    '/sitemap.xml': { maxAge: 600, swr: 600, tags: ['blog'] },
    // /now и /healthz намеренно не кешируются: нет maxAge — нет записи в кеш.
  },

  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
})
```

### `steiger.config.ts`

```ts
import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      'fsd/forbidden-imports': 'error',
      'fsd/no-public-api-sidestep': 'error',
      'fsd/public-api': 'error',
      'fsd/insignificant-slice': 'warn',
      'fsd/excessive-slicing': 'warn',
      'fsd/ambiguous-slice-names': 'error',
      'fsd/inconsistent-naming': 'error',
      'fsd/no-segmentless-slices': 'error',
      'fsd/no-reserved-folder-names': 'error',
      'fsd/typo-in-layer-name': 'error',
    },
  },
  {
    // Astro жёстко требует эти пути; это не слои FSD, а точки входа фреймворка.
    ignores: ['src/content.config.ts', 'src/middleware.ts', 'src/fetch.ts', 'src/actions/**'],
  },
  {
    // src/pages — файловый роутинг: index.astro это маршрут '/', подпапки
    // blog/ en/ api/ — сегменты URL, а не слайсы с сегментами.
    files: ['src/pages/**'],
    rules: {
      'fsd/no-layer-public-api': 'off',
      'fsd/no-segmentless-slices': 'off',
      'fsd/no-segments-on-sliced-layers': 'off',
      'fsd/public-api': 'off',
    },
  },
  { files: ['src/app/**'], rules: { 'fsd/segments-by-purpose': 'off', 'fsd/public-api': 'off' } },
])
```

### `biome.json` (ключевое — `html.experimentalFullSupportEnabled`)

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "files": {
    "ignoreUnknown": true,
    "includes": ["**/*.ts","**/*.tsx","**/*.js","**/*.mjs","**/*.astro","**/*.json","**/*.css",
                 "!**/dist","!**/node_modules","!**/.astro"]
  },
  // БЕЗ этого флага Biome линтит только frontmatter .astro и выдаёт ложный
  // noUnusedVariables на каждый const, использованный в шаблоне.
  "html": { "experimentalFullSupportEnabled": true },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2,
                 "lineWidth": 100, "lineEnding": "lf" },
  "javascript": { "formatter": { "quoteStyle": "single", "jsxQuoteStyle": "double",
                  "semicolons": "asNeeded", "trailingCommas": "all", "arrowParentheses": "always" } },
  "css": { "parser": { "tailwindDirectives": true } },
  "linter": { "enabled": true, "rules": { "preset": "recommended",
    "correctness": { "noUnusedVariables": "error" },
    "style": { "useImportType": "error", "useExportType": "error", "useConst": "error" },
    "suspicious": { "noExplicitAny": "warn",
      "noConsole": { "level": "warn", "options": { "allow": ["warn","error","info"] } } } } }
}
```

Никаких `overrides` для `.astro` больше не нужно — с флагом ложных срабатываний нет
(в исходном прогоне они были заглушены `noUnusedVariables: off`; это было лечение симптома).

### `eslint.config.js`

```js
import js from '@eslint/js'
import astro from 'eslint-plugin-astro'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', '.astro/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        // Слайсовые слои: @/<layer>/<slice>/<segment>/<file>
        { group: ['@/*/*/*/*'], message: 'FSD: импорт мимо public API слайса' },
        // shared — sliceless: @/shared/<segment>/<file>  ← в SPA-шаблоне этого паттерна НЕТ
        { group: ['@/shared/*/*'], message: 'FSD: импорт мимо public API сегмента shared' },
      ] }],
    },
  },
  {
    // Точки входа, навязанные Astro. Им приходится обходить public API слайса:
    // server-only код (actions) и content-config нельзя тащить через баррель.
    files: ['src/actions/**', 'src/content.config.ts', 'src/middleware.ts', 'src/fetch.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
)
```

### `vitest.config.ts`

```ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config'

export default getViteConfig({
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'node' },
})
```

`getViteConfig` из `astro/config` даёт тестам виртуальные модули Astro
(`astro:content`, `astro:assets`) и алиас `@/*` — без него тест схемы контента не собрать.

### `.size-limit.cjs`

```js
// Бюджеты клиентских ассетов. Островной JS грузится только на /contact,
// остальные страницы обязаны оставаться нулевыми по JS (проверяется e2e).
module.exports = [
  { name: 'contact island (react 19 + form)', path: 'dist/client/_astro/*.js',
    limit: '100 KB', gzip: true },
  { name: 'css (одна таблица на весь сайт)', path: 'dist/client/_astro/*.css',
    limit: '5 KB', gzip: true },
]
```

### `docker/Dockerfile`

```dockerfile
# ── build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
# A — SITE_URL зашивается на сборке; C — плейсхолдер + штамповка в entrypoint;
# D — origin читается из env на каждый рендер, значение сборки не важно.
ARG SPIKE_VARIANT=C
ARG SITE_URL=https://__site_origin__
ENV SPIKE_VARIANT=${SPIKE_VARIANT} SITE_URL=${SITE_URL}
RUN pnpm build

# ── prod-deps ───────────────────────────────────────────────────────
# Выход Astro НЕ self-contained: entry.mjs импортит astro/react/react-dom/zod,
# а /_image — sharp. Ставим только dependencies.
FROM node:24-alpine AS prod-deps
WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prod
# Build-time машинерия, которую тянет сам `astro`, но которая не нужна рантайму.
RUN rm -rf \
      node_modules/.pnpm/@rolldown+binding-linux-x64-gnu* \
      node_modules/.pnpm/@img+sharp-libvips-linux-x64* \
      node_modules/.pnpm/@img+sharp-linux-x64* \
      node_modules/.pnpm/lightningcss-linux-x64-gnu* \
      node_modules/.pnpm/@astrojs+compiler-binding-linux-x64-gnu* \
      node_modules/.pnpm/@bruits+satteri-linux-x64-gnu* \
      node_modules/.pnpm/@types+node* \
      node_modules/.pnpm/caniuse-lite* \
      node_modules/.pnpm/prismjs*

# ── runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 SITE_URL=https://__site_origin__
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node docker/entrypoint.sh docker/server.mjs /app/docker/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
ENTRYPOINT ["/app/docker/entrypoint.sh"]
# Обёртка вместо прямого entry.mjs: graceful shutdown + keep-alive под Traefik.
CMD ["node", "./docker/server.mjs"]
```

### `docker/entrypoint.sh` — штамповка origin (вариант C)

```sh
#!/bin/sh
set -eu
: "${SITE_URL:?SITE_URL is required}"
PLACEHOLDER='https://__site_origin__'
ORIGIN="${SITE_URL%/}"

if [ "$ORIGIN" != "$PLACEHOLDER" ]; then
  start=$(date +%s%N)
  count=$(
    find /app/dist -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' -o -name '*.mjs' \) \
      -exec grep -l "$PLACEHOLDER" {} + 2>/dev/null | tee /tmp/stamp.list | wc -l
  )
  if [ "$count" -gt 0 ]; then xargs -r sed -i "s|$PLACEHOLDER|$ORIGIN|g" < /tmp/stamp.list; fi
  end=$(date +%s%N)
  echo "[entrypoint] stamped $count files in $(( (end - start) / 1000000 )) ms: $PLACEHOLDER -> $ORIGIN"
fi

exec "$@"
```

`*.mjs` в списке обязателен: плейсхолдер попадает и в `dist/server/chunks/*.mjs`
(в `astro-config-digest`, откуда берётся `Astro.site`) — 6 файлов из 32.

### `docker/server.mjs` — graceful shutdown + keep-alive (адаптер их не даёт)

```js
process.env.ASTRO_NODE_AUTOSTART = 'disabled'

const { startServer } = await import('../dist/server/entry.mjs')
const { server } = startServer()
const http = server.server

// Traefik/nginx держат idle-соединение дольше, чем дефолтные 5 с Node.
http.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS ?? 65_000)
http.headersTimeout = http.keepAliveTimeout + 5_000

let closing = false
const graceMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 15_000)

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (closing) return
    closing = true
    console.info(`[server] ${signal}: drain up to ${graceMs} ms`)
    http.close(() => { console.info('[server] closed'); process.exit(0) })
    // Без этого close() ждёт простаивающие keep-alive сокеты до таймаута;
    // повторяем, потому что сокет становится idle сразу после своего ответа.
    http.closeIdleConnections()
    const sweep = setInterval(() => http.closeIdleConnections(), 200)
    sweep.unref()
    setTimeout(() => { console.warn('[server] drain timeout, forcing exit'); process.exit(1) },
      graceMs).unref()
  })
}
```

Ключ — недокументированный `ASTRO_NODE_AUTOSTART=disabled` + экспортируемый
`startServer()` из `dist/server/entry.mjs` (читается в
`node_modules/@astrojs/node/dist/server.js`). Так сохраняется весь стандартный
standalone-стек (включая раздачу статики), но появляется доступ к `http.Server`.

### `src/shared/seo/seo-head.astro`

```astro
---
import { getRuntimeConfig, SITE_NAME } from '@/shared/config'
import type { Locale } from '@/shared/i18n'
import { absoluteUrl, alternates } from './urls'

interface Props {
  title: string; description: string; path: string; pathWithoutLocale: string
  locale: Locale; ogType?: 'website' | 'article'; ogImage?: string | undefined; noindex?: boolean
}

const { title, description, path, pathWithoutLocale, locale,
        ogType = 'website', ogImage, noindex = false } = Astro.props

const { ROBOTS_POLICY } = getRuntimeConfig()
const blocked = noindex || ROBOTS_POLICY === 'noindex'
const canonical = absoluteUrl(path)
const image = ogImage ? absoluteUrl(ogImage) : absoluteUrl('/og-default.png')
const fullTitle = `${title} — ${SITE_NAME}`
---
<title>{fullTitle}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
{blocked && <meta name="robots" content="noindex, nofollow" />}
{alternates(pathWithoutLocale).map((alt) => (
  <link rel="alternate" hreflang={alt.hreflang} href={alt.href} />
))}
<meta property="og:type" content={ogType} />
<meta property="og:title" content={fullTitle} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:image" content={image} />
<meta property="og:site_name" content={SITE_NAME} />
<meta property="og:locale" content={locale === 'ru' ? 'ru_RU' : 'en_US'} />
<meta name="twitter:card" content="summary_large_image" />
```

`absoluteUrl()` берёт origin из **runtime** `process.env.SITE_URL` (`shared/config`,
Zod `z.url()`); в вариантах A/C при prerender туда попадает значение сборки — это и есть
ограничение «одного образа», которое чинит штамповка.

### `src/app/fetch/handler.ts` (Advanced Routing, Astro 7)

```ts
import { astro, FetchState } from 'astro/fetch'
import { getRuntimeConfig } from '@/shared/config'

// Единственная точка, через которую проходит весь on-demand-трафик.
// ⚠️ Prerendered-страницы сюда НЕ попадают: их отдаёт статик-хендлер адаптера
// раньше приложения — поэтому runtime-заголовки для них ставит только Traefik.
export default {
  async fetch(request: Request): Promise<Response> {
    const response = await astro(new FetchState(request))
    const { ROBOTS_POLICY } = getRuntimeConfig()

    if (ROBOTS_POLICY === 'noindex') {
      response.headers.set('x-robots-tag', 'noindex, nofollow')
    }
    // Кеш-провайдер Astro не проставляет публичный Cache-Control: в ответе
    // остаётся только X-Astro-Cache. Для браузера/прокси дописываем явно.
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.headers.has('cache-control') && contentType.startsWith('text/html')) {
      response.headers.set('cache-control', 'no-cache')
    }
    return response
  },
}
```

`src/fetch.ts` (навязанный путь) — одна строка: `export { default } from '@/app/fetch/handler'`.
Модуль `astro/fetch` экспортирует композируемые куски пайплайна:
`FetchState, astro, trailingSlash, middleware, pages, sessions, redirects, actions, i18n, cache`.

### `src/middleware.ts` / `src/app/middleware/index.ts`

```ts
// src/middleware.ts — Astro требует этот путь; реализация — в слое app.
export { onRequest } from '@/app/middleware'
```

```ts
import { defineMiddleware } from 'astro:middleware'
import { getRuntimeConfig } from '@/shared/config'

// Staging-контур: заголовок ставится на всё, что реально проходит через процесс.
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next()
  if (getRuntimeConfig().ROBOTS_POLICY === 'noindex') {
    response.headers.set('x-robots-tag', 'noindex, nofollow')
  }
  return response
})
```

### Контакт-форма: эндпоинт (работает без JS) и Astro Action (для JS-пути)

```ts
// src/pages/api/contact.ts
export const prerender = false

import type { APIRoute } from 'astro'
import { ContactInputSchema, formToObject, handleContact } from '@/features/contact-form'

const THANKS = '/contact/thanks'

// Один эндпоинт на оба пути: нативный POST формы (без JS) и fetch из острова.
// Без JS отвечаем PRG-303, чтобы F5 не переотправлял заявку.
export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? ''
  const wantsJson = contentType.includes('application/json')
  const payload = wantsJson
    ? await request.json().catch(() => null)
    : formToObject(await request.formData())

  // CSRF: браузер обязан прислать Origin на любой не-GET из формы или fetch.
  const origin = request.headers.get('origin')
  if (origin !== null && new URL(request.url).origin !== origin) {
    return new Response('forbidden', { status: 403 })
  }

  const parsed = ContactInputSchema.safeParse(payload)
  if (!parsed.success) {
    if (wantsJson) return Response.json({ error: 'invalid' }, { status: 422 })
    return new Response(null, { status: 303, headers: { location: '/contact?error=1' } })
  }

  const result = handleContact(parsed.data)
  if (wantsJson) return Response.json(result, { headers: { 'cache-control': 'no-store' } })
  return new Response(null, { status: 303, headers: { location: THANKS } })
}
```

```ts
// src/features/contact-form/api/action.ts — НЕ реэкспортируется из index.ts слайса!
import { defineAction } from 'astro:actions'
import { z } from 'astro:schema'
import { handleContact } from '../model/schema'

export const contact = defineAction({
  accept: 'form',
  input: z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    message: z.string().min(10).max(2000),
    company: z.string().optional(),       // honeypot
    ts: z.coerce.number().int().positive().optional(),  // time-trap, ставит остров
  }),
  handler: (input) => handleContact(input),
})
```

---

## 4. Дерево `src/` и выхода сборки

### `src/` (FSD + навязанные Astro точки входа)

```
src/
  actions/index.ts                 ← навязано Astro; тонкий реэкспорт из features
  content.config.ts                ← навязано Astro; импорт НАПРЯМУЮ из модуля слайса
  middleware.ts                    ← навязано Astro; реэкспорт из app/middleware
  fetch.ts                         ← навязано Astro 7 (fetchFile); реэкспорт из app/fetch
  app/
    fetch/{handler.ts,index.ts}    layouts/document.astro    middleware/index.ts
    styles/index.css
  pages/                           ← файловый роутинг = слой pages FSD
    index.astro  about.astro  contact.astro  now.astro  404.astro
    healthz.ts  robots.txt.ts  rss.xml.ts  sitemap.xml.ts
    api/{contact.ts,renders.ts,revalidate.ts}
    blog/{index.astro,[slug].astro,page/[page].astro}
    contact/thanks.astro
    en/{index.astro,about.astro,blog/{index.astro,page/[page].astro}}
  widgets/{hero,post-list,site-header,site-footer}/{index.ts,ui/*.astro}
  features/contact-form/{index.ts,api/action.ts,model/schema.ts,ui/contact-form.tsx}
  entities/post/
    index.ts  api/queries.ts  model/{collection.ts,schema.ts}  ui/post-card.astro
    content/*.md (12)  content/covers/*.png (12)
  shared/
    config/index.ts   i18n/{index.ts,locales/{ru,en}.ts}
    lib/{cn.ts,paginate.ts,render-counter.ts,index.ts}
    seo/{index.ts,urls.ts,json-ld.ts,json-ld.astro,seo-head.astro}
```

Тесты — рядом со слайсами (`*.test.ts`), e2e — в `e2e/` вне FSD-графа.

### `dist/` — вариант A (`output: 'static'`), 4.2 МБ

```
dist/
  client/                3.0 МБ
    index.html  404.html
    about/index.html  contact/index.html  contact/thanks/index.html
    blog/index.html  blog/<slug>/index.html × 12  blog/page/{2,3}/index.html
    en/index.html  en/about/index.html  en/blog/index.html  en/blog/page/{2,3}/index.html
    sitemap-index.xml  sitemap-0.xml            ← @astrojs/sitemap, build-time
    favicon.svg  og-default.png
    _astro/  (191 файла)
      document.<hash>.css                        11 760 B / 3 442 B gzip
      client.<hash>.js  index.<hash>.js  react.<hash>.js   ← только для острова
      inter-*-wght-normal.<hash>.woff2 × 7        сабсеты по unicode-range
      <slug>.<hash>[_<variant>].{png,jpeg,webp,avif} × 168  ← 12 обложек × 14 вариантов
  server/                1.2 МБ
    entry.mjs (332 КБ)  virtual_astro_middleware.mjs  chunks/*.mjs
```

Всего HTML-файлов: **25**. `/old` файла не создаёт (`build.redirects: false` навязывается
адаптером — редиректом занимается сервер, а не `<meta http-equiv=refresh>`).

### `dist/` — вариант D (`output: 'server'`), 2.2 МБ

```
dist/client/  888 КБ   ← HTML-файлов 0; _astro всего 23 файла:
                          css + 3 js + 7 woff2 + 12 ИСХОДНЫХ png (оптимизированных нет)
dist/server/  1.3 МБ
```

Производные картинок в D **не генерируются на сборке** — их делает `/_image` на запрос.

---

## 5. Развилка «один образ на все среды»: A / C / D с цифрами

Напоминание условия (`14-content-architecture.md` §2.2.2): `site` в `astro.config` —
build-time, а `SITE_URL` по канону экосистемы — runtime-переменная контейнера.
Доказано в докax Astro: *«`site` — Your final, deployed URL. Astro uses this full URL to
generate your sitemap and canonical URLs in your final build»* **[П]**
https://docs.astro.build/en/reference/configuration-reference/

### Что именно печётся на сборке (вариант A) — проверено

Сервер запущен со `SITE_URL=https://prod.example.com ROBOTS_POLICY=noindex`, сборка была
со `SITE_URL=http://localhost:3201`:

| артефакт | что отдалось | источник origin |
|---|---|---|
| `<link rel=canonical>` на `/` | `http://localhost:3201/` | **сборка** ❌ |
| `og:url`, `og:image` на `/blog/<slug>` | `http://localhost:3201/...` | **сборка** ❌ |
| `hreflang` ru/en/x-default | `http://localhost:3201/...` | **сборка** ❌ |
| JSON-LD (`@id`, `url`, `image`) | `http://localhost:3201/...` | **сборка** ❌ |
| `sitemap-index.xml` + `sitemap-0.xml` (`@astrojs/sitemap`) | `http://localhost:3201/...` | **сборка** ❌ |
| `/sitemap.xml` (свой on-demand роут) | `https://prod.example.com/...` | runtime ✅ |
| `/rss.xml` (`@astrojs/rss` в on-demand роуте) | `https://prod.example.com/...` | runtime ✅ |
| `/robots.txt` (on-demand) | `Disallow: /` — политика применилась | runtime ✅ |
| `X-Robots-Tag` на prerendered `/` | **отсутствует** | ❌ |
| `X-Robots-Tag` на on-demand `/now` | `noindex, nofollow` | runtime ✅ |
| `<meta name=robots>` на prerendered `/` | **отсутствует** | ❌ |

То есть в варианте A «один образ на все среды» **ломается по четырём MUST-пунктам канона**
(I-7 self-canonical, I-11 sitemap, I-15 staging-noindex, M-3 og:url).

### Вариант C — плейсхолдер + штамповка (реализован, измерен)

- `site: 'https://__site_origin__'` — Astro **принимает** (WHATWG URL валиден:
  `new URL('https://__site_origin__').origin === 'https://__site_origin__'`).
  Голый `__SITE_ORIGIN__` **отвергается**: `[config] Astro found issue(s) with your
  configuration: ! Invalid URL` — плейсхолдер обязан быть URL-образным.
- На сборке `SITE_URL=https://__site_origin__` подставляется и в `site`, и в
  `shared/config` (единая точка `absoluteUrl`).
- Плейсхолдер оказывается в **32 файлах**: 26 в `dist/client` (25 HTML + 2 XML;
  `sitemap-index.xml` и `sitemap-0.xml`) и **6 в `dist/server/chunks/*.mjs`**
  (`astro-config-digest`, откуда берётся `Astro.site`).
- Штамповка `find … -exec grep -l … | xargs sed -i`: **10 мс** локально,
  **0 мс** (ниже разрешения `date +%s%N` в busybox) внутри контейнера.
  После — `grep -rl '__site_origin__' dist | wc -l` = **0**.
- В контейнере `SITE_URL=https://demo.stit.tech` выдача:
  `<link rel="canonical" href="https://demo.stit.tech/">`,
  `og:url`, JSON-LD `"@id"`, `sitemap-index.xml` → `https://demo.stit.tech/sitemap-0.xml`,
  `robots.txt` → `Sitemap: https://demo.stit.tech/sitemap.xml`. Всё верно.
- Что ломается: **ничего** из проверенного. `.gz`/`.br` не ломаются, потому что Astro
  **не предсжимает** выход (проверено: в `dist` нет ни одного `.gz`/`.br`) — но правило
  «HTML не предсжимать» надо зафиксировать явно, иначе включение предсжатия молча убьёт
  штамповку. RSS и `sitemap.xml` у нас on-demand и штамповки не требуют.
- Остаточная дыра C (общая с A): **runtime-`ROBOTS_POLICY` не действует на prerendered**.
- Размер образа: **315.7 МБ**; `docker build` (с тёплым кешем слоёв) **13.2 с**.

### Вариант D — `output: 'server'` + `memoryCache` + `routeRules` (реализован, измерен)

Как устроен кеш Astro 7 (прочитан исходник `astro/dist/core/cache/*`):

- ключ = `origin + pathname + нормализованный query`; **cookie и UA в ключ не входят**
  (ровно требование `14` §2.2.4); из query по умолчанию вырезается длинный список
  трекинг-параметров — `utm_*, fbclid, gclid, gbraid, wbraid, dclid, msclkid, twclid,
  li_fat_id, mc_cid, mc_eid, _ga, _gl, _hsenc, _hsmi, _ke, oly_anon_id, oly_enc_id,
  rb_clickid, s_cid, vero_id, wickedid, yclid, __s, ref`; параметры сортируются;
  настраивается `memoryCache({ query: { include | exclude, sort } })`;
- кешируется **только GET**; ответ с `Set-Cookie` **не кешируется** (warn в лог);
  `Vary: Cookie` / `Vary: *` — не кешируется; прочие `Vary` учитываются суффиксом ключа;
- директивы ездят внутренними заголовками `CDN-Cache-Control: max-age=…,
  stale-while-revalidate=…` и `Cache-Tag: …`, которые **удаляются перед отдачей клиенту**;
- наружу выставляется **`X-Astro-Cache: HIT | STALE | MISS`**;
- ёмкость — свой `LRUMap`, `max` по умолчанию **1000** записей (в спайке 500);
- `cache.invalidate({ tags })` и `{ path }` — оба работают (проверено: после
  `POST /api/revalidate {"tags":["blog"]}` следующий `GET /` дал `MISS`);
- `Astro.cache.set({ maxAge, swr, tags, etag, lastModified })` мержится с `routeRules`;
- **в dev кеш выключен** (`cache.enabled === false`) — поведение отличается от прода.

Измерено:

| проверка | результат |
|---|---|
| canonical из runtime `SITE_URL` (сборка была с `http://build-time.invalid`) | ✅ `http://localhost:3201/` |
| `X-Astro-Cache` на `/` | `MISS` → `HIT` |
| публичный `Cache-Control` на кешированном HTML | **отсутствует** ❌ (дописан в `src/fetch.ts`) |
| TTFB первого (холодного) рендера | `/` 126 мс (ленивая загрузка чанков), `/blog` 18 мс, пост 33 мс, `/about` 14 мс, `/contact` 62 мс, `/rss.xml` 82 мс |
| TTFB тёплого кеша, медиана 20 | `/` 1.1–2.3 мс, пост 1.0–2.0 мс (шум от соседних спайков) |
| **200 параллельных на холодный ключ, рендер 300 мс** | **141 MISS / 59 HIT, 141 реальный рендер** — дедупликации нет ❌ |
| 200 параллельных на холодный ключ, рендер ~1 мс | 1 MISS / 199 HIT (быстрый рендер успевает заполнить кеш) |
| `/now` (нет `routeRule`) | не кешируется, `Cache-Control: no-cache` ✅ |
| `/_image` **без** `routeRule` | **300–420 мс на КАЖДЫЙ запрос**, sharp пересжимает |
| `/_image` **с** `routeRule maxAge: 31536000` | 420 мс → **3 мс** ✅ |
| RSS процесса после 50 параллельных `/_image` | **97 → 360 МБ** и **не возвращается** (libvips не отдаёт память ОС; наблюдал 60 с) |
| RSS процесса после 400 параллельных HTML | 101 → 153 МБ |

### Сводная таблица A / C / D

| критерий | A (static, SITE_URL на сборке) | **C (static + штамповка)** | D (server + memoryCache) |
|---|---|---|---|
| один образ на все среды | ❌ | ✅ | ✅ |
| canonical/og/hreflang/JSON-LD | зашиты на сборке | штампуются за 0–10 мс | из runtime env на каждый рендер |
| `sitemap-index.xml` (`@astrojs/sitemap`) | зашит | штампуется | зашит (но не нужен — есть свой) |
| `/robots.txt`, `/sitemap.xml`, `/rss.xml` | runtime ✅ | runtime ✅ | runtime ✅ |
| runtime `ROBOTS_POLICY` на индексируемых | ❌ (нужен Traefik) | ❌ (нужен Traefik) | ✅ |
| TTFB главной | 0.85 мс | 0.85 мс | 1.1–2.3 мс тёплый / 126 мс первый |
| картинки | 168 файлов на сборке, отдаются как статика | то же | `/_image` на запрос: 300–420 мс без кеша, 3 мс с `routeRules` |
| RSS процесса (idle → 400 параллельных) | 99 → 126 МБ | 99 → 126 МБ | 102 → 153 МБ; **360 МБ** после 50 параллельных `/_image` |
| поведение при холодном старте под трафиком | статика, рендеров нет | то же | до **141 рендера** на 200 параллельных запросов одного URL |
| инвалидация без релиза | нет | нет | `cache.invalidate({tags\|path})` ✅ |
| время сборки | 5.9 с холодная | 5.9 с | 1.9 с |
| размер выхода / образа | 4.2 МБ / 315.7 МБ | 4.2 МБ / 315.7 МБ | 2.2 МБ / 314.1 МБ |
| новые классы ошибок | «в проде образ, не виденный staging» | «забытый плейсхолдер» (ловится e2e) | «кеш холодный после релиза», «лавина рендеров» |

### Итог развилки — рекомендация шаблону

**Дефолт — C (плейсхолдер + штамповка), опция — D для проектов с CMS.**

Обоснование (в отличие от вывода `14` §2.2.3, где дефолтом предлагался D — у Astro
расклад другой):

1. У Astro статика — не «мёртвый вес», а **штатно отдаваемый самим процессом** артефакт
   с TTFB **0.85 мс** и `immutable` на ассетах. Провал Nitro (`06` §7.2) не воспроизводится,
   поэтому главный аргумент «prerender бесполезен» отпадает.
2. Вариант D в Astro тащит **две дорогие проблемы**, которых нет у Nitro/Next:
   картинки перестают генерироваться на сборке и переезжают в `/_image`
   (300 мс и 260 МБ RSS на всплеске), а кеш **не дедуплицирует** промахи — холодный
   рестарт под трафиком даёт лавину рендеров.
3. Цена C — 20 строк в entrypoint, 10 мс при старте и один e2e-тест
   («в ответе нет `__site_origin__`»). Класс ошибок «забытый плейсхолдер» закрывается
   тем же тестом плюс проверкой в `/release`.
4. Гибрид доступен без переписывания: `export const prerender = false` на конкретных
   страницах + `routeRules` — они работают и при `output: 'static'` с адаптером
   (у нас так живут `/now`, `/healthz`, `robots.txt`, `sitemap.xml`, `rss.xml`, `/api/*`).
5. **A — только с явной записью** в `docs/stack/rendering.md` «у проекта одна среда»
   (как и предписывает `14` §2.2.3), потому что образ перестаёт быть переносимым
   между staging и prod.

---

## 6. ЕДИНАЯ ТАБЛИЦА ИЗМЕРЕНИЙ (`brief-v2.md`)

Вариант A и C по выдаче идентичны (C = A + штамповка), поэтому колонка «A/C» общая;
различия отмечены отдельно.

| метрика | A / C (`output: 'static'`) | D (`output: 'server'`) |
|---|---|---|
| **время `build`, холодный кеш картинок** | **5.88 с** (из них 3.89 с — 168 вариантов картинок) | **1.90 с** (картинки не генерятся) |
| время `build`, тёплый кеш (`node_modules/.astro`) | **1.85 с** | 1.90 с |
| **размер выхода сборки** | **4.2 МБ** (client 3.0 / server 1.2) | **2.2 МБ** (client 888 КБ / server 1.3 МБ) |
| файлов HTML в выходе | 25 | 0 |
| файлов в `_astro/` | 191 | 23 |
| **размер Docker-образа** | **315.7 МБ** (A и C одинаково) | **314.1 МБ** |
| из них `node_modules` (prod, после прунинга) | 217 МБ → ~190 МБ | то же |
| время `docker build` (кеш слоёв тёплый) | 10.2 с (A) / 13.2 с (C) | 4.4 с |
| **HTML главной `/` (байт raw / gzip -9)** | **8 037 / 2 467** | 8 927 / 2 481 |
| HTML `/blog` | 9 399 / 2 591 | 10 882 / 2 572 |
| HTML `/blog/page/2` | 9 418 / 2 526 | — (та же структура) |
| **HTML поста `/blog/kanon-canonical`** | **8 298 / 2 804** | 9 042 / 2 818 |
| HTML `/about` | 3 173 / 1 339 | 3 173 / 1 339 |
| HTML `/contact` | 8 743 / 3 446 | 8 743 / 3 445 |
| HTML `/contact/thanks` | 2 632 / 1 022 | — |
| HTML `/now` | 2 524 / 1 051 | 2 524 / 1 052 |
| HTML `/en` | 7 694 / 2 329 | 8 584 / 2 344 |
| **JS, реально загружаемый `/` (Playwright)** | **0 байт, 0 ресурсов** | **0 байт, 0 ресурсов** |
| JS на `/blog`, `/blog/<slug>`, `/about`, `/en` | **0 байт** | **0 байт** |
| **JS на `/contact` (gzip)** | **93 224 B** (3 файла) | 93 224 B |
| — состав | `client.<hash>.js` 65 683 B gz (react-dom+scheduler), `index.<hash>.js` 24 531 B gz (остров+devalue+@astrojs/react), `react.<hash>.js` 3 010 B gz | то же |
| — inline-скрипты острова в HTML | 333 B (`client:idle` loader) + 4 397 B (`astro-island` custom element) raw | то же |
| **CSS (одна таблица на весь сайт)** | 11 760 B raw / **3 418 B gzip** | 11 074 / 3 282 |
| **Шрифты, первая страница** | 67 004 B (`inter-cyrillic` 18 748 + `inter-latin` 48 256), далее 0 (кеш) | то же |
| **Картинки: формат и `srcset`** | `<picture>` AVIF → WebP → `<img src>` JPEG-фолбэк; `srcset` 480w/800w/1200w + `sizes="(min-width: 768px) 700px, 100vw"`; `width/height`, `loading=eager`, `fetchpriority=high`, `decoding=async`, `data-astro-image="constrained"` | тот же HTML, но URL вида `/_image?href=…&w=800&f=avif&fit=cover` |
| — размер обложки (исходник PNG 1600×900 = 20 441 B) | AVIF 480w **1 753 B**, 800w **2 798 B**, 1200w **3 702 B**; WebP 480w 2 612, 800w 4 940, 1200w 7 526; JPEG-фолбэк 4 965 / 10 889 / 16 780 | те же байты (тот же sharp); в контейнере musl AVIF 800w = **3 497 B** (другой билд libvips) |
| — суммарно картинок на `/` | 21 122 B (3 карточки, WebP 960w) | 21 122 B |
| — суммарно на посте | 2 798 B (один AVIF 800w) | 2 798 B |
| **TTFB медиана 20, `/`** | **0.85 мс** (min 0.70, p90 1.06) | 1.1–2.3 мс тёплый кеш; **126 мс** первый (холодный) |
| TTFB `/blog/<slug>` | **0.92 мс** (min 0.69, p90 1.79) | 1.0–2.0 мс тёплый; **33 мс** холодный |
| TTFB `/now` (on-demand, no-cache) | 2.20 мс (min 1.25) | 1.5–6.1 мс (шум) |
| TTFB `/healthz` | 1.11 мс | 1.2–4.6 мс (шум) |
| TTFB `/rss.xml` | 2.22 мс (min 1.07) | 1.05–2.3 мс тёплый; 82 мс холодный |
| TTFB `/sitemap.xml` | 1.27 мс | 1.03 мс тёплый |
| TTFB `_astro/*.css` | 0.53 мс | 0.53 мс |
| **RSS процесса, idle** | **99.1 МБ** | **101.5 МБ** |
| RSS после 400 параллельных (200 × `/` + 200 × пост) | **126.3 МБ** | **152.9 МБ** |
| RSS после 50 параллельных `/_image` | n/a (картинки статичны) | **360 МБ**, не освобождается |
| RSS контейнера в покое (`docker stats`) | ~68 МБ | 68.1 МБ |
| **статус `/old`** | **301** → `/` (настоящий редирект, не `meta refresh`) | **301** → `/` |
| **статус `/blog/net-takogo`** | **404** + разметка 404-страницы | **404** |
| **статус `/xx`** | **404** | **404** |
| статус `/xx/` | 301 → `/xx` (потом 404) — **2 хопа** | 301 → `/xx` |
| **статус `/about/`** | **301** → `/about` (канон I-5 просит 308 — Astro отдаёт 301) | **301** → `/about` |
| статус `/about.html` | **404** ✅ (при `build.format: 'file'` было бы 200 — дубль) | **404** |
| статус `/index.html` | **200** ⚠️ дубль главной (canonical указывает на `/`, риск низкий) | **404** ✅ |
| статус `/blog/` | 301 → `/blog` | 301 → `/blog` |
| статус `/404` | 404 | 404 |
| статус `/_actions/contact` (GET) | 404 | 404 |
| **prerender отдаётся самим Node-процессом?** | **ДА.** `/` и `/about` — байт-в-байт файлы с диска (`ETag: W/"…"`, `Last-Modified`), тело стабильно между запросами; `/now` меняется каждый запрос | нет prerender вовсе |
| **`Cache-Control` на HTML** | `public, max-age=0` + weak `ETag` + `Last-Modified` (от `send`) | `no-cache` (дописан в `src/fetch.ts`) + `X-Astro-Cache` |
| **`Cache-Control` на `/_astro/*`** | **`public, max-age=31536000, immutable`** на GET; на **HEAD** — `public, max-age=0` (баг §7.3) | то же |
| `Cache-Control` на `/_image` | n/a | `public, max-age=31536000` (без `immutable`) + `ETag` |
| `Cache-Control` `/healthz` / `/robots.txt` / `/sitemap.xml` | `no-store` / `public, max-age=300` / `public, max-age=600` | то же |
| **ETag** | есть на статике (weak, size+mtime); на on-demand — нет | на on-demand нет (можно задать `Astro.cache.set({ etag })`) |
| **сжатие** | **нет** — процесс не жмёт и не предсжимает; `Accept-Encoding: gzip, br` → ответ без `Content-Encoding`. Жать обязан Traefik | то же |
| **контент для `User-Agent: Googlebot`** | 8 298 B, `<h1>Канон canonical</h1>`, весь текст тела поста, 4 × `<h2>`, `<picture>` — всё в первом HTML; **ровно один `<script>` и тот `application/ld+json`** | то же |
| **canonical в сыром HTML** | ✅ абсолютный | ✅ абсолютный, из runtime env |
| **hreflang** | ✅ `ru`, `en`, `x-default`, взаимные | ✅ |
| **OG** | ✅ `og:type/title/description/url/image/site_name/locale` + `twitter:card` | ✅ |
| **JSON-LD** | ✅ `Article` + `BreadcrumbList` на посте, `Organization` + `WebSite` на главной | ✅ |
| `<html lang>` | ✅ `ru` / `en` | ✅ |
| **dev: время старта до первого 200** | **~3.0 с** (демон `astro dev`, «ready in 1.6–2.4 с» + первый on-demand рендер) | то же |
| dev: TTFB поста первый / повторный | 22 мс / 4 мс | то же |
| **dev: HMR контента** | ✅ правка тела `.md` — видна через ~1 с; правка frontmatter (`title`) — видна; **новый `.md` создаёт новый URL** без рестарта | то же |
| dev: `--host` | ✅ `--host 127.0.0.1` работает; демон (`astro dev status/logs/stop`) | то же |
| **`astro check`** | ✅ 74 файла, **0 ошибок, 0 предупреждений**, 20 hints (deprecation `z` из zod 4 и `FormEvent` из React 19.3), 4.3 с | то же |
| **Biome 2.5.13 на `.astro`** | ✅ линт frontmatter + шаблона + `<script>` + `<style>` (с `html.experimentalFullSupportEnabled`); ❌ **форматирование `.astro` не поддерживается вовсе** | то же |
| **ESLint 10.10 + `eslint-plugin-astro` 3.1** | ✅ линтит frontmatter, 1.3 с, 0 ошибок | то же |
| **Steiger 0.6 + plugin 0.7** | ✅ видит импорты в frontmatter `.astro`, ловит cross-slice и импорт вверх по слоям **в `.astro`**; ✅ ловит deep-import `.astro → .ts`; ❌ **не ловит импорт, целью которого является `.astro`-файл**; ❌ **не видит `export … from`** | то же |
| **Vitest 5.0.1** | ✅ 6 файлов / 15 тестов за 0.96 с, включая `experimental_AstroContainer` (рендер `.astro` в строку) и тест схемы контента | то же |
| **Playwright 1.63** | ✅ 9/9 за 9.4 с (без JS: h1+canonical, текст поста, `Article` JSON-LD, 404 × 2, нативный POST формы → 303 → `/contact/thanks`; с JS: гидрация острова; «0 байт JS»; «в `<body>` нет абсолютных URL своего origin») | то же |
| **size-limit 13.1** | ✅ island 93.22 КБ gzip (лимит 100), CSS 3.42 КБ (лимит 5) | то же |
| **`pnpm check` целиком** | ✅ **12.0 с, exit 0** | ✅ |
| **graceful shutdown (SIGTERM)** | ❌ у адаптера нет: процесс умирает за **30 мс**, запрос в полёте — `fetch failed`. ✅ с обёрткой `docker/server.mjs`: 200 + полное тело, exit 0 за **662 мс**; `docker stop` — **0.26 с** | то же |
| **keep-alive** | ❌ дефолт Node: `Keep-Alive: timeout=5`. ✅ с обёрткой: `timeout=65` | то же |
| **`HOST` / `PORT` из env** | ✅ поддерживаются адаптером напрямую | ✅ |
| HTTPS напрямую | `SERVER_CERT_PATH` + `SERVER_KEY_PATH` (недокументированная фича `standalone.js`) | ✅ |

### 6.1 Постраничный вес (Playwright, реально загруженные ресурсы)

Считается `response.body().length` по типам ресурсов; gzip — `zlib.gzipSync(level 9)`.
Прогон подряд в одном контексте браузера, поэтому шрифты/CSS на второй и далее странице
идут из кеша (0 B) — это честная картина «пользователь ходит по сайту».

Вариант A / C:

| страница | документ raw/gzip | JS raw/gzip | CSS raw/gzip | картинки | шрифты |
|---|---|---|---|---|---|
| `/` | 8 006 / **2 483** | **0 / 0** | 11 760 / 3 418 | 21 122 (3 × WebP 960w) | 67 004 (2 сабсета) |
| `/blog` | 9 394 / **2 622** | **0 / 0** | 0 (кеш) | 39 114 (5 × WebP) | 0 (кеш) |
| `/blog/kanon-canonical` | 8 298 / **2 841** | **0 / 0** | 0 | 2 798 (1 × AVIF 800w) | 0 |
| `/about` | 3 173 / **1 361** | **0 / 0** | 0 | 0 | 0 |
| `/contact` | 8 743 / 3 461 | 306 496 / **93 224** | 0 | 0 | 0 |
| `/now` | 2 525 / **1 068** | **0 / 0** | 0 | 0 | 0 |
| `/en` | 7 694 / **2 349** | **0 / 0** | 0 | 21 122 | 0 |

Вариант D — те же байты по JS/CSS/картинкам, документы на 0.6–1.5 КБ больше raw
(длинные `/_image?…`-URL вместо хешированных имён), gzip практически совпадает.

Состав JS на `/contact` (gzip): `client.<hash>.js` **65 683** (react-dom + scheduler),
`index.<hash>.js` **24 531** (сам остров + `devalue` + клиент `@astrojs/react`),
`react.<hash>.js` **3 010**. Плюс inline в документе: 333 B (`client:idle`-лоадер) и
4 397 B (custom element `astro-island`).

---

## 7. Подводные камни

### 7.1 `build.format: 'file'` + `@astrojs/node` = 404 на родительских маршрутах ⚠️ КРИТИЧНО

С `build: { format: 'file' }` Astro кладёт `/blog` в `dist/client/blog.html`, а посты —
в `dist/client/blog/<slug>.html`. Статик-хендлер адаптера
(`node_modules/@astrojs/node/dist/serve-static.js`) сначала делает `lstatSync(client + urlPath)`
и, увидев **каталог** `blog/`, при `trailingSlash: 'never'` переписывает путь в
`/blog/index.html` — которого нет. Дальше — SSR, а маршрут prerendered ⇒ **404**.

Измерено на реальной сборке: `/blog` → **404**, `/en` → **404**, при том что
`dist/client/blog.html` и `dist/client/en.html` существуют. `/about` работал (нет каталога
`about/`). Бонусом `format: 'file'` даёт дубли: `/about.html` и `/index.html` отдают **200**.

**Лечение: только `build.format: 'directory'`** (дефолт Astro). Тогда `/blog` → 200,
`/about.html` → 404, `/blog/` → 301 на `/blog`. `/index.html` остаётся 200 — но canonical
на нём указывает на `/`, а ссылок на него нет; в Traefik можно прикрыть `redirectRegex`.

Ловушка коварна тем, что **в dev не воспроизводится** (dev рендерит по маршрутам,
а не по файлам) — ломается только собранный контейнер.

### 7.2 Astro Action в public API слайса убивает гидрацию острова ⚠️ КРИТИЧНО для FSD

`src/pages/contact.astro` импортирует `{ ContactForm } from '@/features/contact-form'` —
через баррель слайса, как требует FSD. Баррель реэкспортировал и `contact`
(`defineAction(...)`). Rolldown втащил весь модуль барреля в клиентский чанк острова,
и в браузере получилось:

```
[astro-island] Error hydrating /_astro/index.<hash>.js
Error: [astro:actions] `defineAction()` unexpectedly used on the client.
```

Видимый симптом: остров **не гидрируется**, а Astro дважды тянет чанк
(`importWithRetry` в `astro-island` повторяет `import()` через 1 с с
`?astro-retry=<ts>`) — в Playwright это выглядело как **+28 КБ gzip лишнего трафика**
(124.9 КБ вместо 93.2 КБ). Тест «форма отправляется без навигации» падал: без гидрации
срабатывал нативный POST.

**Правило для шаблона: server-only символы (`defineAction`, всё из `astro:actions`,
`astro:content`, `node:*`) не попадают в `index.ts` слайса.** Им нужен отдельный
серверный entry (`features/<slice>/api/action.ts`), который импортирует только
`src/actions/index.ts` — и этот файл вынесен из-под `no-restricted-imports` и Steiger.
Это прямое, но неизбежное отступление от «единственного public API».

### 7.3 `Cache-Control: immutable` теряется на HEAD-запросах

`serve-static.js` ставит `immutable` в обработчике события `'stream'` библиотеки `send`.
Для HEAD `send` вызывает `res.end()` **до** `this.stream()`, событие не эмитится:

```
GET  /_astro/client.<hash>.js → Cache-Control: public, max-age=31536000, immutable
HEAD /_astro/client.<hash>.js → Cache-Control: public, max-age=0
```

Браузерам всё равно (они делают GET), но любой HEAD-мониторинг/валидатор кеша увидит
неверные заголовки. Заводить issue в `withastro/astro`.

### 7.4 Ни middleware, ни `src/fetch.ts`, ни `staticHeaders` не дотягиваются до prerendered

Проверено прямым экспериментом: `src/fetch.ts` ставил `x-fetch-handler: on` на всё.
Результат на сервере с `ROBOTS_POLICY=noindex`:

| маршрут | `x-fetch-handler` | `x-robots-tag` |
|---|---|---|
| `/` (prerendered) | нет | **нет** |
| `/about` (prerendered) | нет | **нет** |
| `/blog/<slug>` (prerendered) | нет | **нет** |
| `/now`, `/healthz`, `/robots.txt` (on-demand) | on | noindex, nofollow |

Причина видна в `standalone.js`: `staticHandler(req, res, () => appHandler(req, res))` —
статика отдаётся **до** приложения. Доки подтверждают на уровне middleware:
*«This rendering occurs at build time for all prerendered pages, but occurs when the route
is requested for pages rendered on demand»* **[П]**
https://docs.astro.build/en/guides/middleware/

Опция адаптера `staticHeaders: true` не спасает: в `@astrojs/node/dist/index.js`
(`astro:build:done`) в `_headers.json` кладётся **только `Content-Security-Policy`**
и только при `security.csp`. Всё остальное игнорируется.

**Следствие для канона I-15**: контур №1 (заголовок из приложения) на prerendered
недоступен. Остаются контур №2 (Traefik `basicAuth`) и №3 (Traefik
`customResponseHeaders: X-Robots-Tag`), плюс `robots.txt` из приложения — он on-demand
и политику соблюдает. Это надо записать в `docs/stack/seo.md` и в INFRA-HANDOFF.

### 7.5 `memoryCache` не дедуплицирует параллельные промахи

Проверено скриптом `scripts/hammer.mjs` (200 `fetch` в одном тике) на странице с
искусственной задержкой рендера 300 мс:

```
/ n=200 { MISS: 141, HIT: 59 } wall=1537.7ms
renders: {"/":141}     ← счётчик реальных рендеров в компоненте
```

В исходнике `memory-provider.js` нет single-flight: каждый промах идёт в `next()`,
запись в кеш происходит **после** ответа. На быстрых страницах (рендер ~1 мс) это не
видно (1 MISS / 199 HIT), на дорогих — лавина. Шаблону нужен либо прогрев «горячих» URL
при старте, либо собственный single-flight (`Map<key, Promise<Response>>`) в `src/fetch.ts`.

### 7.6 В `output: 'server'` картинки уезжают в `/_image` и это дорого

В варианте D `dist/client/_astro` содержит **только исходные PNG** — производных нет.
`<Picture>` генерирует `/_image?href=…&w=…&f=avif&…`, и каждый такой запрос —
полный цикл sharp:

- первый и **каждый** последующий запрос: **270–420 мс**;
- `Content-Type: image/heif` для AVIF (Astro определяет формат сниффингом байт своим
  вендоренным `image-size`, где AVIF детектится как `heif` —
  `astro/dist/assets/utils/vendor/image-size/types/heif.js`). Браузеры доверяют
  `<source type="image/avif">` и содержимому, но заголовок формально неверен;
- `Cache-Control: public, max-age=31536000` **без `immutable`**;
- 50 параллельных запросов одной картинки → **50 реальных кодирований**, 5 с стены,
  RSS **97 → 360 МБ** и память не возвращается.

Лечится `routeRules: { '/_image': { maxAge: 31536000 } }` (420 мс → 3 мс), но тогда
картинки живут в той же LRU памяти процесса. На `mem_limit: 512m` (рекомендация `04`)
это опасно. Ещё один довод за prerender картинок (A/C).

### 7.7 `sharp` обязателен в `dependencies`, а `astro` тащит в рантайм весь build-toolchain

- `sharp` в `devDependencies` → `pnpm install --prod` его не ставит → `/_image` отдаёт
  **500** `MissingSharp: Could not find Sharp`. В A/C это латентная мина (сработает, как
  только появится хоть одна on-demand страница с `<Image>`), в D — мгновенная смерть.
- `astro` объявляет `vite`, `rolldown`, `esbuild`, `lightningcss`, `@astrojs/compiler-*`,
  `@bruits/satteri`, `shiki` обычными `dependencies`. `pnpm install --prod` в alpine ставит
  **обе** libc-вариации нативных бинарок. Топ по размеру внутри образа:

```
18.5M @rolldown+binding-linux-x64-musl   18.4M @rolldown+binding-linux-x64-gnu
18.0M @img+sharp-libvips-linuxmusl-x64   17.8M @img+sharp-libvips-linux-x64
10.9M @esbuild+linux-x64                 10.6M @shikijs+langs
 9.6M lightningcss-linux-x64-musl         9.6M lightningcss-linux-x64-gnu
 8.2M zod                                 7.8M react-dom
 7.4M astro                               7.0M @astrojs+compiler-binding-linux-x64-gnu
 4.0M @bruits+satteri-linux-x64-musl      4.0M @bruits+satteri-linux-x64-gnu
 4.3M caniuse-lite                        3.8M prismjs
```

Прунинг gnu-вариантов + `@types/node` + `caniuse-lite` + `prismjs` в `prod-deps`-стадии
снимает ~55 МБ и **не ломает** рантайм (проверено: сервер поднимается, страницы, `/_image`
и штамповка работают). Итог: **388 МБ без прунинга → 315.7 МБ с прунингом.**
Полностью self-contained выход (как `.output` у Nitro) Astro не даёт.

### 7.8 `@astrojs/node` молча включает файловые сессии

В логе сборки: `[@astrojs/node] Enabling sessions with filesystem storage`.
В `index.js` адаптера, если `config.session !== false && !session?.driver`, подставляется
`sessionDrivers.fsLite({ base: <cacheDir>/sessions })`. Каталог создаётся лениво, но в
`read_only: true` контейнере первое обращение к сессии упадёт. Контентному сайту сессии
не нужны — в конфиге стоит `session: false`.

### 7.9 Коллизия `[slug]` и пагинации в on-demand режиме

`src/pages/blog/[slug].astro` + `src/pages/blog/[...page].astro` в prerender работают
(пути из `getStaticPaths` конкретны), а в `output: 'server'` `/blog/2` уходит в `[slug]`,
`getPost('2')` → `undefined` → **404**. Решение, принятое в спайке и рекомендуемое
шаблону: пагинация переезжает на **`/blog/page/<N>`** (`src/pages/blog/page/[page].astro`),
страница 1 — отдельный `src/pages/blog/index.astro`. Заодно исчезает двусмысленность
«slug из цифр».

Побочно: `getStaticPaths()` в on-demand-режиме игнорируется с предупреждением
`[router] getStaticPaths() ignored in dynamic page …`, поэтому страницы написаны так,
чтобы работать в обоих режимах (`Astro.props.post ?? await getPost(Astro.params.slug)`),
а пагинация вынесена в `shared/lib/paginate.ts` (`paginateOnDemand`) — `paginate()` из
`getStaticPaths` в server-режиме недоступен.

### 7.10 Dev-сервер Astro 7 — демон, и он умеет «залипнуть»

`astro dev` в Astro 7 запускает фоновый процесс (`astro dev status | logs | stop`,
lock-файл). Наблюдалось устойчивое состояние, когда демон логировал
`Cannot read properties of undefined (reading 'get')` → `Content config not loaded` →
`The collection "post" does not exist or is empty` и **все** блоговые маршруты отдавали
404, хотя прод-сборка того же кода работала. Лечится `astro dev stop` + `rm -rf .astro`.
Дополнительно: при занятом порте демон **молча** уходит на следующий
(`Port 3213 is in use, trying another one...` → 3214) — для скриптов и Playwright это мина.

Частный, воспроизводимый случай: если `src/content.config.ts` импортирует коллекцию
**через баррель слайса** (`@/entities/post`), dev стабильно печатает
`Content config not loaded` при старте (в проде — нет). При импорте напрямую из модуля
(`@/entities/post/model/collection`) предупреждения нет. Рекомендация — прямой импорт.

### 7.11 Astro Actions: CSRF встроен, но прогрессивного фолбэка на prerendered-странице нет

- `<form method="POST" action={actions.contact}>` компилируется в
  `action="?_action=contact"` — POST уходит **на ту же страницу**. Если страница
  prerendered, POST перехватывает статик-хендлер и отдаёт **тот же HTML-файл, 200**,
  action не выполняется. То есть «форма без JS» с Actions на prerendered-странице
  **молча не работает**.
- Прямой `POST /_actions/contact` без заголовка `Origin` → **403**
  `Cross-site POST form submissions are forbidden`; с чужим `Origin` → **403**;
  со своим → 200 и devalue-ответ `[{"ok":1,"id":2},true,"msg_624"]`.
- `accept: 'form'` + JSON-тело → **415** `UNSUPPORTED_MEDIA_TYPE`.

Поэтому в спайке форма постит на обычный эндпоинт `/api/contact` (`prerender = false`),
который отвечает **303 → `/contact/thanks`** (PRG) для нативной отправки и JSON — для
острова. Оба пути покрыты Playwright-тестами и оба зелёные.

### 7.12 `experimentalDisableStreaming` компилируется, но эффект не наблюдается

`adapter: node({ experimentalDisableStreaming: true })` доезжает до манифеста
(`grep 'streaming:' dist/server/entry.mjs` → `streaming: false`), однако на странице
с асинхронным блоком (300 мс в середине body) заголовки в обоих режимах приходят
одинаково рано (TTFB 3–15 мс при total ~310 мс) и `Transfer-Encoding: chunked`
сохраняется. Видимо, флаг влияет на сборку тела, а не на фрейминг Node-ответа.
Для канона P-3 («ботам — не стримить») флаг стоит включать, но **проверять его надо
не curl'ом по TTFB**.

### 7.13 `redirects` в конфиге — настоящий 301, потому что адаптер выключает build-редиректы

Доки Astro предупреждают, что в статике редирект вырождается в `<meta http-equiv="refresh">`
**[П]** https://docs.astro.build/en/guides/routing/. Но `@astrojs/node` в
`astro:config:setup` делает `updateConfig({ build: { redirects: false } })`, поэтому
файл `/old/index.html` не создаётся (в логе сборки: `(file not created, response body was
empty)`), а `/old` обрабатывает сервер и отдаёт **настоящий 301**. Проверено:
`curl -I /old` → `301 Location: /`.

Обратная сторона: нормализующий редирект `/about/` → `/about` — **301**, а не **308**
(в `serve-static.js` код зашит константой). Канон I-5 просит 308; расхождение
безопасно для GET, но должно быть зафиксировано в `docs/stack/seo.md`.

### 7.14 Server islands не видны ботам (и это по дизайну)

`<ServerNow server:defer>` на prerendered `/about`: в HTML едет только `slot="fallback"`
+ два inline-скрипта (~1.7 КБ raw), контент подгружается `fetch('/_server-islands/…')`.
Ответ эндпоинта сам несёт `Cache-Control: no-cache` и **`X-Robots-Tag: noindex`**.
`curl -A Googlebot /about` содержимого острова **не видит**.

Вывод: server islands — инструмент персонализации (корзина, «вы вошли как…»),
**никогда** для индексируемого контента. В правило `seo-invariants`.

### 7.15 `<ClientRouter />` (view transitions) стоит 4.7 КБ gzip на каждой странице

Измерено: подключение `<ClientRouter />` в layout добавляет ровно один внешний скрипт
`ClientRouter.astro_astro_type_script_index_0_lang.<hash>.js` —
**13 828 B raw / 4 726 B gzip**, на всех страницах. Это превращает «0 байт JS» в
«4.7 КБ». Для контент-сайта — выключено по умолчанию (как и `prefetch: false`).

### 7.16 `responsiveStyles: true` инлайнит ~2 КБ CSS в каждую страницу

`image.responsiveStyles: true` добавляет в `<head>` инлайновый `<style>` с правилами
`@layer astro.images{…}` (`data-astro-image`, `data-astro-image-fit`, `data-astro-image-pos`).
Это ~2 КБ raw в каждом документе (в gzip почти бесплатно из-за повторяемости). Альтернатива —
выключить и описать те же правила в своём токен-слое.

### 7.17 Мелочи

- `astro check` даёт 20 hints `ts(6385)`: `'z' is deprecated` (zod 4.6.5 помечает
  namespace-экспорт) и `'FormEvent' is deprecated` (типы React 19.3). Не ошибки,
  но шумят; `astro check` их не фильтрует.
- `@astrojs/sitemap` 3.7.4 генерирует `sitemap-index.xml` + `sitemap-0.xml` **на билде**
  из `site`. Для runtime-origin он бесполезен (в C спасает штамповка). В спайке
  параллельно живёт свой `src/pages/sitemap.xml.ts` (on-demand, runtime origin,
  честный `lastmod` из `updatedDate`). **Рекомендация: оставить свой, интеграцию убрать** —
  иначе два разных sitemap по двум URL, и в `robots.txt` придётся выбирать.
- `zod` в prod-дереве весит 8.2 МБ; `astro:schema` — это тот же zod.
- `sharp` на musl собирается и работает (`@img/sharp-linuxmusl-x64` есть в локе;
  `pnpm.supportedArchitectures` **не понадобился**, потому что сборка идёт внутри alpine).
  Байт-в-байт AVIF у musl и glibc **различается** (2 798 B vs 3 497 B на 800w) — ETag'и
  между локальной сборкой и контейнерной не совпадут, это нормально.

---

## 8. Таблица проверок

| # | Что | Команда / способ | Результат | Статус |
|---|---|---|---|---|
| 1 | Установка по локу | `pnpm install --frozen-lockfile` | 2.1 с, лок не изменился | ✅ |
| 2 | Прод-сборка A | `SPIKE_VARIANT=A pnpm build` | 5.9 с холодная / 1.85 с тёплая, 25 HTML | ✅ |
| 3 | Node standalone поднимается | `node ./dist/server/entry.mjs` | `Server listening on http://127.0.0.1:3201` | ✅ |
| 4 | **Prerender отдаётся процессом** | `curl /` дважды, сверка тел + `ETag` | байт-в-байт, `Last-Modified` с диска | ✅ |
| 5 | `_astro/*` с `immutable` | `curl -s -D - -o /dev/null /_astro/*.js` | `public, max-age=31536000, immutable` | ✅ |
| 5b | то же на HEAD | `curl -I /_astro/*.js` | `public, max-age=0` | ❌ баг §7.3 |
| 6 | `HOST`/`PORT` из env | `HOST=127.0.0.1 PORT=3201` | работает | ✅ |
| 7 | graceful shutdown у адаптера | SIGTERM во время запроса | `fetch failed`, exit за 30 мс | ❌ |
| 7b | то же через `docker/server.mjs` | SIGTERM во время `/_image` | 200 + 3702 B, exit 0 за 662 мс | ✅ |
| 7c | `docker stop` | `time docker stop` | **0.256 с**, в логе `[server] closed` | ✅ |
| 8 | keep-alive | `curl -D -` | дефолт `timeout=5`; с обёрткой `timeout=65` | ✅ (обёрткой) |
| 9 | Сжатие в процессе | `curl -H 'Accept-Encoding: gzip, br'` | `Content-Encoding` отсутствует | ⏭ ожидаемо |
| 10 | ETag | `curl -D -` | есть на статике (weak), нет на on-demand | ✅/⚠️ |
| 11 | **A: что печётся на сборке** | сервер с чужим `SITE_URL` | canonical/og/hreflang/JSON-LD/sitemap-index — сборка; robots/sitemap/rss — runtime | ✅ измерено |
| 12 | **C: плейсхолдер принимается** | `site: 'https://__site_origin__'` | сборка проходит | ✅ |
| 12b | голый `__SITE_ORIGIN__` | то же | `! Invalid URL` | ❌ ожидаемо |
| 12c | **C: штамповка** | `entrypoint.sh` в контейнере | 32 файла, **0 мс**; плейсхолдеров не осталось | ✅ |
| 12d | C: выдача после штамповки | `curl` в контейнере с `SITE_URL=https://demo.stit.tech` | canonical/og/JSON-LD/sitemap-index верные | ✅ |
| 13 | **D: canonical из runtime** | сборка с `http://build-time.invalid` | `http://localhost:3201/` | ✅ |
| 13b | D: `X-Astro-Cache` | `curl -D -` дважды | `MISS` → `HIT` | ✅ |
| 13c | D: публичный `Cache-Control` | `curl -D -` | отсутствует → дописан в `src/fetch.ts` | ⚠️ |
| 13d | **D: 200 параллельных, холодный кеш** | `scripts/hammer.mjs`, рендер 300 мс | **141 рендер** из 200 | ❌ нет дедупа |
| 13e | D: инвалидация по тегам | `POST /api/revalidate {"tags":["blog"]}` | 202, следующий GET = `MISS` | ✅ |
| 13f | D: инвалидация по пути | `{"path":"/about"}` | 202, `MISS` | ✅ |
| 13g | D: `/now` с `maxAge` не задан | `curl -D -` | не кешируется, `no-cache` | ✅ |
| 14 | **0 байт JS без островов** | Playwright: счёт `script`-ресурсов на 5 страницах | **0 ресурсов** | ✅ |
| 15 | **Форма без JS** | Playwright `javaScriptEnabled: false` | POST → 303 → `/contact/thanks`, `role=status` «Спасибо» | ✅ |
| 15b | Форма с JS (остров) | Playwright | ответ inline, URL остаётся `/contact` | ✅ |
| 15c | Astro Action напрямую | `curl -X POST /_actions/contact` | 403 без `Origin`, 403 с чужим, 200 со своим | ✅ |
| 15d | Action как фолбэк на prerendered | `curl -X POST '/contact?_action=contact'` | 200 + исходный HTML, action не выполнен | ❌ §7.11 |
| 16 | `astro:assets` `<Picture>` | сырой HTML | AVIF/WebP/JPEG, 3 ширины, `sizes`, `width/height`, `fetchpriority` | ✅ |
| 16b | sharp в `node:24-alpine` | `docker build` + `/_image` в контейнере | 200, AVIF 3 497 B | ✅ |
| 17 | i18n `/en/*` без префикса дефолта | `curl /en`, `/en/about`, `/en/blog` | 200, `lang="en"`, взаимный hreflang | ✅ |
| 17b | `/xx` → честный 404 | `curl -o /dev/null -w '%{http_code}'` | 404 | ✅ |
| 18 | `trailingSlash: 'never'` | `/about/`, `/blog/` | 301 на версию без слеша | ✅ (301, не 308) |
| 18b | `/about.html` | `curl` | 404 при `format: 'directory'` | ✅ |
| 18c | `/index.html` | `curl` | 200 (дубль) — A/C; 404 — D | ⚠️ |
| 19 | `/old` → 301 | `curl -I` | **301**, не `meta refresh` | ✅ |
| 20 | 404-страница с разметкой | `curl /blog/net-takogo` | 404 + `<h1>404 — страница не найдена</h1>` + `noindex` | ✅ |
| 21 | `X-Robots-Tag` на prerendered | `ROBOTS_POLICY=noindex` + `curl -D -` | заголовка нет | ❌ §7.4 |
| 21b | `X-Robots-Tag` на on-demand | то же | `noindex, nofollow` | ✅ |
| 21c | `robots.txt` при `noindex` | `curl /robots.txt` | `Disallow: /` | ✅ |
| 22 | `experimentalDisableStreaming` | сравнение TTFB/total на async-блоке | разницы не видно; в манифесте `streaming: false` | ⚠️ §7.12 |
| 23 | `astro check` | `pnpm typecheck` | 74 файла, 0 ошибок, 20 hints, 4.3 с | ✅ |
| 24 | Biome линт `.astro` | `biome lint bad.astro` | с флагом: a11y + `<script>` + `<style>` (6 находок); без: только frontmatter + 1 ложная | ✅ (с флагом) |
| 24b | Biome формат `.astro` | `biome format bad.astro` | `No files were processed … ignored` | ❌ не поддержано |
| 25 | ESLint 10 + plugin-astro 3 | `pnpm exec eslint .` | 0 ошибок, 1.3 с; ловит `no-unused-vars`/`no-empty` во frontmatter | ✅ |
| 25b | `no-restricted-imports` на навязанных entry | до override | ловил `src/actions`, `src/content.config.ts` | ✅ (нужен override) |
| 26 | **Steiger: cross-slice в `.astro`** | фикстура `widgets/hero → widgets/post-list` | `Forbidden cross-import from slice "post-list"` | ✅ |
| 26b | Steiger: импорт вверх по слоям в `.astro` | фикстура `entities → widgets` | `Forbidden import from higher layer "widgets"` | ✅ |
| 26c | Steiger: deep-import `.astro → .ts` | фикстура | `Forbidden sidestep of public API` | ✅ |
| 26d | **Steiger: deep-import в `.astro`-цель** | `import PostCard from '@/entities/post/ui/post-card.astro'` | **не поймал** | ❌ |
| 26e | **Steiger: `export … from`** | `export { listPosts } from '@/entities/post/api/queries'` | **не поймал** | ❌ |
| 27 | Vitest: схема контента | `pnpm test` | проходит (заглушка `image()`) | ✅ |
| 27b | Vitest: `experimental_AstroContainer` | рендер `hero.astro` в строку | `<h1>`, текст, `href="/blog"` | ✅ |
| 28 | Playwright smoke | `pnpm test:e2e` | **9/9**, 9.4 с | ✅ |
| 29 | size-limit | `pnpm size` | island 93.22 КБ / CSS 3.42 КБ gzip | ✅ |
| 30 | **`pnpm check` целиком** | `pnpm check` | **exit 0, 12.0 с** | ✅ |
| 31 | dev: старт и HMR контента | `astro dev --port 3213` | 3.0 с; правка тела/frontmatter/новый файл — подхватываются | ✅ |
| 31b | dev: демон «залипает» | — | `Content config not loaded`, все посты 404 | ⚠️ §7.10 |
| 32 | Docker-образ | `docker build -f docker/Dockerfile` | **315.7 МБ**, HEALTHCHECK, `USER node` | ✅ |
| 33 | Бонус: `@astrojs/rss` | `curl /rss.xml` | валидный RSS 2.0, абсолютные ссылки из runtime | ✅ |
| 34 | Бонус: server islands | `server:defer` на `/about` | работает; контент **не** в первом HTML, эндпоинт сам `noindex` | ✅ / ⚠️ |
| 35 | Бонус: `<ClientRouter />` | сборка + замер | +13 828 B raw / **4 726 B gzip** на страницу | ✅ измерено |
| 36 | Бонус: Pagefind | — | не проверялось | ⏭ |
| 37 | Бонус: satori OG | — | не проверялось (есть `public/og-default.png`) | ⏭ |

---

## 9. FSD: что Astro навязывает и как это прятать

### Навязанные пути (Astro 7.3.2)

| путь | зачем | можно ли перенести |
|---|---|---|
| `src/pages/**` | файловый роутинг | да — `srcDir`, но тогда уезжает весь `src` |
| `src/content.config.ts` | коллекции контента | нет (жёсткий путь внутри `srcDir`) |
| `src/middleware.ts` | middleware | нет |
| `src/actions/index.ts` | Astro Actions | нет |
| `src/fetch.ts` | Advanced Routing (Astro 7) | **да**: `fetchFile: 'имя'` или `null` |
| `src/env.d.ts` | типы `astro:*` | фактически заменён `.astro/types.d.ts` в `tsconfig.include` |
| `public/**` | статика как есть | да — `publicDir` |

Принятое решение: **`srcDir` по умолчанию (`src`) + тонкие реэкспорты + ignores в Steiger
и ESLint.** Каждый навязанный файл — 1–3 строки, вся логика лежит в слоях
(`app/middleware`, `app/fetch`, `features/contact-form/api`, `entities/post/model`).

### Сравнение с `srcDir: './src/app'` (вариант из `tooling-lab/astro-fsd/`)

| критерий | `srcDir: 'src'` + ignores (наш) | `srcDir: './src/app'` |
|---|---|---|
| где маршруты | `src/pages/**` — **настоящий слой `pages` FSD** | `src/app/pages/**` — `pages` становится **сегментом app** |
| где `content.config.ts`, `middleware.ts`, `env.d.ts` | в корне `src/` (3–4 файла-реэкспорта) | внутри `src/app/` — «обвязка фреймворка» спрятана |
| алиас `@/*` | штатный из `tsconfig.paths` | нужен ручной `vite.resolve.alias` (`srcDir` уехал) |
| Steiger | ignores на 4 файла + правила для `src/pages/**` и `src/app/**` | всё равно нужны исключения (`src/app/middleware` ловится `segments-by-purpose`) |
| понятность для FSD-агентов и `/scaffold` | слой `pages` на своём месте, путь выводится из kind+slug | `/scaffold` и FSD-карта из `<org>/strategy` перестают биться с деревом |

**Рекомендация одной строкой: оставить `srcDir: 'src'` и прятать навязанные файлы
реэкспортами — перенос в `src/app` экономит 4 файла, но ломает семантику слоя `pages`,
на которой держатся FSD-карта в `strategy`, скилл `/scaffold` и Steiger.**

### Контент внутри слайса

`loader: glob({ pattern: '**/*.md', base: 'src/entities/post/content' })` — **работает**
(12 постов, обложки рядом через `image()` в схеме, относительные `cover: ./covers/x.png`
резолвятся). HMR контента в dev работает полностью (тело, frontmatter, новые файлы).
Единственная оговорка — импортировать коллекцию в `src/content.config.ts` надо
**напрямую из модуля**, не через баррель (§7.10).

Layout-документ живёт в `src/app/layouts/document.astro` — Astro на это никак не влияет,
`<slot name="head" />` даёт страницам вставлять SEO-блок.

---

## 10. i18n: как сделано и что грамотнее

Сделано: встроенный `i18n` (`defaultLocale: 'ru'`, `locales: ['ru','en']`,
`routing.prefixDefaultLocale: false`) + **физический каталог `src/pages/en/`**.

| вариант | плюсы | минусы |
|---|---|---|
| `src/pages/en/**` (наш) | статически видно, что реально переведено; непереведённой страницы просто **нет** ⇒ честный 404 (канон L-2, `14` §2.9.2); никакой рантайм-логики | дублирование файла-обёртки на каждую переведённую страницу |
| `src/pages/[locale]/**` | один файл на маршрут | `/xx/foo` матчится параметром ⇒ нужна ручная валидация локали и явный 404; страница «есть» даже без перевода — риск дублей и ложного hreflang; ломает «дефолт без префикса» (нужен второй комплект маршрутов) |

**Грамотнее — как сделано** (`src/pages/en/`): фреймворк сам даёт 404 на
несуществующую локаль (`/xx` → **404** без единой строки кода), а набор переводов
физически совпадает с набором файлов. Дублирование лечится общими widget/entity-слоями:
`en/index.astro` — это 25 строк, вся разметка в `widgets/*`.

hreflang собирается своим хелпером `shared/seo/urls.ts` (`alternates()` → `ru`, `en`,
`x-default`, абсолютные, взаимные). Встроенные `getAbsoluteLocaleUrl` /
`getRelativeLocaleUrl` из `astro:i18n` **сознательно не используются**: они берут origin из
build-time `site`, а нам нужен runtime `SITE_URL` (вся развилка §5). Свой хелпер — 30 строк
и покрыт unit-тестом.

`<html lang>` берётся из пропса layout'а (`ru` / `en`) — проверено в сыром HTML.
Авто-редиректов по `Accept-Language` нет (канон L-4).

---

## 11. Вердикт: насколько это грамотно для контент-first сайта в нашей экосистеме

### Сильные стороны (по весам `brief-v2.md`)

**Качество выдачи (вес 25) — 24/25.** «Ноль JS» не декларация, а измеренный факт:
на четырёх из пяти reference-маршрутов Playwright не видит ни одного script-ресурса,
а единственный `<script>` в документе — `application/ld+json`. Документ главной
2.5 КБ gzip, поста — 2.8 КБ. Картинки — `<picture>` AVIF/WebP с честным JPEG-фолбэком,
`width`/`height`, `fetchpriority`. Шрифты — сабсеты по `unicode-range`, кириллица
отдельным файлом 18.7 КБ. Всё это из коробки, без единой строки «оптимизации».
Минус один балл — за `font-display: swap` от `@fontsource` (канон P-7 просит `optional`)
и за 2 КБ инлайнового CSS от `responsiveStyles`.

**SEO-инструментарий (вес 20) — 15/20.** Есть: `trailingSlash`, настоящие статусы,
i18n-роутинг, `redirects` с кодами, `astro:assets`, RSS-интеграция, sitemap-интеграция.
Нет: runtime-origin (вся развилка §5), runtime-`X-Robots-Tag` на prerendered (§7.4),
308 вместо 301 (§7.13). Head-API как такового нет — но `<slot name="head">` + свой
`SeoHead.astro` дают ровно то же и проще, чем метаданные-как-объект.

**Контент-пайплайн (вес 15) — 14/15.** Content Layer с `glob({ base })` кладёт контент
**внутрь слайса** — редкая для фреймворков свобода, ровно под FSD. Zod-схема в
`entities/post/model/schema.ts`, ошибка frontmatter = красная сборка. Markdown
компилируется на билде (Rust-процессор Sätteri), в рантайме — только склейка.
HMR полный. Гибрид static+server — per-route `prerender`, без переключения режима проекта.
`routeRules` + `cache.invalidate({tags})` дают ISR-подобную инвалидацию **без CDN**.
Минус — за dev-демон, который умеет «потерять» коллекцию (§7.10).

**Зрелость (вес 15) — 12/15.** GA, предсказуемые мажоры, огромная экосистема,
llms.txt и `.md`-версии доков. Cloudflare за спиной — скорее плюс для финансирования и
минус для гарантий по не-CDN-ветке (`memoryCache` — единственный не-платформенный провайдер).
Astro 7 совсем свежий (июнь 2026) и `routeRules`/`cache`/`src/fetch.ts` ему ровесники —
мы будем среди первых, кто гоняет их в проде.

**Совместимость с наследием (вес 15) — 12/15.** FSD-раскладка легла без боя, Steiger
реально работает на `.astro`, Biome/ESLint/Vitest/Playwright/size-limit — тоже,
`pnpm check` зелёный за 12 с, TS strict (`astro/tsconfigs/strictest` + наши опции) —
0 ошибок. Вычитаем за: отсутствие форматирования `.astro` в Biome, дыры Steiger
(§ п.26d/26e), требование ESLint 10 (в SPA-шаблоне 9.39.5 — мажорный апгрейд гейта)
и конфликт «server-only код vs public API слайса» (§7.2).

**Self-host одним Node-образом (вес 10) — 7/10.** Prerender реально отдаётся процессом,
`immutable` на ассетах, `/healthz`, `HOST`/`PORT` из env — всё есть. Вычитаем за
образ 316 МБ (выход не self-contained), отсутствие graceful shutdown и keep-alive
в адаптере (лечится 25 строками) и отсутствие сжатия в процессе (лечится Traefik).

### Чего в Astro нет и что придётся выдумывать самим

1. **Обёртка сервера** `docker/server.mjs` — graceful shutdown + `keepAliveTimeout`.
   Без неё `make bump` рвёт запросы, а Traefik ловит 502 (§ «graceful shutdown»).
2. **Штамповка origin** `docker/entrypoint.sh` + e2e-тест «нет `__site_origin__` в ответе».
3. **Runtime-конфиг** `shared/config` (Zod поверх `process.env`) — у Astro нет
   ничего вроде `runtimeConfig` Nuxt.
4. **Свой `sitemap.xml`** (on-demand, runtime-origin, честный `lastmod`) вместо/поверх
   `@astrojs/sitemap`; `robots.txt` — тоже свой.
5. **Свой hreflang/canonical-хелпер** (`shared/seo/urls.ts`), потому что `astro:i18n`
   и `Astro.site` привязаны к build-time origin.
6. **Эндпоинт формы с PRG-303** вместо Astro Actions, если форма живёт на
   prerendered-странице (§7.11), плюс honeypot и time-trap руками.
7. **Single-flight для кеша** (вариант D) или прогрев горячих URL при старте.
8. **Правило `X-Robots-Tag` на Traefik** для staging — в приложении его поставить
   на prerendered нельзя.
9. **Прунинг `node_modules`** в Dockerfile (минус 55–70 МБ) — Astro этого не делает.
10. **Правило в `.claude/rules`**: «server-only символы не попадают в `index.ts` слайса»
    (§7.2) и «`build.format` только `directory`» (§7.1).

Ни один из десяти пунктов не дороже пары часов; девять из десяти — файлы, которые в
шаблоне пишутся один раз и наследуются форками. Это принципиально дешевле, чем
отсутствие prerender у Nitro (`06` §7.2) или цена «нулевого JS», которую в React-стеке
надо выгрызать.

### Итоговая оценка

**Astro 7 — самый грамотный из проверенного на сегодня выбор под контент-first сайты
нашей экосистемы.** Он единственный из кандидатов, у которого «ноль JS» — дефолт, а не
достижение; у которого контент можно физически положить внутрь FSD-слайса; и у которого
Node-процесс честно отдаёт prerender с `immutable`-ассетами без CDN и без sidecar-nginx.
Развилка «один образ» закрывается вариантом C за 20 строк entrypoint'а и 10 мс при старте.

Главные риски, которые надо принять осознанно: **новизна Astro 7** (`routeRules`, `cache`,
`src/fetch.ts` — три месяца от релиза), **мажорный апгрейд ESLint 9 → 10** в общем гейте,
**отсутствие форматирования `.astro`** (либо живём без него, либо заводим Prettier с
`prettier-plugin-astro` рядом с Biome) и **316 МБ образа** против ~60 МБ у nginx-варианта
SPA-шаблона.

---

## 12. Конкретные рекомендации шаблону (готовые к переносу)

1. `astro.config.ts`: `output: 'static'`, `adapter: node({ mode: 'standalone',
   experimentalDisableStreaming: true })`, **`build: { format: 'directory' }`**,
   `trailingSlash: 'never'`, `session: false`, `prefetch: false`,
   `image: { responsiveStyles: true, layout: 'constrained' }`,
   `cache: { provider: memoryCache() }` + `routeRules` (нужны и в static-режиме —
   для on-demand маршрутов и `/_image`), `i18n` с `prefixDefaultLocale: false`.
   `@astrojs/sitemap` **не подключать**.
2. `docker/`: `Dockerfile` (3 стадии + прунинг), `entrypoint.sh` (штамповка),
   `server.mjs` (обёртка). `SITE_URL` — build-ARG со значением `https://__site_origin__`.
3. `src/`: навязанные Astro файлы — только реэкспорты; `src/content.config.ts`
   импортирует коллекцию **напрямую из модуля**.
4. `biome.json`: обязателен `"html": { "experimentalFullSupportEnabled": true }`;
   `overrides` для `.astro` не нужны. Форматирование `.astro` — отдельный вопрос владельцу.
5. `eslint.config.js`: два паттерна `no-restricted-imports` (`@/*/*/*/*` и `@/shared/*/*`)
   + override для `src/{actions,content.config.ts,middleware.ts,fetch.ts}`.
6. `steiger.config.ts`: `ignores` на те же 4 пути + отключение слайсовых правил
   на `src/pages/**` и `segments-by-purpose`/`public-api` на `src/app/**`.
7. `vitest.config.ts`: обязательно `getViteConfig` из `astro/config`.
8. e2e (обязательные для гейта SEO): «0 script-ресурсов на индексируемых страницах»,
   «в `<body>` нет абсолютных URL своего origin», «в ответе нет `__site_origin__`»,
   «форма работает без JS → 303», «`/blog/net-takogo` и `/xx` → 404», «canonical абсолютный».
9. Новые правила в `.claude/rules/`: `build.format` только `directory`; server-only код
   не попадает в public API слайса; server islands — не для индексируемого контента;
   HTML не предсжимать (иначе плейсхолдер уедет в `.br`).
10. INFRA-HANDOFF: на staging-роутере Traefik — `basicAuth` **и**
    `customResponseHeaders: X-Robots-Tag: noindex, nofollow` (в приложении на prerendered
    это недостижимо); `compress` с `encodings: [br, gzip]` — процесс не жмёт ничего.

---

## 13. Открытые вопросы владельцу

1. **ESLint 9 → 10.** `eslint-plugin-astro@3.1.0` требует `eslint >= 10`. Гейт SPA-шаблона
   стоит на 9.39.5. Разводим шаблоны по мажорам ESLint или поднимаем оба?
2. **Форматирование `.astro`.** Biome его не делает. Варианты: (а) жить без
   автоформата `.astro` (Biome всё равно их линтит), (б) добавить Prettier +
   `prettier-plugin-astro` только на `*.astro` и звать его из `format:check`.
   Второй путь возвращает в стек Prettier, от которого SPA-шаблон ушёл.
3. **React как язык островов.** Один остров-форма = **93 КБ gzip**. Если острова —
   редкость, Preact/Solid/Svelte или вообще ванильный `<script>` дадут 3–15 КБ.
   Оставляем React ради переиспользования кода SPA-шаблона или берём лёгкий рендерер?
4. **Вариант C vs D по умолчанию.** Рекомендация потока — C. Подтвердить, либо
   выбрать D для проектов с внешней CMS (там runtime-инвалидация ценнее).
5. **`mem_limit` контейнера.** При варианте D и картинках через `/_image` RSS доходил
   до 360 МБ. Оставляем 512 МБ или поднимаем до 768 МБ?
6. **Astro 7 — три месяца от релиза.** Фиксируем точные версии (`astro@7.3.2`,
   `@astrojs/node@11.1.5`) в шаблоне и обновляем осознанно?

---

## 14. Источники

**Astro**
- https://astro.build/blog/astro-7/ (Astro 7.0, 22.06.2026)
- https://astro.build/blog/ (лента релизов: 7.3 — 03.09.2026; 6.4 — 28.05.2026)
- https://docs.astro.build/en/reference/configuration-reference/ (`site`, `cache`, `routeRules`, `build.format`, `trailingSlash`, `image.*`, `session`, `fetchFile`)
- https://docs.astro.build/en/guides/caching/ (`memoryCache()`, `Astro.cache`, `routeRules`, `invalidate`)
- https://docs.astro.build/en/guides/integrations-guide/node/ (`mode`, `staticHeaders`, `experimentalDisableStreaming`, `bodySizeLimit`, `HOST`/`PORT`, `immutable` на `_astro`)
- https://docs.astro.build/en/guides/middleware/ («This rendering occurs at build time for all prerendered pages…»)
- https://docs.astro.build/en/guides/routing/ (редиректы в статике = `meta refresh`)

**Cloudflare / Astro**
- https://www.cloudflare.com/press/press-releases/2026/cloudflare-acquires-astro-to-accelerate-the-future-of-high-performance-web-development/ (16.01.2026)

**Инструменты**
- https://biomejs.dev/internals/language-support/ (Astro/Vue/Svelte — 🟡 parsing/formatting/linting; `html.experimentalFullSupportEnabled`)

**Прочитанные исходники (в `node_modules` спайка)**
- `@astrojs/node@11.1.5`: `dist/{index,server,standalone,serve-static,serve-app,middleware}.js`
- `astro@7.3.2`: `dist/core/cache/{memory-provider,handler,runtime/cache,runtime/utils,runtime/route-matching}.js`, `dist/core/fetch/{index,vite-plugin,features}.js`, `dist/config/entrypoint.js`, `dist/runtime/server/astro-island.js`
- `send@1.2.1`: `index.js` (порядок `setHeader` → `stream`, ветка HEAD)

**Канон и смежные отчёты**
- `research/02-seo-canon.md` §3.2 (I-*, M-*, S-*, L-*, P-*, B-*, Q-*)
- `research/04-runtime-deploy.md` §3.1 (образец Dockerfile), §4 (таблица кеширования)
- `research/06-spike.md` §6–7 (эталон формата, провал prerender у Nitro)
- `research/14-content-architecture.md` §2.2.2–2.2.6, §2.9, §2.10
- `scratchpad/tooling-lab/astro-fsd/` (вариант `srcDir: './src/app'`)
