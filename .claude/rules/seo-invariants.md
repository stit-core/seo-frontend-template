---
description: SEO-канон шаблона — head через DocumentLayout (title/description уникальны, self-canonical, hreflang только для реальных переводов, OG полный), JSON-LD в head только про видимое и только допустимые типы, robots.txt/sitemap.xml/rss.xml/ключ IndexNow on-demand на runtime origin, staging в три контура, гейты seo:check и HTTP-набор.
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
  один для `<title>` и `og:title`) и `description`; оба уникальны среди всех страниц сборки
  (`seo:check`), бюджеты длины — в Zod-схеме коллекции
- Индексируемая (prerendered) страница: self-canonical абсолютным URL без query и хвостового
  слеша (`absoluteUrl()` нормализует путь сам), `<meta name="robots">` не печатается; полный OG
  (`type/title/description/url/site_name/locale` + `image` с `width/height/alt`), `twitter:card`.
  Регистр пути не нормализуется; cross-domain canonical запрещён
- Служебная страница (404, `/now`, подтверждение заявки, ответ обработчика формы, `500`) — проп
  `noindex` layout'а: только `<meta name="robots" content="noindex">`, без canonical/OG/hreflang;
  разрешающие и запрещающие директивы не смешиваются (Яндекс выбирает разрешающую). Prerendered
  служебная страница вне карты сайта и вне пар hreflang — это держит `seo:check`. На prerendered мета — значение сборки, поэтому
  staging закрывают `ROBOTS_POLICY` (`robots.txt` + `X-Robots-Tag` на on-demand) и Traefik
  (`basicAuth` + `X-Robots-Tag`) — три контура
- hreflang — только при реальном переводе (`alternatePath` из `findTranslation` и списков):
  полный взаимный набор `ru`, `en`, `x-default` (дефолтная локаль) с self-ссылкой; без перевода —
  ни одной `<link hreflang>`; canonical внутри локали; авторедиректов по `Accept-Language` нет
- `og:image` — обложка записи (исходный PNG из `_astro/`, `immutable`) или `public/og-default.png`
  1200×630 (`OG_DEFAULT_IMAGE`, `shared/config/site.ts`); URL абсолютный, файл есть в сборке
- Публичные идентификаторы сайта — поля `shared/config/site.ts`, не env: prerendered печатается
  на сборке, а образ собирается без env. `SITE_VERIFICATION.google`/`.yandex` — токены Search
  Console и Вебмастера (пусто — тега нет; альтернатива — HTML-файл в `public/` или DNS TXT),
  `METRIKA_ID` — счётчик (пусто — ни одного стороннего скрипта)
- `<meta name="keywords">` — никогда; RSS autodiscovery `<link rel="alternate"
  type="application/rss+xml">` — на каждой странице, фид своей локали

## JSON-LD

- Печатает layout в `<head>` из пропа `jsonLd` (`<JsonLdScript>`: `<script
  type="application/ld+json">`, `<` экранируется; data block не исполняется, nonce ему не нужен).
  В `<body>` скриптов нет — ни исполняемых, ни data block
- Только `Organization` + `WebSite` (корень `/`; `/en` — `Organization`), `LocalBusiness`
  (страница «О компании» — ровно те факты, что видны в тексте), `BreadcrumbList`, `BlogPosting`
  (запись). `FAQPage`, `HowTo`, `SearchAction` не генерируются — `seo:check` валит сборку
- `BreadcrumbList` — норма вложенной страницы: страница строит один массив крошек и отдаёт его и
  в `<Breadcrumbs>` (`widgets/breadcrumbs`, видимые), и в `jsonLd={[breadcrumbList(crumbs)]}`;
  `seo:check` проверяет форму блока там, где он есть (позиции с 1, абсолютные `item` у предков,
  последняя крошка — текущая страница), отсутствие блока — не ошибка
- Фабрики `shared/seo/json-ld.ts` возвращают типизированные литералы; `json-ld.test.ts` сверяет
  выход каждой фабрики полным объектом и Zod-схемой (абсолютные URL, обязательные поля,
  календарные даты), а `seo:check` — типы на реальном HTML. Размечается только видимое на
  странице: `dateModified` — при `updatedDate`, `image` — при обложке

## robots.txt, sitemap.xml, фиды, IndexNow (on-demand)

- `robots.txt` на проде (`ROBOTS_POLICY=index`): `User-agent: *` / `Allow: /` + абсолютная
  `Sitemap:`; отдельные `noindex`-страницы (`/now`, 404) в нём не закрываются — иначе мета не будет
  прочитана. `ROBOTS_POLICY=noindex` — контур staging целиком: `User-agent: *` / `Disallow: /` без
  Sitemap; реальный замок staging — Traefik `basicAuth`, `Disallow: /` и `X-Robots-Tag` — второй и
  третий контуры. `AI_TRAINING=deny` — одна группа обучающих ботов (`AI_TRAINING_BOTS`),
  поисково-ответные не трогаются; `Host`/`Crawl-delay` не выводятся; `Clean-param` — строкой в
  `buildRobotsTxt`, когда появятся проектные трекинг-параметры (`utm_*`, `ysclid`, `yrclid` Яндекс
  срезает сам)
- `sitemap.xml` — свой маршрут (`@astrojs/sitemap` строит URL от build-time origin): ровно
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
  на отсутствующую страницу; JSON-LD (типы, `Organization`/`WebSite` на главной, форма
  `BreadcrumbList`)
- unit `shared/seo/*.test.ts` (urls, robots, sitemap, rss, json-ld со схемой) и Container API
  (`seo-head`, `json-ld.astro`, `widgets/breadcrumbs`); маршруты `robots.txt` (прод, staging,
  `AI_TRAINING=deny`), `sitemap.xml`, фиды и ключ — `src/pages/_tests/endpoints.server.test.ts`
- HTTP-набор `e2e/http/` (`pnpm test:http`, шаг `pnpm check`) на prod-сервере из сборки: каждая
  страница — тот же HTML под `User-Agent: Googlebot`, canonical на runtime origin, ни одного
  `<script>` в `<body>`, нет `X-Robots-Tag` в прод-профиле; robots (прод и staging) ↔ sitemap ↔
  `dist/client`, фиды, ключ IndexNow; запись с переводом — hreflang, `article:*_time`,
  `BlogPosting` и крошки по видимому; размер HTML < 300 КБ. Парсер `<head>` и `decode`
  сущностей один — `scripts/lib/html.mjs` (он же в `seo:check` и `check:links`)
- Перед релизом вручную: Rich Results Test, validator.schema.org, валидатор Яндекса
  (`webmaster.yandex.ru/site/tools/microtest/`)
