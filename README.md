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
OG, JSON-LD; `robots.txt`/`sitemap.xml`/`rss.xml` on-demand на runtime origin) · Biome 2 +
Prettier (только `*.astro`) ·
ESLint 10 (`eslint-plugin-astro`, `boundaries`) + Steiger · Vitest 5 (Container API) +
Playwright · size-limit · pnpm 10 · lefthook + commitlint.

## Быстрый старт

```bash
# Node 24 + pnpm 10
nvm use && corepack enable && corepack prepare pnpm@10 --activate

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
pnpm typecheck        # astro check
pnpm lint             # Biome + ESLint (границы FSD — здесь)
pnpm format:check     # Biome + Prettier для *.astro
pnpm test             # Vitest: unit + Container API (.astro) + axe, покрытие с порогами
pnpm test:e2e         # Playwright на prod-сборке (порт 3201)
pnpm steiger          # структурный линтер FSD
pnpm check:gate       # негативные фикстуры обязаны валить линтеры
pnpm check:content    # контент-гейт: схема .md, тело, переводы, ссылки, redirects.yaml
pnpm check:links      # после build: все внутренние ссылки в dist/client существуют
pnpm seo:check        # после build: head каждой страницы (title/description/canonical/lang/h1/OG/hreflang/JSON-LD)
pnpm size             # бюджеты CSS / HTML
pnpm kin:diff         # сверка обвязки с ../spa-frontend-template (advisory)
pnpm ttfb <origin> …  # TTFB запущенного сервера: медиана/p90 20 запросов
pnpm accept:image <image>   # приёмка собранного образа до пуша в registry
pnpm check            # gate: typecheck + lint + format + test + steiger + check:gate + check:content + build + check:links + seo:check + size
```

Перед claim «готово» / push — **`pnpm check`** (его же гоняет `lefthook pre-push`).

## Структура

Feature-Sliced Design, импорты строго нисходящие (`app → pages → widgets → features →
entities → shared`); между слайсами одного слоя — запрещены. Границы держит ESLint
(`boundaries` с резолвером + `no-restricted-imports`), структуру — Steiger; `.gate-fixtures/`
с заведомыми нарушениями входит в gate, чтобы линтеры не деградировали молча.

```
content/redirects.yaml   редиректы как данные: 301/308/410 одним хопом (обслуживает middleware)
public/           иконки, manifest, og-default.png (социальная карточка 1200×630)
src/app/          layouts/document.astro (<head> из props: SeoHead + JSON-LD), middleware, styles/index.css
src/pages/        роутинг Astro = слой pages: index, about, contacts/{index,spasibo},
                  legal/privacy, blog/{index,[slug],page/[page],tag/[tag]}, en/… , 500 (prerender);
                  404, healthz, now, robots.txt, sitemap.xml, rss.xml, en/rss.xml, [key].txt,
                  api/contact (on-demand); секции страниц — _blog/, _about/, _contacts/;
                  тесты маршрутов и страниц — _tests/
src/widgets/      site-header, site-footer, post-list, breadcrumbs (видимые крошки)
src/features/     contact-form (форма без JS и её обработчик), theme (единственный остров)
src/entities/     post: content/{ru,en}/*.md + covers/, model, api, lib, ui; company: реквизиты
                  оператора для «О компании» и LocalBusiness
src/shared/       config (runtime env, Zod; идентичность сайта), i18n, lib (+ testing), redirects,
                  seo (absoluteUrl, hreflang, SeoHead, JSON-LD, robots/sitemap/rss), antispam
                  (шов капчи), observability (JSON-лог с порогом LOG_LEVEL, Sentry по DSN), ui
src/{content.config,middleware,env.d}.ts   навязанные Astro entry — тонкие входы
docker/           Dockerfile (3 стадии), entrypoint.sh (штамповка SITE_URL), server.mjs
e2e/              Playwright на prod-сборке
scripts/          check-gate, check-content, check-links, seo-check, kin-diff, ttfb, accept-image
docs/stack/       формы платформенных артефактов (12 kinds) — заполняет /stack-deep-dive
.claude/          правила (path-scoped) и скиллы (init-service, scaffold, content, release…)
```

## Контент

Записи — Markdown в `src/entities/post/content/<locale>/<slug>.md` с frontmatter под
Zod-схему (`title` 25–65, `description` 70–170, `pubDate`, `tags`, `translationKey`,
`draft`, обложка с `alt`). Язык задаёт каталог; переводы связаны `translationKey`,
непереведённое под `/en/` — 404, черновики видны только в `astro dev`. Списки — `/blog`,
`/blog/page/N`, `/blog/tag/<tag>`; всё prerender, 0 JS. Инварианты и гейты — rule
`.claude/rules/content-invariants.md`.

## Режимы рендера

Всё prerender по умолчанию; on-demand (`export const prerender = false`) — только служебное:
`404`, `/healthz`, `/now` (время сервера, `noindex`, `private, no-store`), `robots.txt`,
`sitemap.xml`, `rss.xml`, файл ключа IndexNow и обработчик формы `/api/contact`. Кеш-заголовки,
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
`BreadcrumbList` на вложенных (из того же массива, что видимые крошки `widgets/breadcrumbs`),
`BlogPosting` у записи; в `<body>` ни одного `<script>`. `robots.txt`
(`ROBOTS_POLICY`, `AI_TRAINING`), `sitemap.xml` (ровно prerendered-страницы, `lastmod` из
`updatedDate`), `rss.xml`/`en/rss.xml` и `/<INDEXNOW_KEY>.txt` — on-demand на runtime
`SITE_URL`. Гейты: `pnpm seo:check` в `pnpm check`, `e2e/seo.spec.ts`; правило —
`.claude/rules/seo-invariants.md`.

## Один образ на все среды

Сборка печёт `site: 'https://__site_origin__'`; при старте контейнера
`docker/entrypoint.sh` штампует `SITE_URL` в `dist/client` (HTML, XML, TXT) и проверяет,
что плейсхолдера не осталось, а `docker/server.mjs` добавляет keep-alive и graceful
shutdown под Traefik и отказывается стартовать без реального `SITE_URL`. Подробности —
[`docs/reference/deployment.md`](docs/reference/deployment.md).

## UI

Компоненты пишутся в проекте как `.astro` на собственном токен-слое
(`src/app/styles/index.css`: Tailwind v4 `@theme` + семантические переменные, тема через
`light-dark()` и `data-scheme`), без вендорных UI-китов. Ни одна страница не грузит внешних
скриптов: из JavaScript в шаблоне только остров темы — инлайн-`<script>` в `<head>`, который
применяет выбор до первой отрисовки и обслуживает переключатель. Картинки — `astro:assets` (`<Picture>`:
AVIF/WebP с фолбэком, размеры заданы, обложка записи грузится с приоритетом). Всё это
проверяет e2e, включая axe в обеих темах.

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
