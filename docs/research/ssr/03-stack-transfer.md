# 03 — Перенос стека и кода spa-frontend-template в SSR-шаблон (TanStack Start)

Дата: 2026-09-15. Целевой фреймворк — **TanStack Start на Vite**.
Источник фактов о SPA — полное чтение `/home/mm/git/stit-core/spa-frontend-template`
(все файлы `src/**`, конфиги, docker, e2e, docs, `.claude/**`).
Источник фактов о Start — официальные доки + **чтение исходников установленных/скачанных
пакетов** (`npm pack` в scratchpad, распаковка `src/*.ts` и `dist/**/*.d.ts`), что даёт
более высокую достоверность, чем доки. Каждый факт помечен.

Легенда пометок:
- **[код]** — проверено чтением исходника пакета (версия указана), 2026-09-15
- **[док]** — проверено по официальной документации (URL), 2026-09-15
- **[npm]** — версия проверена `npm view <pkg> version`, 2026-09-15
- **[гипотеза]** — не проверено, требует спайка

---

## 1. TL;DR

1. **Перенос реалистичен и по большей части механический.** Неизменными едут: FSD-раскладка,
   Zod-контракты, `entities/*` queries, `features/*` формы (TanStack Form), Tailwind-токен-слой,
   Biome/ESLint/boundaries, `shared/lib`, компонентные тесты, Playwright, commitlint/lefthook.
2. **TanStack Start конфигурируется под FSD без боли**: `srcDirectory`, `router.entry`,
   `router.routesDirectory`, `router.generatedRouteTree`, `client.entry`, `server.entry`,
   `start.entry` — всё это реальные опции плагина **[код: `@tanstack/start-plugin-core@1.171.44`
   `src/schema.ts` + `src/planning.ts` + `src/resolve-entries.ts`]**. `src/pages` как routes-dir и
   `src/app/router/routeTree.gen.ts` как генерируемое дерево сохраняются 1:1.
3. **Жёсткие переписывания (5 штук):** (а) модульный синглтон `queryClient` → per-request клиент в
   `getRouter()`; (б) `shared/api/client.ts` → изоморфный клиент с пробросом cookie на сервере;
   (в) `features/theme` (zustand+persist в localStorage) → cookie + SSR-атрибуты `data-scheme`/`lang`;
   (г) глобальный синглтон `i18n` Lingui → per-request `setupI18n`; (д) MSW-в-браузере → единый
   серверный mock через `getResponse(handlers, request)` **[код: `msw@2.15.0`
   `lib/core/getResponse.d.ts`]** + один catch-all server route `/api/$`.
4. **Auth в SSR — главный архитектурный блокер.** Бэкенд ставит host-only `SameSite=Strict`
   cookie на `api.${DOMAIN}`; SSR-сервер на `${DOMAIN}` их физически не получит. Рекомендация:
   **проксировать `/api/*` через сам SSR-сервер** (server route `pages/api.$.ts`), плюс попросить
   бэкенд сменить `SameSite=Strict` → **`Lax`** для `access_token` (иначе переход из выдачи Google
   не отдаст cookie на первый документ-запрос и приватные страницы всегда рендерятся анонимными).
   Правило infra «маршрутизация по сабдоменам» не нарушается: Traefik по-прежнему маршрутизирует
   `${DOMAIN}`→frontend и `api.${DOMAIN}`→backend; path-prefix живёт **внутри** приложения.
5. **SEO-приятные факты, проверенные по коду, а не по обещаниям:** `notFound()` в SSR даёт честный
   **HTTP 404**, ошибка — **500**, обычный рендер — 200 **[код: `@tanstack/router-core@1.171.20`
   `dist/esm/load-server.js` → `applyFailure()` + `renderRouterToStream.js`]**. Для ботов
   (`isbot(User-Agent)`) стриминг **ждёт `allReady`** — бот получает полный HTML, а не shell
   **[код: там же]**. Есть per-route `headers()` → можно отдавать `X-Robots-Tag`/`Cache-Control`
   маршрутом. Есть встроенная генерация `sitemap.xml` **[код: `start-plugin-core/src/build-sitemap.ts`]**.
6. **Runtime config без nginx-entrypoint**: сервер читает `process.env` (Zod) на старте; публичное
   подмножество уезжает инлайн-скриптом из `head()` с CSP-nonce (`ctx.ssr.nonce` — реальное поле
   **[код: `router-core/route.d.ts` `AssetFnContextOptions.ssr.nonce`]**), так что
   `shared/config/index.ts` почти не меняется. Один образ на все среды сохраняется.
7. **Два риска инфраструктуры сборки, которые надо закрыть спайком в первую очередь:**
   (а) **Vite 8** — peer у Start `vite: >=7.0.0` **[код: `start-plugin-core/package.json`]**, но есть
   публичные репорты «Start не отвечает на Vite 8 beta/Nitro 3 alpha»; SPA-шаблон сейчас на Vite 8.2.1.
   (б) **`nitro` v3 — до сих пор beta** (`latest = 3.0.260903-beta` **[npm]**), а именно её Start
   рекомендует для Node-хостинга. Альтернатива без Nitro — `srvx@1.0.5` **[npm]** как хост для
   `dist/server/*.js` + статика `dist/client`.
8. **`pnpm gen` (`tsr generate`) с Start несовместим** и должен быть удалён: генератор Start
   дописывает в `routeTree.gen.ts` футер с `declare module '@tanstack/react-start'` и импортами
   `getRouter`/`startInstance`, которых standalone-CLI по `tsr.config.json` не знает
   **[код: `start-plugin-core/src/start-router-plugin/route-tree-footer.ts`]**.
9. **`pnpm check` расширяется**, но остаётся тем же по духу:
   `typecheck → lint → format:check → test → steiger → build → size → seo:check`.
10. Контракт входных файлов Start жёсткий и его надо зафиксировать в доках шаблона: router-entry
    **обязан** экспортировать `getRouter`, start-entry — `startInstance` **[код: route-tree-footer.ts]**.

---

## 2. Findings по элементам

### 2.0. База: что такое Start сегодня (проверенные факты)

| факт | значение | пруф |
|---|---|---|
| пакет | `@tanstack/react-start` **1.168.54** | [npm] |
| тянет за собой | `@tanstack/react-router` 1.170.36, `start-plugin-core` 1.171.44, `start-server-core` 1.169.35 | [код: `package.json` пакета] |
| peer | `vite: >=7.0.0`, `react: >=18 \|\| >=19`, `@rsbuild/core` optional | [код] |
| плагин | `import { tanstackStart } from '@tanstack/react-start/plugin/vite'`; **ставится первым**, `@vitejs/plugin-react` — после | [док](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch) |
| выходные каталоги по умолчанию | `dist/client` и `dist/server` (`build.outDir ?? 'dist'` + `/client`, `/server`) | [код: `src/vite/output-directory.ts`] |
| с Nitro | `.output/server/index.mjs`, запуск `node .output/server/index.mjs` | [док](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) |
| env-имена Vite-окружений | `client` и **`ssr`** (имя `ssr` выбрано ради совместимости с плагинами вроде tailwind) | [код: `src/constants.ts`] |
| server-entry контракт | `export default createServerEntry({ fetch(request) { … } })`, дефолт — `createStartHandler(defaultStreamHandler)` | [код: `react-start/dist/default-entry/esm/server.js`] |
| client-entry контракт | `hydrateRoot(document, <StartClient />)` — гидрируется **весь документ** | [док](https://tanstack.com/start/latest/docs/framework/react/guide/client-entry-point) |
| router-entry контракт | файл **обязан** экспортировать `getRouter` (генератор пишет `import type { getRouter } from …`) | [код: `route-tree-footer.ts`] |
| start-entry контракт | файл экспортирует `startInstance = createStart(() => ({…}))`; опции: `defaultSsr`, `requestMiddleware`, `functionMiddleware`, `serializationAdapters`, `serverFns.fetch` | [код: `start-client-core/dist/esm/createStart.d.ts`] |
| роутер создаётся **на каждый запрос** | `createRequestHandler({ createRouter, … })` вызывает `createRouter()` внутри обработчика запроса | [код: `router-core/dist/esm/ssr/createRequestHandler.js`] |

Полный список опций `tanstackStart()` **[код: `start-plugin-core/src/schema.ts`]**:
`srcDirectory` (default `'src'`), `start.entry`, `router.{entry,basepath,…tsr-config}`,
`client.{entry,base}`, `server.{entry,build.staticNodeEnv,build.inlineCss}`,
`serverFns.{base,disableCsrfMiddlewareWarning,generateFunctionId}`, `pages[]`, `sitemap.{enabled,host,outputPath}`,
`prerender.{enabled,concurrency,filter,crawlLinks,failOnError,autoStaticPathsDiscovery,maxRedirects,…}`,
`dev.ssrStyles`, `spa.{enabled,maskPath,prerender}`, `importProtection{…}`, `vite.installDevServerMiddleware`.

Важные детали из того же исходника:
- `router.routesDirectory` и `router.generatedRouteTree` резолвятся **относительно `srcDirectory`**
  (дефолты `'routes'` и `'routeTree.gen.ts'`).
- `client.entry` / `server.entry` / `start.entry` / `router.entry` тоже резолвятся **относительно
  `srcDirectory`** [код: `src/resolve-entries.ts`].
- `sitemap.enabled` по умолчанию **true**, `outputPath: 'sitemap.xml'`; без `sitemap.host` абсолютных
  URL не будет.
- `client.base` (default `/_build`) **в коде 1.171.44 нигде не потребляется** (единственное вхождение —
  дефолт в схеме), публичная база берётся из `vite.base`. То есть клиентские ассеты ожидаемо лягут в
  `dist/client/assets/*`. **[код + гипотеза: подтвердить спайком]**

---

### 2.1. Entry / bootstrap

**Сейчас (SPA):**
`src/app/main.tsx` (`await bootstrap(); createRoot(#root).render(<App/>)`), `src/app/init.ts`
(`bootstrap()`: `initI18n → initObservability → MSW`), `src/app/root.tsx` (`<AppProviders><RouterProvider/></AppProviders>`),
`index.html` с `<script src="/config.js">`.

**Требование SSR:** `index.html` исчезает — документ рендерит React на сервере. Нужны два входа
(клиент/сервер) + start-instance. Императивный `bootstrap()` до рендера на сервере невозможен
(нет «до рендера», есть «на каждый запрос»).

**Предложение:** три файла в `app/` + перенос ответственностей `init.ts` по местам:

```
src/app/entry-client.tsx   ← hydrateRoot(document, <StartClient/>) + Sentry client + web-vitals + client-init
src/app/entry-server.ts    ← createServerEntry({ fetch }) (+ Sentry wrapFetchWithSentry)
src/app/start.ts           ← createStart({ requestMiddleware, defaultSsr })
src/app/router/index.tsx   ← getRouter(): per-request QueryClient + i18n + ssr-query integration
src/pages/__root.tsx       ← document (<html data-scheme lang>), HeadContent, Scripts, провайдеры
```

`vite.config.ts` (**черновик**):

```ts
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      srcDirectory: 'src',
      router: {
        entry: 'app/router/index.tsx',
        routesDirectory: 'pages',
        generatedRouteTree: 'app/router/routeTree.gen.ts',
        routeFileIgnorePrefix: '-',
      },
      start: { entry: 'app/start.ts' },
      client: { entry: 'app/entry-client.tsx' },
      server: { entry: 'app/entry-server.ts' },
      // server-only код физически не должен попасть в клиентский граф
      importProtection: {
        behavior: { dev: 'error', build: 'error' },
        client: { files: ['src/shared/server/**'] },
      },
      sitemap: { host: process.env.PUBLIC_ORIGIN },
    }),
    nitro(),                       // Node-рантайм; см. риск «nitro v3 beta»
    react({
      babel: { plugins: [['babel-plugin-react-compiler', { compilationMode: 'infer' }]] },
    }),
    tailwindcss(),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
```

`src/app/entry-client.tsx` (**черновик**):

```tsx
import '@/app/instrument.client'            // Sentry — обязательно первым импортом
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { initWebVitals } from '@/shared/observability'

startTransition(() => {
  hydrateRoot(document, <StrictMode><StartClient /></StrictMode>)
})

initWebVitals()   // только в браузере, после гидрации
```

`src/app/entry-server.ts` (**черновик**):

```ts
import { wrapFetchWithSentry } from '@sentry/tanstackstart-react'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

export default createServerEntry(
  wrapFetchWithSentry({ fetch: (request: Request) => handler.fetch(request) }),
)
```

`src/pages/__root.tsx` (**черновик**, объединяет `root.tsx` + `index.html` + провайдеры):

```tsx
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { AppProviders } from '@/app/providers'
import appCss from '@/app/styles/index.css?url'
import { publicConfigScript } from '@/shared/config'
import type { Locale, Scheme } from '@/shared/config'
import { readShellPrefs } from '@/shared/config'          // isomorphic: сервер — cookie, клиент — DOM
import { AppShell } from '@/widgets/app-shell'

interface RouterContext {
  queryClient: QueryClient
  scheme: Scheme
  locale: Locale
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: ({ ssr }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#0a0a0a' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
    // Runtime config до бандла — как /config.js в SPA, но без nginx
    scripts: [{ children: publicConfigScript(), ...(ssr?.nonce ? { nonce: ssr.nonce } : {}) }],
  }),
  shellComponent: RootDocument,
  component: () => <AppShell />,
})

function RootDocument({ children }: { children: ReactNode }) {
  const { scheme, locale } = readShellPrefs()
  return (
    <html lang={locale} data-scheme={scheme}>
      <head><HeadContent /></head>
      <body>
        <AppProviders>{children}</AppProviders>
        <Scripts />
      </body>
    </html>
  )
}
```

Почему `shellComponent`, а не обёртка в `component`: `shellComponent` — штатное поле root-route
**[код: `router-core/route.d.ts` `DefaultRootRouteOptionsExtensions.shellComponent`]**, введено
именно чтобы `<html>` надёжно оборачивал и error/404-состояния, когда router-хуки нестабильны
**[док: commit `feat: add optional shellComponent to root route (#4528)`]**.

**Риски:**
- `hydrateRoot(document, …)` не терпит мусора в `<head>`/`<body>`, вставленного до гидрации
  (расширения браузера, сторонние скрипты) → гидрационные ошибки. Это известная плата за
  full-document SSR; смягчается `suppressHydrationWarning` на `<html>`/`<body>` при необходимости.
- В `shellComponent` не стоит полагаться на router-хуки — см. выше; читать префы надо изоморфной
  функцией (раздел 2.6).
- Порядок плагинов (`tanstackStart` → `nitro` → `react` → `tailwindcss`) — нарушение ломает сборку [док].

---

### 2.2. Router & routes

**Сохраняется как есть:** `src/pages/*` как routes-directory, `routeFileIgnorePrefix: '-'`,
`routeTree.gen.ts` в `src/app/router/`, `createFileRoute`, `beforeLoad`+`loader`, `useSuspenseQuery`.

**Что уходит:** ручной `declare module '@tanstack/react-router' { interface Register … }` в
`app/router/index.ts` — генератор Start сам дописывает в `routeTree.gen.ts`:

```ts
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}
```
**[код: `route-tree-footer.ts`]**

**`head()` per route** — реальная сигнатура **[код: `router-core/route.d.ts:354`]**:

```ts
head?: (ctx: {
  ssr?: { nonce?: string }
  matches: Array<RouteMatch<…>>
  match: RouteMatch<…>
  params: …
  loaderData?: …
}) => Awaitable<{ links?; scripts?; meta?; styles? }>
```

То есть `head()` **получает `loaderData` и `params`** — можно строить title/description/canonical
из загруженных данных. Теги: `{ tag:'title', children }`, `{ tag:'meta', attrs }`,
`{ tag:'link', attrs }`, `{ tag:'script', attrs, children }`, `{ tag:'style', … }`
**[код: `router-core/manifest.d.ts`]**. Дедупликация: title и `meta[name|property]` перекрываются
вложенным маршрутом **[док](https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management)**.

Рядом есть **`headers()`** с той же сигнатурой ctx, возвращающая `Record<string,string>`
**[код: `route.d.ts:353`]**; результаты всех матчей мерджатся в заголовки HTTP-ответа
**[код: `createRequestHandler.js` → `getRequestHeaders()` + `mergeHeaders`]**. Это штатный способ
отдавать `Cache-Control` и `X-Robots-Tag` маршрутом.

**Per-route `ssr`** **[док](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr) + [код: `route.d.ts:254`]**:
`true` (дефолт) | `'data-only'` (beforeLoad+loader на сервере, компонент — нет) | `false`;
можно функцией `({params, search}) => …`; наследование только «строже» (`true → data-only → false`);
глобальный дефолт — `createStart(() => ({ defaultSsr }))`.

**Рекомендованная раскладка режимов для reference-слайсов:**

| route | ssr | head/headers | почему |
|---|---|---|---|
| `/` и все контентные | `true` | canonical, OG, JSON-LD | индексируемые, ради них весь SSR |
| `/login` | `true` | `meta robots: noindex,follow` | нужен серверный redirect при живой сессии; индексировать нечего |
| `/profile` | `'data-only'` | `headers: { 'X-Robots-Tag':'noindex', 'Cache-Control':'private, no-store' }` | приватно; серверный guard даёт мгновенный 302 вместо мигания, но HTML пользователя не кэшируется и не рендерится |
| `/todos` | `'data-only'` | то же | то же |
| `/api/$` (server route) | — | — | только серверный обработчик |

`'data-only'` — компромисс: guard отрабатывает на сервере (нет «вспышки логина»), но персональный
HTML не попадает ни в какой кэш. Если auth-cookie при SSR всё-таки недоступна (см. 2.4) —
деградировать до `ssr: false` для этих двух страниц, тогда шаблон остаётся корректным без бэкенд-правок.

**Guards** переезжают почти буквально:

```tsx
// src/pages/profile.tsx  (черновик)
export const Route = createFileRoute('/profile')({
  ssr: 'data-only',
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions)
    if (!session) throw redirect({ to: '/login', statusCode: 302 })
    return { session }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(userQueryOptions(context.session.userId)),
  headers: () => ({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }),
  component: ProfilePage,
})
```

- `redirect({ statusCode })` — реальное поле, **дефолт 307** **[код: `router-core/redirect.d.ts`]**.
  Для «постоянных» SEO-редиректов — `statusCode: 301`; для guard-редиректов — `302`/`307`.
  Во время SSR редирект возвращается как настоящий `Response`, а не как клиентская навигация
  **[код: `createRequestHandler.js`: `if (result?.type === 'redirect') return result.redirect`]**.
- `notFound()` — принимает `{ routeId, headers, throw }` **[код: `not-found.d.ts`]**; статус ответа
  **404** выставляется автоматически **[код: `load-server.js` `applyFailure()` → `{status:404}`;
  `renderRouterToStream.js`: `status: router._serverResult.status`]**. Это ровно то, что нужно
  против soft-404.
- `Route.useLoaderData()` vs `useSuspenseQuery`: с `setupRouterSsrQueryIntegration` **оставляем
  текущий паттерн** — `loader: ensureQueryData(...)` + `useSuspenseQuery(...)` в компоненте.
  `useSuspenseQuery` исполняется на сервере при SSR, `useQuery` — только после гидрации
  **[док](https://tanstack.com/router/latest/docs/integrations/query)**. `useLoaderData` имеет смысл
  только там, где данные не нужны в кэше Query (например, чисто SEO-поля).

**Риски:**
- `'data-only'` отключает серверный рендер компонента, но `beforeLoad` всё равно бегает на сервере —
  значит запрос к бэкенду на каждый переход по приватной странице делается дважды (сервер + гидрация),
  если `staleTime` мал. Ставить `staleTime` осмысленно.
- Дедупликация `meta` работает по `name`/`property`; `link[rel=canonical]` **не дедуплицируется по rel**
  → следить, чтобы canonical задавался ровно в одном месте (утилита `shared/seo`).

---

### 2.3. TanStack Query

**Сейчас:** `src/app/providers/query.tsx` — модульный синглтон `export const queryClient = new QueryClient(...)`,
он же импортируется в `app/router/index.ts` для `context: { queryClient }`.

**Требование SSR:** синглтон на сервере = общий кэш между всеми запросами всех пользователей
(утечка сессий/персональных данных). Категорический запрет.

**Предложение:** клиент создаётся внутри `getRouter()` (которая вызывается per-request
**[код: `createRequestHandler.js`]**), интеграция — `@tanstack/react-router-ssr-query@1.167.2` **[npm]**.

```tsx
// src/app/router/index.tsx  (черновик)
import { QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { NotFound } from '@/shared/ui/not-found'

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    wrapQueryClient: true,          // провайдер ставит интеграция
    handleRedirects: true,
    dehydrateOptions: { shouldDehydrateQuery: (q) => q.meta?.ssr !== false },
  })

  return router
}
```

Опции `setupRouterSsrQueryIntegration` (`router`, `queryClient`, `handleRedirects` default `true`,
`wrapQueryClient` default `true`, `dehydrateOptions`, `hydrateOptions`) —
**[док](https://tanstack.com/router/latest/docs/integrations/query)**.

**Что это меняет в коде:**
- `src/app/providers/query.tsx` **удаляется** целиком (провайдер даёт интеграция). Остаётся
  `providers/index.tsx` с `I18nProvider` (+ devtools).
- Экспорт `queryClient` из `app/providers` уходит; все потребители берут его из router-context.
- Devtools (`@tanstack/react-query-devtools`, `@tanstack/react-router-devtools`) — **только на клиенте**:
  не `import.meta.env.DEV && <Devtools/>` в SSR-дереве (это отрендерится и на сервере), а
  lazy-компонент, смонтированный после гидрации:

```tsx
// src/app/providers/devtools.tsx (черновик)
import { lazy, Suspense, useEffect, useState } from 'react'
const RouterDevtools = lazy(() =>
  import('@tanstack/react-router-devtools').then((m) => ({ default: m.TanStackRouterDevtools })))

export function Devtools() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!import.meta.env.DEV || !mounted) return null
  return <Suspense fallback={null}><RouterDevtools position="bottom-right" /></Suspense>
}
```

- **Streaming**: запросы, разрешающиеся во время серверного рендера, стримятся клиенту;
  `loader` без `await`/`return` = prefetch без блокировки SSR [док]. Для SEO-страниц наоборот —
  **await обязателен**, иначе бот увидит fallback. (Для ботов Start всё равно ждёт `allReady`
  **[код: `renderRouterToStream.js` + `isbot`]**, но структура HTML будет с out-of-order-вставками —
  лучше не полагаться и await'ить критичные данные.)
- `staleTime`: поднять дефолт до 60 с, чтобы гидрация не перезапрашивала то, что уже пришло с сервера.

**Риски:** любой модуль, который держит состояние «на процесс» (кроме mock-БД, где это осознанно),
станет утечкой между запросами. Это надо зафиксировать правилом (`.claude/rules/ssr-safety.md`).

---

### 2.4. API-клиент и **auth в SSR** (самый тяжёлый раздел)

#### 2.4.1. Что ломается

`src/shared/api/client.ts` сегодня:
- `url = `${runtimeConfig.API_BASE_URL}${path}`` → `/api/...` — **относительный URL**; на сервере
  `fetch('/api/v1/session')` упадёт (`Failed to parse URL`).
- `credentials: 'include'` — на сервере бессмысленно (нет cookie-jar браузера).
- `readCookie()` читает `document.cookie` — на сервере `document` не существует.
- CSRF double-submit — браузерная схема, на сервере не нужна (и нечем).

#### 2.4.2. Cookie-проблема на уровне экосистемы (главное)

Факты из брифа: backend (`go-backend-template`) ставит `access_token`/`refresh_token` как
**httpOnly, `SameSite=Strict`, `Path=/`, без `Domain`** (host-only) и живёт на `api.${DOMAIN}`;
Traefik маршрутизирует **по сабдоменам**; frontend — на корне `${DOMAIN}`.

Из этого следуют два независимых блокера SSR-аутентификации:

**Блокер A — host-only cookie на другом хосте.** Браузер отправит `access_token` только на
`api.${DOMAIN}`. Документ-запрос идёт на `${DOMAIN}` → SSR-сервер **никогда** не увидит cookie →
серверный `beforeLoad`/`sessionQueryOptions` всегда вернёт «анонимно».

**Блокер B — `SameSite=Strict` и навигация из выдачи.** Даже если cookie станет видимой на
`${DOMAIN}`, при переходе с google.ru / yandex.ru на `${DOMAIN}/…` браузер **не отправит**
Strict-cookie на первый top-level-переход. Именно на этом сценарии (вход из поиска) SSR и нужен.
`SameSite=Lax` отправляется на top-level GET-навигации — это ровно нужное поведение.

#### 2.4.3. Варианты и рекомендация

| вариант | что делаем | плюсы | минусы |
|---|---|---|---|
| **A. Прокси `/api/*` через SSR-сервер** (рекомендую) | server route `src/pages/api.$.ts` форвардит на внутренний `http://backend:8080` по docker-сети `backend-net`; `Set-Cookie` бэкенда проходит насквозь и становится host-only на `${DOMAIN}` | SSR видит cookie; CORS не нужен; CSRF-схема упрощается (всё same-origin); infra-правило «сабдомены» не нарушено — Traefik по-прежнему `Host()`-роутит, path-prefix внутри приложения; `api.${DOMAIN}` остаётся для мобильных/сторонних клиентов | +1 сетевой хоп для клиентских запросов; SSR-сервер становится на критическом пути API; надо аккуратно с `Host`/`X-Forwarded-*` |
| B. `Domain=.${DOMAIN}` на бэкенде | бэкенд ставит cookie на весь домен | минимальная правка кода фронта | cookie утекает **на все** сабдомены (`git.`, `grafana.`, …) — расширение поверхности XSS/subdomain-takeover; правка `go-backend-template` |
| C. BFF | SSR-сервер держит собственную сессию (`useSession`/`sealSession` из `@tanstack/react-start/server` **[код: `start-server-core/request-response.d.ts`]**), ходит в бэкенд по внутреннему токену | максимум контроля, можно скрыть токены от браузера совсем | самый большой объём кода; дублирование auth-логики; шаблон перестаёт быть «тонким фронтом» |
| D. Гибрид | публичные — полный SSR, приватные — `ssr: false` | ноль правок в бэкенде/инфре | приватные страницы = обычный SPA (мигание, нет серверного guard'а); для SEO-сайта приемлемо, т.к. приватное не индексируется |

**Рекомендация: A как базовый режим шаблона + D как задокументированный fallback.**
Плюс отдельный **запрос к бэкенд-шаблону**: сменить `SameSite` для `access_token` со `Strict` на
**`Lax`** (для `refresh_token` можно оставить `Strict`, он используется только XHR-ом). Без этого
вариант A решает блокер A, но не решает блокер B.

**Что это значит для соседних репозиториев:**
- `go-backend-template`: `SameSite=Lax` для access-cookie (env-флаг `COOKIE_SAMESITE`), и убедиться,
  что бэкенд не завязан на `Origin`-проверку, ломающуюся при проксировании.
- `project-infra-template-compose`: frontend-контейнер должен быть в сети `backend-net` (internal),
  чтобы ходить в `http://backend:8080`; наружу — только `proxy`. Traefik-labels не меняются.
  `api.${DOMAIN}` остаётся (не удалять — CORS-клиенты, вебхуки).

#### 2.4.4. Изоморфный клиент — черновик

```ts
// src/shared/api/client.ts  (черновик)
import { createIsomorphicFn } from '@tanstack/react-start'
import { publicConfig } from '@/shared/config'

// На сервере — абсолютный внутренний URL и проброшенные заголовки входящего запроса.
// На клиенте — относительный /api и браузерные cookie.
const resolveBase = createIsomorphicFn()
  .server(() => process.env.API_BASE_URL_INTERNAL ?? 'http://backend:8080/api')
  .client(() => publicConfig.API_BASE_URL) // '/api'

const forwardHeaders = createIsomorphicFn()
  .server((): HeadersInit => {
    // импорт вычищается из клиентского бандла компилятором Start
    const { getRequestHeaders } = require('@tanstack/react-start/server')
    const incoming = getRequestHeaders()
    const out = new Headers()
    for (const name of ['cookie', 'accept-language', 'user-agent', 'x-forwarded-for', 'x-request-id']) {
      const value = incoming.get(name)
      if (value) out.set(name, value)
    }
    return out
  })
  .client((): HeadersInit => new Headers())
```

`createIsomorphicFn()` — реальный API **[код: `@tanstack/start-fn-stubs` `createIsomorphicFn.d.ts`,
реэкспорт из `@tanstack/react-start`]**. `getRequestHeaders()`, `getRequestHeader()`, `getCookie()`,
`getCookies()`, `setCookie()`, `setResponseHeader()`, `setResponseStatus()`, `getRequestUrl()`,
`getRequestIP()` — всё реально существует в `@tanstack/react-start/server`
**[код: `start-server-core/dist/esm/request-response.d.ts`]**.

> Примечание по стилю: `require` в ESM-проекте не пройдёт; в реальном коде надо
> `import { getRequestHeaders } from '@tanstack/react-start/server'` на верхнем уровне **внутри
> server-only модуля** (`src/shared/server/request.ts`) и импортировать его через
> `createIsomorphicFn().server(...)`. Импорт `@tanstack/*-start/server` **по умолчанию запрещён
> в клиентском графе** import-protection'ом **[код: `import-protection/defaults.ts`]**, поэтому
> изоляция обязательна.

Само тело `request()` меняется точечно:

```ts
async function request(method: string, path: string, options: RequestOptions = {}) {
  const url = `${resolveBase()}${path}`
  const headers = new Headers(forwardHeaders())
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (MUTATING_METHODS.has(method)) {
    const csrf = readCsrfToken()               // isomorphic: клиент — document.cookie, сервер — undefined
    if (csrf) headers.set('X-CSRF-Token', csrf)
  }
  const response = await fetch(url, {
    method,
    headers,
    ...(import.meta.env.SSR ? {} : { credentials: 'include' as const }),
    body: options.body !== undefined ? JSON.stringify(options.body) : null,
    signal: options.signal ?? null,
  })
  if (!response.ok) throw new ApiError(response.status, url)
  if (response.status === 204) return undefined
  return response.json()
}
```

и `readCookie`:

```ts
const readCsrfToken = createIsomorphicFn()
  .server(() => undefined)                       // мутаций на сервере в loader'ах нет
  .client(() => document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)?.[1])
```

**Проброс `Set-Cookie` обратно.** Если серверный запрос в бэкенд вернул `Set-Cookie` (например,
silent refresh при SSR), его надо отдать браузеру, иначе токен «сгорит» в пустоту:

```ts
// в server-ветке клиента, после fetch:
const { setResponseHeader } = await import('@tanstack/react-start/server')
for (const cookie of response.headers.getSetCookie()) setResponseHeader('set-cookie', cookie)
```
`mergeHeaders` в Start корректно разбивает несколько `set-cookie` **[код: `router-core/ssr/headers.js`
использует `splitSetCookieString` из `cookie-es`]**.

**Прокси-роут** (единая точка для браузера; он же обслуживает mock-режим — см. 2.8):

```ts
// src/pages/api.$.ts  (черновик; flat-именование → путь /api/$)
import { createFileRoute } from '@tanstack/react-router'
import { dispatchApi } from '@/shared/server'   // server-only

const handler = ({ request }: { request: Request }) => dispatchApi(request)

export const Route = createFileRoute('/api/$')({
  server: { handlers: { GET: handler, POST: handler, PUT: handler, PATCH: handler, DELETE: handler } },
})
```
Server routes задаются полем `server.handlers` в `createFileRoute`, splat — `$`
**[док](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)**. Маршруты,
у которых есть только серверные обработчики, **вырезаются из клиентского дерева**
**[код: `start-router-plugin/pruneServerOnlySubtrees.ts`]** — в бандл не попадут.

```ts
// src/shared/server/api-dispatch.ts  (черновик)
import '@tanstack/react-start/server-only'
import { serverEnv } from './config'
import { mockResponse } from './mock'

const HOP_BY_HOP = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'])

export async function dispatchApi(request: Request): Promise<Response> {
  if (serverEnv.API_MODE === 'mock') return mockResponse(request)

  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname.replace(/^\/api/, '') + incoming.search,
                         serverEnv.API_BASE_URL_INTERNAL)
  const headers = new Headers(request.headers)
  for (const name of HOP_BY_HOP) headers.delete(name)
  headers.set('x-forwarded-host', incoming.host)
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  return fetch(target, {
    method: request.method,
    headers,
    body: request.body,
    // @ts-expect-error duplex обязателен для стриминга тела в undici
    duplex: 'half',
    redirect: 'manual',
  })
}
```
`import '@tanstack/react-start/server-only'` — маркер, после которого плагин считает модуль
server-only и ловит его импорт из клиента **[код: `react-start/dist/esm/server-only.d.ts` +
`import-protection/defaults.ts`]**.

`dispatchApi` **переиспользуется** серверной веткой api-клиента напрямую (без HTTP-хопа
«сам к себе») через `serverFns.fetch`/кастомный `fetch` — тогда SSR-loader'ы бьют в бэкенд
в один хоп, а браузер ходит через `/api/*`.

**Риски:**
- Прокси должен быть тонким и стримящим; иначе аплоады/скачивания через него будут буферизоваться.
- Ошибка в allow-list заголовков ломает или backend (`Host`), или auth (`Cookie`). Покрыть
  node-тестом на `dispatchApi`.
- Если бэкенд проверяет `Origin`/`Referer`, при проксировании они станут `${DOMAIN}` — согласовать.

---

### 2.5. Runtime config без nginx-entrypoint

**Сейчас:** `index.html` → `/config.js` → `window.__APP_CONFIG__` → Zod в `shared/config/index.ts`;
файл генерит `docker/nginx-entrypoint.sh` из env контейнера.

**Требование SSR:** nginx нет; но принцип «один образ на все среды» сохраняем — значит конфиг
читается **на старте Node-процесса** из `process.env`, а публичное подмножество — доставляется
в браузер.

**Предложение — два слоя конфигурации:**

```
src/shared/server/config.ts   ← server-only: полный Zod по process.env (включая внутренние адреса)
src/shared/config/index.ts    ← isomorphic: ТОЛЬКО публичное подмножество
```

```ts
// src/shared/server/config.ts  (черновик)
import '@tanstack/react-start/server-only'
import { z } from 'zod'

const ServerEnvSchema = z.object({
  NODE_ENV:            z.enum(['development', 'test', 'production']).default('production'),
  PORT:                z.coerce.number().default(3000),
  ENV:                 z.enum(['dev', 'staging', 'production']).default('production'),
  API_MODE:            z.enum(['mock', 'real']).default('real'),
  API_BASE_URL_INTERNAL: z.string().url().default('http://backend:8080'),
  PUBLIC_API_BASE_URL: z.string().default('/api'),
  PUBLIC_ORIGIN:       z.string().url(),              // https://example.com — canonical/sitemap/OG
  SENTRY_DSN:          z.string().default(''),
  SENTRY_ENVIRONMENT:  z.string().default('production'),
  RELEASE:             z.string().default('unknown'),
  LOG_LEVEL:           z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MOCK_SCENARIO:       z.enum(['empty', 'populated', 'authenticated', 'error']).default('populated'),
  MOCK_DEVTOOLS:       z.coerce.boolean().default(false),
})

export const serverEnv = ServerEnvSchema.parse(process.env)   // падаем на старте, а не в рантайме

export const publicRuntimeConfig = {
  API_BASE_URL:       serverEnv.PUBLIC_API_BASE_URL,
  API_MODE:           serverEnv.API_MODE,
  PUBLIC_ORIGIN:      serverEnv.PUBLIC_ORIGIN,
  SENTRY_DSN:         serverEnv.SENTRY_DSN,
  SENTRY_ENVIRONMENT: serverEnv.SENTRY_ENVIRONMENT,
  RELEASE:            serverEnv.RELEASE,
  ENV:                serverEnv.ENV,
  MOCK_DEVTOOLS:      serverEnv.MOCK_DEVTOOLS,
} as const
```

Доставка в браузер — сравнение трёх способов:

| способ | плюсы | минусы | вердикт |
|---|---|---|---|
| **inline-скрипт из `head()` с nonce** | доступен **синхронно любому модулю** (в т.ч. не-React: api-клиент, observability); минимальная дельта от SPA; порядок гарантирован (`HeadContent` в `<head>`, бандл — из `<body>` через `Scripts`) | нужен nonce под CSP (`ctx.ssr.nonce` есть **[код]**) | **рекомендую** |
| данные root-loader'а + router context | типобезопасно, без инлайн-скриптов, CSP-чисто | недоступно вне React-дерева; api-клиент придётся протаскивать через контекст | как дополнение для React-потребителей |
| `window.__APP_CONFIG__` из отдельного `/config.js` server route | 1:1 с SPA | лишний блокирующий round-trip; ради ничего | нет |

```ts
// src/shared/config/index.ts  (черновик; сохраняет форму SPA-версии)
import { createIsomorphicFn } from '@tanstack/react-start'
import { z } from 'zod'

const PublicConfigSchema = z.object({
  API_BASE_URL:       z.string().default('/api'),
  API_MODE:           z.enum(['mock', 'real']).default('real'),
  PUBLIC_ORIGIN:      z.string().default('http://localhost:3000'),
  SENTRY_DSN:         z.string().default(''),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  RELEASE:            z.string().default('dev'),
  ENV:                z.enum(['dev', 'staging', 'production']).default('dev'),
  MOCK_DEVTOOLS:      z.boolean().default(false),
})
export type PublicConfig = z.infer<typeof PublicConfigSchema>

declare global { interface Window { __APP_CONFIG__?: unknown } }

const read = createIsomorphicFn()
  .server(() => PublicConfigSchema.parse(serverPublicConfig()))   // из shared/server/config
  .client(() => PublicConfigSchema.parse(window.__APP_CONFIG__ ?? {}))

export const publicConfig: PublicConfig = read()

/** Инлайн-скрипт для head(): доставляет publicConfig в браузер до бандла. */
export const publicConfigScript = createIsomorphicFn()
  .server(() => `window.__APP_CONFIG__=${JSON.stringify(serverPublicConfig()).replace(/</g, '\\u003c')}`)
  .client(() => '')
```
`.replace(/</g,'\\u003c')` — обязательная защита от `</script>`-инъекции.

**Контракт env для образа (заменяет `docker/nginx-entrypoint.sh`):**

| env | где нужен | дефолт | назначение |
|---|---|---|---|
| `PORT` | сервер | `3000` | порт Node |
| `ENV` | оба | `production` | `staging` → глобальный `X-Robots-Tag: noindex` |
| `API_MODE` | оба | `real` | `mock` включает in-process MSW |
| `API_BASE_URL_INTERNAL` | **только сервер** | `http://backend:8080` | адрес бэкенда во внутренней сети |
| `PUBLIC_API_BASE_URL` | оба | `/api` | префикс для браузера |
| `PUBLIC_ORIGIN` | оба | — (**обязателен**) | `https://example.com` — canonical, OG, sitemap, robots |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `RELEASE` | оба | `""` / `production` / `unknown` | observability |
| `LOG_LEVEL` | сервер | `info` | JSON-логи в stdout |
| `MOCK_SCENARIO` / `MOCK_DEVTOOLS` | сервер | `populated` / `false` | демо-стенды |

**Что остаётся `VITE_*` (build-time):** по сути ничего из прежнего списка.
`VITE_API_MODE`/`VITE_API_TARGET`/`VITE_MOCK_*` уходят в обычные `process.env` — Start сам
подмешивает `.env` в `process.env` на старте **[код: `start-plugin-core/src/vite/load-env-plugin.ts`:
`Object.assign(process.env, loadEnv(config.mode, config.root, ''))`]**. Оставить `VITE_*` стоит
только для флагов, которые действительно должны исчезать при tree-shake (например
`VITE_ENABLE_DEVTOOLS`). `.env.example` / `.env.local.example` переписываются под новый список
**без префикса `VITE_`**.

**Риски:** `PUBLIC_ORIGIN` обязателен и его забудут — падать на старте (Zod без дефолта) лучше,
чем молча генерировать canonical на `localhost`. Это и правило, и тест.

---

### 2.6. Zustand / theme / locale

**Сейчас:** `features/theme/model/store.ts` — глобальный `create()(persist(..., {name:'app.theme.v1'}))`
в localStorage; `useThemeEffect` в `AppShell` ставит `document.documentElement.dataset.scheme` в `useEffect`
и дёргает `activateLocale`.

**Что ломается в SSR:**
1. Глобальный стор на сервере — состояние протекает между запросами.
2. `persist` читает localStorage, которого на сервере нет → сервер рендерит `light`/`ru`, клиент после
   гидрации переключает → **hydration mismatch + вспышка темы (FOUC)** на каждой загрузке.
3. `data-scheme`/`lang` ставятся только в `useEffect` — в SSR-HTML их нет вообще (для `lang` это ещё и
   SEO-минус: Google и Яндекс читают `<html lang>`).

**Предложение:**
- Источник истины для `scheme` и `locale` — **cookie** (`app_scheme`, `app_locale`), не localStorage.
  Cookie читается и сервером (`getCookie`), и клиентом.
- SSR ставит `<html lang={locale} data-scheme={scheme}>` сразу — ноль вспышки, ноль mismatch.
- Zustand для этого больше не нужен вовсе; если стор хочется сохранить (переключатель, подписчики) —
  делать его **UI-only** и инициализировать значением, пришедшим с сервера.

```ts
// src/shared/config/prefs.ts  (черновик)
import { createIsomorphicFn } from '@tanstack/react-start'

export type Scheme = 'light' | 'dark'
export type Locale = 'ru' | 'en'

export const readShellPrefs = createIsomorphicFn()
  .server(() => {
    const { getCookie } = requireServer()                  // см. 2.4 про изоляцию импорта
    return {
      scheme: (getCookie('app_scheme') === 'dark' ? 'dark' : 'light') as Scheme,
      locale: (getCookie('app_locale') === 'en' ? 'en' : 'ru') as Locale,
    }
  })
  .client(() => ({
    scheme: (document.documentElement.dataset.scheme ?? 'light') as Scheme,
    locale: (document.documentElement.lang || 'ru') as Locale,
  }))
```

```ts
// src/features/theme/model/store.ts  (черновик — без persist)
import { createStore, useStore } from 'zustand'
import { createContext, useContext, useState, type ReactNode } from 'react'

export const createThemeStore = (init: { scheme: Scheme; locale: Locale }) =>
  createStore<ThemeState>()((set) => ({
    ...init,
    setScheme: (scheme) => { document.cookie = `app_scheme=${scheme}; Path=/; Max-Age=31536000; SameSite=Lax`
                             document.documentElement.dataset.scheme = scheme
                             set({ scheme }) },
    setLocale: (locale) => { document.cookie = `app_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
                             set({ locale }) },
  }))

const ThemeStoreContext = createContext<ReturnType<typeof createThemeStore> | null>(null)

export function ThemeStoreProvider({ init, children }: { init: …; children: ReactNode }) {
  const [store] = useState(() => createThemeStore(init))   // per-request на сервере, per-tab на клиенте
  return <ThemeStoreContext.Provider value={store}>{children}</ThemeStoreContext.Provider>
}

export function useThemeStore<T>(selector: (s: ThemeState) => T): T {
  const store = useContext(ThemeStoreContext)
  if (!store) throw new Error('useThemeStore вне ThemeStoreProvider')
  return useStore(store, selector)
}
```
Паттерн «`createStore` + context + `useState(() => …)`» — официальная рекомендация Zustand для SSR
**[док](https://zustand.docs.pmnd.rs/learn/guides/nextjs)**: «store must be created per request and
not shared across simultaneous server requests».

`useThemeEffect` **удаляется** (его работа теперь в SSR-атрибутах и в сеттерах стора).
Смена локали при этом требует перезагрузки/навигации — см. 2.7.

**Риски:**
- Cookie без `httpOnly` — это нормально (не секрет), но `SameSite=Lax` обязателен.
- При `prefers-color-scheme` без cookie сервер не знает системную тему пользователя. Варианты:
  (а) считать дефолтом `light` и дать переключатель (как сейчас);
  (б) CSS-медиазапрос `@media (prefers-color-scheme: dark)` для «нет cookie» в токен-слое
  (тогда `data-scheme` только для явного выбора). Рекомендую (б) — это ещё и чинит первый визит.
- `localStorage`-ключ `app.theme.v1` исчезает — для форков это breaking; в доках отметить.

---

### 2.7. Lingui в SSR

**Сейчас:** `shared/i18n/index.ts` использует **глобальный синглтон** `i18n` из `@lingui/core`;
`initI18n()` вызывается один раз в bootstrap; `activateLocale` меняет активную локаль глобально.

**Что ломается:** глобальный `i18n.activate()` на сервере — гонка между параллельными запросами
(запрос A активирует `en`, запрос B рендерится по-английски). Классическая SSR-ошибка.

**Предложение:** per-request инстанс через `setupI18n({ locale, messages })` —
реальный API **[код: `@lingui/core@5.9.5` `dist/index.d.ts:155` `declare function setupI18n(params?: I18nProps): I18n`]**,
и он же — официальная рекомендация для SSR/RSC **[док: lingui «не использовать глобальный i18n на сервере»,
обсуждение lingui/js-lingui#1804]**.

```ts
// src/shared/i18n/index.ts  (черновик)
import { setupI18n, type I18n } from '@lingui/core'
import { messages as ru } from './locales/ru'
import { messages as en } from './locales/en'

export const SUPPORTED_LOCALES = ['ru', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ru'

const catalogs: Record<Locale, Record<string, string>> = { ru, en }

export function createI18n(locale: Locale): I18n {
  return setupI18n({ locale, messages: { [locale]: catalogs[locale] } })
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
```

Каталоги: **ленивый `import()` на сервере не нужен и вреден** (задержка TTFB + сложность). Каталоги
русского и английского в этом шаблоне — рукописные TS-объекты, они маленькие; грузим их статически
на сервере. На клиенте — оставить ленивую загрузку неактивной локали (чтобы не раздувать бандл):

```ts
// src/shared/i18n/client.ts (черновик)
const clientCatalogs: Record<Locale, () => Promise<{ messages: Record<string,string> }>> = {
  ru: () => import('./locales/ru'),
  en: () => import('./locales/en'),
}
```

Инстанс создаётся в `getRouter()` (per-request) и кладётся в router-context; провайдер:

```tsx
// src/app/providers/i18n.tsx (черновик)
import { I18nProvider as LinguiProvider } from '@lingui/react'
import { useRouteContext } from '@tanstack/react-router'

export function I18nProvider({ children }: { children: ReactNode }) {
  const { i18n } = useRouteContext({ from: '__root__' })
  return <LinguiProvider i18n={i18n}>{children}</LinguiProvider>
}
```

**Определение локали (приоритет):** сегмент URL → cookie `app_locale` → `Accept-Language` → `ru`.
`Accept-Language` берётся `getRequestHeader('accept-language')` **[код]**.

**URL-схема локалей (важно для SEO — разные языки обязаны иметь разные URL):**
рекомендую `ru` на корне (`/о-нас`) и `en` под префиксом (`/en/about`). В file-based routing
это **опциональный параметр пути** `{-$locale}`: поддержка `{-$optional}` подтверждена
**[код: `router-core/dist/esm/path.d.ts:53` — «Supports `{-$optional}` segments»]**.

```
src/pages/
  {-$locale}/
    route.tsx        ← pathless-подобный layout: валидирует locale, кладёт i18n в контекст
    index.tsx        ← '/' и '/en'
    about.tsx        ← '/about' и '/en/about'
```
**[гипотеза]**: точное поведение файлового генератора для каталога `{-$locale}` надо подтвердить
спайком; запасной вариант — плоское `{-$locale}.about.tsx` либо явное дублирование дерева под
`src/pages/en/` (некрасиво, но детерминированно).

`hreflang` — в `head()` layout-маршрута:

```tsx
head: ({ match }) => {
  const path = stripLocale(match.pathname)
  const origin = publicConfig.PUBLIC_ORIGIN
  return {
    links: [
      { rel: 'canonical', href: `${origin}${match.pathname}` },
      { rel: 'alternate', hrefLang: 'ru', href: `${origin}${path}` },
      { rel: 'alternate', hrefLang: 'en', href: `${origin}/en${path}` },
      { rel: 'alternate', hrefLang: 'x-default', href: `${origin}${path}` },
    ],
  }
}
```
(Точные детали канона SEO — поток 02; здесь важно, что механизм `head()` это позволяет и получает
`match`/`params`/`loaderData` **[код]**.)

**Риски:**
- Переключатель языка перестаёт быть мгновенным `activateLocale()` — он становится навигацией
  (`navigate({ to: '/en/...' })`) + установкой cookie. Это правильно для SEO, но это переписывание
  `features/theme/ui/theme-switcher.tsx`.
- Lingui 6.7.0 уже вышел **[npm]**; для паритета с SPA рекомендую остаться на **5.x** и мигрировать
  отдельно (в 6.x могли измениться типы `I18nProps`) — **[гипотеза]**.

---

### 2.8. MSW / mock-режим на сервере

**Сейчас:** `msw/browser` Service Worker, стартует в `bootstrap()`; БД `@mswjs/data` в памяти вкладки,
дамп в localStorage каждые 2 с; сценарий из `VITE_MOCK_SCENARIO`; devtools-панель на ванильном DOM;
в Vitest — `setupServer(...buildHandlers(db,false))` из `msw/node`.

**Что ломается:** серверные loader'ы бьют в бэкенд **до** того, как в браузере вообще появится
Service Worker. Mock-режим в SSR перестаёт работать — страница рендерится с ошибками/пустотой,
а после гидрации «чинится». Для шаблона, где mock — режим по умолчанию в dev, это неприемлемо.

**Варианты:**

| вариант | оценка |
|---|---|
| (a) `msw/node` в SSR-процессе + `msw/browser` в клиенте | **нет**: две независимые БД → SSR и гидрация показывают разные данные; двойной код; SW всё равно надо генерить и обслуживать |
| (b) **единый серверный mock**: SSR-сервер сам отвечает на `/api/*` теми же хендлерами | **да** — рекомендую |

**Реализация (b).** `getResponse(handlers, request, { baseUrl })` — публичный экспорт msw 2.x
**[код: `msw@2.15.0` `lib/core/index.d.ts:12` + `lib/core/getResponse.d.ts`:
`(handlers: Array<RequestHandler>, request: Request, resolutionContext?) => Promise<Response|undefined>`;
`ResponseResolutionContext.baseUrl` — «A base url to use when resolving relative urls»]**.
Критично: `getResponse` идёт через `executeHandlers` и **не трогает cookie-store**
(`storeResponseCookies` вызывается только в `handleRequest`, который используется `setupServer`/`setupWorker`)
**[код: `msw/lib/core/utils/executeHandlers.mjs` vs `handleRequest.mjs`]**, а cookies в резолвере
берутся из заголовка `cookie` запроса **[код: `utils/request/getRequestCookies.js` — при
`typeof document === 'undefined'` работает только header-ветка]**. То есть обработчики
`auth.ts`/`todos.ts`, которые читают `cookies.app_session`, **работают без изменений**.

```ts
// src/shared/server/mock.ts  (черновик)
import '@tanstack/react-start/server-only'
import { getResponse } from 'msw'
import { db } from '@/shared/api/mock/db'
import { buildHandlers } from '@/shared/api/mock/handlers'
import { loadScenario, type Scenario } from '@/shared/api/mock/scenarios'
import { serverEnv } from './config'

let current: Scenario = serverEnv.MOCK_SCENARIO
loadScenario(db, current)      // один раз на процесс — mock-БД и должна быть общей

export function switchScenario(next: Scenario) { loadScenario(db, next); current = next }

export async function mockResponse(request: Request): Promise<Response> {
  const scenario = readScenarioCookie(request) ?? current
  const handlers = buildHandlers(db, scenario === 'error')
  const response = await getResponse(handlers, request, { baseUrl: new URL(request.url).origin })
  return response ?? new Response(null, { status: 404 })
}
```

**Что меняется в `shared/api/mock/**`:**

| файл | изменение |
|---|---|
| `handlers/{auth,users,todos,error}.ts` | **без изменений** (относительные пути `/api/v1/*` резолвятся через `baseUrl`) |
| `handlers/index.ts` (`buildHandlers`) | **без изменений** |
| `db.ts`, `seeds/factories.ts` | **без изменений** |
| `scenarios/index.ts` | убрать `setSessionCookie()` (браузерный `document.cookie`); «уже залогинен» для сценария `authenticated` реализуется иначе — см. ниже |
| `persist.ts` (localStorage) | **удалить**; заменить на опциональный file-snapshot `./.mock-db.json` под `MOCK_PERSIST=1` (в `.gitignore`) |
| `index.ts` (`startMockWorker`, `setupWorker`) | **удалить** |
| `devtools.ts` | переписать: вместо `switchScenario()` в памяти вкладки — `POST /api/__mock/scenario` (тот же server route) + `location.reload()` |
| `public/mockServiceWorker.js`, `package.json#msw.workerDirectory`, скрипт `gen:msw` | **удалить** |

«Уже залогинен» для сценария `authenticated`: сервер при `mockResponse` на первый GET может выставить
`Set-Cookie: app_session=session-bootstrap`, либо (проще и честнее) devtools-панель ставит cookie
из браузера. Рекомендую первое — тогда SSR сразу рендерит авторизованное состояние, что и нужно
для e2e (`VITE_MOCK_SCENARIO=authenticated` в Playwright сейчас именно для этого).

**Переиспользование в Vitest:** остаётся **два** режима, оба валидны и оба через те же `buildHandlers`:
- component-тесты (happy-dom): `setupServer(...buildHandlers(db, false))` из `msw/node` — **как сейчас**;
- node-тесты серверного слоя: прямой вызов `mockResponse(new Request('http://x/api/v1/todos'))` —
  без setupServer вообще.

**Плюсы варианта (b):** одна БД на весь SSR+гидрацию (нет расхождений), минус Service Worker,
минус ~1.1 МБ lazy-чанка из клиентского графа вообще (msw+faker+@mswjs/data живут только на сервере),
mock-режим работает и для ботов/`curl`.

**Риски:**
- mock-БД общая на процесс → параллельные e2e-воркеры будут мешать друг другу. Решение:
  `workers: 1` для mock-e2e или изоляция сценария по cookie + отдельная БД на «сессию».
- `@mswjs/data` и `faker` попадут в серверный бандл всегда. Лечится динамическим импортом в
  `dispatchApi` при `API_MODE==='mock'` (серверный бандл размером не бюджетируется, но чистота
  прод-образа приятна).
- `getResponse` не эмитит lifecycle-события MSW (`onUnhandledRequest`, логи) — диагностика беднее;
  компенсировать своим логом «unhandled mock request».

---

### 2.9. Observability

**Sentry.** `@sentry/react@8.55.2` → **`@sentry/tanstackstart-react@10.74.0`** **[npm]**.
Официальная раскладка **[док](https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/)**:

| файл | содержимое |
|---|---|
| `src/app/instrument.client.ts` | `Sentry.init({ dsn, tracesSampleRate, … })` — **первый импорт** в `entry-client.tsx` |
| `instrument.server.mjs` (корень репо) | `Sentry.init({ dsn, tracesSampleRate })` |
| `src/app/entry-server.ts` | `createServerEntry(wrapFetchWithSentry({ fetch }))` |
| `src/app/start.ts` | `requestMiddleware: [sentryGlobalRequestMiddleware]`, `functionMiddleware: [sentryGlobalFunctionMiddleware]` |
| `src/app/router/index.tsx` | `if (!router.isServer) Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router))` |
| `vite.config.ts` | `sentryTanstackStart({ org, project, authToken })` — **последним** плагином (source maps) |
| `package.json` | `"build": "vite build && cp instrument.server.mjs .output/server"`, `"start": "node --import ./.output/server/instrument.server.mjs .output/server/index.mjs"`, dev — `NODE_OPTIONS='--import ./instrument.server.mjs' vite dev` |

**Проблема с условностью.** В SPA Sentry подключался `dynamic import` только при непустом DSN —
«без DSN ни байта в бандле». С `--import instrument.server.mjs` и «первым импортом» на клиенте это
не сохранить буквально. Предложение — компромисс, сохраняющий дух правила:
- **сервер**: `instrument.server.mjs` делает `if (!process.env.SENTRY_DSN) { /* no-op */ } else Sentry.init(...)`.
  Байты в серверном бандле не бюджетируются — цена нулевая.
- **клиент**: `instrument.client.ts` остаётся тонким шимом, который **динамически** импортирует
  `@sentry/tanstackstart-react` только при непустом `window.__APP_CONFIG__.SENTRY_DSN`:

```ts
// src/app/instrument.client.ts (черновик)
const dsn = (window.__APP_CONFIG__ as { SENTRY_DSN?: string } | undefined)?.SENTRY_DSN
if (dsn) {
  void import('@sentry/tanstackstart-react').then((Sentry) => {
    Sentry.init({ dsn, environment: …, release: …, tracesSampleRate: 0.1 })
  })
}
```
Плата: часть ранних ошибок до резолва промиса не попадёт в Sentry. **[гипотеза]**: надо проверить,
не ломает ли отложенный init `tanstackRouterBrowserTracingIntegration` — возможно, интеграцию надо
добавлять внутри `.then()` через `Sentry.addIntegration`.

**Source maps**: `sentryTanstackStart` (обёртка над `@sentry/vite-plugin@5.4.0` **[npm]**) — включать
**опционально**, по наличию `SENTRY_AUTH_TOKEN` в build-окружении, иначе сборка в CI-less среде будет
падать. `RELEASE` пробрасывается и в init, и в плагин.

**web-vitals**: `web-vitals@6.2.2` **[npm]** (SPA на 4.2.4). Только браузер — вызов переезжает из
`bootstrap()` в `entry-client.tsx` после `hydrateRoot`. `onTTFB` в SSR становится осмысленной метрикой
(раньше почти всегда мерил статику).

**Серверные логи в stdout (JSON).** Рекомендую **не тащить `pino`** (10.3.1 **[npm]**) ради шаблона —
это противоречит духу репо (свой fetch-враппер вместо axios). 40 строк своего:

```ts
// src/shared/server/logger.ts (черновик)
import '@tanstack/react-start/server-only'
import { serverEnv } from './config'

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const
const threshold = LEVELS[serverEnv.LOG_LEVEL]

function emit(level: keyof typeof LEVELS, msg: string, fields: Record<string, unknown> = {}) {
  if (LEVELS[level] < threshold) return
  process.stdout.write(`${JSON.stringify({
    ts: new Date().toISOString(), level, msg, service: 'frontend',
    env: serverEnv.ENV, release: serverEnv.RELEASE, ...fields,
  })}\n`)
}

export const log = {
  debug: (m: string, f?: Record<string, unknown>) => emit('debug', m, f),
  info:  (m: string, f?: Record<string, unknown>) => emit('info', m, f),
  warn:  (m: string, f?: Record<string, unknown>) => emit('warn', m, f),
  error: (m: string, f?: Record<string, unknown>) => emit('error', m, f),
}
```

Request-логгер — через `createMiddleware()` в `requestMiddleware` **[док: Middleware]**:
по одному JSON на запрос (`method`, `path`, `status`, `duration_ms`, `request_id`, `ua_is_bot`).
`request_id` — из `x-request-id` (Traefik) или `crypto.randomUUID()`. Поле `ua_is_bot` даёт
бесплатную аналитику краулеров — ценно для SEO-шаблона.

**Риски:** `console.log` в SSR-коде попадает в stdout контейнера без структуры — запретить правилом
(Biome `noConsole` уже `warn`, на сервере поднять до `error`).

---

### 2.10. Tailwind v4 / токен-слой

**Почти ничего не меняется.** `src/app/styles/index.css` (`@import "tailwindcss"`, `@theme`,
`@theme inline`, `[data-scheme="dark"]`) переезжает **как есть**. `@tailwindcss/vite@4.3.3` **[npm]**
совместим: Start специально назвал серверное окружение `ssr` «ради совместимости с плагинами вроде
tailwindcss» **[код: `start-plugin-core/src/constants.ts`]**.

Изменения:
1. Подключение — через `?url` + `head().links` в `__root.tsx` (см. 2.1):
   `import appCss from '@/app/styles/index.css?url'` → `links: [{ rel:'stylesheet', href: appCss }]`
   **[док](https://tanstack.com/start/latest/docs/framework/react/guide/css-styling)**.
   Альтернатива — side-effect `import '@/app/styles/index.css'` в `__root.tsx`: Start сам находит
   CSS-ассет в манифесте и `HeadContent` рендерит `<link>` для матчнутого дерева [док]. Для
   глобального токен-слоя `?url` предсказуемее.
2. `html, body, #root { height: 100% }` — `#root` больше нет (гидрируется весь документ). Заменить на
   `html, body { height: 100% }` и повесить layout-класс на `<body>`.
3. `data-scheme` теперь в SSR-HTML (см. 2.6). Плюс рекомендую добавить «нет cookie → системная тема»:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-scheme="light"]) { /* значения dark-схемы */ }
}
```
4. **Критический CSS**: у Start есть экспериментальный `server.build.inlineCss`
   (`{ enabled, transformAssets }`) — инлайнит CSS маршрута прямо в SSR-HTML
   **[код: `start-plugin-core/src/schema.ts`, помечено `@experimental`]**. Для LCP на SEO-страницах
   это заметный выигрыш. Рекомендация: **не включать в v1** шаблона (экспериментальное), завести
   строкой в backlog и в `docs/stack/styling.md`.
5. `dev.ssrStyles.enabled` (default true) — предотвращает FOUC в dev-режиме [код]. Оставить дефолт.

**Риски:** гидрация всего документа + `<link>` из `head()` — если сторонний скрипт вставит что-то
в `<head>` до гидрации, React может ругаться. `?url` уменьшает площадь риска (одна ссылка).

---

### 2.11. Тесты

**Vitest — переход на projects.** Сейчас один конфиг с `environment: 'happy-dom'`. Нужны минимум два
окружения: браузерное (компоненты) и node (server-модули, loader'ы, SEO-хелперы, прокси, mock).

```ts
// vitest.config.ts (черновик)
import { defineConfig } from 'vitest/config'

const shared = {
  globals: true,
  setupFiles: ['./vitest.setup.ts'],
}

export default defineConfig({
  // ВАЖНО: плагин tanstackStart в vitest НЕ подключаем — конфликт с резолвом модулей
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: {
    projects: [
      { test: { ...shared, name: 'ui', environment: 'happy-dom',
                include: ['src/**/*.test.{ts,tsx}'],
                exclude: ['src/**/*.server.test.ts', 'src/shared/server/**'] } },
      { test: { ...shared, name: 'server', environment: 'node',
                include: ['src/**/*.server.test.ts', 'src/shared/server/**/*.test.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/app/router/routeTree.gen.ts', 'src/shared/api/mock/**'],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
})
```

**Известный конфликт**: `tanstackStart()` в plugins ломает Vitest (`Cannot read properties of null
(reading 'useState')`); обходной путь — не подключать плагин при `process.env.VITEST`
**[док: TanStack/router#6246 + обсуждения]**. В отличие от SPA, где `vitest.config.ts`
делает `mergeConfig(viteConfig(...))`, здесь **нельзя** переиспользовать `vite.config.ts` целиком —
нужен отдельный конфиг без Start-плагина (React-плагин и alias оставить).

**Новые типы тестов, которых в SPA нет:**

1. **`head()` как чистая функция** (node, быстро, без роутера):
```ts
// src/pages/index.head.test.ts (черновик)
import { Route } from './index'
it('главная отдаёт title и canonical', async () => {
  const head = await Route.options.head!({ params: {}, matches: [], match: { pathname: '/' } } as never)
  expect(head.meta).toContainEqual({ tag: 'title', children: expect.any(String) })
  expect(head.links).toContainEqual(expect.objectContaining({ rel: 'canonical' }))
})
```
**[гипотеза]**: точная форма `ctx` для прямого вызова — подобрать по типу `AssetFnContextOptions`
(`{ ssr?, matches, match, params, loaderData? }` **[код]**); возможно, удобнее тестировать через
реальный роутер с `createMemoryHistory`.

2. **Loader'ы/guard'ы через memory-router** (happy-dom):
```ts
const router = createRouter({ routeTree, context: { queryClient },
  history: createMemoryHistory({ initialEntries: ['/profile'] }) })
await router.load()
expect(router.state.location.pathname).toBe('/login')   // guard сработал
```

3. **Серверный слой** (node): `dispatchApi` (allow-list заголовков, mock-ветка), `mockResponse`,
   Zod-схема `serverEnv` (падение при отсутствии `PUBLIC_ORIGIN`), JSON-логгер, `shared/seo`-билдеры.

4. **A11y** — без изменений (`vitest-axe` на компонентах).

**Playwright — два webServer-профиля.**

```ts
// e2e/playwright.config.ts (черновик)
const PROD = !!process.env.E2E_PROD

export default defineConfig({
  testDir: './',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /seo\.spec\.ts/ },
    { name: 'seo', use: { ...devices['Desktop Chrome'] }, testMatch: /seo\.spec\.ts/ },
  ],
  webServer: {
    command: PROD ? 'node .output/server/index.mjs' : 'pnpm dev --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: '3000', API_MODE: 'mock', MOCK_SCENARIO: 'authenticated',
           PUBLIC_ORIGIN: 'http://localhost:3000', ENV: 'dev' },
  },
})
```
Для `E2E_PROD=1` перед запуском нужен `pnpm build` (в CI — отдельный шаг; локально — `pnpm build && E2E_PROD=1 pnpm test:e2e`).

**SEO-e2e без JS** — через `request`-фикстуру Playwright (это чистый HTTP, JS не исполняется, т.е.
ровно то, что видит краулер):

```ts
// e2e/seo.spec.ts (черновик)
import { expect, test } from '@playwright/test'

test('главная: 200, title, canonical, lang, JSON-LD — в SSR-HTML', async ({ request, baseURL }) => {
  const res = await request.get('/')
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toMatch(/<html[^>]+lang="ru"/)
  expect(html).toMatch(/<title>[^<]+<\/title>/)
  expect(html).toContain(`<link rel="canonical" href="${baseURL}/"`)
  expect(html).toMatch(/<script[^>]+type="application\/ld\+json"/)
})

test('несуществующий путь отдаёт 404, а не 200', async ({ request }) => {
  expect((await request.get('/no-such-page')).status()).toBe(404)
})

test('приватная страница не индексируется', async ({ request }) => {
  const res = await request.get('/profile')
  expect(res.headers()['x-robots-tag']).toContain('noindex')
})

test('sitemap.xml и robots.txt отдаются', async ({ request }) => {
  expect((await request.get('/sitemap.xml')).status()).toBe(200)
  expect((await request.get('/robots.txt')).status()).toBe(200)
})

test('staging целиком noindex', async ({ request }) => { /* ENV=staging профиль */ })
```

`@axe-core/playwright@4.13.0` **[npm]** — как сейчас.

**Риски:** `pnpm test` без Start-плагина тестирует «немного другой» модуль-граф, чем прод
(`createServerFn`/`createIsomorphicFn` не компилируются) — все изоморфные функции в юнитах будут
работать по клиентской ветке. Это надо явно задокументировать: серверные ветки проверяются
**node-проектом Vitest через прямой импорт `shared/server/*`** и e2e, а не через изоморфные обёртки.

---

### 2.12. Lint / архитектура / server-only

**Biome** — без изменений (форматтер и базовые правила).

**ESLint**:
- `eslint-plugin-boundaries` — слои те же, конфиг не меняется.
- `no-restricted-imports` `@/*/*/*/*` — остаётся актуальным. Добавить второй паттерн:
  запрет `@tanstack/react-start/server` и `@/shared/server/**` вне `src/shared/server/**`,
  `src/app/entry-server.ts`, `src/pages/**/*.server.*` — дублирует import-protection, но даёт
  ошибку в IDE сразу, а не на сборке:

```js
'no-restricted-imports': ['error', { patterns: [
  { group: ['@/*/*/*/*'], message: 'Deep-импорт мимо public API запрещён' },
  { group: ['@tanstack/react-start/server', '@/shared/server', '@/shared/server/*'],
    message: 'Server-only модуль. Оборачивай через createIsomorphicFn().server(...)' },
]}],
// и override, снимающий второе правило для src/shared/server/**, src/app/entry-server.ts, src/pages/api.*
```
- `only-throw-error: off` для `src/pages/**` — остаётся (там же теперь и `notFound()`).
- Новый override: `files: ['src/shared/server/**', 'src/app/entry-server.ts', 'instrument.server.mjs']`
  с `globals: globals.node` и `no-console: 'error'`.

**Механизмы запрета server-only в клиенте — что реально существует (проверено по коду):**

| механизм | статус |
|---|---|
| `importProtection` в `tanstackStart()` | **штатный, встроенный**. Опции: `enabled`, `behavior: 'error'\|'mock'` (раздельно dev/build), `client.{specifiers,files,excludeFiles}`, `server.{…}`, `onViolation`, `maxTraceDepth`, `log` **[код: `start-plugin-core/src/schema.ts`]**. Дефолты: клиенту запрещены `@tanstack/{react,solid,vue}-start/server` и файлы `**/*.server.*`; серверу — `**/*.client.*` **[код: `import-protection/defaults.ts`]** |
| маркер-импорты `import '@tanstack/react-start/server-only'` / `'/client-only'` | **есть**, side-effect-only, плагин заменяет на пустой виртуальный модуль **[код: `react-start/dist/esm/server-only.d.ts`]** |
| `createServerOnlyFn()` / `createClientOnlyFn()` / `createIsomorphicFn()` | **есть**, экспортируются из `@tanstack/react-start` **[код: `start-client-core/index.d.ts`]** |
| `vite-env-only` | **не нужен** — вытеснен встроенным механизмом |

Рекомендация: `importProtection.client.files: ['src/shared/server/**']` + маркер-импорт в каждом
модуле `shared/server/*` (двойная страховка, одна ловит в сборке, другая — при прямом импорте).

**Steiger** — нужны новые исключения. Черновик `steiger.config.ts`:

```ts
export default defineConfig([
  ...fsd.configs.recommended,
  { rules: { /* тот же список, что в SPA */ } },
  { files: ['src/app/router/routeTree.gen.ts'], rules: { 'fsd/public-api': 'off' } },
  { files: ['src/pages/index.tsx'], rules: { 'fsd/no-layer-public-api': 'off' } },
  { files: ['src/app/**'], rules: { 'fsd/segments-by-purpose': 'off' } },
  // НОВОЕ: server-only и seo — сегменты sliceless-слоя shared, не входящие в канон ui/model/api/lib/config
  { files: ['src/shared/server/**', 'src/shared/seo/**'], rules: { 'fsd/segments-by-purpose': 'off' } },
  // НОВОЕ: server route /api/$ — файловый роут TanStack, не «слайс страницы»
  { files: ['src/pages/api.$.ts'], rules: { 'fsd/no-layer-public-api': 'off', 'fsd/public-api': 'off' } },
])
```
`src/app/init.ts` из исключений уходит (файла больше нет — динамический импорт mock'а мимо index
тоже уходит вместе с MSW-браузером).

Альтернатива для `shared/seo`: положить в `src/shared/lib/seo/` — тогда исключение не нужно вовсе
(`lib` — канонический сегмент). Для `shared/server` альтернативы нет: это принципиально другой
сегмент, и его отдельность полезна (одна строка в `importProtection`).

**FSD-границы не меняются**: `app → pages → widgets → features → entities → shared`.
`shared/server` — внутри `shared`, значит доступен всем слоям (через изоморфные обёртки).

---

### 2.13. Build, бюджеты, `pnpm check`

**Выходные пути.** Без nitro: `dist/client/**` + `dist/server/**` **[код: `output-directory.ts`]**.
С `nitro()`: `.output/public/**` + `.output/server/index.mjs` **[док: hosting]**.
`client.base = '/_build'` в схеме есть, но **в коде 1.171.44 не потребляется** — клиентские ассеты
ожидаются в `<clientOut>/assets/*` **[код + гипотеза: подтвердить спайком]**.

**`.size-limit.cjs`** (черновик; `size-limit@13.1.1` **[npm]**, SPA на 11):

```js
// Бюджетируется только то, что реально грузит браузер на первом рендере SSR-страницы.
// Серверный бандл (dist/server | .output/server) не бюджетируется.
module.exports = [
  { name: 'client entry',   path: '.output/public/assets/index-*.js', limit: '40 KB', gzip: true },
  { name: 'react vendor',   path: '.output/public/assets/react-*.js',  limit: '65 KB', gzip: true },
  { name: 'router+start',   path: '.output/public/assets/router-*.js', limit: '45 KB', gzip: true },
  { name: 'query vendor',   path: '.output/public/assets/query-*.js',  limit: '14 KB', gzip: true },
  { name: 'initial JS total', path: ['.output/public/assets/*.js'],    limit: '170 KB', gzip: true },
]
```
Бюджеты выше SPA-шных: Start добавляет собственный клиентский рантайм (hydration, ssr-query,
serialization). **[гипотеза]** — реальные цифры замерить спайком, это и есть цель спайка.

**Rolldown `codeSplitting.groups`.** В SPA группы заданы в `build.rollupOptions.output.codeSplitting`.
В Start `rollupOptions.input`/`rolldownOptions.input` задаются плагином **по окружениям**
**[код: `src/vite/planning.ts`]**, поэтому пользовательские опции надо класть в
`environments.client.build.rolldownOptions.output`, а не в корневой `build`. **[гипотеза]**:
работает ли это вместе с манифестом Start (он строит соответствие route→chunk) — **не проверено**.
Рекомендация: **в v1 шаблона ручную нарезку вендоров не делать**, бюджетировать суммарный initial JS,
а разбиение вернуть после спайка.

**Новые артефакты сборки для SEO:** `sitemap.xml` генерится плагином на post-build при
`sitemap.enabled !== false` (нужен `sitemap.host`) **[код: `src/post-build.ts` + `src/build-sitemap.ts`,
`xmlbuilder2`]**. `robots.txt` **не генерится** — класть в `public/robots.txt` статикой (тогда он
не сможет зависеть от `ENV`) либо отдавать server route'ом `src/pages/robots[.]txt.ts` (тогда на
staging отдаём `Disallow: /`). Рекомендую server route.

**`pnpm check`** (черновик):
```
typecheck → lint → format:check → test → steiger → build → size → seo:check
```
где `seo:check` — node-скрипт, который поднимает собранный сервер на свободном порту и проверяет
минимальный инвариант (200 на `/`, 404 на мусоре, наличие `<title>`/canonical/`lang`, доступность
`/robots.txt` и `/sitemap.xml`). Это дешевле, чем гонять Playwright в gate, но ловит 80 % регрессий.
E2E (`test:e2e`) — по-прежнему **вне** gate.

**`pnpm gen` — удалить.** `tsr generate` из `@tanstack/router-cli` не знает про Start-футер в
`routeTree.gen.ts` (`import type { getRouter }`, `declare module '@tanstack/react-start'`)
**[код: `start-router-plugin/route-tree-footer.ts`]** → перезапишет дерево без него и сломает типы.
Дерево генерит vite-плагин на `dev`/`build`. Из `devDependencies` убрать `@tanstack/router-cli`,
из корня — `tsr.config.json`. Вместо `pnpm gen` документировать `pnpm dev` (watch-генерация).

**Скрипты `package.json`** (черновик):
```json
{
  "dev":       "NODE_OPTIONS='--import ./instrument.server.mjs' vite dev --port 3000",
  "build":     "tsc -b && vite build && cp instrument.server.mjs .output/server",
  "start":     "node --import ./.output/server/instrument.server.mjs .output/server/index.mjs",
  "preview":   "vite preview",
  "typecheck": "tsc --noEmit",
  "test":      "vitest run",
  "test:e2e":  "playwright test -c e2e/playwright.config.ts",
  "seo:check": "node scripts/seo-check.mjs",
  "steiger":   "steiger src",
  "size":      "size-limit",
  "check":     "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm steiger && pnpm build && pnpm size && pnpm seo:check"
}
```

**tsconfig**: `lib` остаётся `["ES2024","DOM","DOM.Iterable"]`, но серверные модули используют Node API
→ добавить `"types": ["vite/client", "vitest/globals", "@testing-library/jest-dom", "node"]`
(`@types/node` уже в devDeps). `moduleResolution: 'bundler'`, `verbatimModuleSyntax`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — **без изменений**.

---

### 2.14. Docker (кратко — детали в другом потоке)

Что меняется относительно SPA-Dockerfile:
- runtime-стадия `nginx:1.27-alpine` → **`node:24-alpine`** (или distroless-node).
- Копируется не `dist/`, а `.output/` (+ `instrument.server.mjs`).
- `CMD ["node","--import","./instrument.server.mjs","./server/index.mjs"]`, `WORKDIR /app`.
- `EXPOSE 3000` (вместо 8080) либо `PORT=8080` для совместимости с текущими healthcheck'ами infra.
- `docker/nginx.conf` и `docker/nginx-entrypoint.sh` **удаляются**. Их функции переезжают:
  gzip/brotli → в Traefik (`compress` middleware) или в Node; security-headers → Traefik
  `secure-headers@file` (уже есть в infra) + `headers()` маршрутов; immutable-кэш ассетов →
  заголовки, которые Nitro/srvx ставит статике (**[гипотеза]**, проверить и при необходимости
  добавить middleware).
- `/healthz` → server route `src/pages/healthz.ts` (`GET → new Response('ok')`), `HEALTHCHECK` —
  `wget -qO- http://127.0.0.1:${PORT}/healthz`.
- `ENV` блок с дефолтами (`API_MODE=real`, `PUBLIC_API_BASE_URL=/api`, `PORT=8080`, …) — сохраняется,
  сам принцип «один образ, env на старте» остаётся.
- Образ станет тяжелее (node-рантайм + серверный бандл ≈ 150–250 МБ против ~50 МБ nginx) и
  ресурсоёмче в рантайме (это не статика — нужен CPU/RAM лимит в compose).

---

### 2.15. Скиллы и доки (кратко — детали в другом потоке)

| место | что затронуто |
|---|---|
| `CLAUDE.md` | таблица команд (`pnpm gen` уходит, `pnpm start`/`seo:check` приходят); строка про стек; «Границы → Делать всегда» — добавить «никаких модульных синглтонов с состоянием» |
| `.claude/rules/` | **новое правило `ssr-safety.md`** (per-request всё: QueryClient, i18n, store; server-only через `shared/server` + importProtection; никакого `window`/`document` вне client-веток). **Новое `seo-canon.md`** (поток 02). `env-local.md` — переписать: build-time/runtime таблица меняется (`VITE_*` почти исчезает, появляется server env + public subset). `tests-pipeline.md` — добавить node-проект Vitest и SEO-e2e |
| `/de-template` | A.3 «Runtime config defaults» — вместо `docker/nginx-entrypoint.sh` и `public/config.js` правится `shared/server/config.ts` + `.env.example`; A.5 prune — список слайсов тот же, плюс `pages/api.$.ts` и `shared/server/mock.ts` |
| `/scaffold` | раскладка `page` получает опцию «SSR-режим» (`true`/`data-only`/`false`) и обязательный `head()`-стаб; mock-handler регистрируется так же (`buildHandlers` не изменился) |
| `/stack-deep-dive` | 8 kinds → **10**: добавить `seo` (canonical, hreflang, robots, sitemap, JSON-LD, noindex-политика) и `rendering` (per-route ssr-режимы, prerender/ISR, кэш-политика, streaming). `_templates/config.md` и `_templates/observability.md` переписать под серверный env-контракт; `_templates/routing.md` — под Start + server routes; `_templates/api.md` — под прокси и серверный mock |
| `/release` | тег и push те же; handoff в infra тот же (`make bump SVC=frontend`), но в env-контракте появились `PUBLIC_ORIGIN`, `API_BASE_URL_INTERNAL`, `PORT` |
| `docs/reference/` | `deployment.md` — полностью переписывается (Node вместо nginx); `architecture.md` — добавить серверные entry и `shared/server`; **новый `rendering.md`** и **`seo.md`** |

---

## 3. Целевое дерево `src/` SSR-шаблона

```
src/
├─ app/                                  # sliceless; bootstrap + wiring
│  ├─ entry-client.tsx                   # hydrateRoot(document, <StartClient/>) + Sentry client + web-vitals
│  ├─ entry-server.ts                    # createServerEntry(wrapFetchWithSentry({ fetch }))
│  ├─ start.ts                           # createStart({ requestMiddleware, defaultSsr })
│  ├─ instrument.client.ts               # условная инициализация Sentry (по DSN)
│  ├─ providers/
│  │  ├─ index.tsx                       # AppProviders: I18nProvider + ThemeStoreProvider (+ Devtools)
│  │  ├─ i18n.tsx                        # LinguiProvider с per-request инстансом из router-context
│  │  └─ devtools.tsx                    # lazy, только после гидрации
│  ├─ router/
│  │  ├─ index.tsx                       # export function getRouter(): per-request QueryClient + i18n + ssr-query
│  │  └─ routeTree.gen.ts                # генерится плагином (со Start-футером)
│  └─ styles/index.css                   # токен-слой (перенос 1:1, минус #root)
│
├─ pages/                                # routesDirectory Start
│  ├─ __root.tsx                         # shellComponent = <html data-scheme lang>, HeadContent, Scripts
│  ├─ index.tsx                          # ssr: true, head(): title/description/canonical/JSON-LD
│  ├─ login.tsx                          # ssr: true, noindex, beforeLoad → redirect при сессии
│  ├─ profile.tsx                        # ssr: 'data-only', headers(): noindex + private no-store
│  ├─ todos.tsx                          # ssr: 'data-only'
│  ├─ api.$.ts                           # SERVER ROUTE: прокси в бэкенд или in-process mock
│  ├─ healthz.ts                         # SERVER ROUTE: 200 ok
│  └─ robots[.]txt.ts                    # SERVER ROUTE: robots из ENV (staging → Disallow: /)
│
├─ widgets/app-shell/                    # перенос; минус useThemeEffect
│  ├─ ui/app-shell.tsx
│  └─ index.ts
│
├─ features/
│  ├─ auth/                              # перенос 1:1 (TanStack Form + Zod)
│  ├─ create-todo/                       # перенос 1:1
│  └─ theme/                             # ПЕРЕПИСАН: createStore+Provider, cookie вместо persist
│     ├─ model/store.ts
│     ├─ ui/theme-switcher.tsx           # смена локали = навигация + cookie
│     └─ index.ts
│
├─ entities/                             # перенос 1:1 (schema + queryOptions + мутации + ui)
│  ├─ session/  user/  todo/
│
└─ shared/
   ├─ api/
   │  ├─ client.ts                       # ИЗОМОРФНЫЙ: base + проброс cookie/headers
   │  ├─ index.ts
   │  └─ mock/                           # хендлеры/db/seeds/scenarios — почти без изменений
   │     ├─ db.ts  seeds/  scenarios/  handlers/{auth,users,todos,error,index}.ts
   │     └─ devtools.ts                  # переписан под server-route переключение
   ├─ config/
   │  ├─ index.ts                        # публичный конфиг (isomorphic) + publicConfigScript()
   │  ├─ prefs.ts                        # readShellPrefs(): scheme/locale из cookie|DOM
   │  └─ env.d.ts
   ├─ i18n/
   │  ├─ index.ts                        # createI18n(locale) через setupI18n — БЕЗ синглтона
   │  └─ locales/{ru,en}.ts
   ├─ lib/                               # cn, invariant — 1:1
   ├─ observability/index.ts             # web-vitals (client), обёртки Sentry
   ├─ seo/                               # НОВОЕ: canonical, hreflang, OG, JSON-LD, robots-meta
   │  ├─ canonical.ts  jsonld.ts  meta.ts  index.ts
   ├─ server/                            # НОВОЕ, server-only (importProtection + маркер-импорт)
   │  ├─ config.ts                       # Zod по process.env; serverEnv + publicRuntimeConfig
   │  ├─ request.ts                      # getRequestHeaders/getCookie обёртки
   │  ├─ api-dispatch.ts                 # прокси в бэкенд / mock
   │  ├─ mock.ts                         # getResponse(buildHandlers(db,…), request, {baseUrl})
   │  ├─ logger.ts                       # JSON в stdout
   │  └─ index.ts
   └─ ui/
      ├─ page-header/                    # 1:1
      └─ not-found/                      # НОВОЕ: defaultNotFoundComponent (для честного 404)
```

Корень репо: `vite.config.ts`, `vitest.config.ts` (без Start-плагина), `instrument.server.mjs`,
`scripts/seo-check.mjs`, `public/{favicon.svg}` (без `config.js` и `mockServiceWorker.js`),
`docker/Dockerfile` (без nginx.conf/entrypoint), `e2e/{playwright.config.ts,smoke.spec.ts,seo.spec.ts}`.

---

## 4. Таблица пакетов (версии проверены `npm view` 2026-09-15)

### Добавить

| пакет | версия | зачем | зона |
|---|---|---|---|
| `@tanstack/react-start` | `1.168.54` | сам фреймворк + vite-плагин + server/client entry | dep |
| `@tanstack/react-router-ssr-query` | `1.167.2` | `setupRouterSsrQueryIntegration` (dehydrate/hydrate/streaming) | dep |
| `nitro` | `3.0.260903-beta` ⚠ | Node-сборка `.output/server/index.mjs` | devDep |
| `@sentry/tanstackstart-react` | `10.74.0` | клиент+сервер Sentry, `wrapFetchWithSentry`, middleware, vite-плагин | dep |
| `srvx` | `1.0.5` | **альтернатива nitro**: хост fetch-entry + статика | devDep (если без nitro) |
| `@types/node` | `^24` | уже есть — просто добавить в `tsconfig.types` | devDep |

### Удалить

| пакет / файл | почему |
|---|---|
| `@tanstack/router-cli` + `tsr.config.json` + скрипт `gen` | генератор Start дописывает футер, standalone CLI его снесёт **[код]** |
| `@tanstack/router-plugin` (прямая зависимость) | приходит транзитивно внутри `start-plugin-core` (1.168.38) |
| `@sentry/react` `8.55.2` | заменён на `@sentry/tanstackstart-react` |
| `public/mockServiceWorker.js`, `package.json#msw.workerDirectory`, скрипт `gen:msw` | Service Worker больше не нужен |
| `public/config.js`, `index.html`, `docker/nginx.conf`, `docker/nginx-entrypoint.sh` | заменены серверной конфигурацией и document-рендером |
| `src/app/providers/query.tsx` (файл) | `wrapQueryClient` интеграции |

### Оставить как есть

`react`/`react-dom` 19.2.8 (доступен 19.3.0 **[npm]** — бампать отдельно),
`@tanstack/react-query` (5.101.4 → `5.102.8`), `@tanstack/react-form` (1.33.4 → `1.33.5`),
`zod` (4.4.3 → `4.6.5`), `zustand` (5.0.14 → `5.0.15`), `tailwindcss`/`@tailwindcss/vite` `4.3.3`,
`msw` `2.15.0`, `@mswjs/data` `0.16.2`, `@faker-js/faker` 10,
`@biomejs/biome` 2.5.7, `eslint` 9.39.5, `typescript-eslint` 8,
`eslint-plugin-boundaries` (5 → `7.2.0` **[npm]**, мажорный — отдельной задачей),
`steiger` `0.6.0` + `@feature-sliced/steiger-plugin` `0.7.0`,
`vitest` `4.1.11`, `@testing-library/*`, `vitest-axe` `0.1.0`, `happy-dom` (16 → `20.14.5`),
`@playwright/test` (1.62.1 → `1.63.0`), `@axe-core/playwright` `4.13.0`,
`babel-plugin-react-compiler` 1.0.0, `@vitejs/plugin-react` (5 → `6.1.1`),
`lefthook`, `commitlint`, `size-limit` (11 → `13.1.1`).

### Решить отдельно

| пакет | вопрос |
|---|---|
| `vite` | **8.3.0 vs 7.3.6.** SPA на 8.2.1; peer Start `>=7.0.0` **[код]**, но есть публичные репорты неработающего Start на Vite 8 beta + Nitro 3 alpha. Рекомендую **спайк на 8.x**, при провале — временно 7.3.6 (расхождение с SPA-шаблоном, надо записать в доки) |
| `nitro` | **beta**. Варианты: (1) принять beta (Start это официально рекомендует), (2) `srvx` без nitro, (3) собственный 20-строчный Node-хост поверх `dist/server` fetch-entry |
| `@lingui/*` | 5.9.5 (паритет с SPA) vs 6.7.0. Рекомендую 5.x в v1 |
| `web-vitals` | 4.2.4 → 6.2.2 — мажоры; API `onCLS/onINP/onLCP/onFCP/onTTFB` стабилен, но проверить |
| `typescript` | 6.0.3 (как в SPA) vs 7.0.2. Держать паритет с SPA |
| `pino` `10.3.1` | брать или писать 40 строк своего JSON-логгера (рекомендую второе) |
| `@sentry/vite-plugin` | приходит внутри `@sentry/tanstackstart-react/vite`; отдельно ставить не надо |

---

## 5. Риски и открытые вопросы

### Блокеры, требующие решения владельца

1. **Auth-cookie в SSR (см. 2.4).** Нужно решение по трём пунктам:
   а) принимаем ли прокси `/api/*` через SSR-сервер (рекомендация «да»);
   б) просим ли `go-backend-template` сменить `SameSite=Strict` → `Lax` для access-cookie (рекомендация «да»);
   в) если оба «нет» — фиксируем деградацию: приватные страницы `ssr: false`, серверных guard'ов нет.
2. **Nitro beta / Vite 8.** Готовы ли класть в шаблон зависимость с `-beta` в `latest`?
   Альтернативы (srvx / свой хост) снимают beta, но уводят от официального пути Start.
3. **Отход от паритета версий с SPA** (Vite 7 vs 8, если спайк на 8 провалится) — допустимо ли.

### Технические риски

| риск | вероятность | смягчение |
|---|---|---|
| Vite 8 + Start не собирается/не отвечает | средняя | спайк первым делом; fallback Vite 7.3.6 |
| `hydrateRoot(document)` даёт hydration-ошибки из-за расширений браузера | средняя | `suppressHydrationWarning` на `html`/`body`; в Sentry — отдельный фильтр |
| `codeSplitting.groups` не переносится в environments-конфиг Start | средняя | в v1 не делать ручную нарезку; бюджетировать суммарный initial JS |
| Vitest без Start-плагина тестирует другой граф (изоморфные функции идут по client-ветке) | высокая | node-проект Vitest импортирует `shared/server/*` напрямую; e2e прикрывает остальное |
| Общая mock-БД ломает параллельные e2e | средняя | `workers: 1` для mock-профиля или БД на сессию |
| Отложенный (по DSN) init Sentry на клиенте теряет ранние ошибки и ломает router-tracing | средняя | либо принять потерю, либо всегда грузить Sentry на клиенте и отказаться от «ни байта без DSN» |
| Серверный бандл тянет msw/faker всегда | низкая | динамический импорт mock-ветки в `dispatchApi` |
| `.output/public/assets/*` — реальные пути ассетов не совпадут с `.size-limit.cjs` | высокая | замерить спайком, зафиксировать глобы |
| `{-$locale}` в file-based routing ведёт себя не так, как ожидается | средняя | спайк; fallback — дублирование дерева под `src/pages/en/` |
| Steiger 0.6 неожиданно ругнётся на `pages/api.$.ts` / `shared/server` | низкая | исключения уже заготовлены (2.12) |

### Что надо проверить спайком (приоритет сверху вниз)

1. `pnpm build` + `node .output/server/index.mjs` на Vite 8.3 + Start 1.168.54 + nitro beta.
   Если красное — то же на Vite 7.3.6; если снова красное — srvx без nitro.
2. Реальные пути и размеры клиентских чанков (`.output/public/**`) → бюджеты.
3. Кастомные entry-пути (`app/entry-client.tsx`, `app/entry-server.ts`, `app/start.ts`,
   `app/router/index.tsx`, `routesDirectory: 'pages'`, `generatedRouteTree: 'app/router/routeTree.gen.ts'`) —
   собирается ли, корректен ли футер в `routeTree.gen.ts`.
4. `getCookie()`/`getRequestHeaders()` внутри `getRouter()` и внутри `shellComponent` — доступен ли
   request-контекст (AsyncLocalStorage) в этих точках.
5. HTTP-статусы: 404 на несуществующем пути, 500 на брошенной ошибке в loader'е, 301/302 из `redirect()`.
6. `getResponse` + относительные хендлеры + `baseUrl` + cookie `app_session` — полный mock-цикл
   login → session → todos через server route.
7. Изоморфные функции: действительно ли `.server()`-ветка и её импорты вычищаются из клиентского
   бандла (grep по `.output/public/**` на `API_BASE_URL_INTERNAL` и `@tanstack/react-start/server`).
8. `importProtection` с `client.files: ['src/shared/server/**']` — падает ли сборка при нарушении.
9. `{-$locale}` в file-based routing.
10. Vitest без Start-плагина: проходят ли перенесённые компонентные тесты (`todo-item.test.tsx`).

---

## 6. Источники

Документация (проверено 2026-09-15):
- https://tanstack.com/start/latest/docs/framework/react/build-from-scratch
- https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
- https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
- https://tanstack.com/start/latest/docs/framework/react/guide/client-entry-point
- https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- https://tanstack.com/start/latest/docs/framework/react/guide/css-styling
- https://tanstack.com/start/latest/docs/framework/react/guide/tailwind-integration
- https://tanstack.com/start/latest/docs/framework/react/guide/middleware
- https://tanstack.com/router/latest/docs/integrations/query
- https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management
- https://tanstack.com/router/latest/docs/framework/react/how-to/setup-testing
- https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/
- https://zustand.docs.pmnd.rs/learn/guides/nextjs
- https://mswjs.io/docs/api/get-response/
- https://github.com/lingui/js-lingui/discussions/1804 (SSR: per-request i18n)
- https://github.com/TanStack/router/issues/6246 (Vitest × tanstackStart plugin)
- https://github.com/TanStack/router/commit/eb28ad0 (`shellComponent` на root route)
- https://github.com/vitejs/rolldown-vite/issues/580 (Start не отвечает на Vite 8 beta + Nitro 3 alpha)
- https://vite.dev/blog/announcing-vite8
- https://nitro.build/

Исходники пакетов (скачаны `npm pack`, прочитаны 2026-09-15):
- `@tanstack/start-plugin-core@1.171.44` — `src/schema.ts`, `src/vite/schema.ts`, `src/planning.ts`,
  `src/resolve-entries.ts`, `src/vite/planning.ts`, `src/vite/output-directory.ts`,
  `src/vite/load-env-plugin/index.ts`, `src/constants.ts`, `src/import-protection/defaults.ts`,
  `src/start-router-plugin/route-tree-footer.ts`, `src/start-router-plugin/pruneServerOnlySubtrees.ts`,
  `src/build-sitemap.ts`, `src/post-build.ts`, `package.json`
- `@tanstack/react-start@1.168.54` — `package.json#exports`, `dist/esm/{index,server,server-only,client-only}.d.ts`,
  `dist/default-entry/esm/server.js`
- `@tanstack/start-server-core@1.169.35` — `dist/esm/{index,request-response,session}.d.ts`,
  `dist/esm/createStartHandler.js`
- `@tanstack/start-client-core@1.170.30` — `dist/esm/{index,createStart}.d.ts`
- `@tanstack/react-start-server@1.167.41` — `dist/esm/{index.d.ts,defaultStreamHandler.js}`
- `@tanstack/start-fn-stubs@1.162.0` — `dist/esm/{index,createIsomorphicFn,envOnly}.d.ts`
- `@tanstack/router-core@1.171.20` (из node_modules SPA) — `dist/esm/route.d.ts`, `manifest.d.ts`,
  `redirect.d.ts`, `not-found.d.ts`, `load-server.js`, `ssr/createRequestHandler.js`, `ssr/headers.js`, `path.d.ts`
- `@tanstack/react-router@1.170.24` (из node_modules SPA) — `dist/esm/ssr/renderRouterToStream.js`
- `@tanstack/router-generator@1.167.26` (из node_modules SPA) — `dist/esm/config.d.ts`
- `msw@2.15.0` (из node_modules SPA) — `lib/core/index.d.ts`, `lib/core/getResponse.d.ts`,
  `lib/core/getResponse.mjs`, `lib/core/utils/executeHandlers.mjs`, `lib/core/utils/request/getRequestCookies.js`,
  `lib/core/HttpResponse-*.d.ts` (`ResponseResolutionContext`)
- `@lingui/core@5.9.5` (из node_modules SPA) — `dist/index.d.ts` (`setupI18n`)

Версии (`npm view <pkg> version`, 2026-09-15): `@tanstack/react-start` 1.168.54 ·
`@tanstack/react-router` 1.170.36 · `@tanstack/react-router-ssr-query` 1.167.2 ·
`@tanstack/router-plugin` 1.168.38 · `@tanstack/router-cli` 1.167.36 · `nitro` 3.0.260903-beta
(dist-tags: только `latest`) · `nitropack` 2.13.4 · `srvx` 1.0.5 · `@sentry/tanstackstart-react` 10.74.0 ·
`@sentry/vite-plugin` 5.4.0 · `vite` 8.3.0 (7.x: 7.3.6) · `@vitejs/plugin-react` 6.1.1 ·
`react` 19.3.0 · `@tanstack/react-query` 5.102.8 · `@tanstack/react-form` 1.33.5 · `zod` 4.6.5 ·
`zustand` 5.0.15 · `tailwindcss` / `@tailwindcss/vite` 4.3.3 · `msw` 2.15.0 · `@mswjs/data` 0.16.2 ·
`@lingui/core` / `@lingui/react` 6.7.0 (5.x: 5.9.5) · `web-vitals` 6.2.2 · `vitest` 4.1.11 (5.0.0 есть) ·
`happy-dom` 20.14.5 · `@playwright/test` 1.63.0 · `@axe-core/playwright` 4.13.0 · `vitest-axe` 0.1.0 ·
`size-limit` 13.1.1 · `steiger` 0.6.0 · `@feature-sliced/steiger-plugin` 0.7.0 ·
`eslint-plugin-boundaries` 7.2.0 · `typescript` 7.0.2 · `pino` 10.3.1 · `isbot` 5.2.2 · `cookie-es` 3.1.1

Прочитанный SPA-репозиторий (полностью, 2026-09-15): `/home/mm/git/stit-core/spa-frontend-template` —
`package.json`, `vite.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `tsconfig.json`, `tsr.config.json`,
`eslint.config.js`, `biome.json`, `steiger.config.ts`, `.size-limit.cjs`, `lefthook.yml`, `.commitlintrc.cjs`,
`index.html`, `public/config.js`, `.env.example`, `.env.local.example`, `.npmrc`, `.nvmrc`, `.dockerignore`,
`docker/{Dockerfile,nginx.conf,nginx-entrypoint.sh}`, `e2e/{playwright.config.ts,smoke.spec.ts}`,
все 60 файлов `src/**`, `docs/README.md`, `docs/reference/{architecture,deployment,observability}.md`,
`docs/stack/README.md`, `docs/stack/_templates/*.md`, `.claude/rules/*.md`,
`.claude/skills/{de-template,scaffold}/**`.
