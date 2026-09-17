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
редиректы как данные (`content/redirects.yaml`) · Biome 2 + Prettier (только `*.astro`) ·
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
pnpm test             # Vitest: unit + Container API (.astro) + axe
pnpm test:e2e         # Playwright на prod-сборке (порт 3201)
pnpm steiger          # структурный линтер FSD
pnpm check:gate       # негативные фикстуры обязаны валить линтеры
pnpm check:content    # контент-гейт: схема .md, тело, переводы, ссылки, redirects.yaml
pnpm check:links      # после build: все внутренние ссылки в dist/client существуют
pnpm size             # бюджеты CSS / HTML
pnpm kin:diff         # сверка обвязки с ../spa-frontend-template (advisory)
pnpm ttfb <origin> …  # TTFB запущенного сервера: медиана/p90 20 запросов
pnpm check            # gate: typecheck + lint + format + test + steiger + check:gate + check:content + build + check:links + size
```

Перед claim «готово» / push — **`pnpm check`** (его же гоняет `lefthook pre-push`).

## Структура

Feature-Sliced Design, импорты строго нисходящие (`app → pages → widgets → features →
entities → shared`); между слайсами одного слоя — запрещены. Границы держит ESLint
(`boundaries` с резолвером + `no-restricted-imports`), структуру — Steiger; `.gate-fixtures/`
с заведомыми нарушениями входит в gate, чтобы линтеры не деградировали молча.

```
content/redirects.yaml   редиректы как данные: 301/308/410 одним хопом (обслуживает middleware)
src/app/          layouts/document.astro, middleware (лог, X-Request-Id, редиректы), styles/index.css
src/pages/        роутинг Astro = слой pages: index, blog/{index,[slug],page/[page],tag/[tag]}, en/…
                  (prerender); 404, healthz, now (on-demand); секции страниц — _blog/
src/widgets/      site-header, site-footer, post-list
src/entities/post content/{ru,en}/*.md + covers/, model/{schema,collection}, api/queries, lib, ui
src/shared/       config (runtime env, Zod), i18n, lib (+ testing), redirects, ui
src/{content.config,middleware,env.d}.ts   навязанные Astro entry — тонкие входы
docker/           Dockerfile (3 стадии), entrypoint.sh (штамповка SITE_URL), server.mjs
e2e/              Playwright на prod-сборке
scripts/          check-gate, check-content, check-links, kin-diff, ttfb
.claude/          правила (path-scoped) и скиллы
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
`404`, `/healthz`, `/now` (единственная on-demand HTML-страница: время сервера, `noindex`,
`private, no-store`). Кеш-заголовки, карта маршрутов и рецепт кеша процесса для контента из
CMS — [`docs/reference/rendering.md`](docs/reference/rendering.md).

## Один образ на все среды

Сборка печёт `site: 'https://__site_origin__'`; при старте контейнера
`docker/entrypoint.sh` штампует `SITE_URL` в `dist/client` (HTML, XML, TXT) и проверяет,
что плейсхолдера не осталось, а `docker/server.mjs` добавляет keep-alive и graceful
shutdown под Traefik и отказывается стартовать без реального `SITE_URL`. Подробности —
[`docs/reference/deployment.md`](docs/reference/deployment.md).

## UI

Внешней дизайн-системы нет — компоненты пишутся в проекте как `.astro` на собственном
токен-слое (`src/app/styles/index.css`: Tailwind v4 `@theme` + семантические переменные,
тема через `light-dark()` и `data-scheme`). Контентные страницы не грузят JavaScript —
это проверяет e2e.

## Документация

| Документ | О чём |
|---|---|
| [`docs/README.md`](docs/README.md) | карта документации |
| [`docs/reference/rendering.md`](docs/reference/rendering.md) | режимы рендера, карта маршрутов, кеш-заголовки, рецепт D |
| [`docs/reference/deployment.md`](docs/reference/deployment.md) | образ, entrypoint, server.mjs, env-контракт |
| [`docs/reference/kinship.md`](docs/reference/kinship.md) | родство с `spa-frontend-template` |
| [`CLAUDE.md`](CLAUDE.md) | гайд для агента (ядро + роутер) |

## Часть экосистемы stit

Это один из открытых шаблонов stit (Apache-2.0) — фундамент «-1 уровня»,
берите бесплатно и владейте. Карта всех шаблонов и точка входа —
**[витрина stit](https://git.stit.tech/stit-core/stit-public)**. Нужна
команда, стандарт или поддержка — **[наш подход и контакты (vision)](https://git.stit.tech/stit/vision)**.

## Лицензия

**Apache-2.0** — см. [`LICENSE`](LICENSE).
