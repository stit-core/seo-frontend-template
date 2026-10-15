---
description: FSD под Astro — слои, навязанные entry, public API, сервер и клиент, размещение; границы держит ESLint.
paths: ["src/**/*.ts", "src/**/*.astro", "steiger.config.ts", "eslint.config.js", ".gate-fixtures/**"]
---

# FSD-архитектура (Astro)

## Слои (строго нисходяще)

```
app → pages → widgets → features → entities → shared
```

- `app` и `shared` — sliceless (слой == слайс); остальные — слайсы, **между слайсами
  одного слоя импорт запрещён**: общее поднимается в `entities`/`shared` или
  композируется в widget/page
- **Единственный импорт вверх**: страница импортирует документ-шелл `app/layouts/*` —
  Astro не оборачивает страницы снаружи. `app` не импортирует `pages` (иначе цикл), остальной
  `app` из `pages` недоступен — политики в `eslint.config.js`

## `src/pages` = роутинг Astro

Страница — один файл маршрута на все локали: `[...locale]/index.astro` → `/` и `/en`; пути и проп
`locale` — из `getStaticPaths` (`localeRoutes`, `shared/strategy`: языки страницы — строка карты),
у дефолтной локали сегмента нет. Служебный маршрут — свой файл: `healthz.ts` → `/healthz`.
Подпапки — сегменты URL, не слайсы (правила слайсов Steiger на `pages` выключены).
Файлы одной страницы — её разметка, общая для локалей, и `.ts`-модель — рядом, в
`src/pages/_<name>/` (префикс `_` вне роутинга); widget — только при ≥ 2 страницах. Server route —
`src/pages/<name>.ts` с `export const prerender = false`. `src/pages/_image.ts` — не файл
страницы, а обработчик маршрута `/_image`, который вводит сам Astro (`image.endpoint` в
`astro.config.ts`).

## Навязанные Astro точки входа

`src/content.config.ts`, `src/middleware.ts`, `src/env.d.ts` — не слои, а тонкие входы:
реэкспорт (`middleware.ts`), регистрация коллекций (`content.config.ts`) или декларация типов
(`env.d.ts`). ESLint знает их списком `ASTRO_ENTRIES` (`eslint.config.js`; импорт — только
`app` и `entities`, `no-restricted-imports` выключен), Steiger их игнорирует. Логика — в
`app/middleware`, `features/<x>/api`, `entities/<x>/model`. Любой другой файл вне слоёв
(`src/components`, `src/lib`, новый вход Astro) — ошибка `boundaries/no-unknown-files`: вход
заводится строкой в `ASTRO_ENTRIES`.
`content.config.ts` импортирует коллекцию **напрямую из модуля** слайса
(`@/entities/<x>/model/collection`): через баррель dev-сервер теряет конфиг контента. Там же
коллекция получает данные соседнего слайса, которые нужны её схеме (id реестра авторов).

## Public API

- `index.ts` на каждом слайсе и сегменте `shared`; explicit re-exports, в том числе
  `.astro`: `export { default as PostCard } from './ui/post-card.astro'`. Сегменты `app`
  (`layouts`, `middleware`, `styles`) — модули, не баррели: импортируются по пути
  (`@/app/layouts/document.astro`, `@/app/middleware`)
- В `index.ts` слайса и сегмента `shared` (и примитива `shared/ui/<name>`, `shared/lib/<name>`) —
  **только** `export { x } from './…'`: без импортов, объявлений и top-level вызовов (баррель
  исполнял бы свой код у каждого импортёра) — ESLint `no-restricted-syntax`
- Примитивы Astro и Node (`astro:*`, `node:*`) public API **не раздаёт** — ESLint
  `no-restricted-imports` в баррелях; данные страница берёт запросами слайса (фильтр
  черновиков, локаль), а не `getCollection` напрямую
- Deep-import запрещён: `@/<layer>/<slice>/…` — `no-restricted-imports` по
  `@/<layer>/*/*`; `shared` — `@/shared/<segment>`, `@/shared/ui/<name>`,
  `@/shared/lib/<name>`
- Внутри слайса — относительные пути; снаружи — `@/<layer>/<slice>`: относительный путь из
  слайса в каталог слоя (`../../entities/…`) — та же ошибка `no-restricted-imports`

## Сервер и клиент

Frontmatter `.astro` и модули `.ts` исполняются на сервере — на сборке или на запросе, поэтому
серверный код (запросы к `astro:content`, env процесса, Sentry) в слайсах и за их баррелями
законен. Клиентский код — только `<script>` острова (rule `shared-ui`): в бандл уезжает всё, что
за его импортами, и баррель `@/shared/config` притащил бы Zod и env процесса. Поэтому
клиентский `<script>` импортирует только свой слайс и модули без серверного кода —
`CLIENT_MODULES` в `eslint.config.js` (`@/shared/lib`, `@/shared/i18n`); другое — ошибка
`no-restricted-imports`, данные сервера острову передаёт разметка (`data-*`, `define:vars`).

## Сегменты слайса

`ui/` `model/` `api/` `lib/` `config/` + `content/` (markdown-коллекция сущности:
`content/<locale>/<slug>.md`, обложки в `content/covers/`).
Группировка по типу (`components/`, `hooks/`, `utils/`, `types/`) запрещена — Steiger
`segments-by-purpose`.

## Размещение

| что | где |
|---|---|
| документ-шелл, middleware (лог, адреса `redirects.yaml`, 410), токены ДС и слой сопоставления | `app/layouts/document.astro`, `app/middleware`, `app/styles/{tokens,index}.css` |
| runtime-конфиг, идентичность сайта (`SITE_NAME`, `sameAs`, `OG_DEFAULT_IMAGE`), политика ИИ-ботов, реестр островов `ISLANDS` | `shared/config` |
| дескриптор локалей (код, Intl, OG, самоназвание; первая — дефолтная) и правила адреса по нему, словари каркаса с подстановками `{имя}` (склейку строки словаря шаблонной строкой и `+` валит ESLint), даты | `shared/i18n` |
| SEO: `absoluteUrl`/hreflang, `SeoHead`, фабрики JSON-LD + `JsonLdScript`, генераторы robots/sitemap/rss, реестр ботов `crawlers.yaml` | `shared/seo` |
| тест-хелперы | `shared/lib/testing` |
| канон пути и таблица адресов (данные → правила, ответ на адрес запроса) | `shared/redirects` |
| чтение данных strategy — снимок `strategy/` в корне (бриф, карта, планы, copy deck по языкам, факты; копии каталогов базы `kb/`): страница — секции плана по порядку, тексты слотов по ключу `page/section/slot`, действия, факты, мета и место в карте; локали страниц карты (`localeRoutes` маршрутов), карта переводов, ссылка на страницу на языке страницы или основном, переключатель языка — правилами по проекту (`siteOf`: у сайта — снимок, у тестов — проект фикстуры); правила контракта и схемы читаемых полей — листовой `contract.ts` (его берут и скрипты) | `shared/strategy` |
| проектные UI-примитивы: секция страницы и контейнер каркаса, заголовок, сетка «термин — описание», готовая картинка и ролик-петля | `shared/ui/{section,heading,term-list,media}` |
| каркас сайта, список записей, хлебные крошки (видимые; `BreadcrumbList` из того же массива печатает layout в `<head>`) | `widgets/site-header`, `widgets/site-footer`, `widgets/post-list`, `widgets/breadcrumbs` |
| коллекция контента: `.md`, схема, запросы, карточка/статья | `entities/post/{content,model,api,lib,ui}` |
| реестр авторов и подпись (подпись ставит страница в слот статьи: слайсы одного слоя не импортируют друг друга) | `entities/author/{model,ui}` |
| разметка страниц блога, их модель, `getStaticPaths` и фид (локали делят разметку, модель, пути и фид) | `src/pages/_blog/*.astro`, `src/pages/_blog/sections.ts`, `src/pages/_blog/static-paths.ts`, `src/pages/_blog/feed.ts`, кадры обложки для превью и разметки — `src/pages/_blog/images.ts` (сборочный модуль вне барреля `shared/seo`: on-demand маршрутам конвейер картинок не нужен) |
| SEO-маршруты: on-demand `robots.txt` и ключ IndexNow, prerendered фиды | `src/pages/{robots.txt,[key].txt}.ts`, `src/pages/[...locale]/rss.xml.ts` |
| карта сайта — файл сборки по страницам `dist/client` | интеграция `sitemap-from-build` в `astro.config.ts` + `scripts/lib/sitemap.mjs` (формат — `shared/seo/sitemap.ts`) |

## Кто что проверяет

- **Границы держит `pnpm lint`**: ESLint `boundaries` с резолвером + `no-restricted-imports`
  на всём коде `src` любого расширения, включая клиентские `<script>` в `.astro`; файл вне
  слоёв — `boundaries/no-unknown-files`. Модуль гейта `scripts/` код `src` не импортирует (гейт —
  потребитель `src`, общие данные живут в `src`), импортирует его только тест скрипта гейта. Директива `eslint-disable` в коде не действует
  (`noInlineConfig`), а её предупреждение роняет lint (`--max-warnings 0`): исключение из
  правила — блоком `eslint.config.js` с причиной. Steiger — структура (public API, сегменты,
  имена); он fail-open на `.astro`-целях и `export … from`
- Негативные фикстуры `.gate-fixtures/` (`pnpm check:gate`) обязаны валить
  ESLint/Steiger/Biome. Новое правило границ — новая фикстура + строка в `expected.json`
