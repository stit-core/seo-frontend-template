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

1 файл = 1 URL: `index.astro` → `/`, `en/index.astro` → `/en`, `healthz.ts` → `/healthz`.
Подпапки — сегменты URL, не слайсы (правила слайсов Steiger на `pages` выключены).
Секции одной страницы — рядом, в `src/pages/_<name>/` (префикс `_` вне роутинга);
widget — только при ≥ 2 страницах. Server route — `src/pages/<name>.ts` с
`export const prerender = false`. `src/pages/_image.ts` — не секция, а обработчик маршрута
`/_image`, который вводит сам Astro (`image.endpoint` в `astro.config.ts`).

## Навязанные Astro точки входа

`src/content.config.ts`, `src/middleware.ts`, `src/env.d.ts` — не слои, а тонкие входы:
реэкспорт (`middleware.ts`), регистрация коллекций (`content.config.ts`) или декларация типов
(`env.d.ts`). ESLint знает их списком `ASTRO_ENTRIES` (`eslint.config.js`; импорт — только
`app` и `entities`, `no-restricted-imports` выключен), Steiger их игнорирует. Логика — в
`app/middleware`, `features/<x>/api`, `entities/<x>/model`. Любой другой файл вне слоёв
(`src/components`, `src/lib`, новый вход Astro) — ошибка `boundaries/no-unknown-files`: вход
заводится строкой в `ASTRO_ENTRIES`.
`content.config.ts` импортирует коллекцию **напрямую из модуля** слайса
(`@/entities/<x>/model/collection`): через баррель dev-сервер теряет конфиг контента.

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
| документ-шелл, middleware (лог, редиректы), токены | `app/layouts/document.astro`, `app/middleware`, `app/styles/index.css` |
| runtime-конфиг, идентичность сайта (`SITE_NAME`, `sameAs`, `OG_DEFAULT_IMAGE`) | `shared/config` |
| локали, пути с префиксом, даты | `shared/i18n` |
| SEO: `absoluteUrl`/hreflang, `SeoHead`, фабрики JSON-LD + `JsonLdScript`, генераторы robots/sitemap/rss | `shared/seo` |
| тест-хелперы | `shared/lib/testing` |
| таблица редиректов (данные → Map) | `shared/redirects` |
| проектные UI-примитивы | `shared/ui/<name>/` |
| каркас сайта, список записей, хлебные крошки (видимые; `BreadcrumbList` из того же массива печатает layout в `<head>`) | `widgets/site-header`, `widgets/site-footer`, `widgets/post-list`, `widgets/breadcrumbs` |
| коллекция контента: `.md`, схема, запросы, карточка/статья | `entities/post/{content,model,api,lib,ui}` |
| секции страниц блога, их логика, `getStaticPaths` и фид (ru/en делят разметку, логику, пути и фид) | `src/pages/_blog/*.astro`, `src/pages/_blog/sections.ts`, `src/pages/_blog/static-paths.ts`, `src/pages/_blog/feed.ts` |
| on-demand SEO-маршруты | `src/pages/{robots.txt,sitemap.xml,rss.xml,[key].txt}.ts`, `src/pages/en/rss.xml.ts` |

## Кто что проверяет

- **Границы держит `pnpm lint`**: ESLint `boundaries` с резолвером + `no-restricted-imports`
  на всём коде `src` любого расширения, включая клиентские `<script>` в `.astro`; файл вне
  слоёв — `boundaries/no-unknown-files`. Директива `eslint-disable` в коде не действует
  (`noInlineConfig`), а её предупреждение роняет lint (`--max-warnings 0`): исключение из
  правила — блоком `eslint.config.js` с причиной. Steiger — структура (public API, сегменты,
  имена); он fail-open на `.astro`-целях и `export … from`
- Негативные фикстуры `.gate-fixtures/` (`pnpm check:gate`) обязаны валить
  ESLint/Steiger/Biome. Новое правило границ — новая фикстура + строка в `expected.json`
