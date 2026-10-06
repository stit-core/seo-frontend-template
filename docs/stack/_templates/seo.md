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
| иконки | `favicon.ico` 32×32 · `icon.svg` · `apple-touch-icon.png` 180×180 · manifest | `public/` |

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
| `LocalBusiness` | страница «о компании» — ровно те факты, что видны в тексте | `entities/company` |
| `BreadcrumbList` | вложенные страницы | массив крошек страницы |
| `BlogPosting` | запись коллекции | frontmatter |
| _<тип>_ | _где_ | _откуда_ |

Печатается только в `<head>` и только про видимое. `FAQPage`, `HowTo`, `SearchAction` не
генерируются — `seo:check` валит сборку; `<meta name="keywords">` — никогда.

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
| обучающие AI-краулеры | `AI_TRAINING=allow \| deny` — _решение владельца сайта_ |
| `Clean-param` | _проектные трекинг-параметры; `utm_*`, `ysclid`, `yrclid` Яндекс срезает сам_ |

Отдельные `noindex`-страницы в `robots.txt` не закрываются: закрытый обходом `noindex`
не будет прочитан. `Host`/`Crawl-delay` не выводятся.

## Sitemap и фиды

| артефакт | что внутри | `lastmod` |
|---|---|---|
| `/sitemap.xml` | ровно индексируемые prerendered-страницы сборки | только `updatedDate` записи |
| `/rss.xml`, `/en/rss.xml` | последние 20 записей своей локали | — |

Индексируемая страница вне коллекций — строка в `STATIC_ROUTES` (`src/pages/sitemap.xml.ts`).
`changefreq`/`priority` не выводятся. Больше 50 000 URL — нужен sitemap index с шардами.

## Верификация и уведомление поисковиков

| система | механизм | значение |
|---|---|---|
| Google Search Console | `<meta name="google-site-verification">` | `SITE_VERIFICATION.google` (`site.ts`); пусто — тега нет |
| Яндекс Вебмастер | `<meta name="yandex-verification">` | `SITE_VERIFICATION.yandex` |
| IndexNow | файл `/<ключ>.txt`; submit — шаг чек-листа `/release` | `INDEXNOW_KEY` (env); пусто — файла нет |

Альтернатива мета-тегу — HTML-файл в `public/` или запись DNS TXT.

## Generates

- `src/shared/config/site.ts` — идентичность, OG, verification
- `src/shared/seo/*` — canonical, hreflang, OG, JSON-LD, robots, sitemap, фиды
- `src/pages/{robots.txt,sitemap.xml,rss.xml,[key].txt}.ts` и `STATIC_ROUTES`
- `e2e/http/seo.spec.ts` + `pnpm seo:check` — гейты head'а и карты сайта
- `config.md` — env `SITE_URL`, `ROBOTS_POLICY`, `AI_TRAINING`, `INDEXNOW_KEY`
- чек-лист `/release` и прогон `/seo-audit`

## Открытые вопросы

- _что_
