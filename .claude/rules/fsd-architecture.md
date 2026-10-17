---
description: FSD под Astro — слои, навязанные entry, блок каталога strategy (widgets/<block-id> и его контракт), public API, сервер и клиент, размещение; границы держит ESLint.
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
`src/pages/_<name>/` (префикс `_` вне роутинга); секция страницы из каталога strategy — блок
`widgets/<block-id>` при любом числе страниц (§ Блок каталога). Server route —
`src/pages/<name>.ts` с `export const prerender = false`. `src/pages/_image.ts` — не файл
страницы, а обработчик маршрута `/_image`, который вводит сам Astro (`image.endpoint` в
`astro.config.ts`).

## Блок каталога

Секция страницы — блок каталога strategy (`strategy/kb/site/04-blocks/blocks.yaml`): слайс
`widgets/<block-id>`, имя — id блока каталога; в `widgets` других слайсов нет. Public API слайса —
контракт `<blockName>` и компонент `<BlockName>` (имена — от id блока). Контракт — `model/block.ts`:
`defineBlock` (`shared/strategy`) — варианты каталога, которые блок умеет, и слоты — id элементов
его анатомии с видом значения (`text`, `action`, `fact`, `list`, `group`; действие без цели в
плане — `untargeted`, медиа-слот, который чтение не заполняет, — `media`, текст, который блок
принимает и не показывает, — `unshown`: только успех формы (слот `form-success` блока с формой) — без
JS это страница «спасибо»; дата и картинка записи, которые кладёт страница из коллекции, — `date` и
`image`; набор записей коллекции, который план не заполняет, — `records`); пропсы компонента — `BlockProps` контракта: id секции плана, вариант и слоты. Страница ставит
блок пропсами своей секции (`heroText.props(page, 'hero')`): не та секция, вариант не из блока, слот
вне его анатомии или без значения — ошибка сборки с ключом секции. Значения, которых план не
заполняет, страница кладёт из коллекции третьим аргументом (`articleBody.props(page, 'article-body',
record)`): наборы записей (`records`: свежие, список, связанные) и, у шаблона коллекции, слоты плана без
текста — поля записи (`blank` секции: текста нет в copy deck шаблона, медиа-слот); значение плана запись не
перекрывает, другого элемента не пишет — ошибка сборки с ключом: текст секции — только copy deck. Каркас — тоже блоки каталога, их ставит оболочка (`DocumentLayout`): шапка и подвал
(`header`, `footer`) — секциями плана, который передаёт страница (`chrome` — проп обязателен; страница
без своего плана передаёт план главной), крошки (`breadcrumbs`) — пропом `crumbs`, пропсами секции
крошек плана страницы; своих текстов, пунктов навигации и плана по умолчанию у оболочки нет. Тест
контракта `src/pages/_tests/blocks.astro.test.ts` сверяет блоки с каталогом и планами: каждый widget —
блок каталога с контрактом и компонентом и стоит у секции плана снимка (блок «на будущее» не
заводится), варианты и слоты — из каталога, обязательные элементы приняты, у каждой секции плана —
блок шаблона, его вариант и слоты, которые он принимает; секция плана одной страницы — в разметке
блока: заголовок с id секции уровня каталога, каждый текст и адрес действия, факт без текстов секции
(`binds`) — своей формулировкой (каркас — в своём лендмарке, кроме разделов без версии на языке
страницы); секции шаблонов коллекций — на страницах с записями (тест страниц).

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
  `.astro`: `export { default as ArticleCards } from './ui/article-cards.astro'`. Сегменты `app`
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
| дескриптор локалей (код, Intl, OG, самоназвание; первая — дефолтная) и правила адреса по нему, словари каркаса с подстановками `{имя}` (склейку строки словаря шаблонной строкой и `+` валит ESLint), даты, атрибуты HTML с текстом для человека (`TEXT_ATTRIBUTES`: их судят lint разметки и тест «текст страницы — данные») | `shared/i18n` |
| SEO: `absoluteUrl`/hreflang, `SeoHead`, фабрики JSON-LD + `JsonLdScript`, генераторы robots/sitemap/rss, реестр ботов `crawlers.yaml` | `shared/seo` |
| тест-хелперы | `shared/lib/testing` |
| канон пути и таблица адресов (данные → правила, ответ на адрес запроса) | `shared/redirects` |
| чтение данных strategy — снимок `strategy/` в корне (бриф, карта, планы, copy deck по языкам, факты; копии каталогов базы `kb/`): страница — секции плана по порядку, слоты по элементам анатомии блока (тексты по ключу `page/section/slot`, адреса действий, факты; элемент, который план заполняет не раз, — список), мета, место в карте, типы JSON-LD плана и факты, которые называет страница (`fact:` плана и `fact_ids` её текстов); адрес действия-маршрута — ссылка на страницу карты (версия другого языка — основного или, без неё, любая — с `hreflang`); контракт блока `defineBlock` (секция → пропсы блока, ошибка с ключом секции; пары действие — подпись `labelled`); локали страниц карты (`localeRoutes` маршрутов), карта переводов, ссылка на страницу (версия языка страницы, без неё — основного, без неё — любая), переключатель языка, меню шапки (`menuLinks`: пункты `chrome.header.items` карты × подписи `nav-link` плана), крошки по карте (`breadcrumbsOn`: шаблон с крошками, глубина ≥ 2; секция крошек — в плане такой страницы), правило «связанных» шаблона (`relatedOf`) и страница — правилами по проекту (`siteOf`: у сайта — карта и факты снимка, у тестов — проект фикстуры); страница сайта читает свои план и copy deck модулем по id (`virtual:strategy/<page-id>` → `pageOf`: on-demand маршрут везёт только свою страницу; шаблон коллекции — `templateOf`: в copy deck тексты шаблона, слоты без текста и мету даёт запись), снимок целиком (`snapshot`, `strategyPage`) — проверки по всем страницам; в бандл файлы снимка идут полями схем чтения — плагин `yaml-modules`; правила контракта, схемы читаемых полей и проект из файлов снимка (`projectOf`) — листовой `contract.ts` (его берут скрипты и конфиг сборки: `seo:check` по нему находит план страницы по её адресу — `pageAt` — и границы её типов в head-kit — `headKitTypes`) | `shared/strategy` |
| проектные UI-примитивы: секция страницы и контейнер каркаса, заголовок, сетка «термин — описание», готовая картинка и ролик-петля, действие плана (призыв), карточка набора | `shared/ui/{section,heading,term-list,media,action,card}` |
| блок каталога strategy — секция страницы по плану: контракт, разметка, тест | `widgets/<block-id>/{model/block.ts,ui/<block-id>.astro}` (`hero-text`, `feature-grid`, `prose`, `contact-details`, `lead-form` — над фичей формы, `thank-you`, `not-found`, `legal-text`, `article-cards`, `article-body`, `related-links`) |
| каркас — блоки каталога, которые ставит оболочка: шапка и подвал секциями плана, крошки (видимые; `BreadcrumbList` из того же пропа печатает оболочка в `<head>`) | `widgets/header`, `widgets/footer`, `widgets/breadcrumbs` |
| коллекция контента: `.md`, схема, запросы, пути, запись карточкой списка (данные) | `entities/post/{content,model,api,lib}` |
| реестр авторов: имя и роль по локалям, профиль (подпись записи печатает блок `article-body`) | `entities/author/model` |
| разметка страниц блога (композиция блоков их планов: список, тег, запись), их модель (слоты записи, записи списков, связанные), `getStaticPaths` и фид (локали делят разметку, модель, пути и фид) | `src/pages/_blog/*.astro`, `src/pages/_blog/models.ts`, `src/pages/_blog/static-paths.ts`, `src/pages/_blog/feed.ts`, кадры обложки для превью и разметки — `src/pages/_blog/images.ts` (сборочный модуль вне барреля `shared/seo`: on-demand маршрутам конвейер картинок не нужен) |
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
