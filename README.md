<div align="center">

# spa-frontend-template

### React SPA на строгой FSD-архитектуре, mock-first

Шаблон фронтенда экосистемы stit: Vite + TypeScript + React 19 + TanStack,
Feature-Sliced Design под линтером, mock-режим из коробки. Крутится без бэкенда
с первой минуты; код пишется по спроектированной FSD-карте.

[![License](https://img.shields.io/badge/license-Apache--2.0-2563eb)](LICENSE)
[![Часть stit](https://img.shields.io/badge/stit-открытые_шаблоны-6366f1)](https://git.stit.tech/stit-core/stit-public)
[![Vite](https://img.shields.io/badge/Vite-8-646cff)](#стек)
[![React](https://img.shields.io/badge/React-19.2-149eca)](#стек)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](#стек)
[![Arch](https://img.shields.io/badge/arch-FSD_%2B_Steiger-22c55e)](#структура)

</div>

---

## Стек

TypeScript 6 · Vite 8 · React 19.2 + Compiler 1.0 · TanStack Router (file-based)
+ Query + Form · Zustand · Zod 4 (рукописные контракты API) · Tailwind v4 ·
MSW (mock-режим) · Lingui 5 (runtime-only i18n) · Sentry + web-vitals ·
Biome + ESLint + Steiger · Vitest 4 + Playwright · pnpm 10 · lefthook.

## Быстрый старт

```bash
# Node 24 + pnpm 10
nvm use && corepack enable && corepack prepare pnpm@10 --activate

pnpm install
pnpm prepare         # lefthook git-hooks
pnpm gen:msw         # init Service Worker для MSW в public/

pnpm dev             # mock-режим по умолчанию → http://localhost:5173
```

В углу появится мини-панель `mock:` — переключатель сценариев
(`empty | populated | authenticated | error`) и кнопка `reset`. Бэкенд не нужен.

## Воркфлоу нового проекта

```
0. Use this template на Gitea → клон → pnpm install
1. /smartdev          → сводка состояния
2. /init-service      → оркестратор онбординга:
   ├─ привязка к FSD-карте из ../strategy (проектируется там: /fsd-deep-dive)
   ├─ /stack-deep-dive→ проектирование стека (docs/stack/*)
   ├─ /de-template    → разворот фундамента
   └─ /scaffold       → реализация по слайсам
3. pnpm dev           → SPA крутится в mock-режиме
4. когда бэк появится → zod-схемы сущностей по контракту, VITE_API_MODE=real
5. pnpm check → /release → образ в registry → rollout в <org>/infra (make bump)
```

FSD-карта (`../strategy/docs/projects/<slug>/fsd/<surface>/`, cross-repo) и
стек (`docs/stack/`) — **source of truth**; код пишется по ним.
Reference-слайсы (`features/auth`, `pages/profile`, …) — учебные образцы:
изучить, удалить под свой проект через `/de-template`. Полный путь —
[`docs/getting-started.md`](docs/getting-started.md).

## Команды

```bash
pnpm dev              # Vite dev (mock-режим)
pnpm build            # typecheck + Vite prod build
pnpm test             # Vitest
pnpm test:e2e         # Playwright
pnpm lint             # Biome + ESLint
pnpm steiger          # FSD-линтер
pnpm gen              # route-tree (TanStack Router CLI)
pnpm check            # gate: typecheck + lint + format + test + steiger + build + size
```

Перед claim «готово» / push — **`pnpm check`** (его же гоняет `lefthook pre-push`).

## Структура

Feature-Sliced Design, импорты строго нисходящие (`app → pages → widgets →
features → entities → shared`), между слайсами одного слоя — запрещены; ловит
Steiger.

```
src/app/          bootstrap, providers, router, root-стили
src/pages/        file-based TanStack Router routes
src/widgets/      переиспользуемые блоки
src/features/     пользовательские сценарии
src/entities/     доменные сущности
src/shared/       инфра: api, config, i18n, lib, ui
docs/stack/       проектная карта стека (/stack-deep-dive)
docs/reference/   стационарные доки (architecture, ecosystem, deployment)
.claude/          скиллы и path-scoped правила
```

## UI-компоненты

Внешней дизайн-системы нет — компоненты пишутся в проекте и делаются
design-system-agnostic: опираются только на собственный токен-слой
(`src/app/styles/index.css` — Tailwind v4 `@theme` + семантические
CSS-переменные, тема через `data-scheme`). Слайс-локальный UI — в `ui/`-сегменте
слайса; переиспользуемые примитивы/обёртки — в `src/shared/ui/`. Дисциплина —
rule `shared-ui`.

## Документация

| Документ | О чём |
|---|---|
| [`docs/README.md`](docs/README.md) | карта документации |
| [`docs/getting-started.md`](docs/getting-started.md) | старт для потребителя шаблона |
| [`docs/reference/architecture.md`](docs/reference/architecture.md) | FSD, слои, public API |
| [`docs/reference/deployment.md`](docs/reference/deployment.md) | Docker + nginx + runtime config |
| [`CLAUDE.md`](CLAUDE.md) | гайд для агента (ядро + роутер) |

## Часть экосистемы stit

Это один из открытых шаблонов stit (Apache-2.0) — фундамент «-1 уровня»,
берите бесплатно и владейте. Карта всех шаблонов и точка входа —
**[витрина stit](https://git.stit.tech/stit-core/stit-public)**. Нужна
команда, стандарт или поддержка — **[наш подход и контакты (vision)](https://git.stit.tech/stit/vision)**.

## Лицензия

**Apache-2.0** — см. [`LICENSE`](LICENSE).
