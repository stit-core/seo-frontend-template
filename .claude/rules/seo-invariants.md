---
description: SEO-канон шаблона — head через DocumentLayout (title/description уникальны, self-canonical, hreflang только для реальных переводов, OG полный), JSON-LD в head только про видимое и только допустимые типы, одна организация и авторы по @id, политика ИИ-ботов из реестра базы, robots.txt/sitemap.xml/rss.xml/ключ IndexNow on-demand на runtime origin, staging в три контура, ботам тот же ответ, гейты seo:check и HTTP-набор.
paths: ["src/shared/seo/**", "src/shared/config/site.ts", "src/app/layouts/**", "src/pages/**", "src/widgets/breadcrumbs/**", "scripts/seo-check.mjs", "scripts/lib/html.mjs", "e2e/http/**", "public/**"]
---

# SEO-инварианты

Всё, что читает краулер, — в первом HTML: `<head>` собирает `app/layouts/document.astro` из
props страницы (`shared/seo/seo-head.astro` + JSON-LD из пропа `jsonLd`). Абсолютные URL —
только через `absoluteUrl()` (`shared/seo`): runtime `SITE_URL` на on-demand, плейсхолдер
сборки на prerender (штампует entrypoint). Канон целиком — `docs/research/ssr/02-seo-canon.md`
§3.2; здесь — то, что держат код и гейты.

## Страница (`<head>`)

- Каждая страница — через `DocumentLayout` с `title` (без имени сайта: шаблон `%s — SITE_NAME`
  один для `<title>` и `og:title`) и `description`; оба уникальны среди всех страниц сборки.
  Сниппет индексируемой страницы — в бюджетах: title без суффикса сайта — от трёх слов до 65
  знаков и не общий («Контакты», «Блог», «О компании» — их заменит поисковик), description —
  70–170 знаков; всё это держит `seo:check` по `scripts/lib/site-policy.mjs`, у записей те же
  числа — ещё и Zod-схема коллекции
- Индексируемая (prerendered) страница: self-canonical абсолютным URL без query и хвостового
  слеша (`absoluteUrl()` нормализует путь сам), `<meta name="robots">` не печатается; полный OG
  (`type/title/description/url/site_name/locale` + `image` с `width/height/alt`), `twitter:card`.
  Регистр пути не нормализуется; cross-domain canonical запрещён
- Служебная страница (404, `/now`, подтверждение заявки, ответ обработчика формы, `500`) — проп
  `noindex` layout'а: только `<meta name="robots" content="noindex">`, без canonical/OG/hreflang;
  разрешающие и запрещающие директивы не смешиваются (Яндекс выбирает разрешающую). Prerendered
  служебная страница — маршрут из `NOINDEX_ROUTES` (`scripts/lib/site-policy.mjs`), вне карты
  сайта и вне пар hreflang: `noindex` на любой другой странице (в любой форме: `robots`,
  `googlebot`, `yandex`, `bingbot`, любым регистром) `seo:check` валит, карту против
  сборки сверяет HTTP-набор. На prerendered мета — значение сборки, поэтому
  staging закрывают `ROBOTS_POLICY` (`robots.txt` + `X-Robots-Tag: noindex, nofollow`, который
  обёртка процесса ставит на каждый ответ, статику включительно) и Traefik (`basicAuth` +
  `X-Robots-Tag`) — три контура
- hreflang — только при реальном переводе (`alternatePath` из `findTranslation` и списков):
  полный взаимный набор `ru`, `en`, `x-default` (дефолтная локаль) с self-ссылкой, все на своём
  origin; без перевода —
  ни одной `<link hreflang>`; canonical внутри локали; авторедиректов по `Accept-Language` нет
- `og:image` — обложка записи (исходный PNG из `_astro/`, `immutable`) или `public/og-default.png`
  1200×630 (`OG_DEFAULT_IMAGE`, `shared/config/site.ts`); URL абсолютный на своём origin, файл
  есть в сборке
- Публичные идентификаторы сайта — поля `shared/config/site.ts`, не env: prerendered печатается
  на сборке, а образ собирается без env. `SITE_VERIFICATION.google`/`.yandex` — токены Search
  Console и Вебмастера (пусто — тега нет; альтернатива — HTML-файл в `public/` или DNS TXT),
  `METRIKA_ID` — счётчик (пусто — ни одного стороннего скрипта), `AI_BOTS_POLICY` — политика
  ИИ-ботов (§ robots.txt)
- `<meta name="keywords">` — никогда; RSS autodiscovery `<link rel="alternate"
  type="application/rss+xml">` — на каждой странице, фид своей локали

## JSON-LD

- Печатает layout в `<head>` из пропа `jsonLd` (`<JsonLdScript>`: `<script
  type="application/ld+json">`, `<` экранируется; data block не исполняется, nonce ему не нужен).
  В `<body>` скриптов нет — ни исполняемых, ни data block. Блок — любой `<script>` этого типа,
  какие бы ещё атрибуты ни стояли у тега (`jsonLdBlocks`, `scripts/lib/html.mjs`): сырой тег в слоте
  `head` читают те же правила. Микроданных (`itemscope`, `itemtype`, `itemprop`) в разметке нет —
  сущности размечает только JSON-LD, вторую разметку валит `seo:check`
- Только `Organization` + `WebSite` (корень `/`; `/en` — `Organization`; на других страницах —
  ошибка `seo:check`), `LocalBusiness` (страница «О компании» — ровно те факты, что видны в
  тексте), `BreadcrumbList`, `BlogPosting` (запись). `FAQPage`, `HowTo`, `SearchAction` не
  генерируются — `seo:check` валит сборку. Списки — `JSON_LD_TYPES` и `JSON_LD_FORBIDDEN` в
  `scripts/lib/site-policy.mjs`: новый тип разметки — строкой там, а не правкой скрипта
- Организация у сайта одна — граф по `@id`: её узлы (`Organization` главной, `LocalBusiness`
  «О компании») и каждая ссылка на неё (`publisher` сайта, `author` и `publisher` записи) несут
  `@id` `<origin>/#org`, `WebSite` — `<origin>/#website`; имя сущности — бренд (`SITE_NAME`),
  юрлицо — `legalName`. Блоки отдельные, не `@graph`: ссылка — `@type`, `@id` и `name`, блок
  читается и на странице без узла организации. `seo:check`: у каждого узла типов организации
  (`ORG_TYPES` политики сборки, на любой глубине блока) этот `@id`, узел с этим `@id` — только
  таких типов (подтип `LocalBusiness` — строкой в `ORG_TYPES` и `JSON_LD_TYPES`), имя на всю сборку
  одно, издатель `WebSite` и записи — организация
- Автор записи — `Person` из реестра `entities/author` (поле `author`) или, без него, организация
  по `@id`. У автора свой `@id` `<origin>/#author-<id>` — один на все страницы и локали, имя и
  роль (`jobTitle`) — на языке страницы и те же строки, что печатает видимая подпись. `seo:check`:
  у `Person` свой `@id` на своём origin, имя и роль видны на странице, у одного `@id` на одной
  локали имя одно
- `BreadcrumbList` — норма вложенной страницы: страница строит один массив крошек и отдаёт его и
  в `<Breadcrumbs>` (`widgets/breadcrumbs`, видимые), и в `jsonLd={[breadcrumbList(crumbs)]}`;
  `seo:check` проверяет форму блока (позиции с 1, абсолютные `item` у предков, последняя
  крошка — текущая страница) и что он совпадает с видимыми крошками — `<nav>` с `<ol>`, где
  последний пункт — текущая страница с `aria-current="page"` (паттерн WAI-ARIA Breadcrumb;
  оглавление и нумерованная пагинация — пункты без слов — в `<nav><ol>` не крошки): есть одно —
  есть и другое, имена и адреса по порядку
- Фабрики `shared/seo/json-ld.ts` возвращают типизированные литералы; `json-ld.test.ts` сверяет
  выход каждой фабрики полным объектом и Zod-схемой (абсолютные URL, обязательные поля,
  календарные даты), а `seo:check` — типы на реальном HTML. Размечается только видимое на
  странице: `dateModified` — при `updatedDate`, `image` — при обложке. «Разметка = видимое»
  держит `seo:check` на каждой странице: `headline` = видимый h1, `datePublished`/`dateModified`
  и `article:*_time` — `datetime` видимого `<time>`, `image` = `og:image`, `mainEntityOfPage` =
  canonical, `inLanguage` = язык страницы; у `Organization`/`LocalBusiness` имя, юрлицо, адрес и
  почта видны в тексте, телефон — ссылкой `tel:` с тем же номером. Видимое — без поддеревьев под
  атрибутом `hidden` и под `aria-hidden="true"`: текст, которого человек не видит, разметку не
  подтверждает. Текст обеих сторон сравнивается в
  одной нормализации (`decode` и `normalizeSpace`, `scripts/lib/html.mjs`): сущности разметки
  (`&nbsp;`, `&laquo;`, числовые) раскодированы, неразрывный пробел типографики («+64 %», «ООО
  «Пример»») равен обычному

## robots.txt, sitemap.xml, фиды, IndexNow (on-demand)

- `robots.txt` на проде (`ROBOTS_POLICY=index`): `User-agent: *` / `Allow: /` + абсолютная
  `Sitemap:`; отдельные `noindex`-страницы (`/now`, 404) в нём не закрываются — иначе мета не будет
  прочитана. `ROBOTS_POLICY=noindex` — контур staging целиком: `User-agent: *` / `Disallow: /` без
  Sitemap; реальный замок staging — Traefik `basicAuth`, `Disallow: /` и `X-Robots-Tag` — второй и
  третий контуры. `Host`/`Crawl-delay` не выводятся; `Clean-param` — строкой в `buildRobotsTxt`,
  когда появятся проектные трекинг-параметры (`utm_*`, `ysclid`, `yrclid` Яндекс срезает сам)
- Политика ИИ-ботов — поле сборки `AI_BOTS_POLICY` (`shared/config/site.ts`), не env: решение
  ревьюится в git, одно на все среды и доходит до `<head>` prerendered-страниц. `allow-all`
  (умолчание) — именных групп нет; `allow-search-deny-training` и `deny-all` — одна именная группа
  с `Disallow: /` между `*` и `Sitemap:`; у `deny-all` — ещё мета `bingbot noarchive` и `applebot
  nosnippet` в `<head>` индексируемых страниц. Группа `*` открыта при любой политике: классический
  поиск не закрывает ни одна. Токены группы и мета — из `policies` реестра
  `shared/seo/crawlers.yaml`: это копия файла базы strategy
  (`kb/site/07-seo-geo-performance-analytics/crawlers.yaml`) байт в байт — норма у владельца,
  правится заменой файла, руками список ботов не пишется. Версия копии закреплена: sha256 файла —
  `CRAWLERS_SHA256` политики сборки, правка копии без смены хеша валит `pnpm test`
- `sitemap.xml` — свой маршрут (у `@astrojs/sitemap` `lastmod` не из `updatedDate`, отбор страниц —
  `filter`, карта — шардами `sitemap-index.xml`): ровно
  индексируемые prerendered-страницы сборки (главные, статические страницы из списка
  `STATIC_ROUTES` в `pages/sitemap.xml.ts`, списки, записи без черновиков, теги) — HTTP-набор
  гейта сверяет с `dist/client` за вычетом `noindex`; новая индексируемая страница вне коллекций —
  строка в этом списке; on-demand маршруты вне карты; адрес из `redirects.yaml` не может
  быть живым маршрутом — держит `check:content`, поэтому в карте его нет; `lastmod` только из
  `updatedDate`, `changefreq`/`priority` нет; > 50 000 URL — `buildSitemap` бросает: нужен sitemap
  index с шардами; hreflang в карте не дублируется
- `rss.xml`, `en/rss.xml` — `@astrojs/rss` через `buildFeed`: анонс + ссылка, ≤ 20 записей,
  `atom:link rel="self"`, `language`, абсолютные `link`/`guid`; черновиков нет
- `/<INDEXNOW_KEY>.txt` (`pages/[key].txt.ts`): тело — ключ. Параметризованный маршрут
  перехватывает весь корневой `*.txt` (кроме `robots.txt`): пустой ключ или чужое имя — 404
  `text/plain`, не `404.astro`; ключ в HTML не печатается
- Все четыре — `prerender = false`, явный `Cache-Control` (`robots` и ключ — 300 с, `sitemap` —
  3600 с, фиды — 600 с; 404 ключа — `no-cache`) и `X-Robots-Tag: noindex` на каждом ответе (это
  не страницы выдачи); строки — в карте `docs/reference/rendering.md`

## Гейты

- `pnpm seo:check` (после `build`, внутри `pnpm check`): по `dist/client` — один `<title>` и
  `<h1>`, description с непустым `content`, self-canonical, `lang` по локали пути, OG с
  существующей картинкой, уникальность title/description; hreflang — полный взаимный набор у
  каждой пары переводов (главные, списки и теги под обоими префиксами локалей; записи — twin по
  `translationKey` из frontmatter, реестр коллекций `scripts/lib/content.mjs`) и ни одной ссылки
  на отсутствующую страницу; JSON-LD (любой блок этого типа; типы, `Organization`/`WebSite` только
  на главной, форма `BreadcrumbList`, разметка = видимое без скрытых поддеревьев, одна организация —
  `@id` узлов и ссылок, типы узла — `ORG_TYPES`, одно имя, автор-человек — свой `@id`, подпись на
  странице, одно имя на локали), микроданных нет;
  сниппет в бюджетах и не общий, `noindex` только у `NOINDEX_ROUTES`, canonical на плейсхолдере
  origin и ни плейсхолдера в `<body>`, исполняемый код (`<script>`, обработчики `on*=`,
  `javascript:`) — острова `ISLANDS`, ресурсов с чужих origin нет (и в `style`), og:image и
  hreflang — на своём origin, у картинок размеры, картинка над h1 — не lazy и с
  `fetchpriority="high"`, у `@font-face` — `font-display` swap/fallback/optional;
  страниц черновиков нет; сборка против источника — страница у каждой опубликованной записи и
  prerendered-маршрута `src/pages`, hreflang только у страниц сверенных пар. Сам скрипт под
  гейтом: фикстура `.gate-fixtures/seo` обязана давать ровно нарушения из `expected.json`
  (`pnpm check:gate`)
- unit `shared/seo/*.test.ts` (urls, robots, ai-bots, sitemap, rss, json-ld со схемой) и Container
  API (`seo-head`, `json-ld.astro`, `widgets/breadcrumbs`); маршруты `robots.txt` (прод, staging,
  политика ИИ-ботов), `sitemap.xml`, фиды и ключ — `src/pages/_tests/endpoints.server.test.ts`.
  `robots.test.ts` — матрица доступа «политика × бот реестра» по RFC 9309: доступ каждого бота —
  как в политике базы, а ожидания независимы от печатаемой группы — классический поиск открыт
  всегда, обучающие боты (`bots[].purpose`) закрыты во втором и третьем режимах, поисковые
  ИИ-боты — в третьем
- HTTP-набор `e2e/http/` (`pnpm test:http`, шаг `pnpm check`) на prod-сервере из сборки: каждая
  страница — тот же HTML под `User-Agent: Googlebot`; шаблон каждой страницы, каждый on-demand
  маршрут и адрес без страницы — под UA каждого бота реестра, который ходит в сеть (поиск,
  загрузки по запросу человека, обучение, реклама, превью), ответ тот же, что браузеру: статус, тело
  и все заголовки, кроме `Date` и `X-Request-Id` (сервер не ветвится по User-Agent: кого пускать,
  решает `robots.txt`); `/llms.txt` — 404 `text/plain`;
  canonical на runtime origin, в `<body>`
  нет своего origin, нет `X-Robots-Tag` в прод-профиле, а в staging он на каждом ответе (страницы
  сборки, ассет, `public/*`, on-demand, 404, редиректы, отказ обёртки); HTML on-demand маршрута —
  только с `noindex` (мета или заголовок), его скрипты — острова политики; robots (прод и
  staging) ↔ sitemap ↔ `dist/client`, фиды, ключ IndexNow; размер HTML
  < 300 КБ. Парсер `<head>` и `decode` сущностей один — `scripts/lib/html.mjs` (он же в
  `seo:check` и `check:links`)
- Перед релизом вручную: Rich Results Test, validator.schema.org, валидатор Яндекса
  (`webmaster.yandex.ru/site/tools/microtest/`)
