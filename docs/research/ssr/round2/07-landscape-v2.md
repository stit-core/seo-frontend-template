# 07 — Ландшафт фреймворков для контент-first индексируемых сайтов (раунд 2)

Поток **07-landscape-v2**. Дата: **2026-09-16**. Веса и профиль — из `brief-v2.md`,
решения владельца — из `ROUND2-CONTEXT.md` (имя шаблона зафиксировано: `ssr-frontend-template`).
Это переоценка раунда 1 по новым критериям, а не его продолжение: критерий «реюз
SPA-стека» (вес 30) заменён на «качество выдачи» (25) + «контент-пайплайн» (15).

---

## 1. TL;DR

1. **Рекомендация — Astro 7.x** (`astro@7.3.2`, `@astrojs/node@11.1.5`, `mode: 'standalone'`).
   Σ **437,5 / 500** против 355 у Nuxt и 347,5 у Next — разрыв в 17 % шкалы, не пограничный результат.
2. **Главная новость раунда: дыра Astro закрыта.** В **Astro 7.0 появился стабильный
   серверный кеш HTML** — `cache: { provider: memoryCache() }` + `routeRules` с
   `maxAge`/`swr`/`tags`, императивный `Astro.cache.set/invalidate`, заголовок
   `X-Astro-Cache: HIT|MISS|STALE`, ключ без cookie/UA и с авто-вырезанием `utm_*`.
   Это ровно требование `14` §2.2.4 п.1 — и **без беты**, в отличие от TanStack Start
   (нужен `nitro@3.0.x-beta`) и SolidStart 2 (весь деплой делегирован тому же beta-Nitro).
3. **FSD ложится на Astro лучше, чем считалось**: `src/pages` = маршруты **совпадает** с
   FSD-слоем pages (как в SPA-шаблоне), `_`-префикс даёт колокацию не-маршрутов,
   `src/components`/`src/layouts` — «not required», автоимпортов нет. Цена — гейт
   переезжает на **ESLint 10** (`eslint-plugin-astro` ≥2.0.0 требует `eslint >= 10`).
4. **Топ-3: Astro 437,5 · Nuxt 4.5.2 — 355 · Next 16.3.5 — 347,5** (SvelteKit 2.70.3 — 322,5).
   Nuxt и Next разделяют 7,5 балла — это шум: Nuxt берёт SEO-инструментарием (единственный
   с sitemap+robots+schema-org+og-image+link-checker+hreflang и runtime `NUXT_SITE_URL`),
   Next — зрелостью (единственная письменная LTS-политика).
5. **Лучше Astro для контент-first без CDN нет никого.** SvelteKit чище по «нолю JS» на
   маршрут (`csr = false` буквально не эмитит `start.js`), но у него **ноль SEO-инструментария**
   (слова `canonical`/`hreflang` — 0 вхождений во всём корпусе доков) и ноль контент-слоя.
   Eleventy легче всех, но у него нет серверного слоя вообще.
6. **Измерено локально** (одинаковая статическая страница, gzip):
   Eleventy 3.1.6 — **0 Б JS**; SolidStart 2.0.5 — **15,3 КБ**; Qwik 2.0.0-beta.43 —
   **42,7 КБ** (из них 38,6 КБ — ядро через `modulepreload` на странице без единого
   обработчика); React Router 8.4.0 — **106,9 КБ**. Разница между HTML-first и
   SPA-рантаймом — два порядка.
7. **Аномалия Qwik в HTTP Archive объяснена**: агрессивный preloader («By default, Qwik
   will prefetch any event handlers on the page») + признанный баг over-preloading
   (PR #8984: «the homepage preloaded ~3 600 JS bundles»), фикс #9005 **всё ещё открыт**.
   Байты качаются, но не исполняются — отсюда хороший CWV при медиане JS 2823 КБ.
8. **Выбывают**: Fresh (Deno-only, на npm `fresh` — чужой пакет); Qwik 2 (beta в `latest`,
   **официальных доков на v2 не существует** — qwik.dev документирует Qwik 1); SolidStart 2
   (GA есть, но нет прод-сервера, метаданных, sitemap, i18n, image, MDX и островов —
   `experimental.islands` типизирован литералом `false`); Hono+JSX (конструктор, не фреймворк
   сайта); Eleventy (эталон измерения, не кандидат — v4 в alpha + ребрендинг в Build Awesome Pro).
9. **TanStack Start падает с 1-го места раунда 1 на 7-е** (287,5): критерий, по которому он
   побеждал, исключён из весов, а эмпирика `06` («prerender не отдаётся Node-сервером»,
   «`vite build` не даёт сервера») бьёт ровно в новый профиль. Поле: 23,4 % good CWV — худший
   показатель во всей выгрузке HTTP Archive.
10. **Дополнительный spike не нужен** — топ-3 совпал с набором спайков второго раунда.
    Вместо него — два целевых часовых эксперимента внутри `spike-astro/`: (а) кеш
    `memoryCache()` + `routeRules` на реальном standalone-сервере; (б) гейт ESLint 10 +
    Steiger на FSD-дереве с `_`-колокацией.
## 2. Findings по кандидатам

Пометки: **[П]** — проверено по первоисточнику с URL и датой; **[П~]** — проверено
косвенно (вторичный источник / вывод из кода пакета); **[?]** — предположение;
**[изм]** — измерено мной на этой машине 2026-09-16 (каталог `scratchpad/bench/`).

Все версии сверены через npm registry API 2026-09-16
(`curl -s https://registry.npmjs.org/<pkg>` → `dist-tags` + `time`), скрипт —
`scratchpad/bench/npmver.py`.

### 2.0 Сводка версий и релизной дисциплины (проверено 2026-09-16)

| пакет | `latest` | дата | стаб. релизов / 12 мес | мажоров / 12 мес |
|---|---|---|---|---|
| `astro` | **7.3.2** | 2026-09-08 | 119 | **2** (6.0 — 2026-03-10, 7.0 — 2026-06-22) |
| `@astrojs/node` | 11.1.5 | 2026-08-31 | 31 | 2 (10.0, 11.0 — синхронно с ядром) |
| `@astrojs/mdx` | 8.0.1 | 2026-09-08 | 31 | **4** (5.0, 6.0, 7.0, 8.0) |
| `@astrojs/sitemap` | 3.7.4 | 2026-08-31 | 7 | 0 |
| `nuxt` | **4.5.2** | 2026-08-05 | 30 | 0 (4.0 — 2025-07-16) |
| `@nuxt/nitro-server` → `nitropack` | 4.5.2 → **2.13.4** | 2026-04-29 | 8 | 0 |
| `@nuxt/content` | 3.16.0 | 2026-08-27 | 16 | 0 |
| `@nuxtjs/seo` | 5.3.16 | 2026-09-12 | 37 | 0 |
| `@nuxtjs/i18n` | 10.6.0 | 2026-07-30 | 11 | 0 |
| `@sveltejs/kit` | **2.70.3** | 2026-08-18 | 82 | **0** (линия 2.x с 2023-12) |
| `svelte` | 5.57.0 | 2026-08-28 | 120 | 0 |
| `@sveltejs/adapter-node` | 5.5.7 | 2026-06-24 | 10 | 0 |
| `@solidjs/start` | **2.0.5** | 2026-09-10 | 10 | **1** (2.0.0 — **2026-08-04**) |
| `solid-js` | 1.9.15 | 2026-08-17 | 6 | 0 |
| `@qwik.dev/core` / `@qwik.dev/router` | **2.0.0-beta.43** | 2026-09-01 | **0** | — (beta в dist-tag `latest`) |
| `@builder.io/qwik-city` (линия 1) | 1.20.0 | 2026-05-22 | 9 | 0 |
| `next` | **16.3.5** | 2026-09-11 | 93 | 1 (16.0 — **2025-10-21**) |
| `react-router` / `@react-router/dev` | **8.4.0** | 2026-09-15 | 58 / 51 | 1 (8.0 — 2026-06-17) |
| `@tanstack/react-start` | 1.168.54 | 2026-09-14 | 443 | 0 (**официально RC**) |
| `@11ty/eleventy` | **3.1.6** | 2026-06-02 | **2** | 0 (canary `4.0.0-alpha.10`, 2026-07-01) |
| `hono` | 4.13.8 | 2026-09-15 | 69 | 0 |
| `nitro` (v3) | 3.0.260903-beta | 2026-09-03 | 1 | — (beta в `latest`) |
| `vite` | 8.3.0 | 2026-09-10 | 54 | 1 (8.0 — 2026-03-12) |

Тулинг гейта (проверено 2026-09-16):
`eslint` **10.10.0** · `@biomejs/biome` **2.5.14** · `vitest` **5.0.1** ·
`@playwright/test` **1.63.0** · `size-limit` **14.0.0** · `steiger` 0.6.0 +
`@feature-sliced/steiger-plugin` 0.7.0 · `eslint-plugin-astro` **3.2.0** ·
`eslint-plugin-svelte` 3.23.0 · `eslint-plugin-vue` 10.11.0 · `@astrojs/check` 0.9.10 ·
`svelte-check` 4.7.6 · `vue-tsc` 3.3.11 · `sharp` 0.35.4 · `typescript` 7.0.2 (SPA на 6.0.3).

**Важное для гейта [П]**: `eslint-plugin-astro` с версии **2.0.0 (2026-06-22)** требует
`eslint >= 10.0.0`; последняя совместимая с ESLint 9 — `1.7.0` (2026-04-07). То есть
Astro в шаблоне ⇒ гейт переезжает на **ESLint 10** (это текущий latest, не экзотика).
`eslint-plugin-svelte` (peer `^8.57.1 || ^9 || ^10`) и `eslint-plugin-vue`
(peer `^8.57 || ^9 || ^10`) такого перехода не требуют.

### 2.1 Astro 7.3.2 — главный кандидат

#### 2.1.1 Серверный кеш HTML без CDN — **закрыт из коробки, стабильно**

Это была главная дыра Astro в раунде 1 (`14` §2.2.4 п.1: «Не встроено: Astro, SvelteKit —
пишется руками»). **В Astro 7.0 она закрыта.** Проверено по
https://docs.astro.build/en/guides/caching/ (2026-09-16), фича помечена
«introduced in Astro 7.0.0», отдельного experimental-флага нет
(https://docs.astro.build/en/reference/experimental-flags/ — route caching там отсутствует;
экспериментальны только **CDN-провайдеры** адаптеров).

Дословный конфиг из доки **[П]**:

```js
import { defineConfig, memoryCache } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  adapter: node({ mode: 'standalone' }),
  cache: { provider: memoryCache() },
});
```

Декларативные правила по маршрутам **[П]**:

```js
routeRules: {
  '/api/[...path]':      { swr: 600 },
  '/products/[...slug]': { maxAge: 3600, tags: ['products'] },
  '/blog/[...slug]':     { maxAge: 300, swr: 60 },
}
```

Императивный API: `Astro.cache` в `.astro`, `context.cache` в endpoint/middleware
**[П]** (https://docs.astro.build/en/reference/cache-provider-reference/):

- `cache.set({ maxAge, swr, tags, lastModified, etag })` — мерж с config-правилами,
  скаляры last-write-wins, `tags` аккумулируются, `lastModified` — самая свежая;
- `await cache.invalidate({ tags: ['data'] })` / `{ path: '/api/data' }` —
  **это и есть вебхук-инвалидация из `14` §2.2.5**, отдельного `revalidateTag()` нет;
- `cache.enabled`, `cache.options`, `cache.tags`.

`memoryCache({ max = 1000, query: { sort = true, include, exclude } })` — встроенный
**LRU в памяти процесса**; `query.exclude` по умолчанию режет `utm_*`, `fbclid`,
`gclid`, `gbraid` и ещё ~11 трекинговых параметров — то есть **нормализация ключа
кеша по канону I-19/I-20 сделана за нас**. Ключ = путь + нормализованный query,
учитывается `Vary`, **кроме `Cookie`** — ровно требование `14` §2.2.4 п.1
(«без cookie/UA в ключе»).

Заголовок ответа — **`X-Astro-Cache: HIT | MISS | STALE`** **[П]** (не `X-Cache`;
это надо знать для smoke-теста).

Ловушка **[П]**: в dev-режиме `cache.enabled === false` — «the cache API is available so
that route code does not need conditional checks, but no actual caching occurs».
Тестировать только `astro build && astro preview` / прод-сервером.

⇒ Требование `14` §2.2.4 п.1 у Astro 7 закрыто **без беты** — в отличие от TanStack Start,
которому для того же нужен `nitro@3.0.x-beta`.

#### 2.1.2 `@astrojs/node` 11.1.5 — одним Node-процессом

**[П]** https://docs.astro.build/en/guides/integrations-guide/node/:

| опция | тип | дефолт | с версии |
|---|---|---|---|
| `mode` | `'middleware' \| 'standalone'` | — | — |
| `staticHeaders` | `boolean` | `false` | 10.0.0 (**уже не `experimental`**) |
| `experimentalDisableStreaming` | `boolean` | `false` | 9.3.0 |
| `bodySizeLimit` | `number` | `1073741824` | 10.0.0 |

- `standalone`: `node ./dist/server/entry.mjs` поднимает HTTP-сервер, **сам отдаёт
  страницы, endpoints, prerender-HTML и статику из `dist/client/`**; `dist/client/_astro/**`
  автоматически получает `Cache-Control: public, max-age=31536000, immutable` **[П]** —
  канон P-15 закрыт без nginx.
- Порт/хост — env `HOST` / `PORT` **[П]**. HTTPS — `SERVER_KEY_PATH`/`SERVER_CERT_PATH`
  (в проде не нужен, за Traefik).
- `experimentalDisableStreaming: true` закрывает канон P-3 (стриминг во вред соц-краулерам),
  но дока предупреждает: «In most cases, disabling streaming is not recommended».
- **Нет graceful shutdown и нет healthcheck-эндпоинта** — ни опции, ни раздела в доке
  **[П, отсутствие]**. Оба пишутся самим (см. §5.1).

#### 2.1.3 Контент-пайплайн

**[П]** https://docs.astro.build/en/guides/content-collections/ и
https://docs.astro.build/en/reference/modules/astro-content/:

- конфиг — `src/content.config.ts` (build-time) и `src/live.config.ts` (live);
- лоадеры: `glob({ pattern, base, generateId })`, `file(path, { parser })`,
  **кастомные лоадеры (Content Loader API) — для CMS/API**;
- запросы `getCollection` / `getEntry` / `getEntries` / `reference` / `render(entry)`
  (последний отдаёт `<Content/>` + `headings`);
- **Live collections стабильны с Astro 6.0** (`defineLiveCollection`, `getLiveCollection`,
  `getLiveEntry`), требуют адаптер; в 7.0 live-лоадеры умеют отдавать cache-хинты с
  `tags` и `lastModified` — **стыкуются с route caching** (это и есть «CMS + SWR» из `14` §2.1);
- **Zod — версия 4**: «`import { z } from "astro/zod"` … supports all of the features of
  Zod 4» **[П]** https://docs.astro.build/en/reference/modules/astro-zod/. Свой `zod`
  ставить не нужно — и это важно: SPA-шаблон на `zod@4.4.3`, контракты переносятся 1:1;
- **`src/content/` не обязателен** — единственный зарезервированный каталог `src/pages/`;
  `base` лоадера указывает куда угодно, т.е. **контент можно положить в
  `src/entities/post/content/`** ровно как требует спецификация spike'а;
- кеш — `.astro/data-store.json`; в 7.1.0 появился экспериментальный
  `collectionStorage: 'single-file' | 'chunked' | { chunkSize }` **[П]**.

Требование `14` §2.2.6 («Markdown компилируется на билде, на запрос — только склейка»)
выполняется по построению: content layer строит data-store на билде.

#### 2.1.4 SEO-инструментарий

| канон | Astro 7 | пометка |
|---|---|---|
| I-4 честный 404 | `Astro.response.status = 404` / вернуть `Response`; `src/pages/404.astro`; `Astro.rewrite()` на 404 **только для on-demand** роутов (иначе ошибка `invalid-rewrite404`) | **[П]** |
| I-5/I-6 trailing slash | `trailingSlash: 'ignore' \| 'always' \| 'never'`, дефолт `'ignore'`; в 7.0 появился композируемый хендлер `trailingSlash()` в `astro/fetch` | **[П]** |
| I-7 canonical | хелпера нет; `Astro.url` (per-request) + `Astro.site` (**build-time**) | **[П]** |
| I-9/I-10 robots.txt | своего нет — endpoint `src/pages/robots.txt.ts` | **[П, отсутствие]** |
| I-11 sitemap | `@astrojs/sitemap` 3.7.4: `entryLimit` 45000, шардинг, `filter`, `customPages`, `serialize`, **`i18n` → `<xhtml:link rel="alternate" hreflang>`**. **Только build-time**, требует `site`; «This integration cannot generate sitemap entries for dynamic routes in SSR mode» | **[П]** — **главное ограничение**, см. §5.1 |
| I-4/редиректы | `redirects` в конфиге, **дефолт 301**; объектная форма `{ status: 302\|307\|308, destination }` — только с адаптером; в static-билде вместо статусов пишется `meta refresh` | **[П]** |
| `Astro.redirect(path, status?)` | есть, статус вторым аргументом | **[П]** api-reference |
| L-1…L-5 i18n | `i18n: { defaultLocale, locales, routing: { prefixDefaultLocale: false, redirectToDefaultLocale } }`; `astro:i18n`: `getRelativeLocaleUrl`, `getAbsoluteLocaleUrl(+List)`, `getPathByLocale`, `getLocaleByPath`, `notFound()`, `middleware()`; `Astro.currentLocale`, `Astro.preferredLocale` | **[П]** |
| L-3 hreflang в `<head>` | **хелпера нет** — писать самим через `getAbsoluteLocaleUrlList()` | **[П, отсутствие]** |
| P-7/P-8 шрифты | **Fonts API стабилен с Astro 6.0**: топ-левел `fonts` в конфиге + `import { Font } from "astro:assets"` с обязательным `cssVariable`; провайдеры local/Fontsource/Google/Adobe/Bunny/Fontshare/NPM; preload и fallback-метрики — автоматом; кеш `_astro/fonts` | **[П]** https://docs.astro.build/en/guides/fonts/ |
| P-9/P-10/P-11 картинки | `astro:assets`: `<Image>`, `<Picture formats widths densities>`, `getImage()`; **responsive images / `image.layout` стабильны с 5.10**; дефолтный сервис — `sharp` | **[П]** |
| M-3…M-6 OG | своего генератора нет; `astro-og-canvas` / satori — стороннее | **[П, отсутствие]** |
| RSS | `@astrojs/rss` 4.0.19 | **[П]** |

#### 2.1.5 Острова и «пол JS»

- Директивы `client:load | idle | visible | media | only`, `slot="fallback"` **[П]**.
- **`server:defer` (server islands) стабильны** (с Astro 5.0, в 7 без experimental-пометки).
  Механика: остров выносится в отдельный роут и забирается `GET`-запросом, пропсы
  шифруются в query. **Ловушка [П]**: лимит URL 2048 байт — при превышении Astro
  переключается на `POST`, а он не кешируется браузером.
- «Zero JS, by default» — заявление доков **[П]**
  (https://docs.astro.build/en/concepts/why-astro/), подкреплённое HTTP Archive (§2.9).
- `<ClientRouter />` (`astro:transitions`) — опциональный клиентский роутер;
  **размер бандла в доках не указан** **[П, отсутствие]**. Расхождение в доках: страница
  prefetch утверждает, что `<ClientRouter/>` включает `prefetchAll: true`, страница
  view-transitions этого не говорит **[?]** — для контент-шаблона проще **не включать**
  ClientRouter вовсе.
- Prefetch по умолчанию **выключен**; `prefetch: { defaultStrategy: 'hover' | 'tap' |
  'viewport' | 'load', prefetchAll }` + атрибут `data-astro-prefetch` **[П]**.

#### 2.1.6 FSD-совместимость — лучше, чем казалось

| вопрос | ответ | пометка |
|---|---|---|
| `srcDir` переназначается | да, `string`, дефолт `./src` | **[П]** |
| каталог маршрутов | **жёстко `<srcDir>/pages/`**, опции `pagesDir` нет | **[П]** |
| это конфликт с FSD? | **нет — это совпадение**: в SPA-шаблоне stit маршруты уже лежат в `src/pages` (`routesDirectory: 'src/pages'`), и FSD-слой `pages` = слой маршрутов | вывод |
| колокация не-маршрутов рядом со страницей | **есть**: «You can exclude pages or directories within `src/pages` from being built by prefixing their names with an underscore (`_`). Files with the `_` prefix won't be recognized by the router» | **[П]** https://docs.astro.build/en/guides/routing/ |
| `src/components`, `src/layouts` | **только конвенция**: «This is a common convention in Astro projects, but it is not required» → `widgets/`, `features/`, `entities/`, `shared/` живут свободно | **[П]** |
| автоимпорты | **нет**, всё импортируется явно (есть даже ошибка `no-matching-import`) | **[П]** |
| зарезервированные имена | `src/pages/`, `src/middleware.ts`, `src/content.config.ts`, `src/live.config.ts`, **`src/fetch.ts`** (новое в 7.0, имя меняется опцией `fetchFile`) | **[П]** |

Расхождение с `13` §2.4: там для Astro стояло «`[A]` файлы с префиксом `_` не становятся
маршрутами» — подтверждено дословно.

#### 2.1.7 Гейт: Biome / ESLint / Steiger / Vitest / TS

- **Steiger — формат-осведомлён.** Разбор поставляемого бандла
  `@feature-sliced/steiger-plugin@0.7.0` (файл `dist/index.js`, читано локально
  2026-09-16) **[П~]**: грузятся WASM-парсеры `tree-sitter-{tsx,svelte,astro,vue}.wasm`,
  для `.astro` стоит injection-запрос `(frontmatter_js_block) @tsx`, для `.svelte` —
  `(script_element (raw_text) @tsx)`, для `.vue` — `(document (script_element (raw_text) @tsx))`.
  ⇒ импорты **из** frontmatter `.astro` Steiger видит.
  **Ограничение [П~]**: резолвер `@feature-sliced/filesystem@3.1.0` — это
  `ts.resolveModuleName(...)`, то есть цель импорта `*.astro` / `*.svelte` / `*.vue`
  **не резолвится** (TypeScript такие расширения не знает) и ребро графа теряется.
  **Митигация, которая у нас уже есть по канону**: FSD-импорт идёт через `index.ts`
  слайса, а `index.ts` резолвится штатно. Deep-import в `.astro` ловится
  `no-restricted-imports` в ESLint (`@/*/*/*/*`), как и сейчас в SPA.
  ⚠️ Импорты внутри inline-`<script>` в шаблоне `.astro` Steiger **не** увидит
  (запрос только к frontmatter) — для контент-сайта это почти не встречается.
- **Biome 2.5.14**: `.astro`/`.vue`/`.svelte` — 🟡 experimental по всем трём осям
  (parsing/formatting/linting); полная поддержка — под флагом
  `html.experimentalFullSupportEnabled: true`. Markdown — «in progress», линта нет
  **[П]** https://biomejs.dev/internals/language-support/. Это **одинаково** для Astro,
  Nuxt и SvelteKit, аргументом «за/против» кандидата не является (совпадает с `13` п.11).
- **ESLint**: `eslint-plugin-astro@3.2.0` + `astro-eslint-parser@3.1.0`, требует
  **ESLint 10** (см. §2.0).
- **TS**: `astro check` (нужен `@astrojs/check` + `typescript`), пресет
  `astro/tsconfigs/strict`, `astro sync` генерит `.astro/types.d.ts` **[П]**.
- **Vitest — официальная позиция «да»**: хелпер `getViteConfig` из `astro/config`
  **[П]** https://docs.astro.build/en/guides/testing/. Компонентное тестирование
  `.astro` — только через **experimental_AstroContainer**, и он **всё ещё
  экспериментален в Astro 7**: «This API is experimental and subject to breaking
  changes, even in minor or patch releases» **[П]**
  https://docs.astro.build/en/reference/container-reference/. ⇒ реальный гейт:
  Vitest покрывает `shared/*`, схемы контента, seo-хелперы (`.ts`), а `.astro`-компоненты
  проверяются Playwright'ом (как и предписано `tests-pipeline` для страниц).

#### 2.1.8 Зрелость и риск: Cloudflare

**Первоисточники (проверено 2026-09-16):**

- https://astro.build/blog/joining-cloudflare/ (**16 января 2026**, Fred Schott):
  «The Astro Technology Company – the company behind the Astro web framework – is
  joining Cloudflare!»; «Astro stays open-source and MIT-licensed»; «We will continue
  to run our project in the open, with an open governance model for contributors» и
  «an open community roadmap that anyone can participate in»; «we will continue to
  support and improve deployments for all targets—not just Cloudflare»; «Cloudflare has
  a proven track record of supporting great open-source projects like Astro, TanStack,
  and Hono».
- https://blog.cloudflare.com/astro-joins-cloudflare/: «Astro will remain open source,
  MIT-licensed, and open to contributions, with a public roadmap and open governance»;
  «You can deploy Astro to any platform or cloud».
- https://www.cloudflare.com/press/press-releases/2026/cloudflare-acquires-astro-to-accelerate-the-future-of-high-performance-web-development/:
  «The Astro Technology Company team … will be joining Cloudflare»; «Astro will continue
  to be the best way for developers to build content-driven websites, **whether they
  host on Cloudflare or elsewhere**». Финансовые условия не раскрыты.

**Оценка риска.** Приобретена **компания** (юрлицо + штат), не лицензия: код остаётся
MIT, governance заявлен открытым. Практический индикатор в нашу пользу: именно в
Astro 7 CDN-провайдеры кеша (Netlify/Vercel/Cloudflare) сделаны **равноправными
экспериментальными плагинами поверх платформо-нейтрального ядра**, а дефолтный
провайдер — `memoryCache()`, то есть **self-host без CDN**. Это ровно противоположно
сценарию «фичи только для своего облака». Остаточный риск — среднесрочный (приоритеты
роадмапа могут дрейфовать к Workers); он **не блокирующий**, потому что:
(1) лицензия MIT необратима для уже выпущенного кода; (2) у нас нет ни одной
Cloudflare-зависимости; (3) миграционный путь из Astro (HTML-first, минимум JS)
дешевле, чем из RSC-фреймворка.

**Каденс и поддержка [П]** https://docs.astro.build/en/upgrade-astro/: «The Core team
will provide extended maintenance **for security fixes only** for one previous major
version». LTS в месяцах **не заявлен**. Интервал 6.0 → 7.0 = ~3,5 месяца — это самый
быстрый мажор-темп среди финалистов и **главный минус Astro**.

**Breaking changes 7.0, о которых обязан знать шаблон [П]**
https://docs.astro.build/en/guides/upgrade-to/v7/:
Vite 8 (Rolldown); компилятор переписан на Rust — «Unclosed tags now produce errors»,
невалидный HTML больше не чинится автоматически; `compressHTML: 'jsx'` — новый дефолт;
**новый дефолтный Markdown-процессор Sätteri (Rust)** — для remark/rehype-плагинов надо
ставить `@astrojs/markdown-remark` и настраивать unified явно (**это ломает привычную
remark-экосистему**); `src/fetch.ts` — зарезервированное имя; `@astrojs/db` удалён.

**AI-friendliness доков**: `llms.txt` у Astro **нет** (`docs.astro.build/llms.txt`,
`astro.build/llms.txt` → 404, проверено curl'ом 2026-09-16) — в отличие от Svelte,
Nuxt, Next.js, Solid, TanStack, Hono. Для агентной обвязки это минус, компенсируемый
тем, что доки Astro структурированы и версионированы по мажорам.
### 2.2 Nuxt 4.5.2 — лучший SEO-тулинг, худшая FSD-совместимость

#### 2.2.1 Какой Nitro внутри — **v2, не v3** (важно, это плюс)

Проверено по npm 2026-09-16: `nuxt@4.5.2` → зависимость `@nuxt/nitro-server@4.5.2` →
зависимость **`nitropack@^2.13.4`** + `h3@^1.15.11` + `unstorage@^1.17.5`.
То есть **Nuxt 4.5 стоит на стабильном Nitro v2**, а не на `nitro@3.0.x-beta`
(которому вынужден верить TanStack Start и на который делегирует деплой SolidStart 2).
Это единственный кандидат с **стабильным** серверным рантаймом, дающим `routeRules`.

⚠️ **Ловушка доков**: голый `https://nitro.build/...` уже отдаёт доки **Nitro v3 beta**.
Актуальные для Nuxt 4.5 — `https://v2.nitro.build/...`. Половина «фактов о Nitro» из
интернета сейчас относится не к тому Nitro, который у тебя в `node_modules`.

#### 2.2.2 Nuxt 5 на горизонте — главный риск

**[П]** https://nuxt.com/docs/4.x/community/roadmap: Nuxt 5 — статус **«Scheduled»**,
ожидаемый релиз **~Q4 2026**, «upgrade to Nitro v3 and additional changes».
Ветка `main` репозитория `nuxt/nuxt` — уже `5.0.0-0` (проверено по
`raw.githubusercontent.com/nuxt/nuxt/main/packages/nuxt/package.json`), разошлась с `4.x`
(1017 коммитов вперёд). Дерево доков `/docs/5.x/` уже опубликовано. В npm тега `5.x` нет.
Upgrade guide **[П]** https://nuxt.com/docs/5.x/getting-started/upgrade перечисляет
breaking changes: Nitro v3 (переписан на Web-стандартные `Request`/`Response`),
h3 v2 (`status`/`statusText` вместо `statusCode`/`statusMessage`), серверные импорты
переезжают в `nuxt/server`, есть compat-слой `nitroLegacy: true`.
LTS **[П]**: мажор поддерживается **минимум 6 месяцев** после выхода следующего;
Nuxt 3 EOL — 2026-07-31.

⇒ Выбрать Nuxt 4.5 сегодня = **запланировать миграцию серверного слоя шаблона
на горизонте одного-двух кварталов**. Для форкаемого шаблона, который потребители
не обновляют синхронно, это дороже, чем у остальных кандидатов.

#### 2.2.3 `routeRules` — кеш есть, инвалидации нет

Ключи **[П]** (https://nuxt.com/docs/4.x/guide/concepts/rendering, https://v2.nitro.build/config#routerules):
`prerender`, `ssr: false`, `swr: true|number`, `isr: true|number`, `cache: {…}`,
`redirect: string | { to, statusCode }` (дефолт **307**), `headers`, `cors`, `static`,
`proxy`, **`noScripts: true`**.

- `swr: N` == `cache: { swr: true, maxAge: N }`. Хранилище кеша по умолчанию в проде —
  **memory driver** (в dev — filesystem во временный каталог) **[П]**
  https://v2.nitro.build/guide/cache. Т.е. кеш живёт в памяти процесса, не переживает
  рестарт, не шарится между репликами. Для нашей модели «одна реплика, релиз = новый
  контейнер = пустой кеш» это ровно то, что нужно (`14` §2.2.5).
- **`isr` без CDN ≡ `swr`**: Nuxt-доки прямо оговаривают, что CDN-семантика `isr`
  работает «на платформах, которые это поддерживают (сейчас — Netlify или Vercel)» **[П]**.
- **Программной инвалидации в Nitro v2 нет** **[П]**: методов `.invalidate()`/`.expire()`
  не существует, они появились только в Nitro v3. В v2 — руками
  `useStorage('cache').removeItem(...)` либо `shouldInvalidateCache()`/`shouldBypassCache()`
  в `defineCachedEventHandler`. ⇒ вебхук-ревалидация из `14` §2.2.5 пишется вручную.
- Заголовок ответа кеша в **v2** дословно не задокументирован **[П, отсутствие]**
  (`x-cache: HIT|STALE|REVALIDATED|MISS` описан только в доках v3).
- Prerender: `nitro.prerender.{routes, crawlLinks, ignore, concurrency, failOnError,
  autoSubfolderIndex, retry}`; выход — `.output/public/`, **отдаётся самим Nitro-сервером**.
  Гибридный рендер (`routeRules` с разными режимами) **не работает** с `nuxt generate`,
  только с SSR-пресетами **[П]**.

#### 2.2.4 SEO — объективно самый полный пакет из коробки

`@nuxtjs/seo@5.3.16` — мета-модуль: sitemap, robots, schema-org, og-image, link-checker,
seo-utils. Это единственный кандидат, у которого **link-checker** (проверка битых
внутренних ссылок) и **schema-org** типизированы и идут в комплекте.

**Runtime site config — работает, и имя env другое, чем ожидалось** **[П]**
https://nuxtseo.com/site-config/getting-started/how-it-works:
переменная — **`NUXT_SITE_URL`** (+ `NUXT_SITE_NAME`), т.е. `runtimeConfig.public.site`.
Приоритет: системные дефолты → env CI-платформ → module overrides → ключ `site` в
`nuxt.config` → runtime config/env → хук `site-config:resolve`.
⚠️ **Не нашёл прямого ответа**, применяется ли runtime-override к уже пререндеренным
страницам **[?]**. По архитектуре (резолв в момент рендера) — нет: у prerender-страниц
canonical/OG заморожены на билде. То есть развилка `14` §2.2.2 у Nuxt **не снята**,
просто у SSR-ответов она решена элегантнее всех.

`nuxt-og-image@6.8.0`: дефолтный рендерер — **Satori**, рекомендуемый — **Takumi**
(в 2–10 раз быстрее), Chromium — **опциональный** путь. В прямых зависимостях есть
`chrome-launcher@^1.2.1`, и модуль умеет автоустанавливать Chromium при пререндере в CI.
⇒ **Для Docker-образа Chromium не обязателен**, если не выбирать Chromium-рендерер явно
**[П~]**; поведение автоустановки именно в non-CI node-server рантайме **не проверено** **[?]**.

`@nuxtjs/i18n@10.6.0`: `strategy: 'prefix_except_default'`, `useLocaleHead()` генерит
`<link rel="alternate" hreflang>` по всем локалям, есть `baseUrl` для абсолютных URL **[П]**.
Это закрывает L-1…L-5 канона целиком — единственный кандидат, у которого hreflang
из коробки в `<head>`, а не только в sitemap.

#### 2.2.5 Ноль JS

`routeRules: { '/': { noScripts: true } }` **[П]** https://nuxt.com/docs/4.x/guide/going-further/features —
убирает entry-скрипты, import map, инлайновый payload и JS resource hints; CSS остаётся;
страница **не гидрируется**; такие роуты всегда рендерятся не-стриминговым рендерером.
Гранулярность — **весь маршрут**, не компонент. `experimental.componentIslands` +
`<NuxtIsland>` + `.island.vue` — **экспериментальны** **[П]**; `.server.vue` — с 3.11,
статус «экспериментально» подтверждён только вторичным источником **[П~]**.

Поле: HTTP Archive 2026-08-01 — Nuxt.js **28,6 %** origin'ов с хорошими CWV на мобильных
при медианном JS **1053 КБ** (94 069 origin'ов). Это худший результат среди всех
контентных кандидатов и на порядок хуже Astro. Это не приговор фреймворку (медиана
отражает, что на Nuxt делают приложения, а не лендинги), но это честный сигнал
о «дефолтной траектории» проекта на Nuxt.

#### 2.2.6 FSD-совместимость — самая дорогая из всех

| проблема | деталь | пометка |
|---|---|---|
| `srcDir` по умолчанию **`app/`** в Nuxt 4 | прямой конфликт имён с FSD-слоем `app` (композиционный корень). Лечится `srcDir: 'src/app'` + `dir.*`, но это ремаппинг половины конвенций | **[П~]** |
| автоимпорты | `imports: { autoImport: false }` отключает (остаётся `#imports`); `imports: { scan: false }` — мягкий вариант. Отключение обязательно: канон требует explicit re-exports | **[П]** |
| любой `.vue` в `dir.pages` → маршрут | **ignore-префикса на уровне имени файла в 4.x официально не подтверждено** (dash-префикс документирован только для Nuxt 2). Колокация секций рядом со страницей — через `.nuxtignore` или хук `pages:extend` | **[П~]**, совпадает с `13` §2.4 («`[N]` любой `.vue` в `dir.pages` становится маршрутом») |
| контент в `content/` в корне проекта | вне `src/`, вне FSD-графа | **[П]** |
| Steiger | видит `<script setup>` (`(document (script_element (raw_text) @tsx))`), но не резолвит импорты **в** `.vue` | **[П~]** |

Следствие из `13` §2.4: секции лендинга придётся держать в `widgets/` даже при одном
референсе → конфликт со Steiger-правилом `insignificant-slice` → исключение в
`steiger.config`. Это уже зафиксированная цена, но она реальна.

### 2.3 SvelteKit 2.70.3 — лучший «ноль JS» на маршрут, худший SEO-тулинг

#### 2.3.1 Ноль JS — доказано и докой, и исходником

`export const csr = false` в `+page.js`/`+layout.js` **[П]**
https://svelte.dev/docs/kit/page-options: «Disabling CSR does not ship any JavaScript to
the client… `<script>` tags inside all Svelte components are removed». Проверено по
исходнику `@sveltejs/kit@2.70.3` (`src/runtime/server/page/render.js`): весь блок инжекта
клиента — modulepreload-линки, сериализованные данные, `app.start(...)` — внутри одного
`if (page_config.csr && client) { … }`. **`start.js` не эмитится вообще.**
Побочный эффект: при `csr = false` не работают streaming-промисы из server `load`.

Полезный паттерн из доков: `export const csr = dev;`
Режимы per route: `prerender = true | false | 'auto'` (**`'auto'` = пререндерить и при
этом остаться в манифесте динамического SSR** — идеально для «свежие посты статикой,
длинный хвост на сервере»), `ssr`, `csr`, `trailingSlash` (дефолт **`'never'`** — совпадает
с каноном I-6), `entries()` для динамических роутов.

#### 2.3.2 `adapter-node` 5.5.7 — самый зрелый Node-адаптер в подборке

**[П]** https://svelte.dev/docs/kit/adapter-node:
env `PORT` (3000), `HOST` (0.0.0.0), `SOCKET_PATH`, `ORIGIN`, `PROTOCOL_HEADER`,
`HOST_HEADER`, `PORT_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH` (1), `BODY_SIZE_LIMIT` (512K),
`SHUTDOWN_TIMEOUT` (30 c), `IDLE_TIMEOUT`, `KEEP_ALIVE_TIMEOUT`, `HEADERS_TIMEOUT`.
**`KEEP_ALIVE_TIMEOUT` прямо закрывает риск №9 отчёта `04`** (рассинхрон keep-alive
Node ↔ Traefik → спорадические 502) — у Astro такой ручки в доках нет.
Graceful shutdown автоматический (SIGTERM/SIGINT) + событие `process.on('sveltekit:shutdown')`
с async-хендлером.

Статику и prerender-HTML отдаёт сам (`sirv` с `etag: true`, pre-compressed gzip/brotli
при `precompress: true`). **Ловушка [П~]** (чтение `adapter-node@5.5.7/files/handler.js`):
`cache-control: public,max-age=31536000,immutable` ставится **только** на
`/${appPath}/immutable/*`; **prerendered HTML отдаётся вообще без `Cache-Control`**, только
с ETag. Для канона P-15 это почти то, что нужно (`no-cache`+ETag), но заголовок надо
дописать самому. `serve_prerendered()` делает **308** на нормализацию trailing slash.

Кастомный сервер — официальный шов для кеша HTML:
`import { handler } from './build/handler.js'` → `app.use(handler)` в Express/Polka.
⚠️ Дока предупреждает: при использовании `handler.js` в своём сервере **работают только
`ORIGIN`, `PROTOCOL_HEADER`, `HOST_HEADER`, `PORT_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH`,
`BODY_SIZE_LIMIT`**; `PORT`/`HOST`/`SHUTDOWN_TIMEOUT` и graceful shutdown придётся
реализовать самому. То есть «добавить кеш» = «потерять graceful shutdown, если не
переписать его руками».

Компрессия: доки рекомендуют `@polka/compression`, **не** `compression` — «SvelteKit
streams responses and the more popular `compression` package does not support streaming».

#### 2.3.3 Серверного кеша HTML нет — подтверждено

Grep по полному корпусу доков (`svelte.dev/llms-full.txt`, 1,18 МБ):
`stale-while-revalidate` — **0 вхождений**; «ISR» — только в `adapter-vercel`.
Швы: `setHeaders` в `load`, `event.setHeaders`, `hooks.server.js` `handle({event, resolve})`
(можно вернуть свой `Response`, не вызывая `resolve` — это точка read-through кеша).
⇒ кеш пишется руками целиком.

#### 2.3.4 SEO — самый большой разрыв

Grep по всему корпусу доков Svelte + SvelteKit + CLI: слова **`canonical` и `hreflang` —
0 вхождений**. Нет генератора sitemap (есть только пример `src/routes/sitemap.xml/+server.js`
руками), нет robots, нет OG-генератора, нет i18n-роутинга в ядре (делегирован Paraglide 2
через официальный аддон `npx sv add paraglide` с хуками `reroute`/`handle`).
Есть: `<svelte:head>`, `error(status, body)`, `redirect(status, location)` с типом
`300|301|302|303|304|305|306|307|308`, `+error.svelte`, `handleError`, плейсхолдеры
`%sveltekit.*%` в `app.html`.

`@sveltejs/enhanced-img@0.11.0` — хороший build-time пайплайн (AVIF/WebP, srcset,
авто `width`/`height`, strip EXIF, imagetools-директивы в query, `import.meta.glob` с
`query: { enhanced: true }`), но **принципиально не работает с динамическими путями**
(CMS/БД) — «can only optimize files located on your machine during the build process» **[П]**.

Контент-слой отсутствует: `mdsvex@0.12.8` (жив, релиз 2026-07-19, официальный аддон
`sv add mdsvex`) + `import.meta.glob` — весь рецепт.

#### 2.3.5 Формы без JS — эталон

Form actions работают без JavaScript by design **[П]**
https://svelte.dev/docs/kit/form-actions: «we built a `/login` action that works without
client-side JavaScript — not a `fetch` in sight». `use:enhance` — прогрессивное улучшение.
Это ровно то, что нужно `/contact` из спецификации spike'а.
`remote functions` (`query`/`form`/`command`/`prerender` из `$app/server`) — с 2.27,
**experimental**, требуют двух флагов и **вне semver**: «These are not subject to semantic
versioning, so breaking changes or removal can happen in any release» **[П]**.

#### 2.3.6 FSD-совместимость — работает, но с тегом `@deprecated`

- **Роутятся только файлы с префиксом `+`** (`+page`, `+layout`, `+server`, `+error`);
  «Any other files inside a route directory are **ignored by SvelteKit**» **[П]** ⇒
  колокация свободна без всяких префиксов-исключений. Это лучшая колокация в подборке.
- `kit.files.routes: 'src/pages'` работает. История **[П]**: в 2.29.0 (2025-08-13)
  `config.kit.files.*` задеприкейтили (PR #14152), в 2.54.0 (2026-03-11) **сняли
  предупреждения валидатора** (PR #15482, дословно «this PR **undeprecates** the
  `kit.files` options»), оставив `@deprecated`-тег в типах с текстом «this feature is
  still supported, but it's generally recommended to use monorepos instead».
  В `3.0.0-next.27` `files.routes` жив; удалён `files.lib` — **`$lib` → `#lib`**.
- `kit.alias` пробрасывается и в Vite, и в TypeScript **[П]** — FSD-алиасы работают.
- Аналога Steiger/`eslint-plugin-boundaries` в экосистеме Svelte нет, но оба наших
  инструмента фреймворк-агностичны и работают.

#### 2.3.7 Зрелость: SvelteKit 3.0 уже в `next`

`@sveltejs/kit` dist-tags 2026-09-16: `latest: 2.70.3`, **`next: 3.0.0-next.27`**
(2026-09-08, 27 пререлизов); `@sveltejs/adapter-node` — `next: 6.0.0-next.12`.
Breaking в 3.0: `$lib` → `#lib`; **`$env/*` и `$app/environment` обещаны к удалению**
(дословно из доки: «Explicit environment variables will become the default in SvelteKit 3.
The `$env/*` modules, along with `$app/environment`, will be removed»); `experimental.tracing`
переехал. ⇒ строить runtime-config на `$env/dynamic/public` сейчас = гарантированная миграция.
Плюсы зрелости: стабильных мажоров за всю жизнь — 2 (1.0 — 2022-12-14, 2.0 — 2023-12-14),
официальный codemod `npx sv migrate`, 2,0 млн загрузок/нед, 20,8k ★.

**AI-friendliness — лучшая в подборке**: `llms.txt` + `llms-full.txt` (1,19 МБ) +
`llms-medium`/`llms-small` + отдельные по пакетам; официальный MCP-сервер `@sveltejs/mcp`
и аддон `npx sv add ai-tools`, который кладёт готовый блок в `CLAUDE.md`
**[П]** https://svelte.dev/docs/ai. Ни у одного другого кандидата такого first-party
инструмента для агентов нет.

#### 2.3.8 Env и prerender — развилка `14` §2.2.2 в чистом виде

**[П]** https://svelte.dev/docs/kit/migrating-to-sveltekit-2: «dynamic environment
variables can no longer be read during prerendering in SvelteKit 2 — you should use the
`static` modules instead. If the user lands on a prerendered page, SvelteKit will request
up-to-date values for `$env/dynamic/public` from the server (by default from a module
called `/_app/env.js`)». Подтверждено исходником `render.js`
(`load_env_eagerly` → `modulepreloads.add(\`${paths.app_dir}/env.js\`)`).
⇒ для `<head>` это бесполезно: значения приезжают **после** HTML.
Новое (2.63+, за флагом `kit.experimental.explicitEnvironmentVariables`): `src/env.ts` +
`defineEnvVars` со Standard-Schema-валидацией (Zod/Valibot), импорт из
`$app/env/{private,public}`, плейсхолдер `%sveltekit.env.NAME%` в `app.html`.
### 2.4 Next.js 16.3.5 — единственный настоящий ISR без CDN, но чужая архитектура

- **`cacheComponents: true` — top-level опция, не `experimental.*`** **[П]**
  https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents.
  `experimental.ppr` и route-export `experimental_ppr` **удалены в 16.0**: «`cacheComponents`
  implements Partial Prerendering (PPR) as the default behavior in the App Router… the
  `experimental.ppr` configuration flag and the `experimental_ppr` route segment
  configuration are no longer necessary and have been removed». Флаг стабилен, но **не дефолт**.
  Требует Node-runtime. `'use cache'` стабильна при включённом `cacheComponents`.
  Профили `cacheLife` (`default/seconds/minutes/hours/days/weeks/max`), `cacheTag`,
  **`revalidateTag(tag, profile)` — второй аргумент обязателен с 16.0**, плюс `updateTag()`
  и `refresh()`.
- **ISR без CDN — работает, и это единственный кандидат с этим «из коробки»** **[П]**
  https://nextjs.org/docs/app/guides/self-hosting: «Caching and revalidating pages (with
  ISR) use the same Next.js server cache. By default, this cache is stored on the local
  filesystem (on disk) of each Next.js server instance… This works automatically for a
  single self-hosted `next start` instance with persistent local disk».
  Каталог `.next/cache`; заголовок **`x-nextjs-cache: HIT|STALE|MISS|REVALIDATED`**.
  Мультиинстанс требует `cacheHandler` + `cacheMaxMemorySize: 0`.
  Инвалидация при новом образе — по Build ID (кеш не переносится между релизами).
- `output: 'standalone'` **[П]**: `.next/standalone` + минимальный `server.js`;
  **`public/` и `.next/static` надо копировать руками** («This minimal server does not copy
  the `public` or `.next/static` folders by default»), запуск `node server.js`,
  env `PORT`/`HOSTNAME`.
- **`proxy.ts`** **[П]** — переименование `middleware.ts` в 16.0; «Proxy defaults to using
  the Node.js runtime. The `runtime` config option is not available in Proxy files»;
  без `matcher` выполняется на каждом запросе, включая `_next/static`.
- **SEO**: `generateMetadata` + `metadataBase`, `alternates.canonical` / `alternates.languages`
  (hreflang), `app/sitemap.ts` (`generateSitemaps()` для шардинга; тип включает
  `alternates.languages`), `app/robots.ts` (**в 16.3 добавлено поле `other` для
  нестандартных директив — то есть `Clean-param` Яндекса выражается штатно**),
  `app/opengraph-image.tsx` через `ImageResponse` из `next/og` — **satori, Chromium не нужен**,
  `next/font` с автоматическим self-host, `trailingSlash`, `redirects()` (`permanent` →
  308/307; **301/302 — через `statusCode`**), `redirect()`/`permanentRedirect()`/`notFound()`.
- **Развилка `14` §2.2.2 у Next сформулирована в доках прямее всех** **[П]**
  https://nextjs.org/docs/app/guides/environment-variables: `NEXT_PUBLIC_*` «will be frozen
  with the value evaluated at build time»; серверный env на **динамическом** рендере
  читается на каждом запросе — «This allows you to use a singular Docker image that can be
  promoted through multiple environments with different values». ⇒ у пререндеренных
  страниц canonical запекается; у request-time — нет.
- **`next/image` без CDN работает, но `sharp` ставится вручную** **[П]**
  https://nextjs.org/docs/messages/sharp-missing-in-production: «For a production environment
  using `output: "standalone"`, you **must** install `sharp`». Дисковый кеш —
  `.next/cache/images`; `minimumCacheTTL` дефолт поднят до **14400 c** в 16.0;
  «There is no mechanism to invalidate the cache at this time».
- **JS-пол**: официальной цифры нет, и более того — **в 16.0 метрики размера JS убраны
  из вывода `next build`** **[П]** (version history CLI: «The JS bundle size metrics have
  been removed from `next build`»). Для нашего гейта с `size-limit` это ощутимый минус:
  бюджет придётся считать своими средствами по `.next/static`.
- **Зрелость — эталонная** **[П]** https://nextjs.org/support-policy: 16.x — **Active LTS**
  (с 2025-10-21), 15.x — Maintenance LTS; «Each major version will remain in Maintenance
  LTS for **two years**». Годовой каденс (октябрь). `llms.txt` есть.
  Lock-in по официальной доке минимален: «To run Next.js, your platform needs a Node.js
  server. That's it»; Docker — «All» features.
- **FSD**: каталог `app/` обязателен и означает «маршруты», тогда как в FSD `app` —
  композиционный корень. Это прямая коллизия смысла; спайк 11 второго раунда уже был
  вынужден положить FSD-слой pages в `src/views/`. Плюс Turbopack вместо Vite, RSC-модель,
  `next lint` удалён в 16.

### 2.5 React Router 8.4.0 — зрелый, но пустой для контента

- 8.0.0 — 2026-06-17, 8.4.0 — 2026-09-15; каденс объявлен годовым: «adopting a yearly
  major release schedule» **[П]** https://remix.run/blog/react-router-v8. v8 — **ESM-only**,
  `react-router-dom` удалён, middleware и split route modules включены по умолчанию,
  минимумы: Node 22.22+, React 19.2.7+, Vite 7+.
- **`ssr` — глобальный флаг, per-route переключателя нет** **[П]**
  https://reactrouter.com/start/framework/rendering: «Though it's a global setting,
  individual routes can still be statically pre-rendered».
- **`prerender` + SSR в одном билде — поддерживается явно** **[П]**: «requests to paths
  that have not been pre-rendered will be server rendered as usual». Артефакты — `[url].html`
  и `[url].data` в `build/client`, отдаются процессом.
- `@react-router/serve` — «a production-ready but basic Node.js server built with Express»
  **[П]**; кастомизации нет by design, нужен — `@react-router/express`.
- SEO: `meta` (в v8 поле `data` → **`loaderData`**), `headers` (включая `Cache-Control`),
  `data(value, { status })`, **`redirect(url, 301)` — 301 доступен напрямую**, `handle`.
  **sitemap/robots/canonical/hreflang — конвенций нет**, всё руками.
- **Серверного кеша HTML нет** — подтверждено, только заголовки.
- RSC в v8 — **experimental**: «subject to breaking changes in minor/patch releases».
- `llms.txt` — нет (404).

### 2.6 TanStack Start 1.168.54 — переоценка по новым весам

Что изменилось относительно раунда 1 (`01-frameworks.md` рекомендовал его с Σ 440/500
при весе «реюз SPA-стека» 30):

- Критерий «реюз» из весов **исчез**. Единственное, где Start безусловный лидер
  (совместимость с наследием, 15) — теперь весит вдвое меньше, чем «качество выдачи» (25).
- **Статус RC не изменился**: доки на `main` по-прежнему «currently in the Release Candidate
  stage»; GitHub Discussion #5999 про дату GA без ответа мейнтейнеров (раунд 1, перепроверка
  не выявила изменений) **[П~]**.
- **Эмпирика `06-spike.md` бьёт ровно в новый профиль**: (а) `vite build` **не даёт
  запускаемый Node-сервер** — нужен плагин `nitro/vite`, а `nitro@latest` = **beta**;
  (б) **prerender-страницы Nitro-сервер не отдаёт** — `GET /` рендерится заново,
  `GET /index.html` → 404. Для контент-first шаблона, где prerender — основной режим,
  это дисквалифицирующий дефект в текущем состоянии.
- Поле: HTTP Archive 2026-08-01 — TanStack Start **23,4 %** good CWV mobile (худший
  показатель во всей выгруженной таблице, включая WordPress 48,7 %), медианный JS 404 КБ,
  11 853 origin'а.
- Плюсы остаются: встроенная генерация sitemap с `alternateRefs (hreflang)`, `head()`
  с дедупом, честные статусы, bot-aware рендер по `isbot`, per-route `ssr: true | false |
  'data-only'`, FSD 1:1 (доказано спайком).

⇒ По новым весам Start уходит из топ-3. Он остаётся **правильным выбором для другой
задачи** — см. §4.2.

### 2.7 SolidStart 2.0.5 — GA есть, фреймворка сайта нет

- GA подтверждён: `2.0.0` — **2026-08-04** (npm `time`), анонс — GitHub Discussion
  solidjs/solid-start#2281 «SolidStart v2 is now Stable»; поста в блоге solidjs.com нет.
  Vinxi удалён, конфиг переехал `app.config.ts` → `vite.config.ts` с плагином `solidStart()`.
- **Опции плагина (проверено по исходнику `@solidjs/start@2.0.5/dist/config/index.js`
  и `.d.ts`, локально 2026-09-16)** **[П~]**:
  `appRoot: './src'`, `routeDir: './routes'` (относительно `appRoot`), `ssr: true`,
  `devOverlay: true`, `extensions: ['js','jsx','ts','tsx']`, `middleware`, `serialization`,
  `env`, `serverFunctions.filter`. **`experimental.islands` типизирован литералом `false`**,
  JSDoc дословно: «Enable islands architecture mode. **Currently fixed to `false`
  (not yet fully supported)**». Опции `prerender` в конфиге **нет** (grep по `dist` —
  ни `prerender`, ни `crawlLinks`).
- **Прод-сервера в поставке нет.** Я это подтвердил эмпирически: `vite build` даёт
  `dist/client` + `dist/server/entry-server.js`, где default-export — **H3-приложение**
  (`interface StartHandler extends H3`), а не запускаемый сервер. Чтобы получить
  `.output/server/index.mjs`, надо добавить `nitro()` из `nitro/vite` и поставить
  `nitro.preset: 'node_server'` — то есть **весь деплой, SSG (`nitro.prerender`) и кеш
  (`routeRules.swr`) делегированы beta-Nitro v3** **[П~]**, и в доках SolidStart
  `routeRules` не упоминается ни разу. Внутри самого GA-релиза — `h3@^2.0.1-rc.26`
  (npm latest h3 = `2.0.1-rc.32`, **RC**) и `srvx@^0.12.4`.
- SEO: метаданных в поставке нет — «ставьте `@solidjs/meta` отдельно» (при этом
  `@solidjs/meta@^0.29.4` в прямых зависимостях; сам пакет не публиковался с **2024-05-15**).
  `HttpStatusCode`, `redirect()`/`json()`/`reload()` из `@solidjs/router` — есть.
  **Sitemap / robots / RSS / i18n-роутинг / image-пайплайн — официального решения нет**;
  доки предлагают класть `robots.txt` руками в `/public`.
- MDX: `@solidjs/start-mdx` не существует, `solid-mdx@0.0.7` — 2023-09-14,
  `@vinxi/plugin-mdx` мёртв вместе с Vinxi. Рабочий путь — `@mdx-js/rollup` вручную.
- Адопшн: 83 407 загрузок/нед; HTTP Archive — **9 origin'ов** (66,7 % good CWV — на такой
  выборке цифра статистически бессмысленна).
- Плюсы: `llms.txt` есть, все страницы доков доступны как сырой `.md`
  (`docs.solidjs.com/solid-start/v2/<path>.md`); TS-типы с богатым JSDoc; `routeDir`/`appRoot`
  настраиваются → FSD ложится без боя; весь код — `.tsx`, весь наш гейт работает нативно.

### 2.8 Qwik 2 (`2.0.0-beta.43`) — богатый, но недокументированный

- **`latest` в npm = beta**, GA без даты; последний официальный пост про v2 —
  https://qwik.dev/blog/qwik-2-coming-soon/ от **2024-02-09**.
- 🚨 **Официальный сайт qwik.dev документирует только Qwik 1** **[П]**:
  `qwik.dev/docs/qwikrouter/` → 404, `qwik.dev/docs/qwikcity/` → 200; на странице
  getting-started 9 упоминаний `@builder.io/qwik` и ноль `@qwik.dev/*`; сам сайт отдаётся
  с `q:version="1.19.0-dev"`. Доки v2 живут на preview-деплоях Cloudflare Pages.
  `llms.txt` — 404. **Для шаблона, который пишут и сопровождают агенты, это
  дисквалифицирующий фактор**: модель будет генерировать код по v1-докам с неверными
  импортами.
- Governance: https://qwik.dev/blog/qwik-next-leap/ (2024-03-26) — Builder.io снимает
  брендинг владения, переход на open-collective-модель, репо в org `QwikDev`, npm-скоуп
  `@qwik.dev`. Более свежих новостей о смене владения не найдено.
- Функционально плотнее SolidStart: `routesDir` настраивается (дефолт `src/routes`),
  **MDX из коробки** (`mdx`/`mdxPlugins` в опциях плагина, `@mdx-js/mdx` + `remark-gfm` +
  `remark-frontmatter` в прямых зависимостях), **image-оптимизация из коробки**
  (`imageOptimization.jsxDirectives`, `vite-imagetools@10` в зависимостях),
  **sitemap в SSG из коробки** (`SsgRenderOptions.sitemapOutFile`, дефолт `sitemap.xml`),
  10 адаптеров деплоя, **встроенный in-memory SSR-кеш страниц** (`ssrCacheSize`, дефолт 50),
  `cacheControl(value, target)` с произвольным целевым заголовком,
  `routeLoader$`/`routeAction$`/`server$`, `zod$` и `valibot$`, `useDocumentHead`,
  `useHttpStatus`. ⚠️ `trailingSlash` дефолт **`true`** (сменился относительно v1).
- Node-адаптер `nodeServerAdapter` помечен `@beta` внутри beta-релиза.
- Адопшн: `@qwik.dev/core` — **2 435 загрузок/нед** (для сравнения: `astro` 4,24 млн,
  `nuxt` 1,44 млн, `@sveltejs/kit` 2,00 млн, `next` 43,4 млн).
- **Загадка HTTP Archive решена** (см. §2.9).

### 2.9 Поле: HTTP Archive 2026-08-01 и «пол JS»

Выгрузка (`v2/ha_table.txt`, API `cdn.httparchive.org/v1/{cwv,page-weight,lighthouse,adoption}`),
срез **2026-08-01**, geo=ALL, rank=ALL:

| технология | origin'ов | good CWV mob | медиана JS, КБ | медиана total, КБ | LH perf mob |
|---|---|---|---|---|---|
| **Starlight** (доки на Astro) | 341 | **91,5 %** | **51** | 318 | 0,855 |
| **Eleventy** | 194 | **84,5 %** | 164 | 794 | 0,78 |
| Hugo | 6 142 | 77,9 % | 294 | 1 360 | 0,70 |
| Jekyll | 1 917 | 77,5 % | 171 | 879 | 0,805 |
| **Astro** | 43 850 | **71,0 %** | **396** | 1 367 | 0,70 |
| VitePress | 623 | 71,4 % | 209 | 675 | 0,74 |
| Qwik | 1 334 | 62,5 % | **2 823** | 6 265 | 0,595 |
| Docusaurus | 1 565 | 59,7 % | 560 | 1 283 | 0,69 |
| **SvelteKit** | 9 682 | 50,6 % | 457 | 1 593 | 0,61 |
| WordPress | 2 752 367 | 48,7 % | 648 | 2 644 | 0,435 |
| **Next.js App Router** | 248 526 | 38,3 % | 664 | 1 901 | 0,55 |
| **Nuxt.js** | 94 069 | **28,6 %** | **1 053** | 2 931 | 0,42 |
| React Router | 188 752 | 24,3 % | 1 028 | 2 725 | 0,48 |
| **TanStack Start** | 11 853 | **23,4 %** | 404 | 1 668 | 0,65 |
| SolidStart | **9** | 66,7 % | 348 | 812 | — |
| весь веб | 8 733 157 | 53,0 % | 707 | 2 503 | 0,485 |

Как это читать: цифра — не «фреймворк медленный», а **траектория, по которой едут
проекты на нём по умолчанию**. Astro на 43 тыс. origin'ов держит 71 % при медиане 396 КБ
JS; Nuxt на 94 тыс. — 28,6 % при 1053 КБ. Для шаблона, который потребители **форкают и
дальше ведут сами**, дефолтная траектория важнее теоретического потолка.
Выборка SolidStart (9 origin'ов) статистически пуста.

**Аномалия Qwik объяснена [П~].** Медианный JS 2823 КБ при хорошем CWV 62,5 % — подпись
resumability плюс агрессивного preload:

1. Механика из доки **[П]** https://qwik.dev/docs/advanced/modules-prefetching/:
   «The prefetching is done by adding `<link rel="modulepreload">` elements to the document…
   The preloader will then add the remaining `<link>` elements to the document head».
   `modulepreload` — настоящий сетевой запрос, HTTP Archive считает эти байты как JS.
2. Дефолт **[П]**: «**By default, Qwik will prefetch any event handlers on the page, as
   well as their dependencies**».
3. Признанный баг over-preloading: PR https://github.com/QwikDev/qwik/pull/8984
   («a certain bundle that references a large map of lazy imports … preloaded all N bundles
   even though only one is ever used»; замер на проде с реестром ~120 компонентов Storyblok:
   «the homepage preloaded **~3 600 JS bundles**. With this change it preloads ~1 697»).
   PR закрыт 2026-09-14 и заменён на #9005, который на 2026-09-16 **всё ещё открыт** ⇒
   в августовском срезе и в текущем `latest` фикса нет.
4. Детект Wappalyzer — по DOM-атрибуту `q:version`, без фильтрации по типу сайта ⇒
   в выборку попадают builder.io-Visual-CMS страницы с большими реестрами компонентов.

Хороший CWV при этом объясним: байты **скачиваются, но не исполняются** — main thread
свободен (заявленная цитата доки: «Qwik code prefetch only downloads but does not
execute the code»). Цена платится трафиком и батареей, а не TBT. Для нашего профиля
(мобильный трафик, нет CDN, один VPS) **трафик — это как раз то, за что мы платим**.
### 2.10 Eleventy 3.1.6 / «Build Awesome v4» — эталон «сколько весит честный HTML»

- **v4 ещё не вышел.** npm dist-tags `@11ty/eleventy` на 2026-09-16:
  `latest: 3.1.6` (2026-06-02), `canary: 4.0.0-alpha.10` (2026-07-01), `beta: 3.1.2-beta.4`.
  Стабильных релизов за 12 мес — **два** (3.1.5, 3.1.6).
- **Ребрендинг подтверждён**: https://www.11ty.dev/blog/build-awesome/ (**2026-03-03**) —
  «Eleventy v4 will be Build Awesome v4», проект уходит под зонтик Build Awesome
  (экосистема Font Awesome), репозиторий — `11ty/buildawesome`. Обещана совместимость:
  «we are committed to keeping full compatibility with the existing Eleventy community and
  ecosystem», «we will even maintain compatibility with your existing Eleventy build commands».
  Модель финансирования — подписка **Build Awesome Pro**, при этом «Build Awesome Pro will
  not be required to use Build Awesome (Eleventy)».
- Для нас Eleventy — **не кандидат, а измерительный эталон**: он показывает нижнюю границу
  («честный HTML» = 1446 Б raw / 764 Б gzip на нашей странице, 0 байт JS — §6) и верхнюю
  границу качества поля (84,5 % good CWV). Но: это не TypeScript-проект, нет компонентной
  модели, FSD/Steiger/Vitest применять не к чему, а **весь серверный слой** (формы, `/now`,
  runtime `SITE_URL`, robots/sitemap из env, healthz) пришлось бы писать отдельным
  Node-сервером — Eleventy Serverless закрыт.

### 2.11 Fresh — выбывает (подтверждено)

На npm пакет `fresh` — это HTTP-freshness-утилита `jshttp` (latest 0.5.2, 2017), к Deno
Fresh отношения не имеет. Deno Fresh распространяется через **JSR** и требует рантайма
Deno. Наша экосистема — один Node-образ (`node:24-alpine`), Node 24 в `engines`, pnpm,
`lefthook`, весь гейт на Node-инструментах. **Выбывает по несовместимости рантайма.**

### 2.12 Hono + JSX SSR — минимализм, который придётся достраивать

`hono@4.13.8` (2026-09-15), 69 стабильных релизов за 12 мес, 0 мажоров, `llms.txt` есть.
Из коробки для SSR **[П]** https://hono.dev/docs/guides/jsx: JSX-рендер, **hoisting
`<title>`/`<link>`/`<meta>` в head**, async-компоненты, `Suspense`/`ErrorBoundary`/
`StreamingContext` (экспериментальные), `memo`, Context API, JSX Renderer middleware.

**Чего нет и что пришлось бы написать самим**: file-based routing, SSG, content collections /
Markdown, image pipeline, i18n-роутинг, head-менеджер уровня Astro/Nuxt, sitemap, robots,
OG, серверный кеш HTML, prerender. Это не «фреймворк с пробелами», а «конструктор».
Оценка: единственный сценарий, где Hono уместен в нашей экосистеме, — **не шаблон сайта,
а внутренний сервис-обёртка**. Для `ssr-frontend-template` объём «дописать самим» уходит
далеко за границу того, что разумно сопровождать одной командой.

---

## 3. Матрица с новыми весами

Веса из `brief-v2.md`: **качество выдачи 25 · SEO-инструментарий 20 · контент-пайплайн 15 ·
зрелость и риск 15 · совместимость с наследием 15 · self-host одним Node-образом 10**.
Оценки 1–5 с шагом 0,5. Σ из 500.

| кандидат | выдача ·25 | SEO ·20 | контент ·15 | зрелость ·15 | наследие ·15 | self-host ·10 | **Σ** |
|---|---|---|---|---|---|---|---|
| **Astro 7.3.2** | **5** (125) | 4 (80) | **5** (75) | 3 (45) | 4,5 (67,5) | 4,5 (45) | **437,5** |
| **Nuxt 4.5.2** | 3 (75) | **5** (100) | 4 (60) | 3 (45) | 2 (30) | 4,5 (45) | **355** |
| **Next.js 16.3.5** | 3 (75) | 4,5 (90) | 2,5 (37,5) | **5** (75) | 2 (30) | 4 (40) | **347,5** |
| SvelteKit 2.70.3 | 4 (100) | 2 (40) | 2 (30) | 4 (60) | 3,5 (52,5) | 4 (40) | **322,5** |
| Eleventy 3.1.6 | **5** (125) | 3 (60) | 4 (60) | 2 (30) | 1 (15) | 1,5 (15) | **305** |
| Hono 4.13 + JSX | 4,5 (112,5) | 1 (20) | 1 (15) | 3,5 (52,5) | 4 (60) | 4 (40) | **300** |
| TanStack Start 1.168 | 2,5 (62,5) | 4 (80) | 1 (15) | 2 (30) | **5** (75) | 2,5 (25) | **287,5** |
| Qwik 2.0.0-beta.43 | 3 (75) | 3 (60) | 3 (45) | 1 (15) | 4 (60) | 3 (30) | **285** |
| React Router 8.4.0 | 2 (50) | 2 (40) | 1 (15) | 4 (60) | 4 (60) | 3,5 (35) | **260** |
| SolidStart 2.0.5 | 3,5 (87,5) | 1,5 (30) | 1 (15) | 2 (30) | 4 (60) | 2 (20) | **242,5** |
| Fresh | — | — | — | — | — | — | **выбывает** (Deno-only) |

### 3.1 Обоснование каждой клетки (одна строка на клетку)

**Качество выдачи (25)**

| кандидат | оценка | почему |
|---|---|---|
| Astro | 5 | «Zero JS by default» подтверждено докой и полем (71 % good CWV на 43 850 origin'ах, медиана JS 396 КБ; Starlight — 91,5 % / 51 КБ); гидрация **поштучно на компонент** (`client:*`), не на маршрут |
| Eleventy | 5 | 0 байт JS измерено; 84,5 % good CWV, медиана 164 КБ — лучший в таблице |
| Hono+JSX | 4,5 | JS ровно столько, сколько напишешь сам, но и `<head>`-hoisting — единственная встроенная помощь |
| SvelteKit | 4 | `csr = false` даёт **настоящий** ноль JS (проверено по `render.js`), но гранулярность — маршрут, а дефолт — гидрация; поле 50,6 % / 457 КБ |
| SolidStart | 3,5 | измерено 39,2 КБ raw / 15,3 КБ gzip на статической странице — лучший результат среди «полных» SPA-рантаймов, но островов нет ⇒ рантайм едет всегда |
| Nuxt | 3 | `routeRules.noScripts: true` даёт ноль JS на маршрут, но острова экспериментальны, а поле худшее в подборке (28,6 % / 1053 КБ) |
| Next 16 | 3 | RSC режет клиент, но React-рантайм и App-Router едут всегда; поле 38,3 % / 664 КБ; метрики размера JS убраны из `next build` |
| Qwik 2 | 3 | измерено 116 КБ raw / 42,7 КБ gzip на странице **без единого обработчика** (modulepreload ядра); поле — медиана 2823 КБ из-за over-preload (баг открыт) |
| TanStack Start | 2,5 | поле 23,4 % good CWV — худшее в выгрузке; контентного режима без гидрации нет |
| React Router 8 | 2 | измерено 335,5 КБ raw / 106,9 КБ gzip + 3 КБ инлайна на статической странице с prerender |

**SEO-инструментарий (20)**

| кандидат | оценка | почему |
|---|---|---|
| Nuxt | 5 | единственный, у кого из коробки sitemap + robots + schema-org + og-image + **link-checker** + hreflang в `<head>` (`useLocaleHead`) + **runtime site config** (`NUXT_SITE_URL`) |
| Next 16 | 4,5 | Metadata API + `sitemap.ts` (с `alternates.languages`) + `robots.ts` (с полем `other` ⇒ `Clean-param` штатно) + OG на satori + `next/font`; минус — `metadataBase` запекается на статике |
| Astro | 4 | sitemap с hreflang, RSS, i18n-хелперы, redirects со статусами, `astro:assets`, Fonts API стабилен; минусы — sitemap **только build-time и не покрывает SSR-роуты**, нет hreflang-хелпера для `<head>`, нет OG-генератора, robots.txt руками |
| TanStack Start | 4 | встроенный sitemap с `alternateRefs`, `head()` с дедупом, честные статусы, bot-aware `isbot` |
| Eleventy | 3 | first-party плагины `eleventy-img`, `eleventy-plugin-rss`, `eleventy-plugin-i18n` + сообщество; но всё подключается вручную и всё build-time |
| Qwik 2 | 3 | `useDocumentHead`, sitemap в SSG, imagetools, `cacheControl`; нет i18n-роутинга, robots, OG |
| SvelteKit | 2 | `<svelte:head>`, статусы, `enhanced-img`, paraglide через аддон; **`canonical` и `hreflang` — 0 вхождений во всём корпусе доков**; sitemap/robots/OG отсутствуют |
| React Router 8 | 2 | `meta`/`headers`/`data()`/`redirect(url, 301)`; конвенций sitemap/robots нет |
| SolidStart | 1,5 | `@solidjs/meta` (не публиковался с 2024-05) + `HttpStatusCode`; доки предлагают класть `robots.txt` руками в `/public` |
| Hono+JSX | 1 | только hoisting head-тегов |

**Контент-пайплайн (15)**

| кандидат | оценка | почему |
|---|---|---|
| Astro | 5 | Content Layer + `astro/zod` (**Zod 4**) + кастомные loaders из CMS/API + **live collections стабильны с 6.0** и в 7.0 отдают cache-хинты с тегами; контент лежит где угодно (`base` лоадера) ⇒ **влезает в `entities/<name>/content/`** |
| Nuxt | 4 | Content 3: коллекции, SQL-подобные запросы, Zod-схемы, `<ContentRenderer>`; минусы — SQLite-бэкенд в Docker (нативный `better-sqlite3` либо `node:sqlite`), контент **обязан** лежать в `content/` в корне |
| Eleventy | 4 | коллекции, frontmatter, пагинация, data-каскад — профессия; но типизации схем нет |
| Qwik 2 | 3 | MDX с frontmatter и remark-плагинами из коробки; коллекций и схем нет |
| Next 16 | 2,5 | `@next/mdx` + `gray-matter` руками; в Turbopack remark/rehype задаются **строками** («JavaScript functions can't be passed to Rust»); `import.meta.glob` появился в 16.3 |
| SvelteKit | 2 | `mdsvex` (официальный аддон) + `import.meta.glob`; рекомендованного рецепта блога в доках нет |
| RR8 / TanStack Start / SolidStart / Hono | 1 | ничего; у Solid официальные MDX-пакеты мертвы (`solid-mdx` — 2023-09-14) |

**Зрелость и риск (15)**

| кандидат | оценка | почему |
|---|---|---|
| Next 16 | 5 | единственная **письменная LTS-политика** (Active LTS + Maintenance LTS 2 года), годовой каденс, `llms.txt`, крупнейшая экосистема (43,4 млн загрузок/нед) |
| SvelteKit | 4 | 2 стабильных мажора за всю жизнь, 0 за 12 мес, codemod `sv migrate`, лучший в классе набор `llms*.txt` + официальный MCP; минус — **3.0 уже в `next`** (`$lib`→`#lib`, удаление `$env/*`), experimental вне semver |
| React Router 8 | 4 | заявленный годовой мажор-каденс, честный semver, future-flags; минус — RSC experimental, нет `llms.txt` |
| Astro | 3 | **2 мажора за 6 месяцев** (6.0 — 03-10, 7.0 — 06-22), поддержка «security fixes only for one previous major», 7.0 сменил дефолтный Markdown-процессор на Sätteri (ломает remark-экосистему), **нет `llms.txt`**; Cloudflare — умеренный вендор-риск при MIT + открытом governance |
| Nuxt | 3 | **Nuxt 5 «Scheduled» ~Q4 2026 с переездом на Nitro v3** ⇒ запланированная миграция серверного слоя; LTS ≥ 6 мес после следующего мажора; `llms.txt` есть; 1,44 млн/нед |
| Hono | 3,5 | сам Hono зрелый и стабильный, но как «фреймворк сайта» не существует ⇒ риск переносится на наш собственный код |
| TanStack Start | 2 | **RC уже год**, дата GA не объявлена, серверный кеш требует `nitro@3.0.x-beta` |
| Eleventy | 2 | v4 в alpha; ребрендинг + Pro-подписка меняют модель проекта; 2 стабильных релиза за 12 мес; 194 origin'а |
| SolidStart | 2 | GA 6 недель назад и стоит на **RC h3 (`2.0.1-rc.32`) + beta Nitro v3**; `@solidjs/meta` не обновлялся 2 года; 83 тыс./нед |
| Qwik 2 | 1 | **beta в `latest`**, GA не обещан с 02.2024, **официальных доков на v2 не существует**, 2 435 загрузок/нед, открытый баг over-preload |

**Совместимость с обязательным наследием (15)**

| кандидат | оценка | почему |
|---|---|---|
| TanStack Start | 5 | доказано спайком `06`: FSD 1:1, `src/pages` как маршруты, весь гейт без правок |
| Astro | 4,5 | `src/pages` = маршруты **совпадает** с FSD-слоем pages; `_`-префикс даёт колокацию; `src/components`/`src/layouts` — «not required»; автоимпортов нет; Steiger читает frontmatter; минусы — гейт переезжает на **ESLint 10**, Biome по `.astro` 🟡, компонентные тесты `.astro` только через экспериментальный Container API |
| Qwik 2 / SolidStart / RR8 / Hono | 4 | всё в `.tsx` ⇒ Biome/ESLint/Steiger/Vitest/size-limit работают нативно; каталог маршрутов настраивается (`routesDir` / `routeDir` / `appDirectory`) |
| SvelteKit | 3,5 | колокация идеальна (роутятся только `+`-файлы), `kit.alias` идёт и в TS; но `files.routes` несёт `@deprecated`-тег, `$lib`→`#lib` в 3.0, Biome 🟡 и де-факто Prettier |
| Next 16 | 2 | `app/` = маршруты прямо конфликтует с FSD-слоем `app` (композиционный корень) — спайк 11 был вынужден увести страницы в `src/views/`; RSC-модель, Turbopack вместо Vite |
| Nuxt | 2 | `srcDir` по умолчанию `app/`; автоимпорты (отключаемы); **любой `.vue` в `dir.pages` — маршрут**, ignore-префикса в 4.x нет (только `.nuxtignore`/`pages:extend`); `content/` вне `src` |
| Eleventy | 1 | не TS-проект, нет компонентной модели, Steiger/Vitest/size-limit применять не к чему |

**Self-host одним Node-образом без CDN (10)**

| кандидат | оценка | почему |
|---|---|---|
| Astro | 4,5 | standalone отдаёт страницы + prerender + статику, `_astro/**` автоматически `immutable`, **кеш HTML в процессе стабилен**; минусы — graceful shutdown и healthcheck писать самим, `sharp` в образе при on-demand ресайзе |
| Nuxt | 4,5 | `.output` self-contained, graceful shutdown из коробки (`NITRO_SHUTDOWN_*`), статика процессом, `swr` в памяти; минусы — `better-sqlite3`, потенциальный Chromium у og-image |
| SvelteKit | 4 | adapter-node зрелее всех (включая `KEEP_ALIVE_TIMEOUT` — прямое лекарство от 502-риска из `04` §2.8), `sveltekit:shutdown`, precompress; минус — **кеша HTML нет**, prerendered HTML идёт без `Cache-Control` |
| Next 16 | 4 | `standalone` + **настоящий ISR на диске без CDN** (`x-nextjs-cache`); минусы — `public/` и `.next/static` копировать руками, `sharp` ставить вручную, graceful shutdown не описан |
| Hono | 4 | один процесс, полный контроль; но всё пишется самим |
| React Router 8 | 3,5 | `@react-router/serve` (Express) отдаёт prerender и статику; кеша нет, кастомизация — только через миграцию на `@react-router/express` |
| Qwik 2 | 3 | node-адаптер есть и `ssrCacheSize` даёт встроенный кеш страниц, но адаптер `@beta` внутри beta |
| TanStack Start | 2,5 | эмпирика `06`: `vite build` не даёт сервера, кеш — только через beta-Nitro, **prerender-страницы Nitro-сервером не отдаются** |
| SolidStart | 2 | прод-сервера в поставке **нет вообще** (подтверждено мной: default-export билда — H3-приложение); всё — через beta-Nitro |
| Eleventy | 1,5 | только SSG; весь серверный слой — отдельным приложением; Eleventy Serverless закрыт |

### 3.2 Топ-3 и объяснение разрывов

**1. Astro 7.3.2 — 437,5. 2. Nuxt 4.5.2 — 355. 3. Next.js 16.3.5 — 347,5.**
(4-е место — SvelteKit 322,5.)

- **Разрыв Astro → Nuxt = 82,5 балла (17 % шкалы)** и он не «набегает по мелочи»: Astro
  выигрывает 50 баллов на «качестве выдачи» (единственный с гидрацией **на компонент**,
  а не на маршрут, и с полем 71 % против 28,6 %), 15 — на контент-пайплайне (Content Layer
  с Zod 4 и CMS-лоадерами против привязки к `content/` и SQLite) и 37,5 — на совместимости
  с наследием (`src/pages` совпадает с FSD-слоем; у Nuxt `srcDir: app/` и автоимпорты
  бьются с каноном). Проигрывает он только на SEO-инструментарии (−20). Это **не близкий
  результат**: чтобы Nuxt догнал, нужно обнулить вес «качества выдачи», то есть отказаться
  от самой формулировки «контент-first».
- **Разрыв Nuxt → Next = 7,5 балла — это шум.** Они «одинаково вторые» по разным причинам:
  Nuxt берёт SEO-инструментарием и контентом, Next — зрелостью (единственная письменная
  LTS-политика в подборке). Оба одинаково плохо ложатся на FSD (обоим `app/` означает
  не то, что нам).
- **SvelteKit (322,5) — самый недооценённый 4-й.** Он лидирует по чистоте «ноля JS»
  (`csr = false` буквально не эмитит `start.js`) и по AI-friendliness (llms-файлы + MCP),
  но −60 баллов относительно Astro приходят из двух пустот: **SEO-инструментария нет
  вообще** (canonical/hreflang — ноль упоминаний в доках) и **контент-слоя нет**.
  Для шаблона это означает, что весь §5.1 «дописать самим» вырастет примерно вдвое.
- **TanStack Start падает с 1-го места раунда 1 на 7-е** ровно потому, что критерий, по
  которому он был первым («реюз SPA-стека», вес 30), заменён на «качество выдачи» (25),
  где он последний по полю, и «контент-пайплайн» (15), где у него ноль.
---

## 4. Два вопроса, поставленные брифом

### 4.1 Есть ли кандидат, который **лучше Astro** для контент-first без CDN?

**Нет.** Ни один. Разбор по трём гипотезам, каждая из которых могла бы дать «да»:

**Гипотеза A: «SvelteKit чище по нолю JS».** Верно на уровне одного маршрута
(`csr = false` не эмитит ни байта клиентского кода — проверено по исходнику), но неверно
на уровне сайта. Контент-first сайт — это «десять страниц без JS + форма + фильтр
каталога + переключатель темы». У Astro это `client:visible` на трёх компонентах при
нулевом JS на остальных девяти страницах; у SvelteKit это `csr = false` на девяти
маршрутах и **полная гидрация** на трёх. Гранулярность острова < гранулярности маршрута.
Плюс SvelteKit отдаёт Astro по SEO (−40 баллов: нет sitemap, robots, canonical, hreflang,
OG) и по контенту (−45: content layer отсутствует). Он проигрывает 115 баллов.

**Гипотеза B: «у Next настоящий ISR, а у Astro нет».** Была верна до Astro 7.0 —
и **уже неверна**. `cache: { provider: memoryCache() }` + `routeRules` с `maxAge`/`swr`/
`tags` + `cache.invalidate({ tags })` покрывают ровно те четыре механизма инвалидации,
которые `14` §2.2.5 объявил необходимыми (релиз / TTL+SWR / вебхук по тегам / ручной
flush), причём **стабильно, без беты**, с ключом кеша без cookie/UA и с автоматической
нормализацией трекинговых query-параметров. Next выигрывает только в сценарии
«несколько инстансов с общим кешем» — а у нас `container_name` в compose **запрещает
`replicas`** (`04` §2.8), так что этот сценарий не существует.

**Гипотеза C: «Eleventy даёт минимум байт».** Даёт — 0 JS, 764 Б gzip HTML. Но у него
нет серверного слоя вообще: `/contact` с POST, `/now`, runtime `SITE_URL` в robots/sitemap,
`/healthz`, `X-Robots-Tag` по env, редиректы со статусами — всё это отдельный Node-сервер,
который мы написали бы и сопровождали сами. Разница Astro vs Eleventy по «полу JS»
(§6) — **порядка килобайта на странице без островов**, а разница по объёму собственного
кода — тысячи строк. Плюс Eleventy не даёт ни одного элемента обязательного наследия
(FSD/Steiger/TS/Vitest применять не к чему).

**Что именно делает Astro лучшим именно для «без CDN»:** три вещи сходятся в одной точке.
(1) Гидрация на компонент ⇒ страница без интерактива реально не грузит фреймворк —
трафик, за который мы платим на VPS без CDN, не тратится. (2) Route caching в памяти
процесса ⇒ роль CDN играет сам контейнер, и модель «релиз = новый контейнер = пустой
кеш» работает как атомарная публикация. (3) `@astrojs/node` standalone сам раздаёт
статику с `immutable` ⇒ ни nginx-sidecar, ни CDN не нужны, что подтверждает вывод
`04` §8 («nginx-sidecar не нужен») уже для не-TanStack стека.

**Честная оговорка.** Astro проигрывает по SEO-инструментарию (4 против 5 у Nuxt) и
по зрелости (3 против 5 у Next). Обе потери конвертируются в конкретную работу, а не
в риск: SEO-пробелы — это ~6 файлов в `shared/seo` (§5.1), а быстрый мажор-темп — это
дисциплина `renovate` + прогон `pnpm check` на апгрейде. Обратная конвертация невозможна:
«пол JS» и контент-слой чужими руками не дописываются.

### 4.2 Когда React-first фреймворк (Next / TanStack Start) всё же правильнее?

React-first выигрывает, когда **центр тяжести проекта смещается с документа на сессию**.
Пять конкретных триггеров — если срабатывают два и больше, шаблон сайта не подходит:

1. **Кабинет — основной сценарий, а не опция.** Формы с зависимыми полями, таблицы с
   серверной пагинацией и сортировкой, оптимистичные мутации, инвалидация кешей по
   доменным событиям. Это ровно то, для чего SPA-шаблон уже собран (TanStack Query +
   Form + Router, MSW-сценарии, `entities/*/api/queries.ts`), и переписывать это
   островами — работа против инструмента.
2. **Больше половины маршрутов за `guard ≠ public`.** Неиндексируемые маршруты не платят
   за SSR и не выигрывают от островов; выигрывают от единого клиентского роутера и
   общего кеша данных.
3. **Реюз кода SPA-шаблона имеет денежную величину.** Если у заказчика уже есть
   `<org>/frontend` на `spa-frontend-template`, а сайт — второе окно в тот же домен,
   то общие `entities`/`shared` и общая ментальная модель стоят дороже килобайтов.
   Здесь TanStack Start — 5/5 по наследию (доказано спайком `06`).
4. **Нужен ISR с общим кешем на нескольких инстансах.** Единственная встроенная реализация
   в подборке — Next (`cacheHandler` + `refreshTags()`). Если инфра когда-нибудь уйдёт от
   «одна реплика на VPS», это аргумент.
5. **Требуется формальный LTS в письменном виде** (тендер, комплаенс, «на чём вы будете
   через 2 года»). Такой документ есть только у Next (`nextjs.org/support-policy`).

**Где проходит граница внутри React-first.** Next — когда важнее зрелость, ISR и
SEO-инструментарий (и мы готовы платить `app/`-коллизией с FSD и Turbopack'ом вместо
Vite). TanStack Start — когда важнее родство с SPA-шаблоном и per-route `ssr: true |
false | 'data-only'`, и мы готовы принять RC-статус и beta-Nitro. Для **контент-first**
профиля, заданного владельцем, не подходит ни тот, ни другой: у обоих ноль контент-слоя
и худшее поле по CWV в выгрузке HTTP Archive.

**Формулировка для `docs/stack/rendering.md` форка** (одна строка-триггер):
«Если доля индексируемых публичных маршрутов < 50 % или кабинет — основной сценарий,
это не сайт, а приложение: форкать `spa-frontend-template`, а не `ssr-frontend-template`».
---

## 5. Топ-3: что придётся дописывать самим и какие ловушки известны

Каждый пункт «дописать» = будущий кусок кода или скилла с адресом в дереве шаблона.
Нумерация сквозная, чтобы на неё можно было ссылаться из плана реализации.

### 5.1 Astro 7 — «дописать самим»

| # | что | где в шаблоне | почему нужно (канон / факт) |
|---|---|---|---|
| A-1 | **`robots.txt` как server endpoint** из runtime-env: `ROBOTS_POLICY`, абсолютная строка `Sitemap:`, маски фасетов, `Clean-param` для Яндекса | `src/pages/robots.txt.ts` | канон I-9/I-10/I-17/I-20; у Astro своего robots нет |
| A-2 | **`sitemap.xml` как server endpoint** поверх `getCollection()` вместо `@astrojs/sitemap` | `src/pages/sitemap.xml.ts` (+ `sitemap-[n].xml.ts` при шардинге) | `@astrojs/sitemap` build-time, требует `site` и **не умеет SSR-роуты**; нам нужен runtime-origin (`14` §2.2.3 п.5) и лимит 50 000/50 МБ (I-11) |
| A-3 | **RSS как server endpoint** (или `@astrojs/rss` с runtime-origin) | `src/pages/rss.xml.ts` | `14` §2.10.1 |
| A-4 | **`shared/seo/origin.ts`**: `resolveOrigin(request)` — `SITE_URL` из `astro:env/server` (или `process.env`), ассерт «`Host` совпадает с `SITE_URL`» | `src/shared/seo/` | развилка `14` §2.2.2, вариант D+F; `Astro.site` — build-time |
| A-5 | **`shared/seo/head.astro`** — единый компонент `<Seo>`: title-шаблон, description, absolute canonical, OG-набор, twitter, `<html lang>`, `noindex` по политике | `src/shared/seo/ui/seo.astro` | M-1…M-10; у Astro нет head-менеджера с дедупом |
| A-6 | **hreflang-хелпер** поверх `getAbsoluteLocaleUrlList()` — полный взаимный набор + `x-default` | `src/shared/seo/hreflang.ts` | L-3; в `astro:i18n` хелпера нет (подтверждено) |
| A-7 | **JSON-LD**: типизированные фабрики `Organization`/`WebSite`/`BreadcrumbList`/`Article`, валидируемые Zod-схемой в unit-тесте | `src/shared/seo/jsonld/` | S-1…S-5 |
| A-8 | **OG-картинки**: endpoint `src/pages/og/[...slug].png.ts` на `satori` + `sharp` с дисковым кешем и длинным `Cache-Control` | `src/pages/og/`, `src/shared/og/` | M-5/M-6; у Astro генератора нет |
| A-9 | **Редиректы как данные**: `content/redirects.yaml` → генерация `redirects` в конфиге + server-fallback для рантайм-правил | `src/shared/seo/redirects.ts` + `astro.config` | `14` §2.10.3; конфигурационные `redirects` статичны |
| A-10 | **`/healthz`** и **graceful shutdown** | `src/pages/healthz.ts` + обёртка `mode: 'middleware'` **или** `src/fetch.ts` (Advanced Routing, Astro 7) | у `@astrojs/node` ни того, ни другого нет; `04` §3.4 требует согласовать `stop_grace_period` |
| A-11 | **Штамповка `__SITE_ORIGIN__`** в entrypoint (вариант C из `14` §2.2.3) — только если включаем prerender для «холодных» страниц | `docker/entrypoint.sh` + e2e-тест «в ответе нет `__SITE_ORIGIN__`» | prerender ⊥ runtime env |
| A-12 | **Формы с honeypot**: Astro Actions или endpoint + `features/contact-form` с прогрессивным `<form method="POST">` без JS | `src/features/contact-form/` | спецификация spike'а; Astro Actions есть, honeypot/rate-limit — нет |
| A-13 | **Preview/draft**: подписанная cookie/`?preview=<hmac>` + `getCollection(..., ({ data }) => import.meta.env.DEV || data.draft !== true)` + `noindex` + `no-store` | `src/shared/content/preview.ts` | `14` §2.1.4 |
| A-14 | **Вебхук ревалидации** `POST /internal/revalidate` с HMAC → `context.cache.invalidate({ tags })`, и `/internal/cache/flush` | `src/pages/internal/` | `14` §2.2.5; сам `invalidate` есть, транспорт и подпись — нет |
| A-15 | **`X-Robots-Tag` middleware** по `ROBOTS_POLICY` + `private, no-store` на неиндексируемых | `src/middleware.ts` | I-14/I-15 |
| A-16 | **Прогрев кеша при старте** по списку «горячих» URL из `docs/stack/rendering.md` | `src/shared/cache/warmup.ts` | `14` §2.2.5; иначе первый посетитель после релиза платит за рендер |
| A-17 | **`size-limit` на клиентские ассеты + бюджет размера SSR-HTML** (≤300 КБ, алерт на 150 КБ) | `.size-limit.cjs` + `e2e/seo.spec.ts` | I-24; у Astro метрик билда нет |
| A-18 | **Контент-схемы и `content-invariants`**: Zod-схема frontmatter из `astro/zod`, бюджеты title/description, ровно один h1, alt у каждой картинки, разрешимость внутренних ссылок | `src/entities/<name>/content.config` + `pnpm check:content` | `13` п.9; у Astro есть только схема, проверок канона нет |
| A-19 | **`<YandexNoIndex>`** и `Clean-param`-таблица | `src/shared/seo/` | I-19/I-20/I-23 |
| A-20 | **Тонкая обвязка компонентных тестов** `.astro` — либо принять «`.astro` проверяется только Playwright'ом», либо завести адаптер поверх `experimental_AstroContainer` с явной пометкой риска | `src/shared/lib/testing/` | Container API экспериментален даже в 7.x |

### 5.2 Astro 7 — известные ловушки

| ловушка | детали | источник |
|---|---|---|
| **Кеш не работает в `dev`** | `cache.enabled === false` в dev-режиме; проверять только `astro build && astro preview` | docs.astro.build/en/guides/caching/ |
| **Заголовок называется `X-Astro-Cache`**, не `X-Cache` | smoke-тесты и алерты писать на это имя | cache-provider-reference |
| **`@astrojs/sitemap` не покрывает SSR-роуты** | «This integration cannot generate sitemap entries for dynamic routes in SSR mode»; плюс требует build-time `site` | integrations-guide/sitemap |
| **`server:defer` ломается на длинных пропсах** | пропсы шифруются в query; >2048 байт ⇒ переключение на `POST`, который не кешируется браузером | directives-reference / server-islands |
| **Astro 7 сменил Markdown-процессор на Sätteri (Rust)** | remark/rehype-плагины перестают подключаться «как раньше» — нужен `@astrojs/markdown-remark` и явная настройка unified. **Прямо бьёт в контент-шаблон**: подсветка кода, `remark-gfm`, автолинки заголовков | guides/upgrade-to/v7 |
| **Компилятор переписан на Rust и стал строгим** | «Unclosed tags now produce errors», невалидный HTML больше не чинится; `compressHTML: 'jsx'` — новый дефолт, может съесть пробелы между inline-элементами | там же |
| **`src/fetch.ts` — зарезервированное имя** в 7.0 | если в шаблоне есть `src/shared/api/fetch.ts` — это другое, но корневой `src/fetch.ts` занят (меняется опцией `fetchFile`) | там же |
| **`@astrojs/db` удалён** | если где-то в примерах экосистемы встретится — он мёртв | там же |
| **`eslint-plugin-astro` ≥ 2.0.0 требует ESLint 10** | гейт шаблона переезжает 9.39.5 → 10.10.0; последняя eslint-9-совместимая версия плагина — 1.7.0 (2026-04-07) | npm peerDependencies |
| **Container API экспериментален** | «subject to breaking changes, even in minor or patch releases» ⇒ не строить на нём обязательную часть гейта | container-reference |
| **`sharp` при on-demand ресайзе** | «When using a strict package manager like pnpm, you may need to manually install Sharp»; в Docker — нативный бинарник, нужен `pnpm.supportedArchitectures` с `libc: musl` (канон P-11) | guides/images |
| **Steiger не резолвит импорты *в* `.astro`** | `ts.resolveModuleName` не знает расширения; митигация — канон «импорт только через `index.ts`» + `no-restricted-imports` на deep-import | чтение `@feature-sliced/filesystem@3.1.0` |
| **Steiger видит только frontmatter `.astro`** | импорты внутри inline-`<script>` в шаблоне не попадают в граф | чтение `@feature-sliced/steiger-plugin@0.7.0` |
| **Нет `llms.txt`** | агентам придётся ходить по HTML-докам; компенсировать выдержками в `.claude/rules/astro-*.md` | curl 404 на `docs.astro.build/llms.txt` |
| **Мажор каждые ~3,5 месяца, поддержка «security-only, один предыдущий мажор»** | политика апгрейдов шаблона должна быть написана заранее (`npx @astrojs/upgrade`) | upgrade-astro |
| **Cloudflare-риск** | код MIT и governance открыт, но приоритеты роадмапа могут дрейфовать; индикатор для мониторинга — останется ли `memoryCache()` дефолтным провайдером в 8.x | astro.build/blog/joining-cloudflare/ |

### 5.3 Nuxt 4.5 — «дописать самим» (сверх Nuxt SEO)

| # | что | почему |
|---|---|---|
| N-1 | **Инвалидация кеша по тегам/путям** — в Nitro v2 нет `.invalidate()`; писать поверх `useStorage('cache').removeItem` + собственный реестр «путь → ключи» | `14` §2.2.5 |
| N-2 | **Подтвердить и, если надо, обойти** поведение `NUXT_SITE_URL` на пререндеренных страницах (скорее всего — штамповка C или отказ от prerender) | развилка `14` §2.2.2 |
| N-3 | **Ремаппинг каталогов под FSD**: `srcDir`, `dir.*`, `imports.autoImport: false`, `components: false`, `.nuxtignore`/`pages:extend` для колокации секций | наследие FSD |
| N-4 | **Решение по SQLite Nuxt Content в образе**: `node:sqlite` (Node ≥ 22.5, без нативной сборки) против `better-sqlite3` (нужен toolchain в build-стадии) + фиксация пути файла БД | деплой |
| N-5 | **Исключение Steiger `insignificant-slice`** для секций-виджетов с одним референсом | `13` §2.4 |
| N-6 | `/healthz`, бюджеты `size-limit`, `X-Robots-Tag`, honeypot, preview, прогрев — как у Astro (A-10, A-12, A-13, A-15, A-16, A-17) | канон |
| N-7 | **План миграции на Nuxt 5 / Nitro v3** в `docs/stack/runtime.md` как обязательный раздел шаблона | Nuxt 5 «Scheduled» ~Q4 2026 |

**Ловушки Nuxt**: доки Nitro по голому `nitro.build` — это уже **v3**, актуальные для
4.5 — `v2.nitro.build`; `isr` без CDN эквивалентен `swr`; кеш в памяти процесса не
переживает рестарт; `noScripts` отключает гидрацию целиком по маршруту (интерактив на
такой странице невозможен); `@nuxt/devtools` в `latest` — `4.0.0-beta.1`.

### 5.4 Next 16 — «дописать самим»

| # | что | почему |
|---|---|---|
| X-1 | **Развязка FSD ↔ `app/`**: тонкие `app/**/page.tsx` + FSD-слой страниц отдельным каталогом (спайк 11 использовал `src/views/`), правки `steiger.config` и `eslint-plugin-boundaries` | коллизия смысла `app` |
| X-2 | **Контент-слой целиком**: `@next/mdx` + `gray-matter` + свой индекс коллекций + Zod-схемы + типы | content layer отсутствует |
| X-3 | **Бюджеты размера**: `size-limit` по `.next/static` своими руками — метрики JS убраны из `next build` в 16.0 | канон P-22 |
| X-4 | **Runtime-canonical**: гарантировать, что индексируемые страницы рендерятся request-time (иначе `metadataBase` запекается) — и тест на это | `14` §2.2.2 |
| X-5 | **`sharp` в образ вручную** + `outputFileTracingIncludes` для него; копирование `public/` и `.next/static` в `standalone` | self-hosting docs |
| X-6 | **Graceful shutdown**, `/healthz` (route handler), `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `deploymentId` | self-hosting docs |
| X-7 | hreflang/JSON-LD/RSS/OG-кеш/honeypot/preview/редиректы-как-данные — как у Astro | канон |

**Ловушки Next**: `'use cache'` роняет рантайм, а не билд, если внутри оказались
`cookies()`/`headers()`/`searchParams` (`next-request-in-use-cache`) — «может пройти
`next build` и упасть под `next start`»; `proxy.ts` без `matcher` выполняется на каждом
запросе включая `_next/static`; `minimumCacheTTL` картинок поднят до 14400 с и
«There is no mechanism to invalidate the cache at this time»; `revalidateTag` без второго
аргумента deprecated с 16.0; за nginx для стриминга нужен `X-Accel-Buffering: no`.
---

## 6. Рекомендация

### 6.1 Вердикт

**`ssr-frontend-template` строится на Astro 7.x** (`astro@^7.3.2`, `@astrojs/node@^11.1.5`,
`mode: 'standalone'`), с:

- `cache: { provider: memoryCache() }` + `routeRules` — **серверный кеш HTML в процессе
  без CDN**, стабильный, без беты;
- **режим по умолчанию — `output: 'server'` + SSR + кеш** (вариант D из `14` §2.2.3),
  prerender — включаемая оптимизация для «холодных» страниц со штамповкой `__SITE_ORIGIN__`
  (вариант C), а не дефолт;
- Content Layer с `astro/zod` (Zod 4) как контент-слоем, контент внутри FSD
  (`src/entities/<name>/content/`);
- FSD ровно как в SPA-шаблоне: `src/{app,pages,widgets,features,entities,shared}`,
  маршруты в `src/pages` (совпадает с требованием Astro), колокация не-маршрутов через
  `_`-префикс;
- гейт: Biome 2.5 (с `html.experimentalFullSupportEnabled`), **ESLint 10** +
  `eslint-plugin-astro@^3`, Steiger 0.6 + plugin 0.7, `astro check`, Vitest 5,
  Playwright 1.63, size-limit 14;
- реюз из SPA-шаблона: Zod-контракты, токен-слой `app/styles/index.css` на Tailwind v4,
  вся агентная обвязка (`CLAUDE.md`, `.claude/rules`, скиллы, `docs/stack`),
  `pnpm check`, lefthook, Dockerfile-паттерн и `/release`.

### 6.2 Почему не «однозначно», а «с условиями»

Astro — лидер с отрывом в 82,5 балла, но два его минуса реальны и требуют дисциплины,
а не игнорирования: **быстрый мажор-темп** (6.0 → 7.0 за 3,5 месяца, поддержка
«security-only на один предыдущий мажор») и **новый владелец**. Оба смягчаются
процедурами, а не выбором другого фреймворка.

### 6.3 Условия пересмотра (что должно случиться, чтобы решение переиграли)

| # | триггер | как проверять | что делать |
|---|---|---|---|
| R-1 | `memoryCache()` перестаёт быть дефолтным провайдером, или route caching уходит в платный/CDN-only контур | релиз-ноуты Astro 8.x; наличие `memoryCache` в `astro/config` | к SvelteKit 2/3 + собственный кеш, либо к Next 16 |
| R-2 | Astro меняет лицензию или закрывает governance | `LICENSE` в `withastro/astro`, `GOVERNANCE.md` | немедленный пересмотр; код MIT остаётся, но форк-риск ↑ |
| R-3 | Мажор Astro выходит чаще, чем шаблон успевает пройти `pnpm check` + прогнать `/de-template` (порог: > 2 мажоров за 6 мес с ломающими правками контент-слоя) | git log тегов + `guides/upgrade-to/vN` | зафиксировать мажор в шаблоне и переходить раз в 2 мажора |
| R-4 | Профиль форка уезжает в «приложение» (кабинет — основной сценарий, < 50 % публичных маршрутов) | вопросы `/stack-deep-dive` в kind `rendering` | форкать `spa-frontend-template`, не этот |
| R-5 | Инфра уходит от «одна реплика на VPS» к нескольким инстансам с общим кешем | `compose/site.yml`, `container_name`/`replicas` | Next 16 с `cacheHandler`, либо Redis-провайдер кеша под Astro (писать самим) |
| R-6 | Появляется требование письменного LTS (тендер/комплаенс) | требования заказчика | Next 16 (`nextjs.org/support-policy`) |

### 6.4 Запасной вариант

**Первый запасной — Nuxt 4.5** (Σ 355), если приоритет смещается с «пола JS» на
«максимум SEO из коробки и минимум собственного кода»: Nuxt SEO 5 закрывает A-1…A-3,
A-5…A-8 практически целиком, `NUXT_SITE_URL` решает развилку для SSR-ответов, а Nitro v2
даёт `swr` и graceful shutdown штатно. Цена — FSD-ремаппинг (`srcDir: app/`, автоимпорты,
`.vue`-в-`pages`-это-маршрут), Vue вместо любого UI, худшее поле по CWV и **запланированная
миграция на Nuxt 5 / Nitro v3 в ~Q4 2026**.

**Второй запасной — Next.js 16.3** (Σ 347,5), если решающим становится риск-профиль:
единственная письменная LTS-политика, настоящий ISR на диске, крупнейшая экосистема и
найм. Цена — коллизия `app/` с FSD, RSC-модель, Turbopack вместо Vite, ноль контент-слоя
и отсутствие метрик размера бандла в билде.

**Не запасной вариант — SvelteKit**, несмотря на 4-е место и лучший «ноль JS»: пустоты в
SEO и контенте удваивают §5.1, а `3.0` в `next`-канале с удалением `$env/*` делает
runtime-config зоной гарантированной миграции. Он становится кандидатом №1 **только** если
владелец готов писать SEO-слой шаблона целиком своими руками и считает это активом
(в пользу этого играет лучший в подборке AI-тулинг: `llms-full.txt` + официальный MCP
`@sveltejs/mcp` + `sv add ai-tools` с готовым блоком для `CLAUDE.md`).

### 6.5 Нужен ли дополнительный spike

**Нет.** Топ-3 (Astro, Nuxt, Next) полностью покрыт спайками второго раунда
(08 astro, 09 nuxt, 11 next), четвёртый спайк (10 sveltekit) покрывает 4-е место.
**Добавлять spike по SolidStart 2 или Qwik 2 не нужно**, и вот почему — это ответ на
прямой вопрос брифа:

- **SolidStart 2** (Σ 242,5, 10-е место): фреймворка сайта в нём нет. Нет метаданных в
  поставке, нет sitemap/robots/RSS, нет i18n-роутинга, нет image-пайплайна, нет MDX
  (официальные пакеты мертвы), нет островов (`islands?: false` на уровне типа),
  **нет прод-сервера** (проверено эмпирически: выход билда — H3-приложение, а не сервер;
  всё остальное делегировано **beta-Nitro v3 на RC-h3**). Спайк подтвердит ровно это —
  а это уже подтверждено чтением исходников и попыткой запуска.
- **Qwik 2** (Σ 285, 8-е место): `latest` — beta, GA не обещан с февраля 2024, а главное —
  **официальных доков на v2 не существует** (qwik.dev документирует Qwik 1 /
  `@builder.io/*`; доки v2 живут на preview-урлах Cloudflare Pages; `llms.txt` — 404).
  Для шаблона, который читают и пишут агенты, это дисквалифицирующий фактор независимо от
  качества кода. Плюс измеренный «пол» 42,7 КБ gzip на странице без единого обработчика и
  незакрытый баг over-preloading (PR #9005, открыт на 2026-09-16).

**Что стоит добавить вместо спайка** — два коротких целевых эксперимента внутри
уже существующего `spike-astro/` (≤ 1 час каждый), потому что именно они решают судьбу
рекомендации:

1. **Кеш-эксперимент**: `cache: { provider: memoryCache() }` + `routeRules` на реальном
   `@astrojs/node` standalone — снять `X-Astro-Cache` на MISS/HIT/STALE, замерить TTFB
   кеш-хита против prerender-файла, проверить `cache.invalidate({ tags })` и поведение
   ключа при `?utm_source=…`. Это верификация главного аргумента §4.1-B.
2. **Гейт-эксперимент**: поднять ESLint 10 + `eslint-plugin-astro@3` + Steiger на
   FSD-дереве с `_`-колокацией и убедиться, что (а) кросс-слайсовый импорт из frontmatter
   `.astro` ловится, (б) deep-import в `.astro` ловится `no-restricted-imports`,
   (в) `pnpm check` зелёный. Это верификация оценки 4,5 по критерию «наследие».
---

## 7. Мини-бенчмарк «пол JS» (сделан)

Одна и та же статическая контентная страница — `<h1>`, три абзаца, список из пяти ссылок,
одна растровая картинка 320×180 с явными `width`/`height` — собрана в четырёх
фреймворках, которые **не покрыты** спайками 08–11. Никакого интерактива, ни одного
обработчика событий. Всё, что приезжает сверх HTML, — цена фреймворка.

Машина: Node v24.9.0, pnpm 10.33.0, Linux 6.12, 2026-09-16.
Каталоги: `scratchpad/bench/{eleventy,rr8,solidstart,qwik}/`.
Скрипт замера: `scratchpad/bench/measure.sh` (дедуп по URL; в «JS» попадает всё, что
браузер реально запросит при загрузке документа: `<script src>`, `rel=modulepreload`,
`rel=preload as=script` и бандлы, на которые ссылаются инлайновые скрипты).

### 7.1 Результаты

| фреймворк | режим | HTML raw / gzip | инлайн-`<script>` | JS raw / gzip | CSS raw / gzip | выход сборки | `build` |
|---|---|---|---|---|---|---|---|
| **Eleventy 3.1.6** | SSG | **1 446 / 764 Б** | 0 | **0 / 0** | 303 / 226 Б | 3,3 КБ | 0,45 с |
| **SolidStart 2.0.5** | SSR | 2 461 / 1 227 Б | 366 Б | **39 175 / 15 330 Б** | 17 154 / 3 358 Б | 272 КБ | 2,67 с |
| **Qwik 2.0.0-beta.43** | SSG | 5 473 / 2 722 Б | 2 686 Б | **116 131 / 42 657 Б** | инлайн 311 Б | 206 КБ | 2,03 с |
| **React Router 8.4.0** | prerender (`ssr: true`) | 5 097 / 2 071 Б | 2 983 Б | **335 493 / 106 922 Б** | 299 / 223 Б | 350 КБ | 3,03 с |

Разбивка JS по файлам:

- **SolidStart**: `entry-client-*.js` 21 701/8 521 + `web-*.js` 17 474/6 809.
  Чанк маршрута `index-*.js` (1,35 КБ) **не** загружается на первом рендере.
- **Qwik**: `q-DZYfwtOh.js` 5 132/2 366 (qwikloader) + `q-CmBO-mIk.js` 3 634/1 719
  (preloader) + **`q-_D_5TxLl.js` 107 365/38 572 через `<link rel="modulepreload">`** +
  `bundle-graph.json` 1 226/722 через `rel=preload as=fetch`.
- **React Router**: `entry.client-*.js` 214 784/66 225 + `jsx-runtime-*.js` 85 244/27 898 +
  `errorBoundaries-*.js` 32 526/11 320 + `root-*.js` 510/316 + `home-*.js` 1 516/806 +
  `manifest-*.js` 913/357 (грузится из инлайнового импорта).

### 7.2 Три вывода, которые меняют оценки

1. **Разница между «HTML-first» и «SPA-рантайм» — два порядка, а не проценты.**
   0 Б → 15,3 КБ → 42,7 КБ → 106,9 КБ gzip на **одинаковой** странице без интерактива.
   На VPS без CDN это прямой счёт за трафик и прямой LCP на мобильном.
2. **Заявленный «пол» Qwik и фактический расходятся в 10 раз.** Доки обещают
   qwikloader «about 1 kb minified»; фактический артефакт v2 — 5 222 Б raw / 2 382 Б gzip,
   плюс preloader 2 062 Б gzip, **плюс 38,6 КБ gzip ядра, которое SSR сам кладёт в
   `<link rel="modulepreload">` на странице без единого обработчика**. Это и есть
   локальное воспроизведение аномалии HTTP Archive (§2.9).
3. **SolidStart тащит в прод CSS девтулза.** `entry-client-*.css` = 17 154 Б при том, что
   собственный стиль страницы — 303 Б: в бандл попадают стили дев-оверлея
   (`[data-start-icon-button]{…}`). Пересборка с `solidStart({ devOverlay: false })` даёт
   **байт-в-байт тот же файл** (тот же хеш `CNGh3uVC`) — то есть опция на это не влияет.
   ≈ 3,1 КБ gzip мёртвого CSS на каждой странице.

### 7.3 Команды воспроизведения

```sh
B=scratchpad/bench

# Eleventy
cd $B/eleventy && pnpm install && pnpm build
cd _site && python3 -m http.server 3205 --bind 127.0.0.1 &
$B/measure.sh eleventy http://127.0.0.1:3205

# React Router 8 (prerender)
cd $B/rr8 && pnpm install && pnpm build        # react-router build
cd build/client && python3 -m http.server 3206 --bind 127.0.0.1 &
$B/measure.sh rr8 http://127.0.0.1:3206

# SolidStart 2 (SSR; прод-сервера в поставке нет — свой serve.mjs на 40 строк)
cd $B/solidstart && pnpm install && pnpm build  # vite build
PORT=3207 node serve.mjs &
$B/measure.sh solidstart http://127.0.0.1:3207

# Qwik 2 (SSG через adapters/static)
cd $B/qwik && pnpm install && pnpm build        # vite build && vite build -c adapters/static/vite.config.ts
cd dist && python3 -m http.server 3208 --bind 127.0.0.1 &
$B/measure.sh qwik http://127.0.0.1:3208
```

Все четыре сервера остановлены после замеров (порты 3205–3208 свободны).

### 7.4 Чего бенчмарк **не** мерил

TTFB, RSS процесса, размер Docker-образа, поведение под нагрузкой, CWV в браузере —
это делают спайки 08–11 по единой таблице `brief-v2.md`. Цифры по Astro / Nuxt /
SvelteKit / Next сюда сознательно не переносились, чтобы не дублировать чужие потоки;
сопоставлять их надо по колонкам «HTML gzip» и «JS gzip» той же таблицы.

---

## 8. Риски и вопросы владельцу

### 8.1 Риски принятого решения

| # | риск | вероятность | цена | митигация |
|---|---|---|---|---|
| 1 | **Мажор Astro раз в ~3,5 месяца**, поддержка только «security-only на один предыдущий мажор» | высокая | ломающие правки в форках потребителей, которые обновляются несинхронно | политика апгрейда в `docs/stack/runtime.md`: `npx @astrojs/upgrade` + обязательный `pnpm check`; шаблон живёт на **N** мажоре, форки — не дальше **N−1** |
| 2 | **Сдвиг приоритетов Astro к Cloudflare** после поглощения | средняя | фичи self-host получают меньше внимания | мониторить R-1/R-2 из §6.3; не заводить ни одной Cloudflare-зависимости |
| 3 | **Смена дефолтного Markdown-процессора (Sätteri)** в 7.0 | уже случилась | привычные remark/rehype-рецепты не работают | зафиксировать в шаблоне явную конфигурацию `@astrojs/markdown-remark`, покрыть тестом на подсветку кода и GFM-таблицы |
| 4 | **Container API экспериментален** ⇒ нет стабильного компонентного теста `.astro` | высокая | часть канона Q-2/Q-3 уезжает в e2e | принять: `.astro` покрывается Playwright'ом, Vitest покрывает `.ts` (схемы, seo-хелперы, lib) |
| 5 | **Нет `llms.txt`** у Astro | факт | агент чаще «фантазирует» API | выдержки по критичным API (cache/routeRules/content layer/i18n) положить в `.claude/rules/astro-*.md` при реализации |
| 6 | **ESLint 9 → 10** в гейте | факт | расхождение гейтов SPA- и SSR-шаблонов | либо поднять ESLint 10 в обоих шаблонах, либо принять расхождение и записать в `docs/reference/ecosystem.md` |
| 7 | **`@astrojs/node` без graceful shutdown и healthcheck** | факт | окно 502 при `make bump` | `/healthz` + свой SIGTERM-drain (A-10); Traefik-side healthcheck и `--wait` в `make bump` (`04` §2.8) |
| 8 | **Кеш в памяти процесса теряется на рестарте** | факт | первый посетитель после релиза платит за рендер | прогрев (A-16); принять как фичу — релиз = атомарная публикация (`14` §2.2.5) |

### 8.2 Вопросы, требующие решения владельца

1. **ESLint 10 в обоих шаблонах или расхождение гейтов?** Astro тянет ESLint 10;
   SPA-шаблон на 9.39.5. Поднимать ли SPA заодно — решение о синхронности экосистемы.
2. **Prerender включаем или нет в дефолте шаблона?** Рекомендация — **нет** (SSR + кеш,
   вариант D), prerender как опция. Это влияет на то, попадёт ли в шаблон механика
   штамповки `__SITE_ORIGIN__` (A-11) и запрет предсжатия HTML.
3. **Zod: `astro/zod` или свой `zod`?** Astro ре-экспортирует Zod 4. Использовать
   ре-экспорт (меньше риск рассинхрона) или держать прямой `zod@^4` как в SPA-шаблоне
   (единообразие контрактов между шаблонами)? Рекомендация — `astro/zod` для схем
   контента, прямой `zod` для API-контрактов в `entities/*/model/schema.ts`.
4. **Компонентные тесты `.astro`**: принять «только Playwright» или взять экспериментальный
   Container API с явной пометкой риска? Рекомендация — первое.
5. **Острова на чём?** Astro позволяет React (реюз кусков SPA-шаблона), Svelte, Solid,
   Preact или ничего. Для «интерактив точечный» дешевле всего **без фреймворка**
   (`<script>` в `.astro`) + Preact/Solid там, где нужно состояние; React — только если
   реюз конкретных компонентов SPA имеет цену. Это влияет на `docs/stack/rendering.md`
   и на весь раздел «гидрация» канона FSD-карты.
6. **OG-картинки — генерировать или нет в базовой поставке?** Satori + sharp в образе
   стоят места и сложности; альтернатива — статическая OG на бренд + per-post обложка
   из контента. Рекомендация — второе в базе, генератор как опция.
7. **`landing-template` остаётся отдельной строкой витрины?** Astro покрывает и лендинги,
   и блоги, и доки одним шаблоном — стоит ли `landing-template` вообще существовать
   (вопрос из `13` §2.1, теперь с фактурой: технической причины разделять нет).
---

## 9. Источники

Все URL проверены **2026-09-16**, если не указано иное.

### Astro
- https://docs.astro.build/en/guides/caching/ — route caching, `memoryCache()`, `routeRules`, dev-поведение
- https://docs.astro.build/en/reference/cache-provider-reference/ — `CacheOptions`, `cache.invalidate`, `X-Astro-Cache`, интерфейс `CacheProvider`
- https://docs.astro.build/en/reference/experimental-flags/ — route caching в списке **отсутствует** (⇒ стабилен)
- https://docs.astro.build/en/guides/integrations-guide/node/ — `mode`, `staticHeaders`, `experimentalDisableStreaming`, `bodySizeLimit`, `HOST`/`PORT`, `immutable` на `_astro/**`
- https://docs.astro.build/en/guides/content-collections/ — Content Layer, `glob`/`file`/кастомные loaders, live collections
- https://docs.astro.build/en/reference/modules/astro-content/ — `getCollection`/`getEntry`/`render`/`reference`
- https://docs.astro.build/en/reference/modules/astro-zod/ — «supports all of the features of Zod 4»
- https://docs.astro.build/en/guides/routing/ — `_`-префикс исключает из роутинга; приоритеты; `redirects`
- https://docs.astro.build/en/reference/configuration-reference/ — `srcDir`/`publicDir`/`outDir`/`site`/`trailingSlash`/`fetchFile`
- https://docs.astro.build/en/basics/project-structure/ — «the only directory reserved by Astro is `src/pages/`»; «not required» про components/layouts
- https://docs.astro.build/en/guides/integrations-guide/sitemap/ — требует `site`; «cannot generate sitemap entries for dynamic routes in SSR mode»; `i18n`/hreflang; `entryLimit`
- https://docs.astro.build/en/guides/internationalization/ — `i18n`-конфиг, `astro:i18n`-хелперы (hreflang-хелпера нет)
- https://docs.astro.build/en/reference/directives-reference/ — `client:*`, `server:defer`
- https://docs.astro.build/en/guides/images/ — `astro:assets`, `<Picture>`, `layout`, sharp
- https://docs.astro.build/en/guides/fonts/ — Fonts API, `import { Font } from "astro:assets"`
- https://docs.astro.build/en/guides/environment-variables/ — `astro:env`, `envField`, server secret ⇒ рантайм
- https://docs.astro.build/en/guides/testing/ — `getViteConfig` из `astro/config`
- https://docs.astro.build/en/reference/container-reference/ — «experimental and subject to breaking changes, even in minor or patch releases»
- https://docs.astro.build/en/reference/cli-reference/ — `astro check`
- https://docs.astro.build/en/upgrade-astro/ — «security fixes only for one previous major version»
- https://docs.astro.build/en/guides/upgrade-to/v7/ — Vite 8, Rust-компилятор, `compressHTML: 'jsx'`, Sätteri, `src/fetch.ts`, удаление `@astrojs/db`
- https://docs.astro.build/en/reference/modules/astro-fetch/ , https://docs.astro.build/en/reference/modules/astro-hono/ — Advanced Routing
- https://astro.build/blog/astro-6/ , https://astro.build/blog/astro-7/ — даты мажоров 2026-03-10 / 2026-06-22
- **Cloudflare**: https://astro.build/blog/joining-cloudflare/ (2026-01-16) · https://blog.cloudflare.com/astro-joins-cloudflare/ · https://www.cloudflare.com/press/press-releases/2026/cloudflare-acquires-astro-to-accelerate-the-future-of-high-performance-web-development/
- https://github.com/withastro/astro/releases

### Nuxt / Nitro
- https://nuxt.com/docs/4.x/guide/concepts/rendering — `routeRules`, `isr` (Netlify/Vercel), гибрид
- https://nuxt.com/docs/4.x/guide/going-further/features — `routeRules.noScripts`
- https://nuxt.com/docs/4.x/guide/going-further/experimental-features — `componentIslands`, `ssrStreaming`
- https://nuxt.com/docs/4.x/guide/concepts/auto-imports — `imports: { autoImport: false }`
- https://nuxt.com/docs/4.x/directory-structure/nuxtignore , хук `pages:extend`
- https://nuxt.com/docs/4.x/community/roadmap — Nuxt 5 «Scheduled» ~Q4 2026; LTS ≥ 6 мес; даты Nuxt 3/4
- https://nuxt.com/docs/5.x/getting-started/upgrade — breaking changes Nuxt 5 (Nitro v3, h3 v2, `nuxt/server`, `nitroLegacy`)
- https://nuxt.com/blog/v4-5 — «invisible plumbing for Nuxt 5»
- **https://v2.nitro.build/guide/cache** — memory driver в проде, `useStorage('cache').removeItem`, отсутствие `.invalidate()` в v2
- **https://v2.nitro.build/config#routerules** , https://v2.nitro.build/deploy/runtimes/node — `NITRO_SHUTDOWN_*`, `PORT`/`HOST`
- https://nitro.build/config — prerender-опции (**внимание: голый домен = Nitro v3 beta**)
- https://content.nuxt.com/docs/getting-started/installation , /configuration , /docs/utils/query-collection
- https://nuxtseo.com/site-config/getting-started/how-it-works — **`NUXT_SITE_URL`**, приоритет источников
- https://nuxtseo.com/docs/og-image/v5/guides/satori , /chromium
- https://i18n.nuxtjs.org/docs/guide/seo — `useLocaleHead`, hreflang, `baseUrl`
- https://nuxt.com/llms.txt (200)

### SvelteKit / Svelte
- https://svelte.dev/docs/kit/page-options — `prerender: true|false|'auto'`, `ssr`, **`csr = false`** («does not ship any JavaScript to the client»), `trailingSlash`
- https://svelte.dev/docs/kit/adapter-node — env (включая `KEEP_ALIVE_TIMEOUT`), graceful shutdown, `sveltekit:shutdown`, кастомный сервер, `@polka/compression`
- https://svelte.dev/docs/kit/load — `setHeaders`
- https://svelte.dev/docs/kit/$env-dynamic-public , https://svelte.dev/docs/kit/migrating-to-sveltekit-2 — запрет динамических env при prerender, `/_app/env.js`
- https://svelte.dev/docs/kit/environment-variables — `explicitEnvironmentVariables`, «`$env/*` … will be removed» в 3.0
- https://svelte.dev/docs/kit/seo — sitemap только примером
- https://svelte.dev/docs/kit/form-actions — работа без JS
- https://svelte.dev/docs/kit/remote-functions — experimental, вне semver
- https://svelte.dev/docs/kit/images — `@sveltejs/enhanced-img`, ограничение build-time
- https://svelte.dev/docs/kit/configuration#files — `files.routes` с тегом `@deprecated`
- https://github.com/sveltejs/kit/pull/15482 — «this PR **undeprecates** the `kit.files` options» (2.54.0, 2026-03-11)
- https://svelte.dev/docs/cli/paraglide , https://svelte.dev/docs/cli/mdsvex , https://svelte.dev/docs/ai (MCP `@sveltejs/mcp`)
- https://svelte.dev/llms.txt · llms-full/medium/small · docs/kit/llms.txt

### Next.js / React Router
- https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents — top-level `cacheComponents`, удаление `experimental.ppr`
- https://nextjs.org/docs/app/api-reference/directives/use-cache , /functions/cacheLife
- https://nextjs.org/docs/app/guides/self-hosting , /guides/incremental-static-regeneration — ISR на локальном диске, `x-nextjs-cache`, `cacheHandler`
- https://nextjs.org/docs/app/api-reference/config/next-config-js/output — `standalone`, копирование `public`/`.next/static`
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy — Node-runtime, `matcher`
- https://nextjs.org/docs/app/api-reference/functions/generate-metadata , /file-conventions/metadata/{sitemap,robots,opengraph-image}
- https://nextjs.org/docs/app/guides/environment-variables — «`NEXT_PUBLIC_` variables will be frozen»; «singular Docker image … promoted through multiple environments»
- https://nextjs.org/docs/messages/sharp-missing-in-production , /docs/app/api-reference/components/image
- https://nextjs.org/docs/app/api-reference/cli/next — «JS bundle size metrics have been removed from `next build`»
- https://nextjs.org/support-policy — Active LTS / Maintenance LTS 2 года
- https://nextjs.org/docs/llms.txt
- https://reactrouter.com/start/framework/rendering , /how-to/pre-rendering , /api/framework-conventions/react-router.config.ts
- https://reactrouter.com/api/other-api/serve — «built with Express»
- https://reactrouter.com/how-to/headers , /api/utils/{data,redirect} , /how-to/react-server-components
- https://reactrouter.com/upgrading/v7 , https://remix.run/blog/react-router-v8 — ESM-only, годовой каденс

### SolidStart / Qwik
- https://github.com/solidjs/solid-start/discussions/2281 — «SolidStart v2 is now Stable» (2026-08-04)
- https://docs.solidjs.com/solid-start/v2/migrating-from-v1 , /reference/config/solid-start , /reference/server/http-status-code , /advanced/return-responses , /building-your-application/{head-and-metadata,route-prerendering}
- https://docs.solidjs.com/llms.txt (+ raw `.md` по каждой странице)
- локально: `node_modules/@solidjs/start/dist/config/index.d.ts` — «Enable islands architecture mode. Currently fixed to `false` (not yet fully supported)»
- https://qwik.dev/docs/advanced/qwikloader/ («about 1 kb minified»), /docs/advanced/modules-prefetching/ («By default, Qwik will prefetch any event handlers on the page»), /docs/caching/
- https://github.com/QwikDev/qwik/pull/8984 (закрыт 2026-09-14) и https://github.com/QwikDev/qwik/pull/9005 (**открыт**) — over-preloading
- https://qwik.dev/blog/qwik-next-leap/ (2024-03-26) — governance, переезд в `QwikDev`, скоуп `@qwik.dev`
- https://qwik.dev/blog/qwik-2-coming-soon/ (2024-02-09) — последний официальный пост про v2
- локально: `node_modules/@qwik.dev/router/lib/vite/index.d.ts` — `routesDir`, `mdx`, `imageOptimization`, `ssrCacheSize`, `sitemapOutFile`

### Eleventy / Fresh / Hono
- https://www.11ty.dev/blog/build-awesome/ (2026-03-03) — «Eleventy v4 will be Build Awesome v4», Build Awesome Pro
- https://github.com/11ty/buildawesome/releases/tag/v4.0.0-alpha.10
- npm `@11ty/eleventy` dist-tags: `latest 3.1.6`, `canary 4.0.0-alpha.10`
- https://hono.dev/docs/guides/jsx , https://hono.dev/llms.txt
- npm `fresh` — пакет jshttp (не Deno Fresh); Deno Fresh распространяется через JSR

### Инструменты гейта
- https://biomejs.dev/internals/language-support/ — Vue/Svelte/Astro 🟡 по всем осям; `html.experimentalFullSupportEnabled`
- npm peerDependencies: `eslint-plugin-astro` ≥2.0.0 → `eslint >= 10.0.0` (1.7.0 — последняя для ESLint 9)
- локально: `@feature-sliced/steiger-plugin@0.7.0/dist/index.js` (tree-sitter astro/svelte/vue/tsx + injection-запросы), `@feature-sliced/filesystem@3.1.0/dist/index.js` (`ts.resolveModuleName`)

### Поле
- HTTP Archive Technology Report, срез **2026-08-01**, geo=ALL, rank=ALL:
  `https://cdn.httparchive.org/v1/{cwv,page-weight,lighthouse,adoption}?technology=<tech>&geo=ALL&rank=ALL&start=latest`
  (выгрузка — `scratchpad/v2/ha_table.txt`, скрипт `scratchpad/v2/pull.py`)

### Смежные отчёты этой сессии
`brief.md` · `brief-v2.md` · `ROUND2-CONTEXT.md` ·
`research/01-frameworks.md` (матрица раунда 1, разбор TanStack Start) ·
`research/02-seo-canon.md` §3.2 (MUST/SHOULD/MAY) ·
`research/04-runtime-deploy.md` (Node-образ, Traefik/CrowdSec, кеш без CDN) ·
`research/06-spike.md` (эмпирика TanStack Start) ·
`research/13-template-v2.md` (дизайн шаблона, kinds, канон FSD) ·
`research/14-content-architecture.md` §2.2 (развилка prerender ⊥ runtime `SITE_URL`)
