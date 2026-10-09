<div align="center">

# ssr-frontend-template

### Шаблон индексируемого сайта: static-first, SSR по необходимости

Astro 7 + Node-адаптер, Feature-Sliced Design под линтером, ноль JavaScript на
контентных страницах, один Docker-образ на все среды. Приложение за логином —
это [`spa-frontend-template`](https://git.stit.tech/stit-core/spa-frontend-template).

[![License](https://img.shields.io/badge/license-Apache--2.0-2563eb)](LICENSE)
[![Часть stit](https://img.shields.io/badge/stit-открытые_шаблоны-6366f1)](https://git.stit.tech/stit-core/stit-public)
[![Astro](https://img.shields.io/badge/Astro-7-ff5d01)](#стек)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](#стек)
[![Arch](https://img.shields.io/badge/arch-FSD_%2B_ESLint_%2B_Steiger-22c55e)](#структура)

</div>

---

## Стек

Astro 7.3 + `@astrojs/node` (`output: 'static'`, standalone) · TypeScript 6
(`astro/tsconfigs/strictest`) · Tailwind v4 на собственном токен-слое · контент — Markdown
в git внутри слайса (Content Layer + Zod 4) · i18n `ru` (без префикса) + `en` (`/en`) ·
редиректы как данные (`content/redirects.yaml`) · SEO-слой `shared/seo` (canonical, hreflang,
OG, JSON-LD; `robots.txt` on-demand на runtime origin, `sitemap.xml` и `rss.xml` — файлы сборки) · Biome 2 +
Prettier (только `*.astro`) ·
ESLint 10 (`eslint-plugin-astro`, `boundaries`) + Steiger · Vitest 5 (Container API) +
Playwright · size-limit · pnpm 10 · lefthook + commitlint.

## Быстрый старт

```bash
# Node 24 (.nvmrc) + pnpm 10: точную версию проекта (packageManager) pnpm подтянет сам
nvm use && npm i -g pnpm@10

pnpm install
pnpm prepare         # lefthook git-hooks
pnpm dev             # http://localhost:4321 (демон Astro 7: pnpm astro dev stop)
```

Как в контейнере — prod-сборка с плейсхолдером origin, штамповка и обёртка сервера
(`pnpm start` читает `.env`, если он есть; шаблон — `.env.example`):

```bash
pnpm build
DIST_DIR=dist SITE_URL=http://localhost:3000 sh docker/entrypoint.sh pnpm start
```

## Команды

```bash
pnpm dev              # astro dev
pnpm build            # astro build → dist/{client,server}
pnpm start            # prod-сервер docker/server.mjs (нужны SITE_URL и штамповка entrypoint'ом)
pnpm typecheck        # astro sync + astro-check (типы .astro и .ts)
pnpm lint             # Biome + ESLint (границы FSD — здесь)
pnpm format:check     # Biome + Prettier для *.astro
pnpm test             # Vitest: unit + Container API (.astro) + axe, покрытие с порогами
pnpm test:http        # после build: HTTP-набор на prod-сервере, профили прод и staging
pnpm test:e2e         # build + браузерный набор: axe в двух темах, тема, форма без JS
pnpm steiger          # структурный линтер FSD
pnpm check:gate       # негативные фикстуры обязаны валить линтеры и скрипты гейта
pnpm check:content    # контент-гейт: схема .md, даты, тело без скрытой разметки, переводы, ссылки, redirects.yaml
pnpm check:links      # после build: все внутренние ссылки в dist/client существуют
pnpm seo:check        # после build: head, сниппет, hreflang, JSON-LD = видимое, острова и ресурсы каждой страницы
pnpm size             # бюджеты CSS / HTML
pnpm kin:diff         # сверка обвязки с ../spa-frontend-template (advisory)
pnpm ttfb <origin> …  # TTFB запущенного сервера: медиана/p90 20 запросов
pnpm indexnow <origin> [карта-до.xml] --key <ключ>   # IndexNow после выката: адреса, которые изменил релиз
pnpm geo:probe <origin>     # GEO-шаг /seo-audit: проба соседнего strategy по шаблонам страниц (advisory)
pnpm bots:sources           # источники сетей ботов реестра — файл allowlist для <org>/infra
pnpm accept:image <image>   # приёмка собранного образа до пуша в registry
pnpm check            # gate — состав: .claude/rules/tests-pipeline.md § Gate
```

Перед claim «готово» / push — **`pnpm check`** (его же гоняет pre-push — для пушимого HEAD на
чистом дереве).

## Структура

Feature-Sliced Design, импорты строго нисходящие (`app → pages → widgets → features →
entities → shared`); между слайсами одного слоя — запрещены. Границы держит ESLint
(`boundaries` с резолвером + `no-restricted-imports`), структуру — Steiger; `.gate-fixtures/`
с заведомыми нарушениями входит в gate, чтобы линтеры не деградировали молча.

```
content/redirects.yaml   адреса как данные: переезды старого сайта и 410, один хоп с любой формы адреса
public/           иконки, manifest, og-default.png (социальная карточка 1200×630)
src/app/          layouts/document.astro (<head> из props: SeoHead + JSON-LD), middleware, styles/index.css
src/pages/        роутинг Astro = слой pages: index, about, contacts/{index,spasibo},
                  legal/privacy, blog/{index,[slug],page/[page],tag/[tag]}, en/… , 500,
                  rss.xml, en/rss.xml (prerender); 404, healthz, now, robots.txt, [key].txt,
                  api/contact (on-demand); секции страниц — _blog/, _about/, _contacts/;
                  тесты маршрутов и страниц — _tests/
src/widgets/      site-header, site-footer, post-list, breadcrumbs (видимые крошки)
src/features/     contact-form (форма без JS и её обработчик), theme (остров темы)
src/entities/     post: content/{ru,en}/*.md + covers/, model, api, lib, ui; company: реквизиты
                  оператора для «О компании» и LocalBusiness; author: реестр авторов (в шаблоне
                  пуст) и подпись под заголовком записи
src/shared/       config (runtime env, Zod; идентичность сайта), i18n, lib (+ testing), redirects,
                  seo (absoluteUrl, hreflang, SeoHead, JSON-LD, robots/sitemap/rss), antispam
                  (шов капчи), observability (JSON-лог с порогом LOG_LEVEL, Sentry по DSN), ui
src/{content.config,middleware,env.d}.ts   навязанные Astro entry — тонкие входы
docker/           Dockerfile (3 стадии), entrypoint.sh + stamp.mjs (штамповка SITE_URL), server.mjs
e2e/              Playwright на prod-сборке: http/ — в гейте, browser/ — в /release
scripts/          гейты (check-gate, check-content, check-links, seo-check, lib/), validate-plan,
                  pre-push, kin-diff, ttfb, indexnow, geo-probe, bot-sources, accept-image
docs/stack/       формы платформенных артефактов (12 kinds) — заполняет /stack-deep-dive
.claude/          правила (path-scoped) и скиллы (init-service, scaffold, content, release…)
```

## Контент

Записи — Markdown в `src/entities/post/content/<locale>/<slug>.md` с frontmatter под
Zod-схему (`title` 25–65, `description` 70–170, `pubDate`, `tags`, `translationKey`,
`draft`, обложка с `alt`, `author` — id из реестра авторов). Язык задаёт каталог; переводы
связаны `translationKey`, непереведённое под `/en/` — 404, черновики видны только в
`astro dev`. Списки — `/blog`, `/blog/page/N`, `/blog/tag/<tag>` (страница тега индексируется от
трёх записей локали, ниже — `noindex` и вне карты сайта); всё prerender, 0 JS.
Инварианты и гейты — rule `.claude/rules/content-invariants.md`.

## Режимы рендера

Всё prerender по умолчанию; on-demand (`export const prerender = false`) — только служебное:
`404`, `/healthz`, `/now` (время сервера, `noindex`, `private, no-store`), `robots.txt`,
файл ключа IndexNow и обработчик формы `/api/contact`; фиды и карта сайта — файлы сборки. Кеш-заголовки,
карта маршрутов и рецепт кеша процесса для контента из CMS —
[`docs/reference/rendering.md`](docs/reference/rendering.md).

## Форма обратной связи

`/contacts` — обычная HTML-форма без JavaScript: браузер шлёт POST на `/api/contact`, сервер
проходит лестницу origin-check → лимит и форма тела → honeypot → валидация (согласие на
обработку ПДн проверяется и на сервере) → шов капчи и доставляет заявку одним каналом
(`FORM_DELIVERY=smtp|backend`, три попытки). Успех — 303 на `/contacts/spasibo`, ошибка — та же
страница с сохранёнными полями, сбой канала — честный 500; отказ до разбора заявки — короткий
текст (403, 400, 413). Тело заявки не логируется. Rate-limit на этот путь ставится на прокси —
строка в чек-листе [`deployment.md`](docs/reference/deployment.md). Правило —
`.claude/rules/forms-antispam.md`; политика обработки ПДн — `/legal/privacy` с плейсхолдерами
реквизитов оператора.

## SEO

`<head>` каждой страницы собирает `DocumentLayout` из props (`title`, `description`,
`alternatePath`, `jsonLd`): title-шаблон, self-canonical, полный OG (`og:image` — обложка записи
или `public/og-default.png`), `twitter:card`, hreflang только для реальных переводов (взаимно, +
`x-default`), RSS autodiscovery. JSON-LD — в `<head>`: `Organization`/`WebSite` на главной,
`LocalBusiness` на «О компании» — одна организация с `@id` `<origin>/#org`, на неё ссылаются сайт
и записи; `BreadcrumbList` на вложенных (из того же массива, что видимые крошки
`widgets/breadcrumbs`), `BlogPosting` у записи — с автором `Person`, когда у записи есть автор
из реестра и подпись; в `<body>` ни одного `<script>`. Первая иконка в `<head>` — PNG 192×192:
растр, который подходит выдаче Google. `robots.txt` (`ROBOTS_POLICY`; политика ИИ-ботов — поле сборки `AI_BOTS_POLICY`,
группы — из реестра ботов базы strategy; `Clean-param` Яндексу — служебные параметры адреса
`CLEAN_PARAMS`) и `/<INDEXNOW_KEY>.txt` — on-demand на runtime `SITE_URL`; `sitemap.xml` (сборка пишет его по
страницам `dist/client`: ровно страницы без `noindex`, `lastmod` — дата правки или публикации
записи) и фиды `rss.xml`/`en/rss.xml` — файлы сборки, origin в них штампуется при старте
контейнера. Гейты: `pnpm seo:check` и HTTP-набор
(`e2e/http/`: сырой HTML, тот же ответ каждому боту реестра, robots, карта, фиды) в `pnpm check`;
правило — `.claude/rules/seo-invariants.md`.

Видимость в ИИ-ответах (GEO) держит тот же слой: поисковому роботу и ИИ-боту сервер отдаёт тот же
ответ, что человеку, а кого пускать, решает политика ИИ-ботов в `robots.txt`; организация в
разметке одна, у записи — автор; скрытую разметку и даты из будущего в записи отклоняет
`check:content`, словам учит `/content`. После выката `/seo-audit` гоняет пробу базы strategy
(`pnpm geo:probe`), а `pnpm indexnow` сообщает поисковикам адреса, которые изменил релиз.
`llms.txt` и «версии для ИИ» шаблон не публикует — `docs/reference/seo.md § Чего шаблон не делает`.

## Один образ на все среды

Сборка печёт `site: 'https://__site_origin__'`; при старте контейнера
`docker/entrypoint.sh` штампует `SITE_URL` в `dist/client` (HTML, XML, TXT) и проверяет,
что плейсхолдера не осталось, а `docker/server.mjs` добавляет keep-alive и graceful
shutdown под Traefik и отказывается стартовать, если env не проходит схему `shared/config`
(значение ключа вне формата, нет реального `SITE_URL`). Подробности —
[`docs/reference/deployment.md`](docs/reference/deployment.md).

## UI

Компоненты пишутся в проекте как `.astro` на собственном токен-слое
(`src/app/styles/index.css`: Tailwind v4 `@theme` + семантические переменные, тема через
`light-dark()` и `data-scheme`), без вендорных UI-китов. Ни одна страница не грузит внешних
скриптов: из JavaScript в шаблоне только острова — тема (инлайн-`<script>` в `<head>`, который
применяет выбор до первой отрисовки и обслуживает переключатель) и счётчик при заданном
`METRIKA_ID`; CSP каждой страницы пропускает только их — по хешу тела. Картинки —
`astro:assets` (`<Picture>`: AVIF/WebP с фолбэком, размеры заданы, обложка записи грузится с
приоритетом). Скрипты, чужие ресурсы, размеры картинок и приоритет LCP каждой страницы проверяет
`seo:check`, CSP — HTTP-набор, сырой `<img>` и цвета мимо токенов — ESLint, доступность и
нарушения CSP — браузерный набор в обеих темах на `/release`.

## Из шаблона — в свой сайт

Форк проходит путь «онбординг → платформа → разворот → свои страницы»: `/init-service`
ведёт по этапам, `/stack-deep-dive` заполняет `docs/stack/*.md`, `/de-template`
подставляет идентичность и реквизиты оператора и чистит reference-набор, `/scaffold` и
`/content` добавляют своё, `/seo-audit` и `/release` выпускают. Путь целиком —
[`docs/getting-started.md`](docs/getting-started.md).

## Документация

| Документ | О чём |
|---|---|
| [`docs/README.md`](docs/README.md) | карта документации |
| [`docs/getting-started.md`](docs/getting-started.md) | путь потребителя: форк → свой сайт |
| [`docs/reference/architecture.md`](docs/reference/architecture.md) | FSD под Astro: слои, public API, кто держит границы |
| [`docs/reference/rendering.md`](docs/reference/rendering.md) | режимы рендера, карта маршрутов, кеш-заголовки, рецепт кеша процесса |
| [`docs/reference/seo.md`](docs/reference/seo.md) | что держит шаблон, чек-лист страницы, три контура staging |
| [`docs/reference/deployment.md`](docs/reference/deployment.md) | образ, entrypoint, server.mjs, env-контракт, требования к прокси |
| [`docs/reference/observability.md`](docs/reference/observability.md) | JSON-лог, `X-Request-Id`, `/healthz`, Sentry |
| [`docs/reference/ecosystem.md`](docs/reference/ecosystem.md) | место среди шаблонов stit, флоу работы из хаба `<org>/infra` и контракты с соседями |
| [`docs/reference/infra-handoff.md`](docs/reference/infra-handoff.md) | задание для соседних репо: сервис `site` в compose, Traefik, CrowdSec, приёмка |
| [`docs/reference/kinship.md`](docs/reference/kinship.md) | родство с `spa-frontend-template` |
| [`.claude/rules/forms-antispam.md`](.claude/rules/forms-antispam.md) | форма без JS: PRG, антиспам-лестница, согласие на ПДн, доставка |
| [`CLAUDE.md`](CLAUDE.md) | гайд для агента (ядро + роутер) |

## Часть экосистемы stit

Это один из открытых шаблонов stit (Apache-2.0) — фундамент «-1 уровня»,
берите бесплатно и владейте. Карта всех шаблонов и точка входа —
**[витрина stit](https://git.stit.tech/stit-core/stit-public)**. Нужна
команда, стандарт или поддержка — **[наш подход и контакты (vision)](https://git.stit.tech/stit/vision)**.

## Лицензия

**Apache-2.0** — см. [`LICENSE`](LICENSE).
