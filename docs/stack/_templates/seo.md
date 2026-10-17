---
id: stack.seo
kind: seo
name: seo
status: draft
---

# seo

## Идентичность сайта

| поле | значение | где живёт |
|---|---|---|
| канонический хост | `https://<domain>` — один; `www` → apex на Traefik | `SITE_URL` (env) |
| имя сайта | _<Бренд>_ | `SITE_NAME` |
| заголовок и описание страницы | мета copy deck как есть: бренд — в заголовке (шаблоны `meta-rules.yaml` базы); тексты превью ссылки — `og_title` и `og_description`, без них — заголовок и описание | copy deck strategy |
| профили в других сервисах | _ссылки_ | `SITE_SAME_AS` |
| логотип | `/icon-512.png` | `SITE_LOGO_PATH` |
| иконки | `icon-192.png` 192×192 — первой: она подходит выдаче Google (растр; минимум — 8×8, рекомендация — крупнее 48×48; SVG в списке его форматов нет) · `favicon.ico` 32×32 · `icon.svg` · `apple-touch-icon.png` 180×180 · manifest | `public/`, порядок — `app/layouts/document.astro` |

Поля без пометки «env» — `src/shared/config/site.ts`: prerendered-страница печатается на
сборке, а образ собирается без env, поэтому runtime-значение до неё не доходит.

## Социальные карточки

| поле | значение |
|---|---|
| дефолтная картинка | `public/og-default.png`, 1200×630 (`OG_DEFAULT_IMAGE`) |
| картинка страницы | кадр 1200×630 обложки записи, если есть; иначе дефолт |
| набор тегов | `og:type/title/description/url/site_name/locale` + `image` с `width/height/alt`, `twitter:card` |
| генератор картинок | **нет** — превью ссылки сборка кадрирует из обложки записи |

## Структурированные данные (JSON-LD)

Типы страницы — `seo.structured_data` её плана strategy (head-kit `page_types` её типа).

| тип | где | источник полей |
|---|---|---|
| `Organization` + `WebSite` | главная каждого языка | `site.ts` (имя, логотип, профили), оператор плана, факты страницы (`machine`) |
| `AboutPage` | «о компании» | мета copy deck; `about` — организация по `@id` |
| `ContactPage` + `LocalBusiness` | контакты — адрес, часы, телефон и почта, что видны на странице | `site.ts`, оператор плана, факты страницы (`machine`) |
| `CollectionPage` | список и тег коллекции | мета страницы; издатель — организация по `@id` |
| `BreadcrumbList` | страницы с крошками по карте | секция крошек плана |
| `Article` | запись коллекции | frontmatter; автор — `Person` из реестра `entities/author` (адрес — профиль) или организация |
| _<тип>_ | _где_ | _откуда_ |

Печатается только в `<head>` и только про видимое. Организация одна: её узлы и ссылки на неё
(издатель сайта и списков, `about` страниц, автор и издатель записи) несут `@id` `<origin>/#org`,
имя — бренд (`SITE_NAME`), юрлицо — `legalName`; контакты и реквизиты — `machine` фактов, которые
называет страница, по таблице head-kit `fields_from_facts`. `FAQPage`, `HowTo`, `SearchAction` не генерируются:
верхним типом блока их валит `seo:check` (типы — ровно план, а ни у одного типа страницы head-kit их нет),
вложенными в узел — строгие схемы теста фабрик и страниц (`JsonLdSchema`); `<meta name="keywords">` — никогда.

## Локали и hreflang

| locale | URL | роль |
|---|---|---|
| `ru` | `/…` | дефолтная, она же `x-default` |
| `en` | `/en/…` | поддерживаемая |

hreflang выводится только для реально существующих переводов, взаимно, с self-ссылкой;
без перевода — ни одной `<link hreflang>`. Canonical — внутри своей локали.

## robots-политика

| агент | политика |
|---|---|
| `*` | `Allow: /` + абсолютная `Sitemap:` (`ROBOTS_POLICY=index`) |
| весь сайт на staging | `ROBOTS_POLICY=noindex`: `Disallow: /` и `X-Robots-Tag` на каждом ответе процесса — плюс `basicAuth` и `X-Robots-Tag` на Traefik |
| ИИ-боты | `AI_BOTS_POLICY` (`site.ts`): `allow-all` (умолчание) \| `allow-search-deny-training` \| `deny-all` — _решение владельца сайта: показывать ли сайт в ИИ-ответах и учить ли на его текстах модели; бриф strategy — `search.ai_bots_policy`, `ask` или молчание — `allow-all`_ |
| `Clean-param` (Яндекс) | `CLEAN_PARAMS` (`site.ts`): метки кликов рекламы `yclid`, `gclid`, `fbclid`, `openstat`, `_openstat` + _свои служебные параметры: сессия, `ref`_; `utm_*`, `ysclid`, `yrclid` Яндекс срезает сам; в staging строки нет |

Отдельные `noindex`-страницы в `robots.txt` не закрываются: закрытый обходом `noindex`
не будет прочитан. `Host`/`Crawl-delay` не выводятся.

## Sitemap и фиды

| артефакт | что внутри | `lastmod` |
|---|---|---|
| `/sitemap.xml` | файл сборки: ровно страницы `dist/client` без `noindex` | у записи — `updatedDate`, без правки — `pubDate` |
| `/rss.xml`, `/en/rss.xml` | последние 20 записей своей локали | — |

Списка страниц нет: карту пишет сборка, страница попадает в неё и выпадает из неё сама. Страница
тега — от трёх записей локали: ниже порога она с `noindex` и вне карты.
`changefreq`/`priority` не выводятся. Больше 50 000 URL — нужен sitemap index с шардами.

## Верификация и уведомление поисковиков

| система | механизм | значение |
|---|---|---|
| Google Search Console | `<meta name="google-site-verification">` | `SITE_VERIFICATION.google` (`site.ts`); пусто — тега нет |
| Яндекс Вебмастер | `<meta name="yandex-verification">` | `SITE_VERIFICATION.yandex` |
| IndexNow | файл `/<ключ>.txt`; после выката `pnpm indexnow` отправляет адреса, которые изменил релиз (шаг `/release`) | `INDEXNOW_KEY` (env); пусто — файла нет, шаг пропускается |

Альтернатива мета-тегу — HTML-файл в `public/` или запись DNS TXT.

## Кабинеты

Разовая настройка оператора после первого выката; шаги — «Один раз на проект» чек-листа `/release`.

| кабинет | что настроить | решение проекта |
|---|---|---|
| Яндекс Вебмастер | сайт подтверждён, sitemap подан; «Рендеринг страниц JavaScript» — рендеринг запрещён (страницы отдаёт сервер; умолчание кабинета — «На усмотрение робота Яндекса»); «Настройка GET-параметров» — сверка с `Clean-param`: правило живёт в `CLEAN_PARAMS`; «Видимость сайта в Алисе AI» | регион — _город или «без региона»_ |
| Яндекс Бизнес | профиль организации с сайтом; название, адрес, телефон и часы — как на странице «о компании» | _есть адрес или зона обслуживания: да / нет_ |
| Google Search Console | домен подтверждён, sitemap подан; «Search generative AI» — `Include` при `allow-all` и `allow-search-deny-training`, `Exclude` при `deny-all`; отчёт «Generative AI performance» | — (следует из `AI_BOTS_POLICY`) |
| Bing Webmaster Tools | сайт добавлен импортом из Search Console, sitemap подан; отчёт «AI Performance» — цитирования в Copilot, ИИ-сводках Bing и партнёрских интеграциях Microsoft | _заводим: да / нет_ |

## Generates

- `src/shared/config/site.ts` — идентичность, OG, verification, политика ИИ-ботов, `CLEAN_PARAMS`
- `src/shared/seo/*` — canonical, hreflang, OG, JSON-LD, robots, sitemap, фиды
- `src/pages/{robots.txt,rss.xml,[key].txt}.ts`, карта сайта из сборки (`scripts/lib/sitemap.mjs`)
- `e2e/http/seo.spec.ts` + `pnpm seo:check` — гейты head'а и карты сайта
- `config.md` — env `SITE_URL`, `ROBOTS_POLICY`, `INDEXNOW_KEY`
- чек-лист `/release` и прогон `/seo-audit`

## Открытые вопросы

- _что_
