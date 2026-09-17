# 06 — Эмпирическая проверка (spike): TanStack Start как основа ssr-frontend-template

Каталог кода: `scratchpad/spike/`. Все цифры получены прогоном на этой машине
15.09.2026, Node v24.9.0, pnpm 10.0.0, Linux 6.12.

## 1. TL;DR

- **Путь реализуем.** Полноценный SSR-скелет на TanStack Start собран на
  **Vite 8.3.0** (Rolldown), React 19.3, TypeScript 6.0.3 strict, Tailwind v4,
  React Compiler 1.0 — с **FSD-раскладкой SPA-шаблона один-в-один**
  (`src/{app,pages,widgets,features,entities,shared}`, alias `@/*`, роуты в
  `src/pages`, дерево в `src/app/router/routeTree.gen.ts`). Всё это настраивается
  штатными опциями плагина, без хаков.
- **Vite 8 поддержан** (peer `vite: >=7.0.0`), более того — Start-доки уже
  рекомендуют Vite-8-only `resolve.tsconfigPaths: true` вместо `vite-tsconfig-paths`.
- **Главный сюрприз деплоя:** `vite build` **не даёт запускаемый Node-сервер**.
  Из коробки получается `dist/client` + `dist/server/server.js` (fetch-энтри).
  `.output/server/index.mjs` появляется, только если добавить плагин
  **`nitro/vite`**, а актуальный `nitro` — **`3.0.260903-beta`** (beta в
  dist-tag `latest`). Это ключевой риск для шаблона, который деплоится образом.
- **Ещё сюрприз:** prerender работает (`.output/public/index.html` создаётся),
  но Node-сервер Nitro его **не отдаёт** — `GET /` рендерится заново, а
  `GET /index.html` даёт 404. Prerender/ISR без статики впереди бесполезны.
- Всё SEO-критичное **доказано curl'ом**: SSR-данные в HTML, `<title>`, meta
  description, canonical, hreflang, 404 с кодом 404, 301, 302-guard, robots.txt,
  sitemap.xml, healthz, тема из cookie, i18n per-request с префиксом `/en`.
- **Per-request изоляция подтверждена**: `QueryClient` и Lingui-инстанс создаются
  в `getRouter()`, никакого модульного синглтона; гидрация без ошибок в консоли
  (проверено реальным браузером), клиентская навигация без перезагрузки документа.
- **Производительность:** TTFB медиана `/` = **8.7 ms**, `/posts/$slug` = 7.2 ms,
  server route = 2.0 ms. RSS процесса **109 MB** в покое → **142 MB** после 200
  параллельных запросов. `.output` = 2.3 MB.
- **Не доказано / отложено:** реальный `pnpm check` (Biome/ESLint/Steiger/Vitest/
  size-limit) на SSR-дереве не гонялся (не входило в объём); ISR/кеш-слой;
  Sentry с DSN; поведение под Traefik.

## 2. Версии (факт, `pnpm ls --depth 0` + разбор `node_modules`)

### Прямые зависимости

| пакет | версия | комментарий |
|---|---|---|
| `@tanstack/react-start` | **1.168.54** | опубликована 14.09.2026 |
| `@tanstack/react-router` | 1.170.36 | |
| `@tanstack/react-router-ssr-query` | 1.167.2 | интеграция Query ↔ SSR |
| `@tanstack/react-query` | 5.102.8 | |
| `@tanstack/router-cli` | 1.167.36 | для `pnpm gen` |
| `react` / `react-dom` | 19.3.0 | по `^19.2.0` резолвится в 19.3.0 |
| `vite` | **8.3.0** | Rolldown |
| `@vitejs/plugin-react` | 5.2.0 | peer `vite ^4…^8` |
| `babel-plugin-react-compiler` | 1.0.0 | `compilationMode: 'infer'` |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | |
| `typescript` | 6.0.3 | (в npm уже есть TS 7.0.2 — не брал, SPA на 6) |
| `zod` | 4.6.5 | |
| `@lingui/core` / `@lingui/react` | 5.9.5 | |
| `msw` | 2.15.0 | для server-route мока |
| `nitro` | **3.0.260903-beta** | единственный dist-tag `latest` |
| `srvx` | 1.0.5 | альтернатива Nitro |
| `@sentry/tanstackstart-react` | 10.74.0 | проверен только импорт |

### Транзитивные, важные для понимания

`@tanstack/start-plugin-core` 1.171.44 · `@tanstack/router-plugin` 1.168.38 ·
`@tanstack/router-generator` 1.167.36 · `@tanstack/start-server-core` 1.169.35 ·
`@tanstack/start-client-core` 1.170.30 · `@tanstack/router-core` 1.171.30 ·
`@tanstack/router-ssr-query-core` 1.169.2 · `rolldown` 1.2.8 · `srvx` 0.11.22
(внутри Nitro) · `h3` 2.0.1-rc.32 · `seroval` 1.6.7 · `lightningcss` 1.33.0.

Обратите внимание: **версии подпакетов Start разъезжаются** (1.167.x…1.171.x) —
это нормальный релизный режим репозитория TanStack/router, но пиннить в шаблоне
надо только верхнеуровневые пакеты.

### Команда установки (воспроизводимо)

```sh
pnpm init && pnpm pkg set type=module packageManager=pnpm@10.0.0
pnpm add @tanstack/react-start @tanstack/react-router @tanstack/react-query \
         @tanstack/react-router-ssr-query react react-dom zod \
         @lingui/core @lingui/react
pnpm add -D vite @vitejs/plugin-react babel-plugin-react-compiler \
            tailwindcss @tailwindcss/vite typescript @types/node \
            @types/react @types/react-dom @tanstack/router-cli \
            nitro@3.0.260903-beta
```

## 3. Итоговые конфиги

### `vite.config.ts`

```ts
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const prerenderHome = process.env.SPIKE_PRERENDER === '1'

export default defineConfig({
  resolve: {
    // Vite 8: встроенный резолв paths из tsconfig (@/* → src/*)
    tsconfigPaths: true,
  },

  plugins: [
    tanstackStart({
      srcDirectory: 'src',
      // routesDirectory / generatedRouteTree резолвятся ОТНОСИТЕЛЬНО srcDirectory
      router: {
        entry: './app/router/index.tsx',
        routesDirectory: 'pages',
        generatedRouteTree: 'app/router/routeTree.gen.ts',
        routeFileIgnorePrefix: '-',
      },
      start: { entry: './app/start.ts' },
      client: { entry: './app/client.tsx' },
      server: { entry: './app/server.ts' },

      sitemap: { enabled: true, host: 'https://example.com' },

      ...(prerenderHome
        ? {
            prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false },
            pages: [{ path: '/', prerender: { enabled: true } }],
          }
        : {}),
    }),
    // Nitro даёт запускаемый Node-сервер .output/server/index.mjs;
    // без него vite build отдаёт только fetch-энтри dist/server/server.js.
    nitro(),
    // react-плагин обязан идти ПОСЛЕ tanstackStart
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { compilationMode: 'infer' }]],
      },
    }),
    tailwindcss(),
  ],
})
```

### `tsconfig.json` (отличия от SPA — только `types` и отсутствие `baseUrl`)

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "useDefineForClassFields": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,

    "skipLibCheck": true,
    "noEmit": true,
    "incremental": true,
    "tsBuildInfoFile": "node_modules/.cache/tsbuildinfo.json",

    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client"]
  },
  "include": ["src", "*.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`tsr.config.json` (нужен для standalone `pnpm gen`, пути — **от корня проекта**,
в отличие от плагина):

```json
{
  "routesDirectory": "src/pages",
  "generatedRouteTree": "src/app/router/routeTree.gen.ts",
  "routeFileIgnorePrefix": "-"
}
```

### `package.json#scripts`

```json
{
  "dev": "vite dev --port 3101",
  "build": "vite build",
  "start": "node .output/server/index.mjs",
  "typecheck": "tsc --noEmit",
  "gen": "tsr generate"
}
```

### `src/pages/__root.tsx` (document-shell)

```tsx
/// <reference types="vite/client" />
import { I18nProvider } from '@lingui/react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import appCss from '@/app/styles/index.css?url'
import { readScheme } from '@/features/theme'
import { DEFAULT_LOCALE, type I18n, isLocale } from '@/shared/i18n'

interface RouterContext {
  queryClient: QueryClient
  i18n: I18n
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'stit SSR spike' },
      { name: 'theme-color', content: '#0a0a0a' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: ({ location, context }) => {
    const first = location.pathname.split('/')[1] ?? ''
    const locale = isLocale(first) ? first : DEFAULT_LOCALE
    context.i18n.activate(locale)
    return { locale, scheme: readScheme() }
  },
  notFoundComponent: () => (
    <main className="px-6 py-8">
      <h1 className="text-heading-lg font-semibold">404 — страница не найдена</h1>
      <p className="text-body-md text-muted">Проверьте адрес или вернитесь на главную.</p>
    </main>
  ),
  component: RootDocument,
})

function RootDocument() {
  const { locale, scheme, i18n } = Route.useRouteContext()

  return (
    <html lang={locale} data-scheme={scheme}>
      <head>
        <HeadContent />
      </head>
      <body>
        <I18nProvider i18n={i18n}>
          <Outlet />
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  )
}
```

### `src/app/router/index.tsx` (per-request QueryClient + i18n)

```tsx
import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createI18n } from '@/shared/i18n'
import { routeTree } from './routeTree.gen'

// Start вызывает getRouter на КАЖДЫЙ запрос — queryClient и i18n обязаны
// создаваться здесь, иначе кэш одного посетителя утечёт в HTML другого.
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  })
  const i18n = createI18n()

  const router = createRouter({
    routeTree,
    context: { queryClient, i18n },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

`src/app/client.tsx` / `src/app/server.ts` — дефолтные из доков
(`hydrateRoot(document, <StrictMode><StartClient/></StrictMode>)` и
`createServerEntry({ fetch: (r) => handler.fetch(r) })`); оба **опциональны**,
но заведены явно, чтобы жить в `app/`.

### Страница с SSR-данными и SEO — `src/pages/index.tsx`

```tsx
export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(postsQueryOptions)
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      ...robotsMeta(),
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: absoluteUrl('/') },
    ],
    links: seoLinks('/', 'ru'),
  }),
  component: HomePage,
})

function HomePage() {
  const { data: posts } = useSuspenseQuery(postsQueryOptions)
  /* … */
}
```

### Server routes

```ts
// src/pages/api/v1/posts.index.ts  → GET /api/v1/posts
export const Route = createFileRoute('/api/v1/posts/')({
  server: {
    handlers: {
      GET: () => Response.json(mockPosts.map(/* … */),
        { headers: { 'cache-control': 'public, max-age=60' } }),
    },
  },
})

// src/pages/robots[.]txt.ts  → GET /robots.txt
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        const body = runtimeConfig.INDEXABLE
          ? `User-agent: *\nAllow: /\n…\nSitemap: ${runtimeConfig.SITE_URL}/sitemap.xml\nHost: ${runtimeConfig.SITE_URL}\n`
          : 'User-agent: *\nDisallow: /\n'
        return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      },
    },
  },
})

// src/pages/api/v2/$.ts  → весь /api/v2/* через msw-хендлеры SPA
export const Route = createFileRoute('/api/v2/$')({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await getResponse(buildHandlers(), request)) ?? new Response(null, { status: 501 }),
    },
  },
})
```

Чтение cookie/заголовков на сервере — `@tanstack/react-start/server`
(`getCookie`, `getRequestHeader`, `getRequestUrl`, `setResponseStatus`);
изоморфные хелперы — `createIsomorphicFn().server(…).client(…)`.

## 4. Дерево `src/` (spike)

```
src/app/            client.tsx, server.ts, start.ts,
                    router/{index.tsx, routeTree.gen.ts}, styles/index.css
src/pages/          __root.tsx, index.tsx, login.tsx, profile.tsx (ssr:false),
                    account.tsx (ssr:'data-only'), old.tsx (301),
                    posts/$slug.tsx, $locale.tsx, $locale/index.tsx,
                    healthz.ts, robots[.]txt.ts, sitemap[.]xml.ts,
                    api/v1/posts.index.ts, api/v1/posts.$slug.ts, api/v2/$.ts
src/widgets/        site-shell/{index.ts, ui/site-shell.tsx}
src/features/       theme/{index.ts, lib/read-scheme.ts}
src/entities/       post/{index.ts, model/schema.ts, api/queries.ts}
src/shared/api/     client.ts, index.ts, session.ts, mock/{posts.ts, handlers.ts}
src/shared/config/  index.ts            (import.meta.env.SSR → process.env)
src/shared/i18n/    index.ts, locales/{ru,en}.ts
src/shared/seo/     index.ts            (canonical / hreflang / robots)
src/shared/ui/      page-header/{index.ts, page-header.tsx}
```

40 файлов. Слои и сегменты — те же, что в SPA; новых слоёв не понадобилось,
добавился один sliceless-сегмент `shared/seo`.

## 5. Дерево `.output/` (Nitro `node-server`, 2.3 MB)

```
.output/nitro.json                                   0.3 KB
.output/public/assets/index-BdiFwP3e.js            451.4 KB   (gzip 140.3 KB)
.output/public/assets/index-D1RIe-Kk.css             6.2 KB
.output/public/assets/{useSuspenseQuery,site-shell,pages,_slug,_locale,
                       login,profile,account,old}-*.js  0.03–7.9 KB
.output/server/index.mjs                            12.3 KB   ← точка входа
.output/server/_runtime.mjs                          1.5 KB
.output/server/_chunks/ssr-renderer.mjs              1.0 KB
.output/server/_ssr/ssr.mjs                        205.0 KB
.output/server/_ssr/router-*.mjs                    15.6 KB
.output/server/_ssr/{pages,site-shell,login,profile,account,old,start}-*.mjs
.output/server/_libs/@tanstack/react-router+[…].mjs 673.4 KB
.output/server/_libs/msw+[…].mjs                   430.9 KB   ← мок попал в прод!
.output/server/_libs/zod.mjs                       153.5 KB
.output/server/_libs/h3+rou3+srvx.mjs               68.7 KB
.output/server/_libs/tanstack__query-core.mjs       66.2 KB
.output/server/_libs/{lingui__react+react,lingui__core,tanstack__history,
                      tanstack__react-query,ufo,hookable,…}.mjs
```

С `SPIKE_PRERENDER=1` дополнительно появляются
`.output/public/index.html` (6.4 KB, с отрендеренными данными),
`.output/public/sitemap.xml`, `.output/public/pages.json`.

## 6. Таблица проверок

Сервер: `SITE_URL=http://localhost:3100 INDEXABLE=1 PORT=3100 node .output/server/index.mjs`.

| # | Что | Команда | Результат | Статус |
|---|---|---|---|---|
| 1 | Скелет: Vite 8 + Start + React 19 + TS 6 strict | `pnpm build`, `pnpm typecheck` | сборка 330 client / 334 nitro модулей, 0 ошибок TS | ✅ |
| 2 | FSD-раскладка: роуты `src/pages`, дерево `src/app/router` | опции `srcDirectory`+`router.{routesDirectory,generatedRouteTree,entry}` | сгенерирован `src/app/router/routeTree.gen.ts` | ✅ |
| 2b | entry-файлы Start в `src/app/` | `start.entry`/`client.entry`/`server.entry` | резолвятся относительно `srcDirectory` | ✅ |
| 2c | alias `@/*` | `resolve.tsconfigPaths: true` (Vite 8) | работает без `vite-tsconfig-paths` | ✅ |
| 3 | Document-shell, `<html lang data-scheme>`, `HeadContent`, `Scripts`, CSS `?url` | `curl -s /` | `<html lang="ru" data-scheme="light">`, `<link rel="stylesheet" href="/assets/index-*.css">` | ✅ |
| 4 | SSR-данные из mock server route | `curl -s /` | в HTML «SSR и техническое SEO», «FSD на сервере»; `<title>`, `description`, canonical, 3× hreflang | ✅ |
| 4b | Server route JSON | `curl /api/v1/posts` | 200, `application/json`, 392 B | ✅ |
| 5 | Per-request QueryClient + `setupRouterSsrQueryIntegration` | браузер: клик по ссылке | `navEntries=1`, документ не перезагружался, `dehydratedData` в HTML | ✅ |
| 5b | Гидрация без ошибок | Chrome, `read_console_messages` | **пусто** (ни warning, ни error) на `/`, `/posts/$slug`, `/profile`, тема dark | ✅ |
| 6 | `ssr: 'data-only'` + guard по cookie → 302 | `curl -I /account` | **302** → `/login` (нужен явный `statusCode: 302`) | ✅ |
| 6b | `ssr: false` + guard | `curl -I /profile` | **200** + `pendingComponent`; редирект только в браузере (проверено — уходит на `/login`) | ✅ (ожидаемо не 302) |
| 6c | `/login` noindex | `curl /login` | `<meta name="robots" content="noindex, nofollow">` | ✅ |
| 7 | 404 из `notFound()` | `curl -o /dev/null -w '%{http_code}' /posts/net-takogo` | **404** + SSR-разметка «404 — страница не найдена» | ✅ |
| 7b | 404 для неизвестной локали | `curl /xx` | **404** | ✅ |
| 7c | 301 из `beforeLoad` | `curl -I /old` | **301** → `/` | ✅ |
| 8 | Тема из cookie | `curl -H 'Cookie: scheme=dark' /` | `<html lang="ru" data-scheme="dark">`; в браузере `background: rgb(10,10,10)` | ✅ |
| 9 | i18n per-request, префикс `/en` | `curl /en` | `lang="en"`, `<title>Publications…`, «Server rendering: this text is in the HTML…» | ✅ |
| 9b | hreflang-альтернативы | `curl /`, `curl /en` | `ru`, `en`, `x-default` — на обеих | ✅ |
| 10 | robots.txt / sitemap.xml / healthz | `curl` | 200 `text/plain`, 200 `application/xml` с 3 `<loc>`, 200 `ok` | ✅ |
| 11 | Prerender главной | `SPIKE_PRERENDER=1 pnpm build` | `.output/public/index.html` 6.4 KB с данными; сгенерирован и `sitemap.xml` | ✅ (создаётся) |
| 11b | Prerender-файл отдаётся сервером | `curl /index.html`, сравнение тел | **404**; `GET /` каждый раз новый рендер (разные timestamps) | ❌ |
| 12 | `.output/server/index.mjs` запускается | `node .output/server/index.mjs` | `Listening on http://localhost:3100/` | ✅ (только с `nitro/vite`) |
| 12b | TTFB `/` (20 запросов) | `curl -w '%{time_starttransfer}'` | **медиана 8.7 ms**, min 6.7, p90 13.1, max 17.8 | ✅ |
| 12c | TTFB `/posts/$slug` / `/en` / `/api/v1/posts` / `/healthz` | то же | 7.2 / 7.2 / 2.0 / 1.8 ms | ✅ |
| 12d | RSS | `ps -o rss` | **109 MB** idle → **142 MB** после 200 параллельных `GET /` | ✅ |
| 13 | msw `getResponse` в server route | `curl /api/v2/posts`, `/api/v2/posts/net-takogo` | 200 JSON и 404 — хендлеры SPA работают на сервере | ✅ |
| 13b | `@sentry/tanstackstart-react` ставится и импортируется | `node -e "import * as S from …"` | 190 экспортов, есть `init`, `sentryGlobalRequestMiddleware`, `wrapFetchWithSentry`, `createSentryTunnelRoute` | ✅ (без DSN) |
| 13c | `import.meta.env.SSR`-guard в `shared/config` | запуск без `INDEXABLE`, `SITE_URL=https://staging…` | `noindex, nofollow`, canonical на staging-хост, `robots.txt` = `Disallow: /` | ✅ |
| 14 | Отсутствие server-кода в клиентском бандле | `grep` по `index-*.js` | 0 совпадений `getRequestHeader`, `getRequestUrl`, `mockPosts`, `msw`, `process.env`, текстов постов | ✅ |
| 15 | `verbatimModuleSyntax: true` (док советует выключить) | typecheck + build + grep бандла | собирается, утечек не найдено | ✅ (с оговоркой) |
| 16 | dev-режим | `vite dev --port 3101`, `curl localhost:3101/` | 200, SSR-HTML с данными; первый запрос 1.38 s (on-demand transform) | ✅ |
| 17 | Полный `pnpm check` (Biome/ESLint/Steiger/Vitest/size-limit) | — | не гонялся, вне объёма spike | ⏭ |
| 18 | ISR / кеширование ответов | — | не проверялось | ⏭ |

## 7. Подводные камни

### 7.1 Node-сервер требует Nitro 3 beta

`vite build` со Start даёт `dist/client` + `dist/server/server.js`, где
`server.js` — это модуль `{ fetch(request) }`, а не слушающий порт процесс.
Чтобы получить `.output/server/index.mjs`, нужен `nitro/vite`; сам `nitro`
в npm сейчас только `3.0.260903-beta` (проверено `npm view nitro dist-tags`).
Доки Start это подтверждают и сами помечают плагин как «under active
development» (https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/hosting.md).
Альтернатива без беты — `srvx` 1.0.5:
`srvx --prod -s ../client dist/server/server.js` (в spike не проверялась,
но это официально описанный путь для Rsbuild-выхода той же формы).

**Для шаблона:** это архитектурная развилка. Либо принимаем Nitro-beta
(получаем привычный `.output/server/index.mjs`, `HEALTHCHECK`, `node`-образ),
либо пишем собственный тонкий адаптер на `srvx`/express и не зависим от беты.

### 7.2 Prerender создаётся, но не отдаётся

С `prerender.enabled` файл `.output/public/index.html` создаётся и содержит
корректный SSR-HTML, но `node .output/server/index.mjs`:

- на `GET /` каждый раз делает новый рендер (сравнение тел: разные
  `u:` timestamps в гидрационных данных);
- `GET /index.html` → **404**, `GET /pages.json` → **404**.

Отдаются только ассеты из клиентского манифеста (`/assets/*`). Причина —
prerender дописывает файлы в `.output/public` уже после того, как Nitro
зафиксировал карту статики. Практический вывод: **prerender имеет смысл только
при статике впереди** (nginx/Traefik `root .output/public` с fallback на Node),
иначе это мёртвый вес. Это прямо бьёт по пункту «кеширование/ISR без CDN».

### 7.3 `routesDirectory` относительно `srcDirectory`, а в `tsr.config.json` — от корня

В плагине `parseStartConfig` резолвит
`path.resolve(root, srcDirectory, router.routesDirectory ?? 'routes')`
(`node_modules/@tanstack/start-plugin-core/dist/esm/schema.js`). То есть в
`vite.config.ts` надо писать `routesDirectory: 'pages'`, а в `tsr.config.json`
для CLI — `"routesDirectory": "src/pages"`. Рассинхрон молча ломает `pnpm gen`
(у меня `tsr generate` падал с `ENOENT … /src/routes`, пока не завёл
`tsr.config.json`).

### 7.4 `baseUrl` запрещён в TypeScript 6

Док path-aliases советует `baseUrl: "."` + `paths`
(https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/path-aliases.md).
TS 6.0.3 на это отвечает
`error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`.
Решение — только `paths` (как в SPA-шаблоне), плюс `resolve.tsconfigPaths: true`
в Vite 8.

### 7.5 Док советует выключить `verbatimModuleSyntax` — у нас не воспроизвелось

`build-from-scratch.md` пишет: «Enabling `verbatimModuleSyntax` can result in
server bundles leaking into client bundles». В spike флаг **включён** (как в SPA),
typecheck и build проходят, а `grep` по клиентскому бандлу не нашёл ни
`getRequestHeader`/`getRequestUrl`, ни `msw`, ни мок-данных, ни `process.env`.
Вывод: держать `verbatimModuleSyntax: true` можно, но **обязательно с тестом
«нет server-символов в клиентском бандле»** в gate.

### 7.6 `redirect()` по умолчанию 307, а не 302/301

`RedirectOptions.statusCode` «defaults to 307»
(`@tanstack/router-core/dist/esm/redirect.d.ts`). Для guard'ов и для
SEO-редиректов **всегда указывать `statusCode` явно** — иначе получите 307,
который поисковики трактуют как временный и не переносят вес.

### 7.7 `ssr: false` не умеет серверный редирект

Проверено: `/profile` с `ssr: false` отдаёт **200** и `pendingComponent`,
а guard срабатывает только после гидрации. Для приватных страниц, где нужен
честный 3xx от сервера, нужен **`ssr: 'data-only'`** (`/account` → 302).
Это ровно та развилка, которую надо зашить в канон шаблона.

### 7.8 Trailing slash нормализуется 307-м

`GET /en/` → `307` → `/en`. Для SEO желателен 301; TanStack Router это делает
своим кодом, и переопределить статус «из коробки» не видно. Нужно либо
нормализовать на Traefik/nginx, либо явно сделать 301 в middleware.

### 7.9 NUL-байты в SSR-HTML

В инлайновых гидрационных данных встречаются сырые `\x00` — это разделитель
идентификаторов матчей роутера (`{i:"\0$locale\0en"}`). Для браузеров безопасно,
но: `grep` считает ответ бинарным (все мои первые проверки молча дали пустой
результат), и это стоит иметь в виду для WAF/прокси и любых текстовых пайплайнов.
Проверять HTML в тестах надо с `grep -a` или через парсер.

### 7.10 Встроенный sitemap Start ≠ то, что нужно SEO-сайту

`tanstackStart({ sitemap: { enabled, host, outputPath } })` **включён по
умолчанию** и генерирует `.output/public/sitemap.xml`, но:

- он берёт **только prerender'енные страницы**; при живом SSR пишет
  `[sitemap] No pages were found to build the sitemap. Skipping...`;
- namespace в выводе — `xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"`
  (https), тогда как канон протокола — `http://…`. Валидаторы (и, вероятно,
  Яндекс.Вебмастер) могут придраться;
- собственный server route `/sitemap.xml` **побеждает** статический файл, так
  что конфликт разрешается в пользу рукописного — но лучше явно выключать
  `sitemap: { enabled: false }`, чтобы не плодить два источника правды.

### 7.11 msw утаскивает 431 KB в серверный бандл

`msw` импортирован статически в server route → в `.output/server/_libs/` лежит
`msw+[...].mjs` 430.9 KB. В шаблоне мок-слой обязан быть за динамическим
импортом под `API_MODE=mock` (как `startMockWorker` в SPA), иначе он поедет в прод.

### 7.12 Клиентский вход не нарезан

`.output/public/assets/index-*.js` = 451 KB raw / **140 KB gzip** одним чанком.
Бюджет SPA-шаблона «initial total 150 KB gzip» формально соблюдён, но запас
нулевой, а привычной нарезки `react`/`router`/`query` (`codeSplitting.groups`
в SPA) здесь нет — её придётся заводить руками и заново калибровать size-limit.

### 7.13 hreflang выводится как `hrefLang`

В HTML приходит `<link rel="alternate" hrefLang="ru" …>` — имя атрибута
берётся из ключа объекта как есть. В HTML5 атрибуты регистронезависимы, так что
краулеры это прочитают, но выглядит неканонично; если нужно строгое `hreflang` —
проверить, принимает ли `links` ключ в нижнем регистре.

### 7.14 dev-сервер слушает `localhost`, а не `127.0.0.1`

`curl http://127.0.0.1:3101/` дал `http=000`, `http://localhost:3101/` — 200.
Для Playwright-webServer и healthcheck'ов в контейнере это важно (`--host`).

## 8. Что это значит для ssr-frontend-template

1. **Стек переносится почти без потерь.** FSD, alias, TS-строгость, React
   Compiler, Tailwind-токены, Zod-контракты, Lingui, msw — всё живёт. Новое в
   `app/`: `client.tsx`, `server.ts`, `start.ts`, `router/index.tsx`
   (вместо `main.tsx`/`init.ts`/`root.tsx`/`providers/`).
2. **Правило №1 шаблона: никаких модульных синглтонов.** `QueryClient`, i18n,
   любой стор — только внутри `getRouter()`. Нужен lint-барьер (например,
   `no-restricted-syntax` на `new QueryClient()` вне `app/router`).
3. **Zustand `persist` в `features/theme` не переживает SSR** — тема и локаль
   переезжают в cookie + `createIsomorphicFn`, что и сделано в spike.
4. **Runtime config упрощается**: вместо `nginx-entrypoint.sh` + `config.js` —
   `process.env` под `import.meta.env.SSR`. Но клиентская половина конфига всё
   равно нужна (сериализовать в HTML), если фронту нужны значения после гидрации.
5. **SEO-канон реализуем целиком на `head()`** + `shared/seo` с
   `canonical`/`hreflang`/`robots`, плюс server routes на `robots.txt`/`sitemap.xml`.
   `INDEXABLE` как env-флаг закрывает staging.
6. **Деплой требует решения владельца**: Nitro-beta ради `.output/server/index.mjs`
   против собственного адаптера на `srvx`. И в любом случае — статика
   (`.output/public`) должна отдаваться чем-то перед Node, иначе prerender мёртв,
   а Node тратится на ассеты.
7. **Бюджеты и `pnpm check` придётся перекраивать**: size-limit теперь про
   клиентский вход + серверный бандл, Steiger должен знать про `api/`-роуты в
   `pages/`, а в gate просится новая проверка «в клиентском бандле нет
   server-символов».

## 9. Источники

- https://tanstack.com/start/latest — точка входа доков (страницы отдаются
  SPA-шеллом, содержимое читалось из исходников репозитория ниже)
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/build-from-scratch.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/routing.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/path-aliases.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/server-routes.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/selective-ssr.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/seo.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/static-prerendering.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/tanstack-query.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/server-entry-point.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/client-entry-point.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/hosting.md
- https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework/react/guide/tailwind-integration.md
- `npm view` (registry.npmjs.org) — версии и peer-диапазоны, 15.09.2026
- Исходники в `node_modules`: `@tanstack/start-plugin-core/dist/esm/{schema,planning,resolve-entries}.js`,
  `@tanstack/start-server-core/dist/esm/request-response.d.ts`,
  `@tanstack/router-core/dist/esm/redirect.d.ts`,
  `@tanstack/router-ssr-query-core/dist/esm/index.d.ts`, `msw/lib/core/getResponse.d.mts`
