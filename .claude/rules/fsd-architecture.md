---
description: FSD под Astro — слои, навязанные entry, public API, server-only, размещение; границы держит ESLint.
globs: ["src/**/*.ts", "src/**/*.astro", "steiger.config.ts", "eslint.config.js", ".gate-fixtures/**"]
---

# FSD-архитектура (Astro)

## Слои (строго нисходяще)

```
app → pages → widgets → features → entities → shared
```

- `app` и `shared` — sliceless (слой == слайс); остальные — слайсы, **между слайсами
  одного слоя импорт запрещён**
- **Единственный импорт вверх**: страница импортирует документ-шелл `app/layouts/*` —
  Astro не оборачивает страницы снаружи. `app/layouts` не импортирует `pages`; остальной
  `app` из `pages` недоступен (policy в `eslint.config.js`)

## `src/pages` = роутинг Astro

1 файл = 1 URL: `index.astro` → `/`, `en/index.astro` → `/en`, `healthz.ts` → `/healthz`.
Подпапки — сегменты URL, не слайсы (правила слайсов Steiger на `pages` выключены).
Секции одной страницы — рядом, в `src/pages/_<name>/` (префикс `_` вне роутинга);
widget — только при ≥ 2 страницах. Server route — `src/pages/<name>.ts` с
`export const prerender = false`.

## Навязанные Astro точки входа

`src/content.config.ts`, `src/middleware.ts`, `src/actions/**`, `src/env.d.ts` — не слои,
а тонкие входы: реэкспорт (`middleware.ts`), пустое объявление (`content.config.ts`) или
декларация типов (`env.d.ts`). Steiger их игнорирует, `no-restricted-imports` на них
выключен. Логика — в `app/middleware`, `features/<x>/api`, `entities/<x>/model`.
`content.config.ts` импортирует коллекцию **напрямую из модуля** слайса
(`@/entities/<x>/model/collection`): через баррель dev-сервер теряет конфиг контента.

## Public API

- `index.ts` на каждом слайсе и сегменте `shared`; explicit re-exports, в том числе
  `.astro`: `export { default as PostCard } from './ui/post-card.astro'`. Сегменты `app`
  (`layouts`, `middleware`, `styles`) — модули, не баррели: импортируются по пути
  (`@/app/layouts/document.astro`, `@/app/middleware`)
- В `index.ts` — **только** `export { x } from './…'`: без импортов, объявлений и
  top-level вызовов (barrel + вызов тянет zod/контент в клиентский граф) —
  ESLint `no-restricted-syntax`
- Server-only (`astro:*`, `node:*`) **не реэкспортируется** из `index.ts` — ESLint
  `no-restricted-imports`. Серверный entry слайса (`api/action.ts`,
  `model/collection.ts`) импортирует только навязанный entry Astro, напрямую
- Deep-import запрещён: `@/<layer>/<slice>/…` — `no-restricted-imports` по
  `@/<layer>/*/*`; `shared` — `@/shared/<segment>`, `@/shared/ui/<name>`,
  `@/shared/lib/<name>`
- Внутри слайса — относительные пути; снаружи — `@/<layer>/<slice>`

## Сегменты слайса

`ui/` `model/` `api/` `lib/` `config/` + `content/` (markdown-коллекция сущности:
`content/<locale>/<slug>.md`, обложки в `content/covers/`).
Группировка по типу (`components/`, `hooks/`, `utils/`, `types/`) запрещена — Steiger
`no-reserved-folder-names`.

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
| секции страниц блога, их `getStaticPaths` и фид (ru/en делят разметку, пути и фид) | `src/pages/_blog/*.astro`, `src/pages/_blog/static-paths.ts`, `src/pages/_blog/feed.ts` |
| on-demand SEO-маршруты | `src/pages/{robots.txt,sitemap.xml,rss.xml,[key].txt}.ts`, `src/pages/en/rss.xml.ts` |

## Кто что проверяет

- **Границы держит `pnpm lint`**: ESLint `boundaries` с резолвером + `no-restricted-imports`
  (в т.ч. клиентские `<script>` в `.astro`). Steiger — структура (public API, сегменты,
  имена); он fail-open на `.astro`-целях и `export … from`
- Негативные фикстуры `.gate-fixtures/` (`pnpm check:gate`) обязаны валить
  ESLint/Steiger/Biome. Новое правило границ — новая фикстура + строка в `expected.json`
