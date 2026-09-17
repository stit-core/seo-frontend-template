# 09 — Эмпирическая проверка (spike): Nuxt 4 как основа ssr-frontend-template

Дата прогона: 2026-09-16. Каталог кода: `scratchpad/spike-nuxt/`. Порт 3202.
Машина: Linux 6.12, 20 CPU, 15.7 ГБ RAM (свободно ~3–6 ГБ), Node v24.9.0, pnpm 10.0.0,
Docker 29.8. **Параллельно работали 3–4 других агента** — абсолютные тайминги шумные,
все TTFB даны как медиана из 20 запросов, сборки — с явной пометкой «загруженная машина».

---

## 1. TL;DR

1. **Nuxt 4.5.2 несёт Nitro 2.13.4 (stable 2.x)**, Vite 8.3.0, Vue 3.5.42, h3 1.15.11.
   Не Nitro 3 beta. Пресет `node-server` работает без бубна.
2. **Главное отличие от TanStack Start: Nitro внутри Nuxt реально отдаёт prerendered
   HTML самим процессом** (`06-spike.md` §7.2 — у Start он был мёртвым весом).
   `/about` отдаётся из `.output/public/about/index.html` с `ETag` + `Last-Modified`,
   медиана TTFB 1.7 мс; `/now` рендерится на каждый запрос.
3. **`routeRules: { noScripts: true }` даёт страницу с 0 (ноль) байт клиентского JS**
   при полном SSR-HTML, живом CSS и полным SEO-head: `/about` = 3987 Б raw / 1589 Б gzip /
   1174 Б по проводу (brotli), **0 JS-запросов в браузере**. Это единственный реальный путь
   Nuxt к «HTML-first»; острова (`.server.vue`) его не заменяют (см. §7.4).
4. **Без `noScripts` цена гидрации высокая**: статическая `/about` тянет ~102 КБ JS по
   проводу (14 файлов), страница поста — ~150 КБ. Это Vue + Nuxt-рантайм + vue-i18n +
   unhead + роутер; «островов» в смысле Astro в Nuxt нет.
5. **Развилка «один образ на все среды» решается, но только в режиме `swr`.**
   В SWR-режиме `NUXT_PUBLIC_SITE_URL` + `NUXT_PUBLIC_I18N_BASE_URL` на рантайме
   меняют canonical / og:url / og:image / hreflang / robots.txt / sitemap / RSS.
   В prerender-режиме **всё запечено на билде**, включая `sitemap.xml` (и его нельзя
   «разстатичить» — удаление файла даёт 500, а не fallback на хендлер).
6. **`swr` в Nitro 2 — рабочий серверный кеш HTML в памяти процесса**: холодный
   рендер 10–11 мс, тёплый 1.4–3.7 мс; **200 параллельных запросов на холодный ключ дают
   ровно 1 рендер** (single-flight). Заголовки — `cache-control: s-maxage=600,
   stale-while-revalidate` + weak ETag + 304. **`X-Cache` не выводится** — `cacheStatusHeader`
   есть только в Nitro 3, в 2.13.4 его в бандле нет (правка к `04-runtime-deploy.md` §2.7).
7. **Nuxt SEO suite (`@nuxtjs/seo` 5.3.16) закрывает большую часть MUST канона §3.2
   из коробки**: sitemap (с i18n и `lastmod` из фронтматтера), robots (три контура
   staging-noindex одной env-переменной), schema-org (`WebSite`+`Organization`+`WebPage`+
   `Article`+`BreadcrumbList`), og-image (satori/resvg, 198 мс холодно / 4 мс из кеша),
   canonical+hreflang через `useLocaleHead`. Самим писать остаётся: нормализация URL
   (хвостовой слэш и регистр), RSS, бюджеты и e2e-проверки.
8. **FSD ложится почти целиком**: `srcDir: 'src'` + `dir.*` + `imports.autoImport: false`
   + `components.dirs: []` дают `src/{app,pages,widgets,features,entities,shared}` с явными
   импортами. Steiger видит импорты в `<script setup>` и ловит и forbidden-imports, и
   cross-import, и sidestep. Biome 2.5.13 с `html.experimentalFullSupportEnabled`
   форматирует и линтит `.vue`. ESLint 10.10 + `@nuxt/eslint` + `eslint-plugin-boundaries@7`
   работает на `.vue` — **но только если добавить `import/resolver: typescript`**
   (без резолвера правило молча ничего не проверяет; это, похоже, дефект и в SPA-шаблоне).
9. **Навязанные каталоги вне FSD**: `src/pages/**` (маршруты, любой `.vue` — маршрут),
   `src/components/OgImage/**` (жёсткое требование nuxt-og-image), `src/app.vue`,
   `src/error.vue`, `server/**`, `content.config.ts`, `nuxt.config.ts` — 4 исключения
   в `steiger.config.ts`.
10. **Образ 212 МБ** (node:24-alpine + `.output` 44.7 МБ слоем), сборка 25 с. Внутри
    контейнера: idle 39.5 МиБ, после 200 параллельных 112 МиБ, healthcheck `healthy`,
    graceful shutdown с дожатием in-flight (exit 0). **`better-sqlite3` на alpine не
    собирается** — обязателен `content.experimental.sqliteConnector: 'native'` (node:sqlite).
11. **Вердикт: Nuxt 4 — грамотный и полный выбор для контент-first сайта нашей экосистемы**,
    с одной серьёзной оговоркой — «ноль JS» достигается только режимом `noScripts` на
    уровне маршрута (всё или ничего), а не частичной гидрацией.

---

## 2. Версии (факт, `pnpm ls --depth 0` + разбор `node_modules`)

### Прямые зависимости

| пакет | версия |
|---|---|
| `nuxt` | **4.5.2** |
| `vue` | 3.5.42 |
| `vue-router` | 5.3.1 |
| `@nuxt/content` | 3.16.0 |
| `@nuxt/image` | 2.1.0 |
| `@nuxtjs/i18n` | 10.6.0 |
| `@nuxtjs/seo` | 5.3.16 |
| `zod` | 4.6.5 |
| `@fontsource-variable/inter` | 5.3.0 |

### devDependencies

| пакет | версия |
|---|---|
| `@biomejs/biome` | 2.5.13 |
| `eslint` | **10.10.0** |
| `@nuxt/eslint` | 1.17.0 |
| `eslint-plugin-boundaries` | 7.2.0 |
| `eslint-import-resolver-typescript` | 4.4.5 |
| `@feature-sliced/steiger-plugin` / `steiger` | 0.7.0 / 0.6.0 |
| `vitest` | 5.0.1 |
| `@nuxt/test-utils` | 4.3.2 |
| `@vue/test-utils` | 2.5.0 |
| `@playwright/test` | 1.63.0 |
| `typescript` | 6.0.3 |
| `vue-tsc` | 3.3.11 |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 |
| `size-limit` / `@size-limit/file` | 13.1.1 |
| `sharp` | 0.35.4 |
| `satori` | 0.33.4 |
| `@resvg/resvg-js` | 2.6.2 |
| `happy-dom` | 20.14.5 |
| `@types/node` | 26.5.1 |

> `satori` и `@resvg/resvg-js` формально в devDependencies, но **нужны в рантайме**
> (nuxt-og-image генерирует картинки на запрос). Nitro трассирует их в
> `.output/server/node_modules` по графу импортов, поэтому образ работает; в шаблоне
> их надо перенести в `dependencies`.

### Какой Nitro внутри (ключевой вопрос брифа)

Баннер сборки: `Nuxt 4.5.2 (with Nitro 2.13.4, Vite 8.3.0 and Vue 3.5.42)`.
`.output/nitro.json` → `"versions": { "nitro": "2.13.4" }`.

| пакет | версия | комментарий |
|---|---|---|
| `nitropack` | **2.13.4** | stable 2.x, не Nitro 3 beta |
| `h3` | 1.15.11 | (h3 2.0.1-rc.32 лежит в сторе как транзитив другого пакета, Nitro его не использует) |
| `unstorage` | 1.17.5 | |
| `srvx` | 0.11.22 | peer |
| `db0` | 0.3.4 (+0.4.1) | под @nuxt/content |
| `ipx` | **4.0.0-beta.1** | внутри @nuxt/image 2.1.0 — beta в проде |
| `@nuxt/nitro-server` | 4.5.2 | слой Nuxt поверх Nitro (renderer, islands, route rules `ssr`/`noScripts`/`streaming`) |

Nuxt SEO 5.3.16 разворачивается в: `@nuxtjs/robots` 6.2.3, `@nuxtjs/sitemap` 8.5.1,
`nuxt-og-image` 6.8.0, `nuxt-schema-org` 6.3.2, `nuxt-seo-utils` 8.5.1,
`nuxt-link-checker` 5.3.0, `nuxt-site-config` 4.2.3, `site-config-stack` 4.2.3.

### Установка (воспроизводимо)

```bash
pnpm install --frozen-lockfile       # 3.6 c на прогретом сторе, lock совместим
```

---

## 3. Итоговые конфиги

### `nuxt.config.ts`

```ts
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

// Дефолт нужен только чтобы билд не падал: реальный origin приезжает из env контейнера.
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://stit-demo.local'

// Профиль рендера переключается одним env — так один и тот же код проверяется в двух режимах.
const renderMode = process.env.RENDER_MODE === 'swr' ? 'swr' : 'prerender'

const prerenderRules = {
  '/': { prerender: true },
  '/about': { prerender: true, noScripts: true },
  '/contact': { prerender: true },
  '/blog': { prerender: true },
  '/blog/page/**': { prerender: true },
  '/blog/**': { prerender: true },
  '/en': { prerender: true },
  '/en/about': { prerender: true },
  '/en/contact': { prerender: true },
  '/en/blog': { prerender: true },
  '/en/blog/page/**': { prerender: true },
  '/en/blog/**': { prerender: true },
} as const

const swrRules = {
  '/': { swr: 600 },
  '/about': { swr: 600, noScripts: true },
  '/contact': { swr: 600 },
  '/blog': { swr: 600 },
  '/blog/page/**': { swr: 600 },
  '/blog/**': { swr: 600 },
  '/en': { swr: 600 },
  '/en/about': { swr: 600 },
  '/en/contact': { swr: 600 },
  '/en/blog': { swr: 600 },
  '/en/blog/page/**': { swr: 600 },
  '/en/blog/**': { swr: 600 },
} as const

export default defineNuxtConfig({
  compatibilityDate: '2026-09-15',

  // ── FSD-раскладка ───────────────────────────────────────────────
  srcDir: 'src',
  dir: {
    pages: 'pages',
    layouts: 'app/layouts',
    plugins: 'app/plugins',
    middleware: 'app/middleware',
    assets: 'app/assets',
  },
  // Явные импорты вместо магии: ни композаблов, ни компонентов по соглашению.
  imports: { autoImport: false },
  components: { dirs: [] },

  // Порядок значим: @nuxtjs/seo должен грузиться ДО @nuxt/content, иначе модуль sitemap
  // печатает предупреждение о поломке интеграции с коллекциями.
  modules: ['@nuxt/eslint', '@nuxtjs/seo', '@nuxt/content', '@nuxt/image', '@nuxtjs/i18n'],

  css: ['~/app/styles/index.css'],
  vite: { plugins: [tailwindcss()] },
  typescript: { strict: true, typeCheck: false },

  // ── SEO / site config ───────────────────────────────────────────
  site: {
    url: siteUrl,
    name: 'stit demo',
    defaultLocale: 'ru',
    indexable: process.env.ROBOTS_POLICY !== 'noindex',
  },

  sitemap: {
    autoI18n: true,
    exclude: ['/now', '/en/now'],
    xslColumns: [
      { label: 'URL', width: '60%' },
      { label: 'Last Modified', select: 'sitemap:lastmod', width: '40%' },
    ],
  },

  // node:sqlite вместо better-sqlite3: минус 17 МБ нативных prebuild'ов и сборка на alpine.
  content: {
    experimental: { sqliteConnector: 'native' },
  },

  robots: {
    disallow: ['/contact'],
  },

  ogImage: {
    // component в defaults запрещён типами: шаблон выбирается через defineOgImageComponent().
    defaults: { width: 1200, height: 630 },
    // playwright есть в devDependencies гейта — без этого модуль тащит playwright-core в .output.
    compatibility: {
      dev: { browser: false },
      runtime: { browser: false },
      prerender: { browser: false },
    },
  },

  schemaOrg: {
    identity: { type: 'Organization', name: 'stit demo' },
  },

  linkChecker: { enabled: false },

  // ── i18n ────────────────────────────────────────────────────────
  i18n: {
    restructureDir: 'src/shared/i18n',
    strategy: 'prefix_except_default',
    defaultLocale: 'ru',
    locales: [
      { code: 'ru', language: 'ru-RU', name: 'Русский', file: 'ru.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    // Без авторедиректа по Accept-Language: требование SEO-канона L-4.
    detectBrowserLanguage: false,
    // baseUrl НЕ задаём: он попадает в site-config поверх runtimeEnv и убивает подмену SITE_URL.
  },

  // dir резолвится модулем относительно srcDir, а public/ лежит в корне.
  image: {
    dir: '../public',
    // ipx по умолчанию отдаёт max-age=60; routeRules его не перебивают — только опция стораджа.
    ipx: { fs: { maxAge: 31536000 } },
    format: ['avif', 'webp'],
    screens: { sm: 640, md: 768, lg: 1024, xl: 1280 },
  },

  // ── рендеринг ───────────────────────────────────────────────────
  routeRules: {
    ...(renderMode === 'swr' ? swrRules : prerenderRules),
    '/now': { prerender: false, swr: false, robots: false, headers: { 'cache-control': 'no-cache' } },
    '/en/now': { prerender: false, swr: false, robots: false, headers: { 'cache-control': 'no-cache' } },
    // ?sent=1 меняет тело — кешировать нельзя
    '/contact': { robots: false, swr: false, prerender: false },
    '/en/contact': { robots: false, swr: false, prerender: false },
    '/old': { redirect: { to: '/', statusCode: 301 } },
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/covers/**': { headers: { 'cache-control': 'public, max-age=604800' } },
    '/_og/**': { headers: { 'cache-control': 'public, max-age=604800' } },
  },

  nitro: {
    preset: 'node-server',
    compressPublicAssets: { gzip: true, brotli: true },
    prerender: {
      crawlLinks: renderMode === 'prerender',
      failOnError: false,
      routes: renderMode === 'prerender' ? ['/', '/en'] : [],
      ignore: ['/now', '/en/now'],
    },
  },

  experimental: { componentIslands: true },

  alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },

  devtools: { enabled: false },
  telemetry: false,
})
```

### `content.config.ts`

```ts
import { fileURLToPath } from 'node:url'
import { defineCollection, defineContentConfig } from '@nuxt/content'
import { defineSitemapSchema } from '@nuxtjs/sitemap/content'
import { z } from 'zod'
import { postFrontmatterSchema } from './src/entities/post/model/schema'

// Контент живёт в FSD-слайсе, а не в навязанном content/ на корне.
const postsDir = fileURLToPath(new URL('./src/entities/post/content', import.meta.url))

// Sitemap не видит коллекции сам: поле sitemap в схеме — единственный способ попасть в него без prerender.
function postsCollection(locale: 'ru' | 'en') {
  return defineCollection({
    type: 'page',
    source: {
      include: '**/*.md',
      cwd: `${postsDir}/${locale}`,
      prefix: locale === 'ru' ? '/blog' : '/en/blog',
    },
    schema: postFrontmatterSchema.extend({
      sitemap: defineSitemapSchema({
        z,
        name: `posts${locale === 'ru' ? 'Ru' : 'En'}`,
        onUrl: (url: Record<string, unknown>, item: Record<string, unknown>) => {
          url.lastmod = item.updatedDate
        },
      }),
    }),
  })
}

export default defineContentConfig({
  collections: { postsRu: postsCollection('ru'), postsEn: postsCollection('en') },
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
    // Каталоги, навязанные фреймворком: файловые маршруты и шаблоны OG-картинок.
    files: ['./src/pages/**', './src/components/**'],
    rules: {
      'fsd/public-api': 'off',
      'fsd/no-layer-public-api': 'off',
      'fsd/no-segmentless-slices': 'off',
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // restructureDir @nuxtjs/i18n: каталог с JSON-каталогами, кода там нет.
    files: ['./src/shared/i18n/**'],
    rules: { 'fsd/public-api': 'off' },
  },
  { files: ['./src/app/**'], rules: { 'fsd/segments-by-purpose': 'off' } },
])
```

### `eslint.config.mjs`

```js
import boundaries from 'eslint-plugin-boundaries'
// @nuxt/eslint генерирует .nuxt/eslint.config.mjs (правила vue + typescript + сам Nuxt).
import withNuxt from './.nuxt/eslint.config.mjs'

const fsdLayers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']
const allowedBelow = {
  app: ['pages', 'widgets', 'features', 'entities', 'shared'],
  pages: ['widgets', 'features', 'entities', 'shared'],
  widgets: ['features', 'entities', 'shared'],
  features: ['entities', 'shared'],
  entities: ['shared'],
  shared: ['shared'],
}

export default withNuxt(
  {
    ignores: ['.nuxt', '.output', '.data', 'coverage', 'node_modules',
      'test-results', 'playwright-report', '_*.mjs'],
  },
  {
    plugins: { boundaries },
    settings: {
      // Без резолвера алиас @/* не резолвится и правило молча ничего не проверяет.
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: ['./.nuxt/tsconfig.app.json'] },
      },
      'boundaries/elements': fsdLayers.map((layer) => ({ type: layer, pattern: `src/${layer}/*` })),
    },
    rules: {
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        policies: Object.entries(allowedBelow).map(([from, to]) => ({
          from: [{ element: { type: from } }],
          allow: to.map((type) => ({ to: { element: { type } } })),
        })),
      }],
      // FSD-имена слайсов односложны по канону; правило Vue тут не работает.
      'vue/multi-word-component-names': 'off',
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@/*/*/*/*'], message: 'Deep-импорт мимо public API запрещён' }],
      }],
    },
  },
)
```

### `biome.json` (ключевое)

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "files": {
    "ignoreUnknown": true,
    "includes": ["**/*.ts", "**/*.vue", "**/*.js", "**/*.mjs", "**/*.json", "**/*.css",
      "!**/node_modules", "!**/.nuxt", "!**/.output", "!**/.data",
      "!**/coverage", "!**/test-results", "!**/playwright-report"]
  },
  "html": {
    "experimentalFullSupportEnabled": true,   // без него .vue только частично
    "formatter": { "enabled": true },
    "parser": { "interpolation": true }
  },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100, "lineEnding": "lf" },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded", "trailingCommas": "all" } },
  "css": { "parser": { "tailwindDirectives": true } },
  "linter": {
    "rules": {
      "preset": "recommended",
      "correctness": { "noUnusedVariables": "error" },
      "style": {
        "useImportType": "error", "useExportType": "error", "useConst": "error",
        "useVueMultiWordComponentNames": "off"   // FSD-имена слайсов односложны
      },
      "suspicious": { "noExplicitAny": "warn", "noConsole": { "level": "warn", "options": { "allow": ["warn","error","info"] } } }
    }
  }
}
```

### `vitest.config.ts`

```ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    globals: true,
    environment: 'nuxt',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.nuxt/**', '.output/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.test.ts', 'src/pages/**', 'src/components/**'],
    },
  },
})
```

### `.size-limit.cjs`

```js
// Бюджетируется клиентский граф, который реально грузит контентная страница.
// Nuxt не даёт стабильных имён чанков, поэтому бюджет ставится на весь _nuxt/*.js
// и отдельно на CSS; страничный «сколько реально скачал браузер» меряет e2e.
module.exports = [
  { name: 'client JS total (_nuxt/**.js)', path: '.output/public/_nuxt/*.js', limit: '340 KB', gzip: true },
  { name: 'client CSS', path: '.output/public/_nuxt/*.css', limit: '8 KB', gzip: true },
]
```

### `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test'

const port = 3212
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL, trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    env: {
      PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production',
      NUXT_PUBLIC_SITE_URL: baseURL, NUXT_PUBLIC_I18N_BASE_URL: baseURL,
    },
  },
})
```

### `docker/Dockerfile`

```dockerfile
# ── build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
# Пресет фиксируем явно: он не должен зависеть от автодетекта окружения.
ENV NITRO_PRESET=node-server
ARG RENDER_MODE=swr
ENV RENDER_MODE=$RENDER_MODE
RUN pnpm build \
 # sharp трассируется под glibc и musl сразу — в alpine-образе нужен только musl.
 && rm -rf .output/server/node_modules/@img/sharp-libvips-linux-x64 \
           .output/server/node_modules/@img/sharp-linux-x64 \
 && find .output -name '*.map' -delete

# ── runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NITRO_SHUTDOWN_TIMEOUT=15000

COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", ".output/server/index.mjs"]
```

### `src/shared/seo/seo.ts` — абсолютный URL из runtime-конфига

```ts
import { useSiteConfig } from '#imports'

// Абсолютный URL читается из site-config на каждый рендер, а не из билд-константы.
export function absoluteUrl(path: string): string {
  const base = String(useSiteConfig().url ?? '').replace(/\/+$/, '')
  return path === '/' ? `${base}/` : `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(iso))
}
```

### `server/middleware/normalize-url.ts` — нормализация URL (её в Nuxt нет)

```ts
import { defineEventHandler, getRequestURL, sendRedirect } from 'h3'

// Внутренние префиксы Nuxt/модулей трогать нельзя: в /__nuxt_island/<PascalName>_<hash>.json
// регистр значим, и нормализация ломает острова.
const SKIP_PREFIX_RE = /^\/(?:__|_nuxt|_ipx|_og|_i18n|api|\.well-known)/

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (url.pathname === '/' || SKIP_PREFIX_RE.test(url.pathname)) return

  let pathname = url.pathname
  if (pathname.endsWith('/')) pathname = pathname.replace(/\/+$/, '')
  if (/[A-Z]/.test(pathname)) pathname = pathname.toLowerCase()

  if (pathname !== url.pathname) return sendRedirect(event, `${pathname}${url.search}`, 301)
})
```

### `server/middleware/robots-policy.ts`

```ts
import { defineEventHandler, setResponseHeader } from 'h3'

// Staging закрывается заголовком, а не только robots.txt — три контура канона SEO.
export default defineEventHandler((event) => {
  if (process.env.ROBOTS_POLICY === 'noindex') {
    setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
  }
})
```

> На практике **не нужен**: `@nuxtjs/robots` сам ставит `X-Robots-Tag: noindex, nofollow`
> на все динамические ответы, когда `indexable=false` (см. §4.6). Но он **не влияет
> на prerendered-файлы** — как и модульный.

### `server/api/contact.post.ts` — форма работает и без JS

```ts
import { createError, defineEventHandler, getRequestHeader, readBody, sendRedirect, setResponseHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody<ContactPayload>(event)
  // Нативная отправка формы (без JS) приходит как form-urlencoded — ей нужен 303, а не JSON.
  const isFormPost = (getRequestHeader(event, 'content-type') || '').includes('form-urlencoded')

  setResponseHeader(event, 'cache-control', 'no-store')

  // honeypot: заполненное скрытое поле — бот, отвечаем как будто всё хорошо
  if (body?.company) return isFormPost ? sendRedirect(event, '/contact?sent=1', 303) : { ok: true }

  if (!body?.name || !body?.email || !body?.message) {
    if (isFormPost) return sendRedirect(event, '/contact?error=1', 303)
    throw createError({ statusCode: 422, statusMessage: 'Missing fields' })
  }

  return isFormPost ? sendRedirect(event, '/contact?sent=1', 303) : { ok: true, received: { name: body.name } }
})
```

### `server/routes/rss.xml.ts` — фид (важно: без суффикса `.get`)

```ts
import { queryCollection } from '@nuxt/content/server'
import { defineEventHandler, setResponseHeader } from 'h3'
// nuxt typecheck резолвит #imports для server/** по APP-импортам — берём алиас модуля напрямую.
import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'

export default defineEventHandler(async (event) => {
  const site = getSiteConfig(event)
  const origin = String(site.url).replace(/\/+$/, '')
  const posts = await queryCollection(event, 'postsRu')
    .select('path', 'title', 'description', 'pubDate')
    .order('pubDate', 'DESC').limit(20).all()
  …
})
```

---

## 4. Дерево `src/`, `server/` и `.output/`

### `src/` (34 файла + 24 markdown)

```
src/app.vue                                  # NuxtLayout > NuxtPage, явные импорты из #components
src/error.vue                                # 404/5xx, useHead({ robots: noindex })
src/app/layouts/default.vue                  # useLocaleHead(...) → lang/dir/hreflang/og:locale
src/app/styles/index.css                     # Tailwind v4 @theme + @font-face + data-scheme
src/components/OgImage/Default.satori.vue    # ← навязано nuxt-og-image (вне FSD)
src/pages/index.vue                          # hero + 3 последних поста
src/pages/about.vue                          # статичная страница (noScripts)
src/pages/contact.vue                        # форма + ?sent=1
src/pages/now.vue                            # рендер на каждый запрос
src/pages/blog/index.vue                     # страница 1
src/pages/blog/page/[page].vue               # страницы 2..N
src/pages/blog/[slug].vue                    # пост: Article+BreadcrumbList, NuxtPicture, ContentRenderer
src/widgets/{hero,post-list,site-header,site-footer}/{index.ts,ui/*.vue}
src/features/contact-form/{index.ts,ui/contact-form.vue}
src/entities/post/index.ts
src/entities/post/api/queries.ts             # queryCollection-обёртки
src/entities/post/model/schema.ts            # Zod 4 фронтматтер + POSTS_PER_PAGE
src/entities/post/model/schema.test.ts
src/entities/post/ui/post-card.vue
src/entities/post/ui/post-card.test.ts
src/entities/post/content/{ru,en}/*.md       # 12+12 постов
src/shared/i18n/locales/{ru,en}.json         # ← restructureDir @nuxtjs/i18n
src/shared/lib/{cn.ts,index.ts}
src/shared/seo/{seo.ts,index.ts}
```

### `server/` (вне FSD-графа — норма, это Nitro-слой)

```
server/api/contact.post.ts
server/middleware/normalize-url.ts
server/middleware/robots-policy.ts
server/routes/healthz.ts
server/routes/rss.xml.ts
```

### `.output/` — режим `swr` (65 МБ)

```
.output/nitro.json
.output/public/              4,5 МБ
  _nuxt/                     3,3 МБ  (JS/CSS + .br + .gz, immutable)
  covers/  fonts/  _og-static-fonts/  __nuxt_content/{postsRu,postsEn}/sql_dump.txt
.output/server/              60 МБ
  index.mjs (693 Б)  package.json  chunks/ (1,7 МБ)
  node_modules/              59 МБ
    @img/ 37 МБ (sharp libvips glibc+musl)   ← в Dockerfile удаляем glibc-половину
    @resvg/ 8,4 МБ   @shikijs/ 2,0 МБ   ipx/ 1,5 МБ   zod/ 1,1 МБ
```

### `.output/` — режим `prerender` (68 МБ)

То же самое + `.output/public` разрастается до **7,9 МБ**: 199 HTML (+ `.br`/`.gz`),
`_payload.json` на каждый маршрут, `_ipx/**` (96 файлов), `_og/s/*.png` (26 файлов),
`sitemap_index.xml`, `__sitemap__/{ru-RU,en-US}.xml`, `old.html`.

### `nuxt generate` (для сравнения)

`.output/public` 8,0 МБ и **никакого `.output/server`**: чистый SSG под nginx.
Добавляются `200.html` и `404.html` (SPA-fallback для статик-хостов), `robots.txt`
становится файлом. 203 маршрута за 6,5 с, вся команда 14 с.

---

## 5. Единая таблица измерений (по `brief-v2.md`)

Две колонки — два профиля рендера одного и того же кода:
**A = prerender** (`routeRules.prerender` + `crawlLinks`), **B = swr** (`routeRules.swr: 600`).

| метрика | A · prerender | B · swr | как мерялось |
|---|---|---|---|
| время `build` | 20–36 с (ненагруженная машина), 83 с (4 агента параллельно); из них prerender 199 маршрутов 5,8–23,4 с | 17–20 с (ненагруженная), 74 с (нагруженная) | `time pnpm build` |
| время `nuxt generate` | 14 с (203 маршрута) | — | `time pnpm generate` |
| размер выхода сборки | `.output` **68 МБ** (public 7,9 МБ + server 61 МБ) | `.output` **65 МБ** (public 4,5 МБ + server 60 МБ) | `du -sh` |
| размер Docker-образа | — (не собирался) | **212 МБ** (`node:24-alpine` + слой `.output` 44,7 МБ); сборка 25 с | `docker images`, `docker history` |
| HTML `/` (raw / gzip-9 / по проводу) | 13 209 / 4 263 / **3 496 Б (br)** | 13 310 / 4 272 / 13 310 (без сжатия) | `curl --compressed`, `gzip -9c` |
| HTML `/about` (noScripts) | 3 916 / 1 582 / **1 174 Б (br)** | 3 987 / 1 589 / 3 987 | то же |
| HTML `/blog/<slug>` | 18 144 / 5 590 / **4 631 Б (br)** | 19 210 / 5 887 / 19 210 | то же |
| HTML `/contact` | 8 801 / 3 274 / 8 801 | 8 801 / 3 271 / 8 801 | (SSR — не сжимается) |
| HTML `/now` | 7 900 / 3 066 / 7 900 | 7 900 / 3 063 / 7 900 | то же |
| **JS по проводу `/`** | 134,3 КБ (18 файлов) | 137,9 КБ (21) | Playwright, `content-length` script-ресурсов, `waitUntil:'load'` |
| **JS по проводу `/about`** | **0 КБ (0 файлов)** — `noScripts` | **0 КБ** | то же |
| **JS по проводу `/blog/<slug>`** | 149,5 КБ (25) | 146,1 КБ (23) | то же |
| **JS по проводу `/contact`** | 102,1 КБ (13) | 103,5 КБ (13) | то же |
| JS после `networkidle` (с префетчем NuxtLink) | 137–154 КБ | 135–154 КБ | `waitUntil:'networkidle'` |
| JS без `noScripts` на статической странице | 102,2 КБ (14 файлов) | — | вариант до включения `noScripts` |
| CSS по проводу | 2,5 КБ (один `entry.css`, br) | 2,5 КБ | Playwright |
| Шрифты | 65,4 КБ (2 × woff2 subset: latin + cyrillic) | 65,4 КБ | Playwright |
| `size-limit` на `_nuxt/*.js` | 315,7 КБ gzip (весь граф всех маршрутов) | 315,7 КБ gzip | `pnpm size` |
| `size-limit` на CSS | 3,02 КБ gzip | 3,02 КБ gzip | `pnpm size` |
| обложка: форматы и `srcset` | `<picture>` → `source type=image/avif`, `source type=image/webp`, `<img src=…f_png…>`; `srcset` 1w + 768w, `sizes="(max-width: 767px) 100vw, 768px"` | то же | `curl \| grep` |
| размер обложки 768×432 | AVIF **3 196 Б** · WebP **4 780 Б** · PNG 36 291 Б | то же | `curl -w '%{size_download}'` |
| TTFB медиана 20 · `/` | **1,87 мс** | 6,35 мс (тёплый кеш, нагруженная машина) / 1,7 мс (ненагруженная) | `curl -w '%{time_starttransfer}'` |
| TTFB `/about` | **1,73 мс** | 3,62 мс | то же |
| TTFB `/blog/<slug>` | **1,95 мс** | 3,70 мс (тёплый); **10,7–11,1 мс холодный** | то же |
| TTFB `/now` | 7,44 мс | 20,5 мс (нагруженная) / 4,6 мс (ненагруженная) | то же |
| TTFB `/healthz` | 2,19 мс | 3,14 мс | то же |
| TTFB в контейнере | — | `/` 2,87 мс · `/about` 2,30 · пост 2,60 · `/now` 6,67 · `/healthz` 1,99 | через `-p 127.0.0.1:3202:3000` |
| RSS процесса idle | 95,0 МБ | 95,0–99,4 МБ | `ps -o rss=` |
| RSS после 200 параллельных | 167,4 МБ | 183,8 МБ | `seq 200 \| xargs -P 200` |
| RSS после одной страницы поста | — | 159,5 МБ | `ps -o rss=` |
| RSS после генерации одной OG-картинки | — | **251,8 МБ** (+92 МБ: satori+resvg+шрифты) | `ps -o rss=` |
| RSS в контейнере (cgroup) | — | idle **39,5 МиБ**, после 200 параллельных **111,8 МиБ** | `docker stats --no-stream` |
| `/old` | **301** → `/` | 301 → `/` | `curl -o /dev/null -w '%{http_code}'` |
| `/blog/net-takogo` | **404** | 404 | то же |
| `/xx/` | 301 → `/xx`, затем **404** | 301 → `/xx` → 404 | то же |
| `/about/` (хвостовой слэш) | **200 — дубль** (статика отвечает раньше middleware) | **301 → `/about`** | то же |
| `/healthz`, `/robots.txt`, `/sitemap_index.xml`, `/rss.xml` | 200 | 200 | то же |
| prerender-страницы отдаются самим Node-процессом? | **да**: два запроса `/about` дают идентичные тела, `ETag` + `Last-Modified`; `/now` — разные | n/a (всё SSR + кеш) | `cmp` двух тел, `curl -I` |
| `Cache-Control` на HTML | prerendered — **нет** (только ETag/Last-Modified); `/now` — `no-cache` | `s-maxage=600, stale-while-revalidate` + weak ETag → 304 | `curl -I` |
| `Cache-Control` на `/_nuxt/*` | `public, max-age=31536000, immutable` + `X-Robots-Tag: noindex` | то же | `curl -I` |
| `Cache-Control` на `/fonts/**`, `/covers/**` | заданы routeRules (`immutable` / `max-age=604800`) | то же | `curl -I` |
| `Cache-Control` на `/_ipx/**` | по умолчанию `max-age=60` (!); лечится `image.ipx.fs.maxAge` → `max-age=31536000` | то же | `curl -I` |
| `Cache-Control` на `/_og/**` | `public, max-age=259200, s-maxage=259200, immutable` (собственный, routeRules не перебивают) | то же | `curl -I` |
| сжатие | статика/prerendered — предсжаты `.br` + `.gz` (`compressPublicAssets`), файлы < 1 КБ не жмутся; **динамические ответы не сжимаются вовсе** | **всё динамическое — без сжатия** | `curl -H 'Accept-Encoding: br' -I` |
| ETag / 304 | есть на статике; на swr weak-ETag → **304** | есть | `If-None-Match` |
| контент до гидрации для `User-Agent: Googlebot` | `/`: 1×`<h1>`, canonical, 1 JSON-LD, 6 hreflang, og:image, 126 слов. `/blog/<slug>`: 1×`<h1>`, canonical, JSON-LD, 6 hreflang, og:image, **370 слов** | то же | `curl -A Googlebot` |
| hreflang / canonical / OG / JSON-LD в сыром HTML | все присутствуют | все присутствуют | `curl \| grep -a` |
| время старта dev | Nitro-сервер собран за 7,6 с; первый 200 через **1,9 с** после готовности | — | `nuxt dev`, `curl` |
| HMR контента (`.md`) | **~1 с** | — | `sed` по `.md` + polling |
| HMR компонента (`.vue`) | **~1 с** | — | `sed` по `.vue` + polling |
| `--host` | dev слушает **только `[::1]:3202`** (IPv6 localhost); для LAN/контейнера нужен `--host` | — | `ss -ltnp` |
| `pnpm check` целиком | — | **28–31 с**, exit 0 (typecheck+lint+format+test+steiger+build+size) | `time pnpm check` |
| `pnpm test:e2e` | — | 8 тестов, 2,1–7,1 с, exit 0 | `pnpm test:e2e` |

---

## 6. Таблица проверок

| # | что проверяли | статус | команда / факт |
|---|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | ✅ | 3,6 с, lock совместим |
| 2 | `nuxt build` (prerender) | ✅ | 199 маршрутов |
| 3 | `nuxt build` (swr) | ✅ | 2 маршрута (только `sql_dump.txt`) |
| 4 | `nuxt generate` | ✅ | только `.output/public`, +`200.html`/`404.html` |
| 5 | Node-процесс отдаёт prerendered HTML | ✅ | тела идентичны, `ETag`, TTFB 1,7 мс |
| 6 | `swr` кеш в памяти процесса | ✅ | холодно 10,7 мс → тепло 1,4 мс |
| 7 | `swr` single-flight на 200 параллельных | ✅ | **1 рендер** (инструментовка render-id) |
| 8 | `X-Cache` / `cacheStatusHeader` | ❌ | в Nitro 2.13.4 отсутствует (есть только в Nitro 3) |
| 9 | API инвалидации кеша | ❌ | нет; писать самим через `useStorage('cache')`, группа `nitro/routes` |
| 10 | Кеш переживает рестарт | ❌ | по умолчанию in-memory (`createStorage({})`) |
| 11 | graceful shutdown | ✅ | `NITRO_SHUTDOWN_TIMEOUT` (мс, дефолт 30000), in-flight дожимается, `docker stop` → exit 0 |
| 12 | keep-alive | ⚠️ | `Keep-Alive: timeout=5` (дефолт Node), env-ручки нет |
| 13 | runtime `SITE_URL` в SSR/swr | ✅ | `NUXT_PUBLIC_SITE_URL` + `NUXT_PUBLIC_I18N_BASE_URL` |
| 14 | runtime `SITE_URL` в prerendered HTML | ❌ | запечён на билде |
| 15 | runtime `SITE_URL` в `/robots.txt` | ✅ | всегда динамический |
| 16 | runtime `SITE_URL` в `/sitemap*.xml` | ⚠️ | **да в swr, нет в prerender** (файл запечён; удаление файла → 500) |
| 17 | runtime `SITE_URL` в `/rss.xml` | ✅ | серверный route |
| 18 | runtime `SITE_URL` в OG-картинке | ✅ | `og:image` абсолютный из site-config |
| 19 | `@nuxtjs/sitemap`: i18n | ✅ | `autoI18n: true` → `sitemap_index.xml` + `__sitemap__/{ru-RU,en-US}.xml` + XSL |
| 20 | `@nuxtjs/sitemap`: коллекции контента | ⚠️ | **не автоматически**: нужен `defineSitemapSchema()` в схеме коллекции |
| 21 | `lastmod` из фронтматтера | ✅ | через `onUrl` в `defineSitemapSchema` |
| 22 | шардирование sitemap | ✅ (по локалям) | ⏭ по 50k URL — не проверялось |
| 23 | `@nuxtjs/robots`: `X-Robots-Tag` + `Disallow: /` | ✅ | `NUXT_PUBLIC_SITE_INDEXABLE=false` или `NUXT_SITE_ENV=staging` |
| 24 | `X-Robots-Tag` на prerendered HTML | ❌ | статика идёт мимо middleware |
| 25 | robots не закрывает `/_nuxt` | ✅ | вместо этого `X-Robots-Tag: noindex` на ассетах |
| 26 | `nuxt-schema-org` | ✅ | `WebSite`+`Organization`+`WebPage`+`Article`+`BreadcrumbList`+`ImageObject` в одном `@graph` |
| 27 | `nuxt-og-image` (satori+resvg) | ✅ | 198 мс холодно / 4,3 мс из кеша, 35,8 КБ PNG |
| 28 | og-image: community-шаблоны в проде | ❌ | требует eject или свой `components/OgImage/*.satori.vue` |
| 29 | og-image тянет `playwright-core` (6,3 МБ) | ⚠️→✅ | лечится `ogImage.compatibility.*.browser = false` |
| 30 | `nuxt-seo-utils` (titleTemplate, авто-OG/Twitter) | ✅ | `<title>О проекте \| stit demo</title>`, авто `og:*`/`twitter:*` |
| 31 | `nuxt-link-checker` | ⏭ | выключен (dev-инструмент) |
| 32 | Nuxt Content v3 + Zod 4 | ✅ | `postFrontmatterSchema` (Zod 4.6.5) работает как схема коллекции |
| 33 | `cwd` коллекции в FSD-слайсе | ✅ | `src/entities/post/content/{ru,en}` |
| 34 | `queryCollection` в SSR/prerender | ✅ | app-composable; на сервере — `@nuxt/content/server` |
| 35 | `better-sqlite3` на alpine | ❌ | `node-gyp` падает при `pnpm install` в `node:24-alpine` |
| 36 | `sqliteConnector: 'native'` (node:sqlite) | ✅ | работает; −17 МБ из `.output`, образ собирается |
| 37 | клиентский WASM-SQLite в бандле | ⚠️ | 864 КБ `.wasm` + 210 КБ воркер **собираются**, но на наших страницах не грузятся |
| 38 | `@nuxt/image` + `sharp` на alpine | ✅ | musl-бинарь трассируется; glibc-половину удаляем в Dockerfile |
| 39 | IPX on-demand | ✅ | AVIF 3,2 КБ / WebP 4,8 КБ на 768×432 |
| 40 | IPX при prerender | ✅ (после фикса `image.dir`) | 96 файлов в `.output/public/_ipx` |
| 41 | `<NuxtPicture>` srcset/AVIF/WebP | ✅ | 3 формата, фолбэк `<img src>` (канон P-10) |
| 42 | i18n `prefix_except_default` | ✅ | `/about` + `/en/about` |
| 43 | `useLocaleHead` → hreflang + x-default + og:locale | ✅ | `ru`, `ru-RU`, `en`, `en-US`, `x-default` |
| 44 | абсолютный canonical без `i18n.baseUrl` | ❌ | относительный + WARN «I18n baseUrl is required» |
| 45 | `<html lang>` | ✅ | `<html dir="ltr" lang="ru-RU">` |
| 46 | `detectBrowserLanguage: false` | ✅ | авторедиректа нет |
| 47 | `/xx/` → 404 | ✅ | 301 на `/xx`, затем 404 |
| 48 | FSD через `srcDir` + `dir.*` | ✅ | все 6 слоёв на месте |
| 49 | `imports.autoImport: false` | ✅ | всё через `#imports`, `#components`, `#i18n` |
| 50 | Steiger видит `.vue` `<script setup>` | ✅ | ловит forbidden-imports, cross-import, sidestep |
| 51 | Biome на `.vue` | ✅ | с `html.experimentalFullSupportEnabled: true` — формат + линт |
| 52 | ESLint 10 + `@nuxt/eslint` | ✅ | vue+ts правила из `.nuxt/eslint.config.mjs` |
| 53 | `boundaries` на `.vue` | ✅ | **только с `import/resolver: typescript`** |
| 54 | `nuxt typecheck` (vue-tsc) | ✅ | 17–19 с, ловит ошибки в `nuxt.config.ts` |
| 55 | Vitest 5 + `@nuxt/test-utils` (`environment: 'nuxt'`) | ✅ | 5 тестов, 1,9 с |
| 56 | `mountSuspended` | ❌ | падает: `[unimport] failed to find "defineOgImageComponent"` при `imports.autoImport: false` |
| 57 | `mount` из `@vue/test-utils` в nuxt-env | ✅ | работает, не поднимает приложение |
| 58 | Playwright smoke + бюджеты JS | ✅ | 8 тестов |
| 59 | `size-limit` | ⚠️ | работает, но только «весь граф»: у Nuxt нет стабильных имён чанков |
| 60 | `pnpm check` | ✅ | 28 с, exit 0 |
| 61 | `noScripts` → 0 JS | ✅ | 0 запросов script в браузере |
| 62 | острова `.server.vue` как «0 JS» | ❌ | экономят ~3 КБ JS, но добавляют ~18 КБ JSON; см. §7.4 |
| 63 | форма без JS (native POST) | ✅ | 303 → `/contact?sent=1`; honeypot; 303 → `?error=1` |
| 64 | `createError({ statusCode: 404 })` | ✅ | реальный HTTP 404 |
| 65 | `error.vue` с noindex | ✅ | `<meta name="robots" content="noindex, nofollow">` |
| 66 | Docker-образ | ✅ | 212 МБ, healthcheck healthy |
| 67 | один образ на все среды | ✅ (в swr) | `-e NUXT_PUBLIC_SITE_URL=https://demo.example.com` меняет всё |

---

## 7. Подводные камни

### 7.1 `image.dir` резолвится относительно `srcDir` — prerender изображений молча ломается

При `srcDir: 'src'` и `public/` в корне prerender выдаёт сотни строк
`[404] IPX_FILE_NOT_FOUND` (в моём прогоне — 96 штук), а `failOnError: false` их глотает.

Причина (чтение `@nuxt/image@2.1.0/dist/module.js`):

```js
options.dir = resolve(nuxt.options.rootDir, options.dir)         // строка 264 — не используется дальше
…
const path = layer?.config.image && layer.config.image.dir || layer.config.dir?.public || 'public'
publicDirs.add(resolve(srcDir, path))                             // строка 269–270 — вот это используется
options.dirs = [...publicDirs].filter((dir) => existsSync(dir))   // пусто → IPX не находит файлы
```

В рантайме всё работает (`fs.dir = relative(serverDir, publicDir)` = `../public`), ломается
только prerender. **Фикс: `image: { dir: '../public' }`.**

### 7.2 `i18n.baseUrl` убивает runtime-подмену `SITE_URL` (и это не задокументировано)

`nuxt-site-config` собирает стек источников; разрешение — `stack.sort((a,b) => (a._priority||0) - (b._priority||0))`
и «последний при равном приоритете побеждает» (код в `.output/server/chunks/nitro/nitro.mjs`,
функция `createSiteConfigStack`). В стеке на билде оказываются:

```
{_context:'system',_priority:-15}
{_context:'nuxt-site-config:config',_priority:-3, url:<site.url>}
{_context:'buildEnv',_priority:-1, url:<NUXT_PUBLIC_SITE_URL на билде>}
{_context:'@nuxtjs/i18n', url:<i18n.baseUrl>}      ← _priority отсутствует ⇒ 0
```

а runtime-источник пушится **раньше** с `_priority: 0`:

```js
siteConfig.push({ _context: 'runtimeEnv', _priority: SiteConfigPriority.runtime /* 0 */,
  ...runtimeConfig.site, ...runtimeConfig.public.site, ...serverEnvSiteConfig })
```

Итог: запись `@nuxtjs/i18n` (равный приоритет, пушится позже) **перебивает** runtime-env.
Эмпирика: с `i18n.baseUrl` заданным `NUXT_PUBLIC_SITE_URL=https://prod.example.com` на рантайме
**не влияет ни на что** — ни на `/robots.txt`, ни на SSR-canonical.

Но `push()` выбрасывает пустые строки (`if (typeof val !== "undefined" && val !== "")`),
поэтому **если `i18n.baseUrl` не задан, запись i18n не несёт `url`** и runtime-env побеждает.

**Рецепт для шаблона — две переменные окружения, а не одна:**

| env | что меняет |
|---|---|
| `NUXT_PUBLIC_SITE_URL` | site-config: `og:url`, `og:image`, JSON-LD, `robots.txt`, `sitemap`, RSS, `absoluteUrl()` |
| `NUXT_PUBLIC_I18N_BASE_URL` | `runtimeConfig.public.i18n.baseUrl` → `useLocaleHead()`: canonical + hreflang |

Проверено: `NUXT_PUBLIC_I18N_BASE_URL=https://run.example.test` на рантайме даёт
`<link rel="canonical" href="https://run.example.test/now">` и абсолютные hreflang.

Источники механики env: `envSiteConfig()` разбирает префиксы `NUXT_SITE_` и `NUXT_PUBLIC_SITE_`
(`NUXT_PUBLIC_SITE_INDEXABLE` → `indexable`, `NUXT_SITE_NAME` → `name` и т.д.) —
**проверено чтением собранного `nitro.mjs`** и подтверждено докой
https://nuxtseo.com/docs/site-config/guides/setting-site-config (`NUXT_SITE_URL`,
`NUXT_SITE_NAME`, `NUXT_SITE_ENV`).

### 7.3 Prerendered sitemap нельзя «разстатичить»

Как только включается prerender с `crawlLinks`, `@nuxtjs/sitemap` запекает `sitemap_index.xml`
и `__sitemap__/*.xml` (код модуля: `shouldHookIntoPrerender = prerenderSitemap ||
nitro.prerender.routes.length && nitro.prerender.crawlLinks`) — и **не регистрирует** серверные
хендлеры. Попытка удалить файлы из `.output/public` даёт **500 ENOENT**, а не fallback:
карта статики зафиксирована на билде.

То есть в prerender-режиме `sitemap.xml` навсегда содержит build-time origin.
Варианты: (а) не пререндерить (режим `swr`), (б) штамповать плейсхолдер в entrypoint
(паттерн «C» из `14-content-architecture.md` §2.2.3).

### 7.4 Острова (`.server.vue`) — не путь к «0 JS», и они ломаются о нормализацию URL

Эксперимент: вынес рендер тела поста в `entities/post/ui/post-body.server.vue`
(остров), зарегистрировав `src/entities/post/ui` как `components.dirs`.

1. Первая версия передавала весь объект поста пропсом → **остров отрендерился пустым `<div>`**.
   Причина в коде `nuxt-island.js`: пропсы уезжают в **query-string** запроса
   `/__nuxt_island/<Name>_<hash>.json?props=<JSON>`; большой AST туда не лезет.
2. Вторая версия (остров сам делает `queryCollection` по `path`) тоже отрендерилась пустой —
   пока не выяснилось, что мой `normalize-url` middleware **лоукейсил**
   `/__nuxt_island/PostBody_…json` → 301, а внутренний `eventFetch` редирект не следует.
   После добавления `^\/__` в skip-regex остров заработал.
3. Итог измерений на `/blog/ssr-bez-cdn`: JS 149,5 КБ → **146,1 КБ** (−3,4 КБ),
   но JSON 2,1 КБ → **25,0 КБ** (payload острова дублируется). **Суммарно хуже.**

Вывод: в Nuxt «острова» — это механизм server-only компонентов, а не partial hydration.
Реальный рычаг «ноль JS» — `routeRules.noScripts`, и он **на весь маршрут** («всё или ничего»).
Страница с `noScripts` теряет клиентскую навигацию (каждый переход — полная загрузка),
что для контентного сайта скорее плюс.

Документация Nuxt по `noScripts`: *«Disables rendering of Nuxt scripts and JS resource hints
for sections of your site»* — https://nuxt.com/docs/4.x/guide/concepts/rendering (проверено 2026-09-16).

### 7.5 Хвостовой слэш: нормализовать можно только там, где нет статики

- В `swr`-режиме `server/middleware/normalize-url.ts` даёт **301** для `/about/`, `/blog/`,
  `/blog/<slug>/`, `/en/about/` — канон I-5/I-6 выполнен.
- В prerender-режиме статический хендлер Nitro отвечает **раньше** middleware:
  `/about/` → `about/index.html` → **200, дубль**.
- Попытка лечить через `nitro.prerender.autoSubfolderIndex: false` (файл `about.html`
  вместо `about/index.html`) **делает prerender мёртвым весом**: `/about.html` отдаётся
  статикой (ETag), а `/about` рендерится на каждый запрос (проверено: тела различаются,
  TTFB 21 мс против 1,7 мс).

Встроенной серверной нормализации в Nuxt нет вовсе: `trailingSlash` в схеме — это
**только опция `NuxtLink`** (`experimental.defaults.nuxtLink.trailingSlash`: *«An option to
either add or remove trailing slashes in the `href`»*), не редирект.

**Вывод для шаблона:** либо режим `swr` (тогда middleware работает), либо нормализация
хвостового слэша на Traefik (`redirectRegex`), а в приложении оставить только регистр.

### 7.6 `nuxt-og-image` 6.8: community-шаблоны запрещены в проде + тянет playwright

1. `defineOgImageComponent('NuxtSeo')` в prod падает:
   `Community template "NuxtSeoSatori" must be ejected before production use.
   Run: npx nuxt-og-image eject NuxtSeoSatori. No app components found — create one in components/OgImage/`
   (код: `dist/runtime/server/util/options.js:107–120`). Лечится своим
   `src/components/OgImage/Default.satori.vue` — **каталог жёстко `<srcDir>/components/OgImage/`**
   (модуль сканирует `join(layer.cwd,'components')` и `join(srcDir,'components')` по
   `config.componentDirs = ['OgImage','OgImageCommunity','og-image','OgImageTemplate']`).
2. Рендереры больше не встроены: без `satori` и `@resvg/resvg-js` в зависимостях билд падает
   с `[nuxt-og-image] satori renderer missing dependencies`.
3. Если в devDependencies есть `@playwright/test` (а у нас гейт на Playwright),
   модуль автоматически включает browser-рендерер и **трассирует `playwright-core` (6,3 МБ)
   в `.output/server/node_modules`**. Лечится:

```ts
ogImage: { compatibility: { dev: { browser: false }, runtime: { browser: false }, prerender: { browser: false } } }
```

4. `ogImage.defaults.component` **запрещён типами** (`Omit<OgImageOptions, 'component' | …>`)
   — шаблон выбирается только вызовом `defineOgImageComponent()` на странице.
5. Цена в RSS: первая генерация картинки поднимает процесс с ~160 МБ до ~252 МБ
   (satori + resvg + шрифты), дальше из кеша 4,3 мс.

### 7.7 `better-sqlite3` не ставится в `node:24-alpine`

`pnpm install --frozen-lockfile` в `node:24-alpine` падает на `node-gyp rebuild`
(нет musl-prebuild под Node 24, нет python/make/g++). Дока Nuxt Content подтверждает,
что `better-sqlite3` — «Works in all Node environments», но про musl молчит
(https://content.nuxt.com/docs/getting-started/configuration, проверено 2026-09-16).

Решение — `content: { experimental: { sqliteConnector: 'native' } }` (node:sqlite, Node ≥ 22.5)
**и убрать `better-sqlite3` из зависимостей вовсе**. Профит: `.output` 81 → 65 МБ,
образ собирается без build-deps.

### 7.8 `@nuxtjs/sitemap` не видит коллекции Nuxt Content сам

Без prerender карта содержала только 4 статических маршрута (`/`, `/about`, `/blog`, `/now`).
Модуль логирует `No dynamic sources detected`. Интеграция включается полем в схеме коллекции:

```ts
schema: postFrontmatterSchema.extend({
  sitemap: defineSitemapSchema({ z, name: 'postsRu',
    onUrl: (url, item) => { url.lastmod = item.updatedDate } }),
})
```

После этого — 15 URL на локаль (12 постов + 3 статических) с `<lastmod>`; появляется
служебный эндпоинт `/__sitemap__/nuxt-content-urls.json`.
**Остаётся дырка**: динамические маршруты пагинации `/blog/page/2..3` в карту не попадают
(их не видит ни один источник) — их надо добавлять `sitemap.urls` вручную.

Дополнительно: модуль предупреждает `You have loaded @nuxt/content before @nuxtjs/sitemap,
this may cause issues with the integration` — порядок в `modules` значим.

### 7.9 Nitro 2.13.4 ≠ документация на nitro.build

`https://nitro.build/docs/cache` описывает `cacheStatusHeader` (`X-Cache: HIT|STALE|
REVALIDATED|MISS`), `sendCacheControl`, `allowQuery`, `allowCookies`. **В собранном
`nitro.mjs` (Nitro 2.13.4) этих идентификаторов нет вообще** — есть только
`shouldBypassCache`, `shouldInvalidateCache`, `staleMaxAge`, `varies`, `group`, `integrity`.
Заголовки синтезируются так (код из `.output/server/chunks/nitro/nitro.mjs`):

```js
if (opts.swr) {
  if (opts.maxAge) cacheControl.push(`s-maxage=${opts.maxAge}`)
  if (opts.staleMaxAge) cacheControl.push(`stale-while-revalidate=${opts.staleMaxAge}`)
  else cacheControl.push('stale-while-revalidate')
} else if (opts.maxAge) cacheControl.push(`max-age=${opts.maxAge}`)
```

Это **правка к `04-runtime-deploy.md` §2.7**: там факты про `X-Cache`/`sendCacheControl`
процитированы с nitro.build как применимые к нашему стеку — для Nuxt 4.5 они неверны.

Кеш маршрутов живёт в группе `nitro/routes` на storage `cache:`; в собранном бандле
`createStorage({})` монтирует только `/assets` и `data` — **кеш в памяти, рестарт его чистит**.
Встроенного API инвалидации нет: нужен свой server-route поверх `useStorage('cache')`.

### 7.10 `nuxt typecheck` резолвит `#imports` для `server/**` по APP-импортам

`.nuxt/tsconfig.server.json` корректно маппит `#imports` → `./types/nitro-imports`
(там есть `getSiteConfig`), но `nuxt typecheck` всё равно падает:

```
server/routes/rss.xml.ts(3,10): error TS2724: '"#imports"' has no exported member named 'getSiteConfig'. Did you mean 'useSiteConfig'?
```

Обход — импорт по алиасу модуля: `import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'`.

### 7.11 Имя файла server-route: `.get` ломает HEAD

`server/routes/rss.xml.get.ts` → `GET /rss.xml` = 200, **`HEAD /rss.xml` = 404**.
Без суффикса (`rss.xml.ts`) HEAD работает. Для SEO-эндпоинтов суффикс метода не ставить.

### 7.12 `mountSuspended` из `@nuxt/test-utils` несовместим с `imports.autoImport: false`

```
Error: [unimport] failed to find "defineOgImageComponent" imported from "#imports"
  Plugin: nuxt:imports-transform
  File: src/pages/index.vue
```

`mountSuspended` поднимает приложение целиком, а значит трансформирует все страницы;
в тестовом билде реестр unimport не содержит композаблов, добавленных модулями.
Рабочий вариант — обычный `mount()` из `@vue/test-utils` внутри `environment: 'nuxt'`
(резолвит `#components`, `@/…`, но не грузит `src/pages/**`).

### 7.13 `eslint-plugin-boundaries` без резолвера — тихий no-op

С `settings['boundaries/elements']`, но без `settings['import/resolver']`, правило
`boundaries/dependencies` (и legacy `element-types`) **не сработало ни на одном** из
четырёх умышленно нарушающих фикстур — ни на `.ts`, ни на `.vue`. После добавления

```js
'import/resolver': { typescript: { alwaysTryTypes: true, project: ['./.nuxt/tsconfig.app.json'] } }
```

ловятся все четыре: алиасный и относительный импорт вверх по слоям, cross-slice в одном слое,
и то же самое в `<script setup>`.

> Это же, судя по `eslint.config.js` SPA-шаблона (там нет `import/resolver`, а импорты
> идут через `@/…`), означает, что `boundaries/element-types` в SPA-шаблоне сейчас
> **ничего не проверяет**. Стоит проверить отдельно (не входило в задачу этого потока).

### 7.14 Прочие мелочи

- `nuxt dev` слушает **только `[::1]`** — `curl http://127.0.0.1:3202` даёт connection refused.
  Тот же дефект зафиксирован у TanStack Start (`06-spike.md` §7.14).
- Динамические ответы Nitro **не сжимаются**: `compressPublicAssets` относится только к
  `.output/public`. Всё, что SSR/swr, обязан жать Traefik.
- `X-Robots-Tag` от `@nuxtjs/robots` приезжает и на `/healthz` — безвредно, но шум.
- `sitemap.exclude` не выкидывает `/now` сам по себе: нужен либо `exclude`, либо
  `routeRules: { '/now': { robots: false } }` (последнее заодно даёт `X-Robots-Tag: noindex`).
- Клиентский бандл всегда содержит `sqlite3.wasm` (864 КБ) + `sqlite3-worker1` (210 КБ) +
  `sqlite3-opfs-async-proxy` (32 КБ) от Nuxt Content — на наших страницах они **не грузятся**,
  но лежат в `.output/public/_nuxt` и попадают в `size-limit`. Отключается `content.experimental`-ручкой
  только частично — проверить `sitemap.zeroRuntime`/`content` в реальном шаблоне.
- Nuxt 4.5 пишет buildDir в `node_modules/.cache/nuxt/.nuxt` при `nuxt build`, но `.nuxt/`
  при `nuxt prepare`/`dev`. `eslint.config.mjs` импортирует `./.nuxt/eslint.config.mjs` —
  значит `pnpm lint` требует предварительного `nuxt prepare` (в `pnpm check` он идёт после
  `typecheck`, который его делает сам).
- `i18n.lazy` и `i18n.bundle.optimizeTranslationDirective` удалены в `@nuxtjs/i18n` 10 —
  ловится `nuxt typecheck`.
- `image.formats` → **`image.format`** (тоже ловится typecheck'ом).

---

## 8. Развилка «prerender ⊥ runtime SITE_URL»: цифры и вердикт

Проверено буквально: собрано с `NUXT_PUBLIC_SITE_URL=https://build.example.test`,
запущено с `NUXT_PUBLIC_SITE_URL=https://run.example.test` (+ `NUXT_PUBLIC_I18N_BASE_URL`).

| артефакт | A · prerender | B · swr |
|---|---|---|
| canonical / hreflang на `/about` | `https://build.example.test/...` (запечён) | **`https://run.example.test/...`** |
| `og:url`, `og:image` | запечён | **runtime** |
| JSON-LD `@id`/`url` | запечён | **runtime** |
| `/robots.txt` | **runtime** (всегда динамический) | **runtime** |
| `/sitemap_index.xml`, `/__sitemap__/*.xml` | запечён, «разстатичить» нельзя | **runtime** |
| `/rss.xml` | **runtime** | **runtime** |
| `/now` (SSR) | **runtime** | **runtime** |

Цена перехода A → B (одинаковый код, один флаг `RENDER_MODE`):

| | A · prerender | B · swr | дельта |
|---|---|---|---|
| TTFB `/` | 1,87 мс | 6,35 мс (нагруж.) / ~1,7–2,0 мс (ненагруж.) | +0…4 мс |
| TTFB поста (тёплый кеш) | 1,95 мс | 3,70 мс | +1,8 мс |
| TTFB поста (холодный кеш) | 1,95 мс | **10,7 мс** | +8,8 мс, один раз на URL |
| HTML по проводу `/` | 3 496 Б (br с диска) | 13 310 Б (несжато) | жмёт Traefik |
| RSS idle | 95,0 МБ | 95,0–99,4 МБ | ≈0 |
| RSS после 200 параллельных | 167,4 МБ | 183,8 МБ | +16 МБ |
| `.output` | 68 МБ | 65 МБ | −3 МБ |
| время билда | 20–36 с | 17–20 с | −3…16 с |
| `/about/` (хвостовой слэш) | 200 дубль ❌ | 301 ✅ | + |
| «один образ на все среды» | ❌ | ✅ | + |

### Вердикт и рекомендованная комбинация для шаблона

**Дефолт: `swr` на все индексируемые маршруты, prerender — не использовать.**
Это ровно вариант «D» из `14-content-architecture.md` §2.2.3, и Nuxt его поддерживает
лучше всех рассмотренных: кеш встроен, single-flight встроен, инвалидация по TTL,
SITE_URL живой, хвостовой слэш чинится, sitemap/robots/rss динамические.

Конкретно:

```ts
routeRules: {
  // индексируемое — swr + отключённые скрипты там, где нет интерактива
  '/':            { swr: 600 },
  '/about':       { swr: 600, noScripts: true },
  '/blog':        { swr: 600 },
  '/blog/page/**':{ swr: 600 },
  '/blog/**':     { swr: 600, noScripts: true },   // пост без интерактива → 0 КБ JS
  '/en/**':       { swr: 600 },
  // интерактив и «живое» — без кеша
  '/contact':     { swr: false, robots: false },
  '/now':         { swr: false, robots: false, headers: { 'cache-control': 'no-cache' } },
}
```

Prerender оставить как **опциональный профиль** для проектов с одной средой
(`docs/stack/rendering.md` фиксирует отказ) — он даёт −2…9 мс TTFB и br-предсжатие HTML,
ценой запечённых абсолютных URL и 200-дубля на хвостовом слэше.

Отдельная рекомендация по бюджету JS: **`noScripts: true` на всех маршрутах, где нет
интерактивного острова**. На нашем эталоне это `/`, `/about`, `/blog`, `/blog/**`, `/en/**`
— то есть весь индексируемый контур. JS остаётся только на `/contact`. Проверяется
e2e-тестом с бюджетом 1 КБ.

---

## 9. Что Nuxt закрывает из MUST канона `02-seo-canon.md` §3.2

| # | требование | статус в Nuxt | чем |
|---|---|---|---|
| I-1 | полный контент в первом HTML | ✅ из коробки | SSR/prerender; `experimental.ssrStreaming` по умолчанию **false** |
| I-2 | `ssr: false` только на неиндексируемых | ✅ | `routeRules.ssr` |
| I-4 | 404/410 | ✅ | `createError({ statusCode })` → реальный код |
| I-5 | нормализация одним редиректом | ❌ **писать самим** | server middleware (и только в swr-режиме) |
| I-6 | `trailingSlash: never` | ❌ нет такой настройки | только `NuxtLink`-уровень |
| I-7 | абсолютный self-canonical | ✅ | `useLocaleHead` + `NUXT_PUBLIC_I18N_BASE_URL` |
| I-9/I-10 | `robots.txt` из runtime + `Sitemap:` | ✅ | `@nuxtjs/robots` |
| I-11 | `sitemap.xml` только 200-URL, свой origin | ✅ (с оговоркой 7.8) | `@nuxtjs/sitemap` |
| I-12 | `lastmod` только реальный | ✅ | `defineSitemapSchema({ onUrl })` |
| I-13 | без `changefreq`/`priority` | ✅ | по умолчанию не выводятся |
| I-14 | приватные роуты noindex + no-store | ✅ | `routeRules: { robots: false, headers }` |
| I-15 | staging: 3 контура | ⚠️ 2 из 3 | `NUXT_PUBLIC_SITE_INDEXABLE=false`/`NUXT_SITE_ENV=staging` → `Disallow: /` + `X-Robots-Tag` + `<meta robots>`; **но не на prerendered-файлах**; basic-auth — на Traefik |
| I-16 | не закрывать ассеты в robots | ✅ | вместо этого `X-Robots-Tag: noindex` на `/_nuxt/*` |
| I-18 | пагинация с self-canonical | ⚠️ | страницы есть, canonical пишется руками |
| I-24 | бюджет HTML ≤ 300 КБ | ✅ с запасом | максимум 19,2 КБ |
| M-1/M-2 | уникальные title/description | ✅ | `useSeoMeta` + titleTemplate из site-config |
| M-3/M-4/M-5 | полный OG + twitter + абсолютный og:image | ✅ | `nuxt-seo-utils` (`automaticOgAndTwitterTags`) |
| M-6 | генерация OG на сервере с кешем | ✅ | `nuxt-og-image` (satori/resvg, дисковый кеш) |
| M-7 | `<html lang>` | ✅ | `useLocaleHead({ lang: true })` |
| M-9 | verification-метки из runtime | ⏭ не проверял | `site` config |
| M-10 | без `keywords` | ✅ | не генерируется |
| S-1 | `Organization` + `WebSite` на главной | ✅ | `schemaOrg.identity` |
| S-2 | `BreadcrumbList` | ✅ | `defineBreadcrumb` |
| S-3 | JSON-LD типизирован и валидируется | ⚠️ | типы есть, Zod-тест писать самим |
| S-5 | JSON-LD рендерится сервером | ✅ | (в `<body>`, не в `<head>` — на индексацию не влияет) |
| L-1/L-2/L-3/L-4/L-5 | i18n | ✅ | `prefix_except_default`, `useLocaleHead`, `detectBrowserLanguage: false` |
| P-1 | head до первого байта | ✅ | без стриминга head всегда целиком |
| P-2/P-3 | контент вне Suspense, bot-aware рендер | ✅ **из коробки** | `experimental.ssrStreaming` дефолт `false`; при включении — авто-отключение для ботов по `botRegex` (см. §10) |
| P-7/P-8 | шрифты self-host, subsetting | ✅ (код проекта) | два woff2 с `unicode-range`, `font-display: optional` |
| P-9/P-10 | width/height, AVIF→WebP→фолбэк | ✅ | `<NuxtPicture>` |
| P-11 | sharp с musl в Docker | ⚠️ | трассируются обе libc, musl-часть оставляем вручную |
| P-12 | не инлайнить критический CSS | ✅ | внешний `entry.css` (2,5 КБ br) |
| P-15 | заголовки кеширования | ⚠️ | prerendered HTML идёт **без `Cache-Control`**; ассеты immutable; `/_ipx` чинится `image.ipx.fs.maxAge` |
| P-18 | предсжатие статики | ✅ | `compressPublicAssets: { gzip, brotli }` |
| P-22 | size-limit | ⚠️ | только «весь граф», страничный бюджет — через Playwright |
| B-6 | 503 + Retry-After | ⏭ | пишется самим |
| Q-1…Q-3 | e2e SEO, unit, «HTML без JS» | ✅ | реализовано в спайке |

**Итог по 38 строкам таблицы: ✅ 26, ⚠ частично 7, ❌ не закрывает 3 (I-5, I-6 —
нормализация URL; и «полные» три контура staging только для динамических ответов),
⏭ не проверялось 2.** Писать самим придётся: нормализацию URL, RSS, Zod-валидацию JSON-LD,
503-режим, страничные бюджеты JS и весь e2e-контур.

---

## 10. Интересное, что нашлось в исходниках (не в доках)

### `routeRules` Nuxt-слоя (типы из `@nuxt/nitro-server@4.5.2/dist/index.mjs`)

```ts
interface NitroRouteRules {
  ssr?: boolean
  streaming?: boolean
  noScripts?: boolean
  experimentalNoScripts?: boolean   // @deprecated
  appMiddleware?: Record<string, boolean>
  appLayout?: string | false
}
```

### Bot-aware стриминг встроен

`@nuxt/schema@4.5.2`:

> *«Enable SSR streaming to improve Time to First Byte (TTFB). … Streaming is automatically
> disabled for bot/crawler user agents to ensure search engines receive fully-rendered HTML.
> You can opt a route out of streaming via `routeRules` with `streaming: false`. … @default false»*

```ts
ssrStreaming: boolean | { enabled?: boolean, botRegex?: RegExp }
// botRegex @default /bot\b|crawl|spider|slurp|facebookexternalhit|google\b|bing\b|yandex\b|baidu\b|duckduck/i
```

Рантайм (`runtime/handlers/renderer.mjs`):

```js
const canStream = NUXT_SSR_STREAMING && !ssrContext.noSSR && !ssrError && !isRenderingPayload
  && !import.meta.prerender && !(NUXT_NO_SCRIPTS && componentIslandsActive)
  && !routeOptions.noScripts && !!routeOptions.streaming && !routeOptions.cache
  && !routeOptions.isr && !routeOptions.redirect
const renderRouteContext = { canStream,
  prefersStream: !!(NUXT_SSR_STREAMING && !SSR_BOT_RE.test(getRequestHeader(event, 'user-agent') || '')) }
```

Т.е. канон P-3 (bot-aware рендер) у Nuxt закрыт даже при включённом стриминге,
а по умолчанию стриминга нет вовсе — что для контент-сайта и нужно.

### Graceful shutdown (из собранного `nitro.mjs`)

```js
function getGracefulShutdownConfig() {
  return {
    disabled: !!process.env.NITRO_SHUTDOWN_DISABLED,
    signals: (process.env.NITRO_SHUTDOWN_SIGNALS || 'SIGTERM SIGINT').split(' ').map(s => s.trim()),
    timeout: Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || '', 10) || 3e4,   // МИЛЛИСЕКУНДЫ
    forceExit: !process.env.NITRO_SHUTDOWN_NO_FORCE_EXIT,
  }
}
```

`NITRO_SHUTDOWN_TIMEOUT` — **в миллисекундах** (в черновике `04-runtime-deploy.md` §3.1
стоит `15000`, это верно; значение `15` означало бы 15 мс).

---

## 11. Вердикт: насколько это грамотно для контент-first сайта в нашей экосистеме

### Сильные стороны (то, ради чего стоит брать)

1. **Единственный из проверенных стеков, где Node-процесс сам корректно отдаёт и статику,
   и SSR, и серверный кеш HTML, и оптимизацию картинок, и OG-картинки, и sitemap/robots —
   без CDN и без nginx-sidecar.** Ровно наша инфра-модель (`04-runtime-deploy.md`).
2. **`swr` в Nitro решает развилку «один образ на все среды» без единой строки хаков:**
   никаких плейсхолдеров, никакого prerender-при-старте. Плюс single-flight, плюс 304.
3. **Nuxt SEO suite** — самый полный SEO-инструментарий среди кандидатов: sitemap с i18n и
   XSL, robots с тремя контурами staging, schema-org, og-image, canonical/hreflang.
   Это экономит недели работы и, главное, снимает целый класс ошибок в шаблоне.
4. **`noScripts` даёт честный ноль JS** там, где интерактив не нужен — то есть на 90 %
   маршрутов контентного сайта. Документ `/about` при этом весит 1,17 КБ по проводу.
5. **FSD ложится** без борьбы: `srcDir` + `dir.*` + отказ от автоимпортов, весь гейт
   (Steiger/Biome/ESLint/Vitest/Playwright/size-limit/TS strict) реально работает на `.vue`.
6. Dev-опыт: HMR контента и компонентов ~1 с, `nuxt typecheck` ловит ошибки в самом конфиге.

### Слабые стороны (что придётся принять или обойти)

1. **Нет partial hydration.** Либо весь маршрут гидрируется (~102–150 КБ JS), либо не
   гидрируется вовсе (`noScripts`). Промежуточного состояния «остров + 5 КБ рантайма»
   Nuxt не даёт, а `.server.vue` в нашем замере делает только хуже.
2. **Prerender и runtime-origin несовместимы** — в prerender-режиме сайт становится
   «один образ = одна среда» (включая sitemap, который нельзя разстатичить).
3. **Размер артефакта.** `.output/server/node_modules` 59 МБ даже после перехода на
   node:sqlite: `@img` (sharp) 37 МБ, `@resvg` 8,4 МБ, `@shikijs` 2 МБ. Образ 212 МБ.
   Ужать до ~150 МБ можно отказом от on-demand IPX (build-time картинки) и от og-image.
4. **RSS-профиль.** 95 МБ idle голого процесса (39,5 МиБ по cgroup в контейнере),
   ~184 МБ под нагрузкой, +92 МБ после первой OG-картинки. Для VPS с 2 ГБ — нормально,
   но `mem_limit` в compose нужен и его надо ставить не ниже 512 МБ.
5. **Много модулей = много неочевидных стыков.** Три самых дорогих бага спайка
   (`image.dir`, `i18n.baseUrl` vs site-config, og-image ↔ playwright) — все на стыках,
   и ни один не диагностируется по сообщению об ошибке.
6. **Клиентский WASM-SQLite (1,1 МБ) собирается всегда**, даже когда не используется.
7. **`ipx@4.0.0-beta.1`** внутри @nuxt/image 2.1.0 — beta-зависимость в проде.

### Что пришлось бы выдумывать самим в шаблоне

| что | объём | где |
|---|---|---|
| нормализация URL (слэш + регистр) с skip-листом внутренних префиксов | ~20 строк | `server/middleware/normalize-url.ts` |
| RSS/Atom-фид | ~45 строк | `server/routes/rss.xml.ts` |
| `/healthz` | 5 строк | `server/routes/healthz.ts` |
| `absoluteUrl()` поверх `useSiteConfig()` | 5 строк | `shared/seo` |
| OG-шаблон в навязанном каталоге | 1 файл | `src/components/OgImage/Default.satori.vue` |
| `sitemap`-поле в схеме коллекции + `lastmod` | ~10 строк | `content.config.ts` |
| ручное добавление пагинации в sitemap | ~5 строк | `nuxt.config.ts#sitemap.urls` |
| страничные бюджеты JS | ~15 строк | `e2e/smoke.spec.ts` |
| e2e-контур канона (статусы, canonical, «нет origin в разметке») | ~60 строк | `e2e/` |
| двойная env-переменная origin + документация почему | — | `docs/stack/rendering.md` |
| правка Dockerfile под sharp/musl | 3 строки | `docker/Dockerfile` |
| 4 исключения Steiger под навязанные каталоги | ~20 строк | `steiger.config.ts` |
| `import/resolver` для boundaries | 3 строки | `eslint.config.mjs` |

Итого «своего кода» — порядка **200 строк**, из них половина — тесты. Для сравнения:
SEO-инструментарий, который приходит модулями, — это тысячи строк, которые иначе
пришлось бы писать и поддерживать.

### Итоговая оценка по весам `brief-v2.md`

| критерий | вес | оценка | обоснование |
|---|---|---|---|
| Качество выдачи для контентного сайта | 25 | **20/25** | HTML-first ✅, 0 JS через `noScripts` ✅, но нет partial hydration; без `noScripts` 102–150 КБ JS |
| SEO-инструментарий из коробки | 20 | **18/20** | лучший из кандидатов; минус за нормализацию URL и RSS |
| Контент-пайплайн | 15 | **13/15** | Content v3 + Zod 4 + произвольный `cwd` ✅; sitemap-интеграция требует ручного поля; WASM-SQLite в бандле |
| Зрелость и риск | 15 | **12/15** | Nuxt 4.5 GA, Nitro 2 stable; но ipx beta, og-image ломающие изменения в 6.x, доки nitro.build не про нашу версию |
| Совместимость с наследием (FSD + гейт) | 15 | **13/15** | всё работает; минус за навязанные `src/pages`, `src/components/OgImage`, `mountSuspended` |
| Self-host одним Node-образом без CDN | 10 | **9/10** | всё в одном процессе ✅; минус за 212 МБ и RSS |
| **итого** | 100 | **85/100** | |

---

## 12. Открытые вопросы владельцу / для следующего шага

1. **Режим по умолчанию.** Предлагаю `swr` (один образ на все среды). Prerender —
   опциональный профиль. Нужно решение, потому что от него зависит формулировка
   `docs/stack/rendering.md` и наличие плейсхолдер-штамповки в entrypoint.
2. **`noScripts` по умолчанию на всех контентных маршрутах?** Это отключает клиентскую
   навигацию (каждый переход — полная загрузка). Для SEO и CWV это плюс, для «ощущения
   приложения» — минус. Предлагаю: да, по умолчанию, с явным списком исключений.
3. **on-demand IPX и og-image оставляем?** Они дают −8,4 МБ (`@resvg`) и −37 МБ (`@img`)
   образа и −90 МБ RSS, если от них отказаться в пользу build-time картинок и статичных
   OG (обложка поста как `og:image`). Для лендингов/блогов статики достаточно.
4. **`mem_limit` для `compose/site.yml`** — предлагаю 512 МБ (при OG-генерации пик ~252 МБ).
5. **Проверить `boundaries` в SPA-шаблоне** (см. §7.13) — вероятно, правило там не работает.
6. **Не проверено в этом прогоне** (не хватило времени, не блокирует решение):
   `sitemap.zeroRuntime`, шардирование карты >50k URL, `nuxt-link-checker` в CI,
   `redirectToCanonicalSiteUrl` (301 на канонический хост), Lighthouse CI,
   `vitest-axe`/`@axe-core/playwright` (a11y-контур), поведение под `mem_limit`.

---

## 13. Источники

### Проверено эмпирикой (этот спайк)

Все числа §5 и §8, разбор `.output/server/chunks/nitro/nitro.mjs`,
`node_modules/@nuxt/image@2.1.0/dist/module.js`,
`node_modules/nuxt-og-image@6.8.0/dist/{shared,runtime}`,
`node_modules/@nuxtjs/sitemap@8.5.1/dist/module.mjs`,
`node_modules/@nuxt/nitro-server@4.5.2/dist/index.mjs`,
`node_modules/nuxt/dist/app/components/nuxt-island.js`,
`node_modules/@nuxt/schema@4.5.2/dist/index.d.mts`.

### Документация (проверено 2026-09-16)

- https://nuxt.com/docs/4.x/guide/concepts/rendering — `routeRules`: `ssr`, `noScripts`,
  `prerender`, `swr`, `isr`, `redirect`, `headers`, `cors`, `appMiddleware`
- https://nitro.build/docs/cache — семантика `swr`, опции кеша (**внимание: это Nitro 3;
  `cacheStatusHeader`/`X-Cache`/`sendCacheControl` в Nitro 2.13.4 отсутствуют**)
- https://content.nuxt.com/docs/getting-started/configuration — `experimental.sqliteConnector`:
  `better-sqlite3` | `sqlite3` | `native` | `bun`
- https://nuxtseo.com/docs/site-config/guides/setting-site-config — `NUXT_SITE_URL`,
  `NUXT_SITE_NAME`, `NUXT_SITE_ENV`
- https://nuxtseo.com/docs/robots/guides/disable-indexing — `NUXT_SITE_ENV=staging`
  отключает индексацию
- https://nuxtseo.com/docs/site-config/guides/runtime-site-config — runtime site config
  через Nitro-плагин/мидлварь (env-переменные там **не описаны**)
- https://nuxtseo.com/sitemap/guides/content — интеграция sitemap ↔ Nuxt Content v3
  (`defineSitemapSchema`)

### Смежные отчёты сессии

- `brief.md`, `brief-v2.md`, `ROUND2-CONTEXT.md`
- `research/02-seo-canon.md` §3.2 — канон MUST/SHOULD
- `research/04-runtime-deploy.md` §2.7, §3.1 — **§2.7 требует правки** (см. §7.9)
- `research/06-spike.md` §7.2 — «prerender создаётся, но не отдаётся» у TanStack Start;
  **у Nuxt эта проблема отсутствует**
- `research/14-content-architecture.md` §2.2.2–2.2.4 — развилка runtime-origin;
  Nuxt реализует вариант «D» без доработок
