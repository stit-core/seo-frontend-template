---
id: stack.content
kind: content
name: content
status: draft
---

# content

## Источник

| поле | значение |
|---|---|
| режим | `git` \| `cms` \| `api` |
| где лежит | `src/entities/<name>/content/<locale>/<slug>.md` (git) |
| публикация = | релиз образа (git): правка текста → `pnpm check` → новый тег → `make bump` |
| частота публикаций | _сколько записей в месяц_ |

Дефолт шаблона — `git`: контент версионируется вместе с кодом, ревью текста = ревью PR,
второго контейнера и бэкапа БД не нужно. `cms`/`api` — проектное решение: оно тянет
режим рендера (`cached`/`dynamic`), кеш процесса, инвалидацию и рецепт D из
`docs/reference/rendering.md`; кода для них в шаблоне нет.

## Кто редактирует

| поле | значение |
|---|---|
| кто пишет тексты | _разработчик / маркетолог через PR / редактор без git_ |
| чем | _редактор + PR в Gitea / админка_ |
| кто ревьюит | _кто_ |

**Блокирующий инвариант.** Редактор без git — и режим `git` не проходит: публикация
записи означает релиз образа, а CI-раннера в экосистеме нет. Либо редактор работает
через PR, либо источник контента — `cms`/`api`, и тогда маршруты его коллекций в
`rendering.md` — `cached`/`dynamic`, а не `static`. Расхождение между этой секцией и
картой маршрутов — `**blocker**` промоушна в `stable`.

## Коллекции

| коллекция | что это (data-item strategy) | локали | URL | схема |
|---|---|---|---|---|
| `post` | `article` | `ru`, `en` | `/blog/<slug>` | `src/entities/post/model/schema.ts` |
| _<name>_ | _data-item_ | _локали_ | _/<path>/<slug>_ | `src/entities/<name>/model/schema.ts` |

Одна коллекция = один слайс сущности: `content/` (тексты), `model/{schema,collection}.ts`,
`api/queries.ts`, `ui/`. Новая коллекция — запись в реестре `scripts/lib/content.mjs` и
импорт в `src/content.config.ts`. Заводит `/scaffold collection`.

Поля frontmatter (Zod, строгая мапа — неизвестное поле ломает сборку): `title` (25–65),
`description` (70–170, уникален в локали), `pubDate`, `updatedDate?`, `cover?` + `coverAlt?`,
`tags`, `draft`, `translationKey`, `author?` (id реестра авторов `src/entities/author`: реальные
люди, которые пишут или проверяют тексты; в шаблоне реестр пуст).

## Локали контента

| locale | URL | обязательные к переводу коллекции | fallback |
|---|---|---|---|
| `ru` | `/…` (дефолтная, без префикса) | _все_ | — |
| `en` | `/en/…` | _какие_ | **нет** — непереведённое отдаёт 404 |

Язык задаёт каталог; переводы связаны `translationKey`; hreflang выводится только из
фактических пар. Набор локалей — `SUPPORTED_LOCALES` (`src/shared/i18n/locale.ts`).

## Черновики

`draft: true` виден только в `astro dev`; в сборке записи нет нигде — ни в списках, ни в
sitemap, ни по URL (404). Preview-режима с токеном нет: у статики нет рендера на запрос,
которому его можно показать.

## Картинки

| поле | значение |
|---|---|
| пайплайн | build-time `astro:assets`: `<Picture>` с `formats={['avif','webp']}` + фолбэк `<img src>` |
| где лежат | рядом с текстом — `content/covers/<translationKey>.png`, общие для локалей |
| обложка записи | 1600×900; она же `og:image` страницы |
| дефолтная OG | `public/og-default.png`, 1200×630 |
| размеры | `width`/`height` заданы всегда; LCP-картинка — `fetchpriority="high"` без `lazy`, остальные — `lazy` + `decoding="async"` |
| `alt` | обязателен; декоративная миниатюра рядом с заголовком-ссылкой — `alt=""` |
| удалённые хосты | _нет_ — картинки версионируются вместе с текстом |
| бюджет | LCP-картинка ≤ 150 КБ AVIF; вес HTML главной и записи держит `.size-limit.cjs`, любой страницы — потолок 300 КБ HTTP-набора |

Удалённые источники (`image.domains`/`remotePatterns`) — проектное решение: это ещё и
allowlist против SSRF через эндпоинт ресайза.

## Редиректы

`content/redirects.yaml` — данные: `{ from, to?, status }`, `301 | 308 | 410`, один хоп,
без цепочек. Применяет `app/middleware` до роутинга. Смена slug опубликованной записи —
строка здесь, а не «ссылки как-нибудь сами».

## Поиск по сайту

| поле | значение |
|---|---|
| движок | `нет` \| `client-index` \| `server` |
| страница | `/search` — `dynamic`, `noindex`, вне sitemap (если заводится) |

Дефолт — `нет`: индекс и остров поиска стоят JS на каждой странице.

## Generates

- `src/entities/<name>/{content,model/{schema,collection},api,ui}` — слайс коллекции
- `src/content.config.ts` — регистрация коллекции
- `scripts/lib/content.mjs` — запись в реестре коллекций (гейты `check:content`, `seo:check`)
- `src/pages/<path>/**` — списки, страница записи, теги
- источник данных для `sitemap.xml`, `rss.xml` и hreflang
- `content/redirects.yaml`
- `config.md` — env источника контента, если режим не `git`

## Открытые вопросы

- _что_
