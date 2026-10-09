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
| описание | _70–170 символов_ | `SITE_DESCRIPTION` |
| title-шаблон | `%s — <Бренд>`; один для `<title>` и `og:title` | `shared/seo/meta.ts` |
| профили в других сервисах | _ссылки_ | `SITE_SAME_AS` |
| логотип | `/icon-512.png` | `SITE_LOGO_PATH` |
| иконки | `icon-192.png` 192×192 — первой: её берёт выдача Google (растр от 48 px, SVG не читает) · `favicon.ico` 32×32 · `icon.svg` · `apple-touch-icon.png` 180×180 · manifest | `public/`, порядок — `app/layouts/document.astro` |

Поля без пометки «env» — `src/shared/config/site.ts`: prerendered-страница печатается на
сборке, а образ собирается без env, поэтому runtime-значение до неё не доходит.

## Социальные карточки

| поле | значение |
|---|---|
| дефолтная картинка | `public/og-default.png`, 1200×630 (`OG_DEFAULT_IMAGE`) |
| картинка страницы | обложка записи, если есть; иначе дефолт |
| набор тегов | `og:type/title/description/url/site_name/locale` + `image` с `width/height/alt`, `twitter:card` |
| генератор картинок | **нет** — обложка рисуется руками и лежит в контенте |

## Структурированные данные (JSON-LD)

| тип | где | источник полей |
|---|---|---|
| `Organization` + `WebSite` | `/` | `site.ts` |
| `Organization` | `/en` | `site.ts` |
| `LocalBusiness` | страница «о компании» — ровно те факты, что видны в тексте | `site.ts` (имя) + `entities/company` |
| `BreadcrumbList` | вложенные страницы | массив крошек страницы |
| `BlogPosting` | запись коллекции | frontmatter; автор — `Person` из реестра `entities/author` или организация |
| _<тип>_ | _где_ | _откуда_ |

Печатается только в `<head>` и только про видимое. Организация одна: её узлы и ссылки на неё
(издатель сайта, автор и издатель записи) несут `@id` `<origin>/#org`, имя — бренд (`SITE_NAME`),
юрлицо — `legalName`. `FAQPage`, `HowTo`, `SearchAction` не генерируются — `seo:check` валит
сборку; `<meta name="keywords">` — никогда.

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
| Яндекс Вебмастер | сайт подтверждён, sitemap подан; рендеринг JS — «не выполнять» (страницы отдаёт сервер); «Настройка GET-параметров» — сверка с `Clean-param`: правило живёт в `CLEAN_PARAMS`; «Видимость сайта в Алисе AI» | регион — _город или «без региона»_ |
| Яндекс Бизнес | профиль организации с сайтом; название, адрес, телефон и часы — как на странице «о компании» | _есть адрес или зона обслуживания: да / нет_ |
| Google Search Console | домен подтверждён, sitemap подан; «Search generative AI» — `Include` при `allow-all` и `allow-search-deny-training`, `Exclude` при `deny-all`; отчёт «Generative AI performance» | — (следует из `AI_BOTS_POLICY`) |
| Bing Webmaster Tools | сайт добавлен импортом из Search Console, sitemap подан; отчёт «AI Performance» — цитирования в Copilot и ChatGPT search | _заводим: да / нет_ |

## Generates

- `src/shared/config/site.ts` — идентичность, OG, verification, политика ИИ-ботов, `CLEAN_PARAMS`
- `src/shared/seo/*` — canonical, hreflang, OG, JSON-LD, robots, sitemap, фиды
- `src/pages/{robots.txt,rss.xml,[key].txt}.ts`, карта сайта из сборки (`scripts/lib/sitemap.mjs`)
- `e2e/http/seo.spec.ts` + `pnpm seo:check` — гейты head'а и карты сайта
- `config.md` — env `SITE_URL`, `ROBOTS_POLICY`, `INDEXNOW_KEY`
- чек-лист `/release` и прогон `/seo-audit`

## Открытые вопросы

- _что_
