# Архитектура

Feature-Sliced Design поверх файлового роутинга Astro. Нормативная часть — правило
`.claude/rules/fsd-architecture.md` (границы держит `pnpm lint`, структуру — `pnpm steiger`);
здесь — карта и объяснения.

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
| `app/` | документ-шелл `layouts/document.astro`, `middleware` (лог, адреса `redirects.yaml`, заголовки), токены ДС и слой сопоставления `styles/{tokens,index}.css`, единственная точка аналитики |
| `pages/` | роутинг: 1 файл = 1 URL; файлы страницы (разметка и модель) — рядом, в `_<name>/` |
| `widgets/` | блоки каталога strategy (`widgets/<block-id>`: секция страницы по плану — первый экран, сетка карточек) и каркас: шапка, подвал, список записей, крошки |
| `features/` | пользовательские сценарии: форма обратной связи, предпочтения посетителя (тема и движение) |
| `entities/` | доменные сущности: коллекция контента `post` (с текстами внутри слайса), реквизиты `company`, реестр авторов `author` |
| `shared/` | инфраструктура: config, i18n, seo, redirects, observability, antispam, lib и примитивы страницы `ui` — секция, заголовок, сетка «термин — описание», медиа (готовая картинка и ролик-петля), действие плана и карточка набора |

### Единственный импорт вверх

`pages → app/layouts`. Astro не оборачивает страницы снаружи: документ-шелл (`<html>`,
`<head>`, лендмарки) страница импортирует сама. Остальной `app` из `pages` недоступен, а `app` не
импортирует `pages` (иначе цикл) — политики в `eslint.config.js`.

## `src/pages` = роутинг

Страница — один файл на все локали: `[...locale]/index.astro` → `/` и `/en`, `[...locale]/about.astro` →
`/about` и `/en/about` (сегмент дефолтной локали пуст, языки страницы — строка карты strategy);
служебный маршрут — свой файл (`healthz.ts` → `/healthz`). Подпапки — сегменты URL, а не слайсы, поэтому правила Steiger о public API и сегментах слайсов
(`public-api`, `no-layer-public-api`, `no-segmentless-slices`, `no-segments-on-sliced-layers`) на
`pages` выключены.

Страница — это `DocumentLayout` и секции `Section` из `@/shared/ui/section`: ширину, фон и ритм
задаёт секция, оболочка страницу не сужает (rule `shared-ui`). Файлы одной страницы живут рядом
с ней: `src/pages/_<name>/` — префикс `_` исключает каталог из роутинга. Секция страницы из
каталога strategy — блок `widgets/<block-id>` при любом числе страниц: пропсы — элементы анатомии
блока каталога, вариант — его вариант, контракт — `defineBlock` (`shared/strategy`) под тестом
«блок ↔ каталог ↔ планы» (rule `fsd-architecture`). Маршрут `pages/[...locale]/about.astro` —
тонкий файл над `pages/_about/about-page.astro`: пути и `locale` — из `getStaticPaths`
(`localeRoutes`, `shared/strategy`).

## Навязанные Astro точки входа

`src/content.config.ts`, `src/middleware.ts`, `src/env.d.ts` — не слои, а тонкие входы:
реэкспорт, декларация типов, регистрация коллекций. Логика — в `app/middleware`,
`entities/<x>/model`, `features/<x>/api`. Других файлов вне слоёв нет: `src/components`,
`src/lib` или новый вход Astro ESLint не пропустит, пока вход не объявлен в `ASTRO_ENTRIES`
`eslint.config.js`.

`content.config.ts` импортирует коллекцию **напрямую из модуля** слайса: через баррель
dev-сервер теряет конфиг контента.

## Public API

`index.ts` на каждом слайсе и каждом сегменте `shared` — explicit re-exports, включая
компоненты:

```ts
export { default as PostCard } from './ui/post-card.astro'
```

Внутри `index.ts` нет импортов, объявлений и вызовов: баррель исполнял бы свой код у каждого
импортёра. Примитивы Astro и Node (`astro:*`, `node:*`) он не раздаёт — страница берёт данные
запросами слайса, а не `getCollection` напрямую.

Frontmatter и модули `.ts` исполняются на сервере (сборка или запрос), поэтому серверный код в
слайсах и за баррелями законен. Клиентский код — только `<script>` острова: он импортирует свой
слайс и модули без серверного кода (`@/shared/lib`, `@/shared/i18n`), а не, например,
`@/shared/config` — тот притащил бы в бандл Zod и env процесса.

Сегменты `app` (`layouts`, `middleware`, `styles`) — модули, а не баррели: у них один
потребитель и нет смысла в промежуточном файле.

## Дерево

```
src/
├─ app/           layouts/document.astro · middleware/ · styles/{tokens,index}.css · analytics/
├─ pages/         [...locale]/{index,about,contacts/{index,spasibo},legal/privacy,blog/**,rss.xml}
│                 · 404 · 500 · now · healthz · robots.txt · [key].txt · api/contact
│                 · файлы страниц _home/ _about/ _contacts/ _privacy/ _blog/
│                 · тесты маршрутов _tests/
├─ widgets/       hero-text · feature-grid (блоки каталога) · site-header · site-footer · post-list · breadcrumbs
├─ features/      contact-form · preferences
├─ entities/      post (content/{ru,en}/*.md + covers, model, api, lib, ui) · company · author
└─ shared/        config · i18n · seo · redirects · strategy · observability · antispam · lib
                  · ui/{section,heading,term-list,media,action,card}
```

## Сегменты слайса

`ui/` `model/` `api/` `lib/` `config/` и — у сущности с текстами — `content/`.
Группировка по типу (`components/`, `hooks/`, `utils/`, `types/`) запрещена: Steiger
`segments-by-purpose`. Внутри слайса — относительные пути, снаружи —
`@/<layer>/<slice>`.

## Кто что проверяет

| инструмент | задача |
|---|---|
| ESLint 10 (`boundaries` + `no-restricted-imports`) | **границы FSD** на всём коде `src`: направление импортов, deep-import (и относительным путём), файлы вне слоёв, примитивы Astro в баррелях, импорты клиентских `<script>`; директива `eslint-disable` в коде не действует |
| Steiger | структура: public API, сегменты, имена; на `.astro`-целях fail-open |
| `astro-check` (`pnpm typecheck`) | типы (`astro/tsconfigs/strictest`) |
| Biome + Prettier | формат и базовые правила; `.astro` форматирует Prettier |
| `.gate-fixtures/` + `pnpm check:gate` | заведомые нарушения обязаны валить линтеры и свои скрипты гейта ровно ожиданиями — иначе гейт деградирует молча |

Новое правило границ или проверка скрипта гейта = новое нарушение в `.gate-fixtures/` и строка в
`expected.json`.

## Тесты

Рядом с модулем: `<name>.test.ts` (unit, happy-dom), `<name>.astro.test.ts` (Container
API + axe), `<name>.server.test.ts` (node-окружение, родные `Request`/`Response`).
E2E — `e2e/` вне FSD-графа, на прод-сборке: HTTP-набор `e2e/http/` — шаг гейта, браузерный
`e2e/browser/` — обязательный шаг `/release`. Дисциплина — правило `.claude/rules/tests-pipeline.md`.

## Гейт

`pnpm check` — состав и что держит каждый шаг: `.claude/rules/tests-pipeline.md` § Gate.
