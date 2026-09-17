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
(`astro/tsconfigs/strictest`) · Tailwind v4 на собственном токен-слое · Zod 4 ·
i18n `ru` (без префикса) + `en` (`/en`) · Biome 2 + Prettier (только `*.astro`) ·
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
pnpm size             # бюджеты CSS / HTML
pnpm kin:diff         # сверка обвязки с ../spa-frontend-template (advisory)
pnpm check            # gate: typecheck + lint + format + test + steiger + check:gate + build + size
```

Перед claim «готово» / push — **`pnpm check`** (его же гоняет `lefthook pre-push`).

## Структура

Feature-Sliced Design, импорты строго нисходящие (`app → pages → widgets → features →
entities → shared`); между слайсами одного слоя — запрещены. Границы держит ESLint
(`boundaries` с резолвером + `no-restricted-imports`), структуру — Steiger; `.gate-fixtures/`
с заведомыми нарушениями входит в gate, чтобы линтеры не деградировали молча.

```
src/app/          layouts/document.astro, middleware, styles/index.css (токены, тема)
src/pages/        роутинг Astro = слой pages: index.astro, en/, 404.astro, healthz.ts
src/widgets/      каркас: site-header, site-footer
src/shared/       config (runtime env, Zod), i18n, lib (+ testing/a11y), ui
src/{content.config,middleware,env.d}.ts   навязанные Astro entry — тонкие реэкспорты
docker/           Dockerfile (3 стадии), entrypoint.sh (штамповка SITE_URL), server.mjs
e2e/              Playwright на prod-сборке
scripts/          check-gate.mjs, kin-diff.mjs
.claude/          правила (path-scoped) и скиллы
```

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
