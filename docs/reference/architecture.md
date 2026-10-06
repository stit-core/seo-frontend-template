# Архитектура

Feature-Sliced Design поверх файлового роутинга Astro. Нормативная часть — правило
`.claude/rules/fsd-architecture.md` (его держит `pnpm lint`); здесь — карта и объяснения.

## Слои

```
app → pages → widgets → features → entities → shared
```

Импорт строго **нисходящий**. `app` и `shared` — sliceless (слой = слайс, сегменты внутри
видят друг друга). У остальных слоёв есть слайсы, и **между слайсами одного слоя импорт
запрещён**: общее либо поднимается в `entities`/`shared`, либо композируется в widget или
на странице.

| слой | что лежит |
|---|---|
| `app/` | документ-шелл `layouts/document.astro`, `middleware` (лог, редиректы, заголовки), токен-слой `styles/index.css`, единственная точка аналитики |
| `pages/` | роутинг: 1 файл = 1 URL; секции страниц — рядом, в `_<name>/` |
| `widgets/` | блоки каркаса и переиспользуемые блоки: шапка, подвал, список записей, крошки |
| `features/` | пользовательские сценарии: форма обратной связи, переключатель темы |
| `entities/` | доменные сущности: коллекция контента `post` (с текстами внутри слайса), реквизиты `company` |
| `shared/` | инфраструктура: config, i18n, seo, redirects, observability, antispam, lib, ui |

### Единственный импорт вверх

`pages → app/layouts`. Astro не оборачивает страницы снаружи: документ-шелл (`<html>`,
`<head>`, лендмарки) страница импортирует сама. Остальной `app` из `pages` недоступен —
политика в `eslint.config.js`.

## `src/pages` = роутинг

`index.astro` → `/`, `en/index.astro` → `/en`, `healthz.ts` → `/healthz`. Подпапки —
сегменты URL, а не слайсы, поэтому правила слайсов Steiger на `pages` выключены.

Секции одной страницы живут рядом с ней: `src/pages/_<name>/` — префикс `_` исключает
каталог из роутинга. Widget заводится, когда блок нужен ≥ 2 страницам; иначе Steiger
поймает `insignificant-slice`. Локали делят одну разметку: `pages/about.astro` и
`pages/en/about.astro` — тонкие обёртки над `pages/_about/about-page.astro` с разным
`locale`.

## Навязанные Astro точки входа

`src/content.config.ts`, `src/middleware.ts`, `src/env.d.ts` (и `src/actions/**`, если
появятся) — не слои, а тонкие входы: реэкспорт, декларация типов, регистрация коллекций.
Логика — в `app/middleware`, `entities/<x>/model`, `features/<x>/api`.

`content.config.ts` импортирует коллекцию **напрямую из модуля** слайса: через баррель
dev-сервер теряет конфиг контента.

## Public API

`index.ts` на каждом слайсе и каждом сегменте `shared` — explicit re-exports, включая
компоненты:

```ts
export { default as PostCard } from './ui/post-card.astro'
```

Внутри `index.ts` нет импортов, объявлений и вызовов: баррель с вычисленным значением
тянет zod и контент в любой граф, который его коснулся. Server-only символы (`astro:*`,
`node:*`) из барреля не реэкспортируются — серверный entry слайса импортирует их сам.

Сегменты `app` (`layouts`, `middleware`, `styles`) — модули, а не баррели: у них один
потребитель и нет смысла в промежуточном файле.

## Дерево

```
src/
├─ app/           layouts/document.astro · middleware/ · styles/index.css · analytics/
├─ pages/         index · about · contacts/{index,spasibo} · legal/privacy · blog/**
│                 en/** · 404 · 500 · now · healthz · robots.txt · sitemap.xml
│                 rss.xml · [key].txt · api/contact · секции _about/ _blog/ _contacts/
│                 · тесты маршрутов _tests/
├─ widgets/       site-header · site-footer · post-list · breadcrumbs
├─ features/      contact-form · theme
├─ entities/      post (content/{ru,en}/*.md + covers, model, api, lib, ui) · company
└─ shared/        config · i18n · seo · redirects · observability · antispam · lib · ui
```

## Сегменты слайса

`ui/` `model/` `api/` `lib/` `config/` и — у сущности с текстами — `content/`.
Группировка по типу (`components/`, `hooks/`, `utils/`, `types/`) запрещена: Steiger
`no-reserved-folder-names`. Внутри слайса — относительные пути, снаружи —
`@/<layer>/<slice>`.

## Кто что проверяет

| инструмент | задача |
|---|---|
| ESLint 10 (`boundaries` + `no-restricted-imports`) | **границы FSD**: направление импортов, deep-import, server-only в баррелях, клиентские `<script>` |
| Steiger | структура: public API, сегменты, имена, значимость слайса; на `.astro`-целях fail-open |
| `astro check` | типы (`astro/tsconfigs/strictest`) |
| Biome + Prettier | формат и базовые правила; `.astro` форматирует Prettier |
| `.gate-fixtures/` + `pnpm check:gate` | заведомые нарушения обязаны валить линтеры — иначе гейт деградирует молча |

Новое правило границ = новая фикстура в `.gate-fixtures/` и строка в `expected.json`.

## Тесты

Рядом с модулем: `<name>.test.ts` (unit, happy-dom), `<name>.astro.test.ts` (Container
API + axe), `<name>.server.test.ts` (node-окружение, родные `Request`/`Response`).
E2E — `e2e/` вне FSD-графа, на прод-сборке: HTTP-набор `e2e/http/` — шаг гейта, браузерный
`e2e/browser/` — обязательный шаг `/release`. Дисциплина — правило `.claude/rules/tests-pipeline.md`.

## Гейт

```
plan:check → typecheck → lint → format:check → test → steiger → check:gate → check:content
           → build → check:links → seo:check → size → test:http
```

`pnpm test:e2e` — браузерный набор, обязательный шаг `/release`: в гейт не входит, тянет браузер.
