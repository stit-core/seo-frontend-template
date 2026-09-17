# 01 — Выбор SSR-фреймворка для `ssr-frontend-template`

Дата исследования: **2026-09-15**. Все версии сверены с npm registry и `main`-веткой
исходников в день исследования.

---

## 1. TL;DR

1. **Рекомендация — TanStack Start** (`@tanstack/react-start` **1.168.54**, опубликован
   2026-09-14). Это единственный кандидат, который сохраняет *весь* стек SPA-шаблона
   без замены: тот же Vite 8, тот же `@tanstack/react-router` (Start = Router + SSR-обвязка),
   тот же file-based routing, те же loaders/`beforeLoad`, Query/Form/Zustand/Zod/Tailwind/
   Lingui/MSW/Vitest/Playwright/Biome/ESLint/Steiger — без изменений в идеологии.
2. **FSD-раскладка переносится 1:1 и конфигурируется официально** (проверено по исходнику
   схемы конфига плагина): `srcDirectory: 'src'`, `router.routesDirectory: 'pages'`,
   `router.generatedRouteTree: 'app/router/routeTree.gen.ts'`, а точки входа
   `start` / `router` / `client` / `server` переносятся в `src/app/` опциями
   `start.entry` / `router.entry` / `client.entry` / `server.entry`. Пути резолвятся
   **относительно `srcDirectory`**.
3. **SEO-фичи закрыты из коробки**: per-route `head()` с дедупом title/meta и наследованием,
   `links`/`scripts` (в т.ч. JSON-LD), корректные HTTP-статусы (`notFound()` → **404**,
   ошибка в loader → **500**, `redirect({ statusCode: 301 })`), `prerender` + `crawlLinks`,
   **встроенная генерация `sitemap.xml`** с per-page `priority`/`changefreq`/`lastmod`/
   `alternateRefs (hreflang)`, server routes для `robots.txt`/`healthz`.
4. **Найдено сильное SEO-преимущество**: в `renderRouterToStream` стоит `isbot(User-Agent)` —
   для краулеров сервер ждёт `allReady` и отдаёт **полный** HTML вместо стрима шелла
   (проверено по коду `@tanstack/react-router@1.170.36`).
5. **Селективный SSR — точно как в брифе**: `ssr: true | false | 'data-only' | (ctx) => …`
   на роуте, `defaultSsr` в `createStart()`, наследование «только строже», `shellComponent`
   для полностью клиентского root. Это даёт «один шаблон с переключателем рендера»
   без второго репозитория; плюс полноценный `spa.enabled` (prerender шелла `/_shell`).
6. **Деплой одним Node-образом — штатный**: `vite build` → `dist/client` + `dist/server`,
   запуск через `srvx` (srvx уже транзитивная зависимость Start). Альтернатива —
   плагин `nitro/vite` → `.output/server/index.mjs`, `node .output/server/index.mjs`.
7. **Кеш без CDN**: собственный «ISR» Start — это только `Cache-Control`-заголовки для CDN.
   Реальный серверный кеш даёт **Nitro `routeRules: { '/blog/**': { swr: 3600 } }`** —
   node-server-пресет кеширует полный ответ в своей storage. Это аргумент за сборку с Nitro,
   а не с голым srvx.
8. **Главный риск — статус RC**: v1 RC анонсирован 2025-09-23, и на 2026-09-15 docs на `main`
   по-прежнему пишут «currently in the **Release Candidate** stage». Стабильной 1.0 нет ~12 мес,
   вопрос об ETA в GitHub Discussions не отвечен. При этом релизы ежедневные, API объявлен
   стабильным, и номера пакетов уже `1.168.x`.
9. **Резервный вариант — React Router v8 framework mode** (`8.3.1`, мажор 2026-06-17,
   Vite `^7||^8`, годовой мажор-каденс). Зрелее по семверу, но роутер меняется целиком
   (`routes.ts`, `meta`/`headers`-экспорты), нет per-route SSR-переключателя и встроенного
   sitemap — реюз кода падает примерно вдвое.
10. **Astro уместен только для «чисто контентного» сайта** (блог/док/лендинг из Markdown,
    минимум интерактива). Для приложения с auth/формами/Query он ломает реюз почти полностью.

---

## 2. Findings

### 2.0 Что именно надо переиспользовать (перечитан код SPA-шаблона)

Прочитано: `vite.config.ts`, `tsr.config.json`, `tsconfig.json`, `package.json`,
`steiger.config.ts`, `eslint.config.js`, `vitest.config.ts`, `vitest.setup.ts`,
`.size-limit.cjs`, `index.html`, `src/app/**` (все файлы), `src/pages/{__root,index,login,profile}.tsx`,
`src/shared/config/index.ts`, `src/shared/api/client.ts`, `src/shared/i18n/index.ts`.

| Зона | Что в SPA | Судьба при Start |
|---|---|---|
| bundler | Vite 8.2.1 (Rolldown), `@tailwindcss/vite`, `@vitejs/plugin-react` + `babel-plugin-react-compiler` | **идентично**, добавляется `tanstackStart()` перед `viteReact()` |
| routing | `tanstackRouter()` из `@tanstack/router-plugin/vite`, `routesDirectory: src/pages`, `generatedRouteTree: src/app/router/routeTree.gen.ts`, `routeFileIgnorePrefix: '-'` | плагин `router-plugin` **убирается из vite.config** (Start включает генератор внутри себя), те же опции переезжают в `tanstackStart({ router: {…} })` |
| router | `createRouter(...)` — **модульный синглтон** `src/app/router/index.ts` | → **фабрика `getRouter()`** (обязательна: Start создаёт router на каждый SSR-запрос) |
| query | `queryClient` — **модульный синглтон** `src/app/providers/query.tsx` | → создаётся внутри `getRouter()`; провайдер даёт `setupRouterSsrQueryIntegration` |
| form | `@tanstack/react-form` | без изменений (Start даже знает о нём в `optimizeDeps`) |
| state | zustand + `persist` в localStorage (`features/theme`) | требует переделки: SSR не видит localStorage → тема/локаль из cookie + `ScriptOnce` |
| zod | рукописные контракты | без изменений; плюс `createServerFn().validator(schema)` |
| i18n | Lingui runtime-only, **глобальный синглтон `i18n`** | требует `setupI18n()` на запрос (см. 2.5) |
| styling | Tailwind v4, свой токен-слой | без изменений; бонус — `server.build.inlineCss` |
| mock | MSW Service Worker (браузер) + `msw/node` в тестах | браузерный воркер остаётся для клиентской навигации; на SSR нужен `setupServer` в серверном энтри (см. 2.5) |
| observability | `@sentry/react` 8.55 (dynamic import) + web-vitals | → `@sentry/tanstackstart-react` 10.74.0 (**beta**) |
| lint | Biome 2, ESLint 9 flat (boundaries по FSD, `no-restricted-imports`), Steiger 0.6 | без изменений; `consistent-type-imports: separate-type-imports` уже стоит — **это же и защита от verbatimModuleSyntax-утечки** |
| tests | Vitest 4 (happy-dom, vitest-axe), Playwright | Vitest остаётся для unit/component; loaders/head/статусы — надёжнее e2e |
| TS | TS 6 strict, `verbatimModuleSyntax: true` | **конфликт с рекомендацией Start** (см. 2.3.11) |
| budgets | size-limit по `dist/assets/*` | пути меняются на `dist/client/_build/assets/*` |
| runtime config | `/config.js` от nginx-entrypoint + `window.__APP_CONFIG__` | **исчезает**: конфиг читается на сервере из `process.env` и уезжает в клиент через loader root-роута |

---

### 2.1 Кандидаты: версии и зрелость (проверено 2026-09-15 через npm registry API)

| Пакет | latest | дата публикации | Node | peer Vite | peer React |
|---|---|---|---|---|---|
| `@tanstack/react-start` | **1.168.54** | 2026-09-14 | `>=22.12.0` | `>=7.0.0` (optional) | `>=18 \|\| >=19` |
| `@tanstack/react-router` | 1.170.36 | 2026-09-13 | `>=20.19` | — | `>=18 \|\| >=19` |
| `@tanstack/react-router-ssr-query` | 1.167.2 | 2026-08-26 | `>=20.19` | — | peer `@tanstack/react-query >=5.102.0` |
| `@tanstack/router-plugin` | 1.168.38 | 2026-09-13 | `>=20.19` | `>=5 \|\| >=6 \|\| >=7 \|\| >=8` | — |
| `@tanstack/nitro-v2-vite-plugin` | 1.155.2 | 2026-09-09 | `>=22.12` | `>=7.0.0` | — |
| `nitro` (v3) | **3.0.260903-beta** | 2026-09-03 | `^20.19 \|\| >=22.12` | — | — |
| `react-router` / `@react-router/dev` | **8.3.1** | 2026-08-28 | `>=22.22.0` | `^7.0.0 \|\| ^8.0.0` | `>=19.2.7` |
| `next` | **16.3.5** | 2026-09-11 | `>=20.9.0` | — (Turbopack) | `^18.2 \|\| ^19` |
| `astro` | **7.3.2** | 2026-09-08 | `>=22.12.0` | внутр. vite `^8.0.13` | — (через `@astrojs/react` 6.0.5) |
| `vike` | **0.4.266** | 2026-09-02 | `>=20.19.0` | `>=6.3.0` | — |
| `waku` | **1.0.0-rc.0** | 2026-08-25 | `^22.15 \|\| ^24 \|\| ^26` | внутр. | **`~19.2.4`** (жёсткий пин) |
| `vite` | **8.3.0** | 2026-09-10 | `^20.19 \|\| >=22.12` | — | — |
| `react` | **19.3.0** | 2026-09-09 | — | — | — |
| `@sentry/{tanstackstart-react,react-router,nextjs,astro,react}` | все **10.74.0** | 2026-09-09 | `>=18`…`>=20` | — | — |

**Семвер-зрелость за 12 мес** (стабильные релизы, без pre-тегов):

| Проект | релизов/12мес | мажоры за 12 мес | комментарий |
|---|---|---|---|
| TanStack Start | 443 | 0 (линия 1.x с 2025-02-25) | ежедневные патчи, но **официально всё ещё RC** |
| React Router | 34 | 1 (**8.0.0 — 2026-06-17**) | заявлен годовой мажор-каденс, breaking через future flags |
| Next.js | 83 | 1 (16.x, окт. 2025; 16.3 stable 2026-08-03) | Turbopack по умолчанию |
| Astro | 119 | **2** (6.0.0 — 2026-03-10, 7.0.0 — 2026-06-22) | быстрый мажор-темп |
| Vike | 144 | 0 (всё ещё **0.4.x**, линия с 2023-09) | 1.0 нет |
| Waku | 6 | — (`1.0.0-rc.0`) | RSC-first, пин React `~19.2.4` |

> Статус RC у Start — **проверено**: docs `main` (`docs/start/framework/react/overview.md`)
> буквально: «TanStack Start is currently in the **Release Candidate** stage! … feature-complete
> and its API is considered stable». Блог-пост «TanStack Start v1 Release Candidate» — 2025-09-23.
> GitHub Discussion #5999 «When is the Tanstack start stable release planned?» (01.12.2025,
> повтор 04.02.2026) — **ответа мейнтейнеров нет**.

---

### 2.2 Совместимость с версиями SPA-шаблона

- **Vite 8** — проверено: `@tanstack/react-start` peer `vite >=7.0.0`; примеры в репозитории
  Start используют `vite ^8.0.14`. Плюс Vite 8 даёт встроенный `resolve.tsconfigPaths: true`,
  что документировано в Start отдельно (`docs/start/.../path-aliases.md`).
- **React 19.2/19.3 + React Compiler 1.0** — проверено косвенно: в scratchpad-спайке pnpm
  успешно разрешил граф `@tanstack/react-start@1.168.54` + `vite@8.3.0` + `react@19.3.0` +
  `@vitejs/plugin-react@5.2.0` + `@tailwindcss/vite@4.3.3` + `babel-plugin-react-compiler@1.0.0` +
  `@tanstack/react-query@5.102.8` + `@tanstack/react-router-ssr-query@1.167.2`
  (файл `scratchpad/spike/pnpm-lock.yaml`). Отдельного «compiler support»-заявления в доках
  Start нет, но компилятор подключается штатно через babel-плагин `@vitejs/plugin-react`,
  который в Start обязателен и ставится **после** `tanstackStart()` — *предположение*,
  что ограничений нет; требует проверки в потоке-спайке.
- **TanStack Query 5.101.4 → нужен `>=5.102.0`** (peer у `@tanstack/react-router-ssr-query`).
  Мелкий, но обязательный bump. В доке Start также используется новый `queryClient.query(options)`
  (Query ≥5.102).
- **`@vitejs/plugin-react`**: SPA на `^5.0.0`; примеры Start — `^6.0.1`. Обе линии резолвятся
  с Vite 8 (peer у 5.2.0: `^4.2.0 || … || ^8.0.0`).
- **TypeScript 6** — примеры Start используют `typescript: npm:@typescript/typescript6@^6.0.2`;
  peer у `@react-router/dev` явно `^5.1 || ^6 || ^7`. Для Start peer TS нет — ограничений не видно.
- **Node 24** — ок (Start требует `>=22.12.0`).

---

### 2.3 TanStack Start — углублённый разбор

#### 2.3.1 Пакеты и плагин

```
@tanstack/react-start           1.168.54   (тянет react-router 1.170.36 сам)
@tanstack/react-router          1.170.36
@tanstack/react-router-ssr-query 1.167.2   (SSR-интеграция Query)
@tanstack/react-query          >=5.102.0
@tanstack/react-router-devtools 1.167.2
```

Плагин — `import { tanstackStart } from '@tanstack/react-start/plugin/vite'`
(**проверено**: экспорт `./plugin/vite` есть в манифесте пакета; есть и `./plugin/rsbuild`).
Порядок плагинов из доки: **`tanstackStart()` строго перед `viteReact()`**.

`tanstackStart()` уже содержит генератор роут-дерева (`tanstackRouterGenerator`) и
code-splitter из `@tanstack/router-plugin` — отдельно подключать `tanstackRouter()`
**не нужно** (проверено по `packages/start-plugin-core/src/vite/start-router-plugin/plugin.ts`).

#### 2.3.2 Нужен ли Nitro

Нет, **не обязателен**. Три варианта (все — из официальной доки `guide/hosting.md`):

| Вариант | Сборка | Запуск | Что даёт |
|---|---|---|---|
| Голый Vite | `vite build` → `dist/client` + `dist/server/server.js` | `srvx --prod -s ../client dist/server/server.js` | минимум зависимостей; `srvx` уже транзитивная зависимость Start (`srvx@0.11.22` в lock) |
| Nitro v3 (`nitro/vite`) | `vite build` → `.output/` | `node .output/server/index.mjs` | `routeRules` (кеш/SWR/редиректы/заголовки), пресеты, self-contained output |
| Nitro v2 (`@tanstack/nitro-v2-vite-plugin`) | — | — | пакет живой (1.155.2, 2026-09-09), но **в доках не упоминается**; актуальный путь — `nitro/vite` |

⚠️ `nitro` v3 на npm в `latest` — **бета** (`3.0.260903-beta`), и дока Start прямо предупреждает:
«The `nitro/vite` plugin … is still under active development». Это цена за `routeRules`.

Скрипт запуска из доки (Vite+Nitro): `"start": "node .output/server/index.mjs"`.
Опциональный твик: `globalThis.Response = FastResponse` из `srvx` в `src/server.ts` (~+5% throughput).

#### 2.3.3 Конвенции энтри-файлов и перенос в `src/app/` — **проверено по исходнику**

`packages/start-plugin-core/src/schema.ts` (ветка `main`):

```ts
srcDirectory: z.string().optional().default('src'),
start:  { entry?: string },
router: { entry?: string, basepath?: string } & <конфиг router-generator, partial>,
client: { entry?: string, base?: string /* default '/_build' */ },
server: { entry?: string, build: { staticNodeEnv: true, inlineCss: false } },
serverFns: { base: '/_serverFn', disableCsrfMiddlewareWarning: false, generateFunctionId? },
pages: Page[], sitemap?: {…}, prerender?: {…}, spa?: {…}, dev: {…}, importProtection?: {…}
```

и там же:

```ts
const routesDirectory   = path.resolve(root, srcDirectory, rawRouterOptions.routesDirectory   ?? 'routes')
const generatedRouteTree= path.resolve(root, srcDirectory, rawRouterOptions.generatedRouteTree ?? 'routeTree.gen.ts')
```

`packages/start-plugin-core/src/planning.ts` — энтри резолвятся **относительно `srcDirectory`**
с дефолтными базовыми именами: `start` (optional), `router` (**required**), `client` (optional),
`server` (optional).

⇒ FSD-раскладка настраивается полностью:

```ts
tanstackStart({
  srcDirectory: 'src',
  start:  { entry: 'app/start.ts' },
  router: {
    entry: 'app/router/index.tsx',
    routesDirectory: 'pages',                       // → <root>/src/pages
    generatedRouteTree: 'app/router/routeTree.gen.ts', // → <root>/src/app/router/routeTree.gen.ts
    routeFileIgnorePrefix: '-',
  },
  client: { entry: 'app/client.tsx' },
  server: { entry: 'app/server.ts' },
})
```

Важные ограничения, найденные в схеме: Start **отбирает** у пользователя опции
`autoCodeSplitting` и `target` (`tsrConfig = configSchema.omit({ autoCodeSplitting, target })`).
Опция `routeTreeFileFooter` доступна (она из `router-generator/src/config.ts`).

#### 2.3.4 `pnpm gen` (`tsr generate`) — придётся убрать

Start дописывает в `routeTree.gen.ts` **футер** (`start-router-plugin/route-tree-footer.ts`):

```ts
import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'      // если есть src/start.ts
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}
```

плюс прунит server-only-поддеревья (`pruneServerOnlySubtrees`). Голый `tsr generate`
такого не сделает ⇒ `tsr.config.json` и `@tanstack/router-cli` из шаблона **удаляются**,
скрипт `gen` либо исчезает, либо становится `vite build --mode=gen`-эквивалентом.
Побочный плюс: ручной `declare module '@tanstack/react-router' { interface Register … }`
в `src/app/router/index.ts` **больше не нужен** — Register генерируется.

#### 2.3.5 `__root.tsx` как document-shell

```tsx
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [...], links: [...], scripts: [...] }),
  shellComponent: RootShell,     // всегда SSR, оборачивает component/errorComponent/notFound
  component: RootComponent,
  notFoundComponent: …, errorComponent: …,
})
```

`<HeadContent />` — обязателен в `<head>`, `<Scripts />` — в `<body>`.
Дедуп: `title` и `meta` по `name`/`property` перекрываются **последним** вхождением вниз
по дереву роутов ⇒ наследование мета из root в страницы работает как надо.
`<HeadContent assetCrossOrigin="anonymous" />` — для CORS-атрибутов на preload/stylesheet.

Для темы без FOUC есть `<ScriptOnce children={…} />` — инлайн-скрипт, который выполняется
до гидрации и сам себя удаляет из DOM; плюс `suppressHydrationWarning` на `<html>`.
Это прямой ответ на `features/theme` (`data-scheme` на `<html>`).

#### 2.3.6 Селективный SSR — **точный API проверен**

- `ssr: true` (дефолт) — `beforeLoad` + `loader` + рендер компонента на сервере.
- `ssr: false` — ничего из этого на сервере.
- `ssr: 'data-only'` — `beforeLoad`/`loader` на сервере, компонент — только на клиенте.
- `ssr: (ctx) => …` — функция, получает валидированные `params`/`search` как discriminated union
  `{status:'success', value} | {status:'error', error}`; **выполняется только на сервере
  и вырезается из клиентского бандла**.
- Глобальный дефолт — `createStart(() => ({ defaultSsr: false }))` в `src/start.ts`.
- **Наследование только в сторону ужесточения**: `true → 'data-only' → false`; ребёнок не может
  ослабить родителя.
- Для первого роута с `ssr !== true` сервер рендерит `pendingComponent` (или
  `defaultPendingComponent`), на клиенте фолбэк держится минимум `minPendingMs`.
- Полностью клиентский root — через `shellComponent` (`<html>`-шелл всегда SSR-ится).

#### 2.3.7 SPA-режим (`spa.enabled`)

Схема (`spaSchema`): `enabled` (default `true`, если объект передан), `maskPath` (default `/`),
`prerender` с дефолтами `outputPath: '/_shell'`, `crawlLinks: false`, `retryCount: 0`.
Билд дополнительно пререндерит **только root-роут** → статический `/_shell.html`,
все 404 переписываются на него. `useRouter().isShell()` — для кастомизации шелла.
Есть пример в репозитории — `examples/react/start-basic-static` (`spa` + `sitemap` + `prerender`
одновременно). Зрелость: документировано подробно, есть e2e-пример ⇒ идея
«**один шаблон, переключатель рендера**» технически поддержана.

#### 2.3.8 Prerender / SSG / sitemap

`prerender`: `enabled`, `autoSubfolderIndex`, `autoStaticPathsDiscovery`, `concurrency` (14),
`crawlLinks` (default `true`), `filter({path})`, `retryCount`, `retryDelay`, `maxRedirects`,
`failOnError`, `onSuccess({page, html})`, `headers`.
`pages: [{ path, prerender: { enabled, outputPath }, sitemap: {…} }]`.

Автодискавери исключает роуты с параметрами (`$id`), pathless-layout (`_`) и роуты без компонента.

`sitemap: { enabled (default true), host, outputPath (default 'sitemap.xml') }`; per-page
`sitemap`: `exclude`, `priority` (0..1), `changefreq`, `lastmod`, **`alternateRefs: [{href, hreflang}]`**,
`images`, `news`. Это готовый каркас для SEO-канона (hreflang для ru/en!).

⚠️ В `guide/isr.md` в примерах фигурирует `prerender.routes: ['/blog', '/blog/posts/*']` —
**такой опции в схеме нет** (`packages/start-plugin-core/src/schema.ts`). Это ошибка в доке;
реально нужны `pages[]` + `crawlLinks` + `filter`.

#### 2.3.9 Серверные примитивы, статусы, cookies

Из `@tanstack/react-start/server` (проверено по `.d.ts` `@tanstack/start-server-core@1.169.35`):

```
getRequest(), getRequestHeaders(), getRequestHeader(name),
getRequestIP({xForwardedFor}), getRequestHost({xForwardedHost}), getRequestUrl(), getRequestProtocol()
setResponseHeader/setResponseHeaders/getResponseHeader(s)/removeResponseHeader/clearResponseHeaders
getResponseStatus(), setResponseStatus(code, text?), getResponse()
getCookies(), getCookie(name), setCookie(name, value, opts), deleteCookie(name, opts)
useSession/getSession/updateSession/sealSession/unsealSession/clearSession  (шифрованные cookie-сессии)
getValidatedQuery(standardSchema)
```

`getRequestIP({xForwardedFor:true})` / `getRequestHost({xForwardedHost:true})` — прямо
для работы за Traefik.

**HTTP-статусы (проверено по коду `@tanstack/router-core` `load-server.js` + `renderRouterToStream.js`):**

- `notFound()` → терминальный boundary со `status: 404`;
- брошенная ошибка в loader → `status: 500`;
- иначе `200`;
- `redirect({ to, statusCode })`, **дефолт 307**, `301`/`308` задаются явно; `headers` поддерживаются;
- статус кладётся в `new Response(stream, { status: router._serverResult.status })`.

`notFound({ headers, routeId, data, throw })` — можно добавить заголовки к 404.

**Server routes** прямо в роут-файле:

```ts
// src/pages/robots[.]txt.ts
export const Route = createFileRoute('/robots.txt')({
  server: { handlers: { GET: async () => new Response(txt, { headers: { 'Content-Type': 'text/plain' } }) } },
})
```

и `headers: () => ({ 'Cache-Control': … })` на обычных страничных роутах.

#### 2.3.10 Server functions, middleware, CSRF

- `createServerFn({ method }).validator(schema).handler(async ({data}) => …)` — типобезопасный RPC,
  base-путь `/_serverFn` (конфигурируем).
- `createMiddleware().server(async ({next}) => { const r = await next(); r.response.headers.set(…); return r })`.
- `src/start.ts`: `createStart(() => ({ requestMiddleware: [...], functionMiddleware: [...], defaultSsr, serverFns: {…} }))`.
- **CSRF**: если `src/start.ts` **нет** — Start ставит CSRF-мидлварь для server functions
  автоматически. Если `src/start.ts` есть — нужно явно
  `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })`
  (проверяет `Sec-Fetch-Site`/`Origin`/`Referer`), иначе dev-warning
  (глушится `serverFns.disableCsrfMiddlewareWarning: true`).
  ⚠️ Это **вторая** CSRF-схема поверх текущей `X-CSRF-Token` из cookie в `shared/api/client.ts` —
  надо решить, какая где действует (server fn vs прямые вызовы Go-бэкенда).
- Контроль окружения: `createServerOnlyFn`, `createClientOnlyFn`, `createIsomorphicFn().server().client()`,
  `<ClientOnly fallback>`, `useHydrated()`, суффиксы `*.server.ts` / `*.client.ts`
  и маркер-импорты `import '@tanstack/react-start/server-only'`.
- **Import protection** (экспериментально, включено по умолчанию): в dev — `mock` + warning,
  в build — `error`. Денаит `**/*.server.*` в клиенте и `@tanstack/react-start/server`.
  Type-only импорты игнорируются.

**Критично про loaders**: «Route `loader`s are **isomorphic** — они выполняются и на сервере,
и в браузере при навигации». Нельзя класть в loader `process.env` — только через server fn.

#### 2.3.11 `verbatimModuleSyntax` — конфликт с текущим tsconfig

Дока `build-from-scratch.md` прямо: «Enabling `verbatimModuleSyntax` can result in server bundles
leaking into client bundles. It is recommended to keep this option disabled.»
Механизм: при `verbatimModuleSyntax` инлайновый `import { type X, y } from './db.server'`
сохраняет реальный импорт модуля.

**Митигация, а не отказ**: в `eslint.config.js` уже стоит
`'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }]`
— он превращает все типовые импорты в отдельные `import type {…}`, которые стираются полностью.
Плюс Start-овская import protection ловит остаток на build. ⇒ Предлагаю **оставить
`verbatimModuleSyntax: true`** и зафиксировать это как осознанное отклонение от рекомендации,
с обязательным `pnpm check` (lint + build) как гейтом. Это решение владельца.

#### 2.3.12 SSR-интеграция TanStack Query

```tsx
// src/app/router/index.tsx
export function getRouter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent', defaultPreloadStaleTime: 0 })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}
```

Дока прямо предупреждает: «Create the client inside `getRouter`, not at module scope.
Start creates a router for each SSR request. A process-wide QueryClient could reuse one
reader's cached data in another reader's HTML.» Интеграция сама даёт провайдер + дегидрацию +
стриминг; свой провайдер — через `wrapQueryClient: false`.
Приватные ответы — `headers: () => ({ 'Cache-Control': 'private, no-store' })`.

#### 2.3.13 Streaming, isbot, nonce/CSP

- `defaultStreamHandler` → `renderRouterToStream` → `renderToReadableStream`/`renderToPipeableStream`
  с `progressiveChunkSize: Number.POSITIVE_INFINITY`.
- **`isbot(request.headers.get('User-Agent'))` → `await stream.allReady`** — ботам отдаётся
  полный HTML. Для Яндекса/Google это ровно то, что нужно.
- **Nonce**: `createRouter({ ssr: { nonce } })` (тип есть в `router-core` `RouterOptions.ssr.nonce`),
  передаётся в React (`nonce:` в опциях renderToStream) и применяется `HeadContent`
  к инлайновым `<style>` (в т.ч. при `inlineCss`) и к скриптам гидрации.
  ⇒ CSP без `unsafe-inline` возможна; nonce генерируется в request middleware и кладётся в router.
- `head().scripts` / `routeOptions.scripts` / `<ScriptOnce>` — все инлайны получают nonce.

#### 2.3.14 Runtime config без nginx-entrypoint

Официальный рецепт (`guide/environment-variables.md#runtime-client-environment-variables-in-production`):
server function читает `process.env` **внутри handler** и отдаёт значение через loader;
клиент получает его из дегидрированных данных.

Для шаблона: `src/pages/__root.tsx` получает `loader`, который зовёт
`getPublicRuntimeConfig` (`createServerFn`), парсит `RuntimeConfigSchema` из `process.env`
и возвращает **только публичные** поля. `shared/config` перестаёт быть модульным синглтоном
и становится: на сервере — `process.env` per request, на клиенте — root loader data.
⚠️ Всё, что попадёт в этот объект, уезжает в HTML — фильтровать явно (правило `env-local`
уже это требует).

Отдельно: `server.build.staticNodeEnv` (default `true`) статически подставляет `NODE_ENV`
в серверный бандл; при `false` обязательно выставлять `NODE_ENV=production` в контейнере.

#### 2.3.15 i18n-роутинг

Встроенного локале-роутинга нет. Варианты:
1. **Префикс в путях** — `src/pages/$locale/…` (обычный path param) + `beforeLoad`, который
   валидирует локаль и активирует per-request `setupI18n`. Самый прозрачный для SEO
   (`/ru/...`, `/en/...`) + `alternateRefs` в sitemap.
2. **`rewrite: { input, output }`** в `createRouter` (`LocationRewrite` в `router-core`) —
   для схем вида поддомен→путь; описано в `docs/router/guide/url-rewrites.md`.
3. Пример в репозитории — `examples/react/start-i18n-paraglide` (Paraglide, `urlPatterns` с
   локализованными путями, cookie `PARAGLIDE_LOCALE`). Для Lingui аналога нет ⇒ пишем сами.

---

### 2.4 Деплой одним Node-образом в compose/Traefik без CDN

**Форма билда (голый Vite)** — проверено по `output-directory.ts`
(`build.outDir ?? 'dist'` + `/client` и `/server`) и по `package.json` примера
`start-basic-react-query`:

```
dist/
  client/           ← статика; ассеты под client.base = /_build/
    _build/assets/*.js|css
  server/server.js  ← fetch-handler
```

Запуск: `srvx --prod -s ../client dist/server/server.js`.

**Форма билда (Nitro)**: `.output/server/index.mjs` + `.output/public`,
запуск `node .output/server/index.mjs`.

**Черновик Dockerfile** (замена nginx-стадии):

```dockerfile
# stage build — как сейчас (node:24-alpine, corepack pnpm, --mount=type=secret,id=npmrc)
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/.output ./.output
EXPOSE 8080
HEALTHCHECK --interval=30s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
USER node
CMD ["node", ".output/server/index.mjs"]
```

`/healthz` — server route `src/pages/healthz.ts` (`server.handlers.GET` → 200).
Traefik-лейблы и middlewares (`crowdsec@file,secure-headers@file,rate-limit@file`) не меняются;
маршрутизация по сабдомену остаётся. Проксирование `/api` — как в SPA, через `API_BASE_URL`,
но теперь ещё и **серверные** запросы к бэкенду идут по внутреннему адресу
(`http://backend:8080`) — нужен раздельный `API_BASE_URL_SERVER` / `API_BASE_URL_CLIENT`.

**Кеширование без CDN** (важный вывод):

- «ISR» в доках Start — это **только** `Cache-Control`/`CDN-Cache-Control` заголовки,
  делегируемые CDN. Без CDN они не дают ничего, кроме браузерного кеша.
- Traefik OSS **не умеет** HTTP-кеш.
- Рабочий вариант — **Nitro `routeRules`**: `{'/blog/**': { swr: 3600 }}`
  (= `cache: { swr: true, maxAge: 3600 }`). node-server-пресет кеширует **полный ответ**
  в своей storage; по истечении TTL отдаётся stale, а страница регенерируется в фоне.
  Есть `cache.sendCacheControl: false` — «server-only caching», без анонса кеша наружу.
  ⚠️ Дефолтная storage — память процесса ⇒ при нескольких репликах кеш не общий (нужен Redis).
- Плюс — максимум статики через `prerender` + `crawlLinks` (для контентных страниц это вообще
  снимает вопрос).

⇒ **Для SEO-сайта без CDN рекомендуется сборка с `nitro/vite`**, несмотря на бета-статус
пакета `nitro`. Fallback — `srvx` + prerender + `Cache-Control` (без серверного кеша).

---

### 2.5 Что ломается при переносе (синглтоны и браузерные API)

| Что | Почему ломается на сервере | Решение |
|---|---|---|
| `export const router = createRouter(...)` | один router на процесс ⇒ смешение состояний запросов | `export function getRouter()` |
| `export const queryClient = new QueryClient()` | кеш одного пользователя утечёт в HTML другого (прямая цитата из доки) | создавать внутри `getRouter()`; `setupRouterSsrQueryIntegration` |
| `i18n` — глобальный синглтон `@lingui/core` | `i18n.activate(locale)` — процессный ⇒ гонка локалей между запросами | `setupI18n({ locale, messages })` на запрос (экспорт есть в `@lingui/core`), инстанс в router context → `<I18nProvider i18n={…}>` |
| `runtimeConfig = readConfig()` на модуле | `window` undefined; `process.env` на модуле запрещён (edge + утечка) | server fn + root loader (2.3.14) |
| zustand `persist` (localStorage) в `features/theme` | localStorage нет; тема на сервере неизвестна ⇒ hydration mismatch | тема/локаль в cookie, читается `getCookie` в request middleware; `<ScriptOnce>` ставит `data-scheme` до гидрации; `suppressHydrationWarning` на `<html>` |
| `document.cookie` в `shared/api/client.ts` (`readCookie('csrf_token')`) | `document` нет | `createIsomorphicFn().server(() => getCookie(...)).client(() => document.cookie…)` |
| MSW: `startMockWorker()` из `msw/browser` в `app/init.ts` | Service Worker не работает на сервере ⇒ SSR-запросы уйдут в реальный API | на сервере `setupServer(...buildHandlers(db,false))` из `msw/node` в `src/app/server.ts`, под `import.meta.env.DEV`/`API_MODE==='mock'`; БД `@mswjs/data` — модульный синглтон на процесс, персист в localStorage заменить на память/файл. Официальной доки «Start + msw/node» нет — **предположение**, требует спайка |
| `import.meta.env.DEV && <Devtools/>` | ок, но devtools в `__root` должны быть внутри `<body>` перед `<Scripts/>` | как в примере `start-basic-react-query` |
| `.size-limit.cjs` пути `dist/assets/*` | билд теперь `dist/client/_build/assets/*` (или `.output/public/_build/...`) | обновить пути; бюджет считать по клиентскому бандлу |
| `index.html` + `public/config.js` | Start генерирует документ из `__root.tsx` | `index.html` удаляется, `config.js`/nginx-entrypoint — тоже |
| `tsr.config.json`, `@tanstack/router-cli`, `pnpm gen` | Start сам генерит дерево + футер | удалить (см. 2.3.4) |

**Линт/архитектура:** `steiger.config.ts` и `eslint.config.js` переносятся почти без правок.
Нужно: добавить в Steiger-исключения новые файлы `src/app/{start.ts,server.ts,client.tsx}`
(сегмент-правило для `src/app/**` уже отключено), а в ESLint-ignore — новый путь
`routeTree.gen.ts` (он там же). Роуты-«эндпоинты» (`healthz.ts`, `robots[.]txt.ts`,
`sitemap[.]xml.ts`) лягут в `src/pages/` плоскими файлами — как сейчас `login.tsx`/`profile.tsx`,
т.е. в уже существующий паттерн; семантически «API-роут в слое pages» — тема для решения владельца.

**Тесты:** отдельной доки по Vitest у Start нет (единственное упоминание — unit-тесты
server functions в `guide/authentication.md`). Практический вывод: unit/component-тесты
остаются как есть (happy-dom + vitest-axe), а **loaders / `head()` / HTTP-статусы / robots /
sitemap проверяются e2e** — у Start есть готовый образец: e2e-набор примера
`start-next-migration` проверяет ровно «public HTML, server-rendered metadata, redirects,
missing pages, sitemap entries, private response caching». `guide/production-checklist.md` —
готовый чек-лист, который можно превратить в e2e-спеки.

**Sentry:** `@sentry/tanstackstart-react@10.74.0` — официальный, но **beta**
(«compatible with TanStack Start 1.0 RC and is currently in beta»). Проверенные имена API:
`instrument.client.ts` (+ первый импорт в `client.tsx`), `instrument.server.mjs` в корне,
`wrapFetchWithSentry` в `src/server.ts`, `sentryTanstackStart` из
`@sentry/tanstackstart-react/vite`, `Sentry.tanstackRouterBrowserTracingIntegration(router)`,
`sentryGlobalRequestMiddleware` / `sentryGlobalFunctionMiddleware` в `src/start.ts`.
Условная инициализация «только при непустом DSN» (как сейчас в SPA) потребует переделки:
`instrument.*` — это top-level side-effect модули.

---

### 2.6 Альтернативы — детально

**React Router v8 framework mode (8.3.1, 2026-08-28; мажор v8 — 2026-06-17).**
Плюсы: настоящий стабильный семвер с заявленным годовым мажор-каденсом и future-flag-механикой;
peer `vite ^7 || ^8`, TS `^6 || ^7`, React `>=19.2.7`; официальный
`@sentry/react-router@10.74.0` (peer `react-router 7.x || ^8.x`); Node-деплой из коробки
(`@react-router/serve` на express, или свой сервер). Минусы для нас:
роутер меняется целиком — `routes.ts`-конфиг (или `@react-router/fs-routes`), экспорты
`loader`/`clientLoader`/`meta`/`headers` вместо объекта route options, свои `Link`/`Form`;
TanStack Query используется, но без `setupRouterSsrQueryIntegration`;
**`ssr` — глобальный флаг в `react-router.config.ts`, per-route переключателя нет**
(только `prerender()` и `clientLoader`); встроенной генерации sitemap нет.
v8 — ESM-only, middleware включён по умолчанию, `react-router-dom` удалён.

**Next.js 16.3.5.** Максимальная зрелость и SEO-инструментарий (Metadata API, ISR «по-настоящему»,
`@sentry/nextjs`), но: Turbopack вместо Vite, App Router вместо TanStack Router, RSC-модель,
свой формат конфигов и деплоя. Реюз SPA-шаблона — минимальный (останутся Zod/Zustand/Tailwind/
Lingui/MSW и куски `entities`/`shared`). Плюс максимальный lock-in и наибольшее расхождение
с SPA-шаблоном — «родственность» шаблонов, ради которой всё затевается, теряется.

**Astro 7.3.2 (React islands, `output: 'server'`, `@astrojs/node` 11.1.5).**
Лучший выбор **только** для контент-сайта: content collections, острова, минимум JS,
отличный SEO по умолчанию. Но страницы пишутся в `.astro`, роутинг астровский, TanStack Router
внутри острова = клиентский роутинг (SSR страниц теряется). Реюз — только `shared/*`-утилиты
и токен-слой. Плюс темп мажоров: 6.0 (2026-03-10) и 7.0 (2026-06-22) за полгода.
**Когда всё-таки Astro**: сайт ≈ статический контент (блог, документация, продающий лендинг —
т.е. ровно ниша будущего `landing-template`), интерактива мало, приложенческого auth нет.

**Vike 0.4.266.** Vite-нативный, гибкий, SSR/SSG/SPA по страницам, но: **0.x спустя годы**,
144 релиза за 12 мес, собственная файловая маршрутизация `+Page.tsx`/`+config.ts` —
реюз `src/pages` из TanStack Router невозможен, официальной интеграции с TanStack Router нет.

**Waku 1.0.0-rc.0 (2026-08-25).** RSC-first, peer React **`~19.2.4`** (жёсткий пин, конфликт с
react 19.3.0), 6 релизов за год, требует `react-server-dom-webpack`. Для продакшн-шаблона рано.

**Ручной Vite SSR (Environment API) + TanStack Router.** Технически возможно: у роутера есть
`renderRouterToStream`/`renderRouterToString`/`RouterServer`/`RouterClient`/`createRequestHandler`.
Но `docs/router/guide/ssr.md` прямо предупреждает: «these can be subject to change and should
be regarded as **experimental until Start reaches stable status**» — т.е. риск тот же, что у Start,
а руками придётся делать всё: статусы, prerender, sitemap, manifest ассетов, server functions,
CSRF, nonce. Экономически бессмысленно.

---

## 3. Матрица решений

Веса: реюз SPA-стека **30**, SEO **20**, зрелость/риск **15**, деплой одним Node-образом
без CDN **15**, тесты/линт/FSD **10**, AI-friendliness доков **5**, отсутствие lock-in **5**.
Оценки 1–5.

| Кандидат | Реюз·30 | SEO·20 | Зрелость·15 | Деплой·15 | Тесты/FSD·10 | Доки·5 | Lock-in·5 | **Σ (из 500)** |
|---|---|---|---|---|---|---|---|---|
| **TanStack Start 1.168** | 5 (150) | 5 (100) | 3 (45) | 4 (60) | 4 (40) | 5 (25) | 4 (20) | **440** |
| React Router v8 fw | 2 (60) | 4 (80) | 5 (75) | 5 (75) | 4 (40) | 4 (20) | 4 (20) | **370** |
| Manual Vite SSR + TSR | 5 (150) | 3 (60) | 2 (30) | 4 (60) | 3 (30) | 2 (10) | 5 (25) | **365** |
| Next.js 16 | 1 (30) | 5 (100) | 5 (75) | 4 (60) | 3 (30) | 5 (25) | 2 (10) | **330** |
| Astro 7 + React | 1.5 (45) | 5 (100) | 3 (45) | 5 (75) | 3 (30) | 4 (20) | 3 (15) | **330** |
| Vike 0.4 | 2.5 (75) | 4 (80) | 2 (30) | 4 (60) | 3 (30) | 3 (15) | 3 (15) | **305** |
| Waku 1.0-rc | 1 (30) | 4 (80) | 1 (15) | 3 (45) | 2 (20) | 2 (10) | 3 (15) | **215** |

Комментарии к оценкам:
- *Реюз* у Start = 5, потому что меняется **обвязка**, а не слои `entities`/`features`/`widgets`/`shared`
  и не библиотеки; у RR v8 = 2, потому что переписывается весь слой `pages` + `app/router`.
- *SEO* у RR v8 = 4 (нет встроенного sitemap и per-route `ssr`), у Start/Next/Astro = 5.
- *Зрелость* у Start = 3 из-за RC-статуса длиной в год (компенсируется темпом релизов и
  тем, что версии уже 1.168.x, а не 0.x).
- *Деплой* у Start = 4, а не 5, потому что для реального серверного кеша без CDN нужен
  бета-`nitro`.

---

## 4. Рекомендации для шаблона

### 4.1 Вердикт

- **Брать TanStack Start** (`@tanstack/react-start ^1.168.54`) с билдом **через `nitro/vite`**.
- **Запасной вариант**: React Router v8 framework mode — если владелец сочтёт RC-статус
  блокирующим для клиентских проектов. Переход Start → RR v8 позже дороже, чем наоборот
  (в Start уходит «свой» роутер).
- **Astro** — не для этого шаблона; зарезервировать под `landing-template` из публичного роадмапа.

### 4.2 Пакеты (черновик diff к `package.json`)

```jsonc
// dependencies: добавить
"@tanstack/react-start": "^1.168.54",
"@tanstack/react-router-ssr-query": "^1.167.2",
"@tanstack/react-query": "^5.102.0",     // bump с ^5.62 — peer требования ssr-query
// devDependencies: добавить
"nitro": "3.0.260903-beta",              // или srvx, если без Nitro
"@sentry/tanstackstart-react": "^10.74.0",
"@vitejs/plugin-react": "^6.0.1",        // bump с ^5
// удалить
"@tanstack/router-cli", "@tanstack/router-plugin",   // Start включает генератор
"@sentry/react"                                        // заменяется на tanstackstart-react
// scripts
"dev": "vite dev",
"build": "vite build && tsc --noEmit",
"start": "node .output/server/index.mjs",
"gen": <удалить>
```

### 4.3 `vite.config.ts` (черновик)

```ts
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },   // Vite 8 — встроенный резолв paths из tsconfig
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: 'src',
      start:  { entry: 'app/start.ts' },
      router: {
        entry: 'app/router/index.tsx',
        routesDirectory: 'pages',                        // <root>/src/pages
        generatedRouteTree: 'app/router/routeTree.gen.ts',
        routeFileIgnorePrefix: '-',
      },
      client: { entry: 'app/client.tsx' },
      server: { entry: 'app/server.ts' },
      prerender: { enabled: true, crawlLinks: true, failOnError: true },
      sitemap: { enabled: true, host: process.env.PUBLIC_ORIGIN ?? 'https://example.com' },
      pages: [{ path: '/', sitemap: { priority: 1, changefreq: 'daily' } }],
    }),
    nitro(),                                    // routeRules/SWR-кеш без CDN
    react({ babel: { plugins: [['babel-plugin-react-compiler', { compilationMode: 'infer' }]] } }),
  ],
})
```

*Черновик, не проверен сборкой.* Порядок `tanstackStart()` → `react()` — из доки (обязателен).

### 4.4 Раскладка `src/` (FSD сохраняется)

```
src/app/
  start.ts            createStart({ requestMiddleware: [nonce, locale/theme из cookie, csrf, sentry], defaultSsr: true })
  client.tsx          hydrateRoot(document, <StrictMode><StartClient/></StrictMode>) + import './instrument.client'
  server.ts           createServerEntry({ fetch }) (+ wrapFetchWithSentry, + msw/node в mock-режиме)
  router/index.tsx    getRouter(): QueryClient + createRouter + setupRouterSsrQueryIntegration + ssr.nonce
  router/routeTree.gen.ts   (генерируется Start, с футером Register)
  providers/i18n.tsx  I18nProvider с per-request инстансом Lingui
  styles/index.css
src/pages/
  __root.tsx          head() + shellComponent(<html><head><HeadContent/>…<body>{children}<Scripts/>) + loader(runtime config)
  index.tsx login.tsx profile.tsx todos.tsx
  healthz.ts          server.handlers.GET → 200
  robots[.]txt.ts     server.handlers.GET
  sitemap[.]xml.ts    (только если нужен динамический; иначе — встроенная генерация)
src/widgets|features|entities|shared/   без структурных изменений
```

Файлы, исчезающие из шаблона: `index.html`, `public/config.js`, `docker/nginx.conf`,
`docker/nginx-entrypoint.sh`, `tsr.config.json`, `src/app/main.tsx`, `src/app/init.ts`
(его содержимое расходится по `start.ts`/`client.tsx`/`server.ts`).

### 4.5 Правила/доки, которые надо завести или переписать

- Новое правило `.claude/rules/ssr-boundaries.md`: «никаких модульных синглтонов с
  пользовательским состоянием»; перечень (`router`, `queryClient`, `i18n`, `runtimeConfig`,
  zustand-store), API-контроля окружения (`createServerOnlyFn`/`createIsomorphicFn`/`ClientOnly`/
  `useHydrated`/`*.server.ts`), запрет `process.env` на модульном уровне, «loader изоморфен».
- Правило `env-local` переписывается: build-time `VITE_*` остаётся, «runtime через
  `window.__APP_CONFIG__` + nginx» заменяется на «runtime через `process.env` в server fn →
  root loader; в HTML уезжает только whitelisted-набор».
- Правило `tests-pipeline`: добавить секцию «SEO/SSR e2e» (статусы 200/301/404/500,
  наличие title/description/canonical в «сыром» HTML до JS, `robots.txt`, `sitemap.xml`,
  `Cache-Control` на приватных страницах) — по образцу `guide/production-checklist.md`.
- `docs/stack/` — кандидаты на новые kinds `rendering` (ssr/ssg/spa-матрица по роутам,
  `defaultSsr`, prerender/sitemap) и `seo` (канон title/description/canonical/hreflang/JSON-LD,
  noindex на staging). *Смежные потоки 02 и 05 — за ними финальное решение.*
- `docs/reference/deployment.md` переписывается полностью (Node-образ вместо nginx).

### 4.6 Черновик `src/app/start.ts`

```ts
import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import { getCookie, getRequestHeader } from '@tanstack/react-start/server'

// Nonce на запрос: без него CSP придётся держать unsafe-inline.
const securityMiddleware = createMiddleware().server(async ({ next }) =>
  next({ context: { nonce: crypto.randomUUID().replaceAll('-', '') } }),
)

// Тема и локаль — из cookie: иначе SSR не знает, что рендерить, и будет hydration mismatch.
const prefsMiddleware = createMiddleware().server(async ({ next }) =>
  next({
    context: {
      scheme: getCookie('app.scheme') === 'dark' ? 'dark' : 'light',
      locale: getCookie('app.locale') ?? getRequestHeader('accept-language')?.slice(0, 2) ?? 'ru',
    },
  }),
)

export const startInstance = createStart(() => ({
  defaultSsr: true,
  requestMiddleware: [securityMiddleware, prefsMiddleware,
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })],
}))
```

*Черновик; точная форма `next({ context })` для request-middleware взята из
`guide/hydration-errors.md` и `guide/middleware.md`.*

---

## 5. Риски и открытые вопросы

**Риски**

1. **RC-статус Start длиной в год.** Стабильной 1.0 нет, ETA не озвучен. Митигация:
   пиннинг точных версий в `package.json` (не `^`), `pnpm check` в pre-push, renovate с
   ручным апрувом, и явная запись в `docs/stack/dependencies.md`.
2. **`nitro` v3 в `latest` — бета**, и дока Start сама просит репортить баги. Митигация:
   стартовать на голом `srvx` (простой и стабильный), а `nitro` включать только когда
   понадобится серверный SWR-кеш; переключение — одна строка в `vite.config.ts` и
   `CMD` в Dockerfile.
3. **`@sentry/tanstackstart-react` — beta.** Fallback: ручная схема из
   `guide/observability.md` (`@sentry/react` на клиенте + `@sentry/node` в
   `defineHandlerCallback`), она стабильна.
4. **Import protection — experimental**, а именно на неё завязана защита от утечки
   серверного кода при `verbatimModuleSyntax: true`.
5. **MSW на сервере** — единственный крупный узел без официальной документации под Start.
   Возможен вариант «mock только в браузере + отдельный mock-бэкенд контейнер для SSR».
6. **Два CSRF-механизма** (Start-овый Origin/Referer для server fn и `X-CSRF-Token`
   для Go-бэкенда) — риск расхождения с `go-backend-template`.
7. **Кеш Nitro в памяти процесса** — при масштабировании репликами нужен Redis;
   в текущей модели «один VPS = одна среда» это не проблема, но надо записать.
8. **`sitemap.host` и canonical нужны абсолютные URL** — значит домен должен быть известен
   на билде (или canonical считать из `getRequestHost({xForwardedHost:true})` в рантайме).
   Первое проще, второе честнее для «одного образа на все среды». **Вопрос владельцу.**

**Открытые вопросы владельцу**

1. **Один шаблон с переключателем рендера или два репозитория?** Технически Start закрывает
   оба режима (`defaultSsr` + `spa.enabled`), т.е. можно сделать *один* `ssr-frontend-template`,
   умеющий и SPA. Но тогда судьба существующего `spa-frontend-template` (nginx-образ, лёгкий
   бандл, отсутствие Node в рантайме) — под вопрос. Моя рекомендация: **оставить два шаблона**,
   SSR-шаблон форкнуть от SPA и держать «родственным», а `spa.enabled` — как опцию внутри
   SSR-шаблона для админок.
2. **`verbatimModuleSyntax`** — оставляем `true` вопреки рекомендации Start (с защитой
   через `separate-type-imports` + import protection) или выключаем?
3. **Nitro сразу или позже?** (влияет на форму Dockerfile и на `docs/stack/runtime.md`)
4. **Схема i18n-URL**: `/ru/...` + `/en/...` префиксы (лучше для SEO и `hreflang`)
   или одна локаль на деплой (проще)?
5. **Имя форка** — `<org>/site`? Тогда `docs/stack/service.md` и `/release`-скилл надо
   расширить полем `surface: web` и новым дефолтом имени образа.

**Что проверить дальше (поток-спайк)**

- Реальный `vite build` на Vite 8.3 + React 19.3 + Compiler 1.0 + TS 6: собирается ли,
  что в `dist/client/_build`, не ломает ли компилятор `shellComponent`.
- `msw/node` внутри серверного энтри Start (dev и prod-бандл).
- Работает ли Lingui `setupI18n` per-request вместе с `@lingui/react` без глобального `i18n`.
- Размер клиентского бандла Start против текущих бюджетов (150 KB gzip initial) —
  вероятно, придётся поднять.
- Поведение `notFound()`/`redirect(301)` через Traefik + CrowdSec.

---

## 6. Источники

Документация и исходники TanStack (ветка `main`, прочитаны 2026-09-15):

- https://github.com/TanStack/router/blob/main/docs/start/framework/react/overview.md — статус RC
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/build-from-scratch.md — `tanstackStart()`, `verbatimModuleSyntax`
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/selective-ssr.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/spa-mode.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/static-prerendering.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/seo.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/isr.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/hosting.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/middleware.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/server-functions.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/server-routes.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/server-entry-point.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/client-entry-point.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/execution-model.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/environment-variables.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/hydration-errors.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/import-protection.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/css-styling.md — `ssr.nonce`, inlineCss
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/tanstack-query.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/path-aliases.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/production-checklist.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/observability.md
- https://github.com/TanStack/router/blob/main/docs/start/framework/react/migrate-from-next-js.md
- https://github.com/TanStack/router/blob/main/docs/router/guide/document-head-management.md
- https://github.com/TanStack/router/blob/main/docs/router/guide/ssr.md — «experimental until Start reaches stable»
- https://github.com/TanStack/router/blob/main/packages/start-plugin-core/src/schema.ts — схема опций плагина
- https://github.com/TanStack/router/blob/main/packages/start-plugin-core/src/planning.ts — резолв энтри
- https://github.com/TanStack/router/blob/main/packages/start-plugin-core/src/resolve-entries.ts
- https://github.com/TanStack/router/blob/main/packages/start-plugin-core/src/vite/output-directory.ts
- https://github.com/TanStack/router/blob/main/packages/start-plugin-core/src/start-router-plugin/route-tree-footer.ts
- https://github.com/TanStack/router/blob/main/packages/react-start/src/plugin/vite.ts
- https://github.com/TanStack/router/blob/main/packages/router-generator/src/config.ts
- https://github.com/TanStack/router/tree/main/examples/react/start-basic-react-query — эталон Query+SSR
- https://github.com/TanStack/router/tree/main/examples/react/start-basic-static — spa+sitemap+prerender
- https://github.com/TanStack/router/tree/main/examples/react/start-i18n-paraglide
- https://github.com/TanStack/router/tree/main/examples/react/start-next-migration — nitro/vite
- пакеты npm (tarball-инспекция `.d.ts`/`.js`): `@tanstack/router-core@1.171.x`
  (`router.d.ts` → `ssr.nonce`; `route.d.ts` → `ssr`, `headers`; `load-server.js` → 404/500;
  `redirect.d.ts` → `statusCode` default 307; `not-found.d.ts`),
  `@tanstack/react-router@1.170.36` (`ssr/renderRouterToStream.js` → isbot + nonce + status),
  `@tanstack/start-server-core@1.169.35` (`request-response.d.ts`, `session.d.ts`)

Прочее:

- https://tanstack.com/blog/announcing-tanstack-start-v1 — RC, 2025-09-23
- https://github.com/TanStack/router/discussions/5999 — вопрос об ETA стабильной 1.0 без ответа
- https://registry.npmjs.org/ — версии и даты публикаций всех пакетов из таблицы 2.1
- https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/ — статус beta
- https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/ — API
- https://nitro.build/docs/cache — `routeRules`, `swr`, `cache.sendCacheControl`
- https://nitro.build/docs/routing
- https://nuxt.com/docs/guide/concepts/rendering — поведение SWR на node-server-пресете
- https://reactrouter.com/changelog + https://www.infoq.com/news/2026/08/react-route-v8/ — v8 (2026-06-17), ESM-only, middleware по умолчанию, Node 22.22+/React 19.2.7+/Vite 7+
- https://raw.githubusercontent.com/remix-run/react-router/main/docs/start/framework/rendering.md — глобальный `ssr`, `prerender()`
- https://nextjs.org/blog/next-16 , https://nextjs.org/blog/next-16-3-turbopack
- https://vike.dev/ — 0.4.266, `+Page.js`-роутинг
