---
description: SEO-канон шаблона — head через DocumentLayout (title/description уникальны, self-canonical, hreflang только для реальных переводов, OG полный), JSON-LD в head только про видимое и только допустимые типы, одна организация и авторы по @id, политика ИИ-ботов из реестра базы, robots.txt и ключ IndexNow on-demand на runtime origin, sitemap.xml и фиды — файлы сборки, staging в три контура, ботам тот же ответ, гейты seo:check и HTTP-набор, GEO-проба geo:probe.
paths: ["src/shared/seo/**", "src/shared/config/site.ts", "src/app/layouts/**", "src/pages/**", "src/widgets/breadcrumbs/**", "scripts/seo-check.mjs", "scripts/lib/html.mjs", "scripts/lib/sitemap.mjs", "e2e/http/**", "public/**"]
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
  Регистр пути не нормализуется; cross-domain canonical запрещён. Canonical — единственная форма
  адреса, по которой сервер отдаёт страницу: с любой другой (хвостовой и двойной слеш,
  `/index.html`, точки, другая запись процентов) обёртка процесса отвечает одним 301 на неё, со
  спрятанным разделителем (`%2F`) — 404. За edge двойной слеш, точки и букву процентами Traefik
  приводит сам, и по такому адресу отвечает страница: дубль закрывает этот же canonical, а ссылку
  неканонической формы в сборке валит `check:links` (`docs/reference/rendering.md § Нормализация
  URL`)
- Служебная страница (404, `/now`, подтверждение заявки, ответ обработчика формы, `500`) — проп
  `noindex` layout'а: только `<meta name="robots" content="noindex">`, без canonical/OG/hreflang;
  разрешающие и запрещающие директивы не смешиваются (Яндекс выбирает разрешающую). 404 и 410 — на
  языке префикса пути (`localeOf`, `shared/i18n`): под `/en/…` — английские; `500` — файл сборки,
  запроса не знает — дефолтная локаль. Язык в теле страницы ошибки один. Prerendered
  служебная страница — маршрут из `NOINDEX_ROUTES` (`scripts/lib/site-policy.mjs`), вне карты
  сайта и вне пар hreflang: `noindex` на любой другой странице (в любой форме: `robots`,
  `googlebot`, `yandex`, `bingbot`, любым регистром) `seo:check` валит, и он же сверяет карту со
  сборкой. Второй законный `noindex` — тонкая страница тега: меньше трёх опубликованных записей
  локали (`TAG_INDEX_MIN_POSTS` политики; у коллекции — `isTagIndexable`). Право на него тегу
  `seo:check` берёт из источника, а не из списка, и держит порог в обе стороны: тонкий тег в
  индексе и тег от порога под `noindex` — оба нарушения. На prerendered мета — значение сборки, поэтому
  staging закрывают `ROBOTS_POLICY` (`robots.txt` + `X-Robots-Tag: noindex, nofollow`, который
  обёртка процесса ставит на каждый ответ, статику включительно) и Traefik (`basicAuth` +
  `X-Robots-Tag`) — три контура
- hreflang — только при реальном переводе, по карте переводов страницы (проп `translations`: версии
  страницы карты strategy, twin записи по `findTranslation`, та же страница списка или тега от порога
  на другой локали): полный взаимный набор всех версий и `x-default` (версия первой локали
  дескриптора, у которой версия есть — дефолтной) с self-ссылкой, все на своём origin; версия одна —
  ни одной `<link hreflang>`; `og:locale` — строка дескриптора, `og:locale:alternate` — у каждой другой
  версии; canonical внутри локали; авторедиректов по `Accept-Language` нет. Переключатель языка в
  шапке — каждый перевод самоназванием языка; без перевода — главная языка или ничего, по
  `untranslated_fallback` версии в карте
- `og:image` — превью ссылки 1200×630: у записи с обложкой — её кадр JPEG (`ogImageOf` модуля сборки
  блога `src/pages/_blog/images.ts`: конвейер картинок Astro серверному бандлу не нужен; файл `_astro/`,
  `immutable`), иначе `public/og-default.png` (`OG_DEFAULT_IMAGE`,
  `shared/config/site.ts`); URL абсолютный на своём origin, файл есть в сборке. `seo:check` сверяет
  сам файл с нормой базы (`OG_IMAGE` политики): 1200×630 и те же размеры в мета, JPEG или PNG, до
  300 КБ
- Публичные идентификаторы сайта — поля `shared/config/site.ts`, не env: prerendered печатается
  на сборке, а образ собирается без env. `SITE_VERIFICATION.google`/`.yandex` — токены Search
  Console и Вебмастера (пусто — тега нет; альтернатива — HTML-файл в `public/` или DNS TXT),
  `METRIKA_ID` — счётчик (пусто — ни одного стороннего скрипта), `AI_BOTS_POLICY` — политика
  ИИ-ботов (§ robots.txt)
- `<meta name="keywords">` — никогда; RSS autodiscovery `<link rel="alternate"
  type="application/rss+xml">` — на каждой странице языка с блогом, фид своей локали
- Иконки сайта печатает layout, первой — PNG 192×192 (`public/icon-192.png`), следом ICO и SVG
  браузерам. Для выдачи Google принимает растр (SVG в списке его форматов нет) от 8×8 и советует
  крупнее 48×48; какую из нескольких иконок он возьмёт, справка не говорит — первой стоит та, что
  ему подходит. `seo:check`: первая иконка страницы — PNG не мельче `ICON_MIN_SIDE` политики
  сборки, файл в сборке — того же размера, что обещает `sizes`; на главных иконка обязательна

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
  странице: `dateModified` — при `updatedDate`, `image` — при обложке: кадры её мастера 16:9, 4:3 и
  1:1 (`articleImagesOf`), пропорции, которые просит выдача Google. «Разметка = видимое»
  держит `seo:check` на каждой странице: `headline` = видимый h1, `datePublished`/`dateModified`
  и `article:*_time` — `datetime` видимого `<time>`, `image` — кадры 16:9, 4:3 и 1:1 мастера `og:image`
  (файлы сборки), `mainEntityOfPage` =
  canonical, `inLanguage` = язык страницы; у `Organization`/`LocalBusiness` имя, юрлицо, адрес и
  почта видны в тексте, телефон — ссылкой `tel:` с тем же номером. Видимое — без поддеревьев под
  атрибутом `hidden` и под `aria-hidden="true"`: текст, которого человек не видит, разметку не
  подтверждает. Текст обеих сторон сравнивается в
  одной нормализации (`decode` и `normalizeSpace`, `scripts/lib/html.mjs`): сущности разметки
  (`&nbsp;`, `&laquo;`, числовые) раскодированы, неразрывный пробел типографики («+64 %», «ООО
  «Пример»») равен обычному

## robots.txt, sitemap.xml, фиды, IndexNow

- `robots.txt` на проде (`ROBOTS_POLICY=index`): `User-agent: *` / `Allow: /` + абсолютная
  `Sitemap:`; отдельные `noindex`-страницы (`/now`, 404) в нём не закрываются — иначе мета не будет
  прочитана. `ROBOTS_POLICY=noindex` — контур staging целиком: `User-agent: *` / `Disallow: /` без
  Sitemap; реальный замок staging — Traefik `basicAuth`, `Disallow: /` и `X-Robots-Tag` — второй и
  третий контуры. `Host`/`Crawl-delay` не выводятся
- `Clean-param` — строка прод-`robots.txt` вне групп (директива межсекционная, читает её только
  Яндекс; Google склеивает адреса с параметрами по canonical): служебные параметры адреса
  `CLEAN_PARAMS` (`shared/config/site.ts`) — метки кликов рекламы `yclid`, `gclid`, `fbclid`,
  `_openstat` (метка Openstat в Директе; `openstat` — имя из нормы базы) и параметры проекта
  (сессия, `ref`). `utm_*`, `ysclid`, `yrclid` Яндекс
  срезает сам; в staging строки нет. Правило параметров живёт в коде, «Настройка GET-параметров»
  Вебмастера — сверка: параметр, который нашёл робот, дописывается в `CLEAN_PARAMS`
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
- `sitemap.xml` — файл сборки: его пишет интеграция `sitemap-from-build` (`astro.config.ts`,
  `scripts/lib/sitemap.mjs`) по страницам `dist/client`, когда они собраны. В карте ровно
  индексируемые страницы — те, что без `noindex`: адрес — canonical страницы, `lastmod` — дата
  последнего изменения записи (`updatedDate`, без правки — `pubDate`; генератор берёт её из
  `article:*_time` страницы), у страницы вне коллекций его нет. Списка страниц нет: новая страница
  попадает в карту сама, закрытая `noindex` — сама выпадает; адрес из `redirects.yaml` не может быть
  живым маршрутом (держит `check:content`), поэтому в карте его нет. `changefreq`/`priority` нет;
  > 50 000 URL — `buildSitemap` бросает, сборка падает: нужен sitemap index с шардами; hreflang в
  карте не дублируется. `@astrojs/sitemap` не подключается: `lastmod` у него не из дат записи,
  отбор страниц — `filter`, а не `noindex` самой страницы, карта — шардами `sitemap-index.xml`. В
  `astro dev` карты нет
- `[...locale]/rss.xml` — prerendered-эндпоинт, фид на каждой локали блога в карте (`/rss.xml`,
  `/en/rss.xml`): `@astrojs/rss` через `buildFeed`, анонс + ссылка, ≤ 20 записей, `atom:link rel="self"`,
  `language`, абсолютные `link`/`guid`; черновиков нет
- Карта и фиды несут плейсхолдер origin и штампуются при старте контейнера вместе со страницами
  (`docker/stamp.mjs` берёт `*.xml`); отдаёт их статик-хендлер, как страницы: `public, max-age=0` +
  ETag, без `X-Robots-Tag` в прод-профиле
- `/<INDEXNOW_KEY>.txt` (`pages/[key].txt.ts`): тело — ключ. Параметризованный маршрут
  перехватывает весь корневой `*.txt` (кроме `robots.txt`): пустой ключ или чужое имя — 404
  `text/plain`, не `404.astro`; ключ в HTML не печатается. Отправка — `pnpm indexnow` после
  выката (`scripts/indexnow.mjs`, шаг `/release`): ключ сверяется с живым файлом, уходят только
  адреса, которые изменил релиз, — новые, изменённые (`lastmod` записи) и удалённые против карты,
  снятой до выката; по умолчанию — сухой прогон. Файл карты «до» без адресов (страница ошибки,
  другой формат) и ответ приёмника не 2xx — отказ с кодом 1. Страница вне коллекций даты не несёт:
  её правку скрипт не видит
- `robots.txt` и ключ — `prerender = false`: их содержимое зависит от env контейнера
  (`ROBOTS_POLICY`, `INDEXNOW_KEY`). У обоих явный `Cache-Control` (300 с; 404 ключа — `no-cache`) и
  `X-Robots-Tag: noindex` на каждом ответе (это не страницы выдачи); строки — в карте
  `docs/reference/rendering.md`

## Гейты

- `pnpm seo:check` (после `build`, внутри `pnpm check`): по `dist/client` — один `<title>` и
  `<h1>`, description с непустым `content`, self-canonical, `lang` и `og:locale` по локали пути (локали
  проверяемого проекта — его политика сборки), OG с
  существующей картинкой — превью ссылки по норме (`OG_IMAGE`: 1200×630, JPEG или PNG, до 300 КБ),
  уникальность title/description, иконка сайта (первая — PNG от 48 px с
  файлом того же размера, на главных обязательна); hreflang — полный взаимный набор у
  каждой пары переводов (главные, списки и индексируемые теги под префиксами локалей; записи — twin по
  `translationKey` из frontmatter, реестр коллекций `scripts/lib/content.mjs`) и ни одной ссылки
  на отсутствующую страницу; JSON-LD (любой блок этого типа; типы, `Organization`/`WebSite` только
  на главной, форма `BreadcrumbList`, разметка = видимое без скрытых поддеревьев (картинка статьи —
  кадры 16:9, 4:3 и 1:1 мастера превью), одна организация —
  `@id` узлов и ссылок, типы узла — `ORG_TYPES`, одно имя, автор-человек — свой `@id`, подпись на
  странице, одно имя на локали), микроданных нет; карта сайта `sitemap.xml` — ровно индексируемые
  страницы сборки своим self-canonical, `lastmod` — дата последнего изменения записи из frontmatter
  (правка, без неё — публикация), у остальных страниц его нет;
  сниппет в бюджетах и не общий, `noindex` только у `NOINDEX_ROUTES` и у тегов ниже порога записей (от
  порога тег индексируется), canonical на плейсхолдере
  origin и ни плейсхолдера в `<body>`, исполняемый код (`<script>`, обработчики `on*=`,
  `javascript:`) — острова реестра `ISLANDS` на своих страницах и в бюджете, ресурсов с чужих
  origin и data:-адресов нет (и в `style`, и в CSS сборки: CSP их не пропускает), og:image и
  hreflang — на своём origin, у картинок и роликов размеры, картинка над h1 — не lazy и с
  `fetchpriority="high"`, фолбэк `<picture>` — не PNG-производная мастера, источник `<source media>`
  другой пропорции — со своими размерами, и он достижим, у ролика — постер, по кнопке — `preload`
  `none` или `metadata`, с автозапуском — `loading="lazy"`, `preload="none"` и источники под условием
  движения, над h1 — ещё и preload постера с `fetchpriority="high"`, у `@font-face` —
  `font-display` swap/fallback/optional, и он только от Fonts API по списку шрифтов (семейство списка в
  `<style>` страницы; в CSS сборки — нет), preload шрифтов — не больше двух;
  страниц черновиков нет; сборка против источника — страница у каждой опубликованной записи и
  prerendered-маршрута `src/pages` (маршрута локалей `[...locale]` — хоть на одной локали), hreflang только у страниц сверенных пар. Сам скрипт под
  гейтом: фикстура `.gate-fixtures/seo` обязана давать ровно нарушения из `expected.json`
  (`pnpm check:gate`)
- unit `shared/seo/*.test.ts` (urls, robots, ai-bots, sitemap, rss, json-ld со схемой) и Container
  API (`seo-head`, `json-ld.astro`, `widgets/breadcrumbs`); генератор карты на временном каталоге
  страниц — `shared/seo/sitemap.server.test.ts`; маршруты `robots.txt` (прод, staging, политика
  ИИ-ботов) и ключ — `src/pages/_tests/endpoints.server.test.ts`, фиды — `blog.astro.test.ts`.
  `robots.test.ts` — матрица доступа «политика × бот реестра» по RFC 9309: доступ каждого бота —
  как в политике базы, а ожидания независимы от печатаемой группы — классический поиск открыт
  всегда, обучающие боты (`bots[].purpose`) закрыты во втором и третьем режимах, поисковые
  ИИ-боты — в третьем
- HTTP-набор `e2e/http/` (`pnpm test:http`, шаг `pnpm check`) на prod-сервере из сборки: каждая
  страница — тот же HTML под `User-Agent: Googlebot`; шаблон каждой страницы, каждый on-demand
  маршрут, карта, фиды, адрес без страницы, адреса `redirects.yaml` и ответы обёртки на форму адреса
  (301 и 404) — под UA каждого бота реестра, который ходит в сеть (поиск,
  загрузки по запросу человека, обучение, реклама, превью), ответ тот же, что браузеру: статус, тело
  и все заголовки, кроме `Date` и `X-Request-Id` (сервер не ветвится по User-Agent: кого пускать,
  решает `robots.txt`); `/llms.txt` — 404 `text/plain`;
  canonical на runtime origin, в `<body>`
  нет своего origin, нет `X-Robots-Tag` в прод-профиле, а в staging он на каждом ответе (страницы
  сборки, карта и фиды, ассет, `public/*`, on-demand, 404, адреса `redirects.yaml`, ответы обёртки
  на форму адреса и её отказ); HTML on-demand маршрута —
  только с `noindex` (мета или заголовок), его скрипты — острова политики; у адреса одна форма —
  неканоническая (слеш, `//`, `/index.html`, точки, проценты) и адрес `redirects.yaml` в любой
  форме отвечают одним 301 сразу на конечный адрес, `%2F` и заглавные своего адреса — 404; `robots.txt` (прод —
  со строкой `Clean-param`, staging — без неё), проштампованные карта (ровно индексируемые страницы `dist/client`, все 200, `lastmod` у
  каждой записи) и фиды, ключ IndexNow; размер HTML
  < 300 КБ. Парсер `<head>` и `decode` сущностей один — `scripts/lib/html.mjs` (он же в
  `seo:check` и `check:links`)
- `pnpm geo:probe <origin>` — шаг `/seo-audit`, вне гейта (Python соседа и сеть): утилита базы
  strategy `geo_probe.py --ua-probe` по шаблонам страниц сборки с реестром ботов сайта; флаги B и S
  её таблицы `head-kit.yaml#checks` — «чинить», кроме тех, что даёт решение сайта: страница закрыта
  сборкой; при `deny-all` — закрытые ИИ-боты и ровно те мета, что политика ставит по реестру
  (`nosnippet` всем роботам или заголовком — «чинить»). Разбор флагов — `scripts/lib/geo-flags.mjs`
  под unit-тестом `shared/seo/geo-flags.test.ts`; заодно копия реестра сверяется с файлом базы. На
  живом домене проба видит edge: бан бота по UA, заглушку антибота, сертификат. Соседа нет — строка
  пропуска
- Перед релизом вручную: Rich Results Test, validator.schema.org, валидатор Яндекса
  (`webmaster.yandex.ru/site/tools/microtest/`)
