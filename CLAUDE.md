# spa-frontend-template — гайд для агентов

Шаблон React SPA: TypeScript 6 / Vite 8 / React 19.2 + Compiler 1.0 /
TanStack Router (file-based) + Query + Form / Zustand / Zod 4 (рукописные
контракты API, без кодогена) / Tailwind v4 / MSW для mock-режима /
Lingui 5 runtime-only i18n / Sentry condit. + web-vitals /
Biome 2 + ESLint 9 + Steiger / Vitest 4 + Playwright / pnpm 10 / lefthook.

Этот файл — **ядро (always-on) + роутер**. Детали — в `docs/`, контекстные
правила — в `.claude/rules/` (path-scoped), процедуры — в `.claude/skills/`.
Карта документации — `docs/README.md`.

## Точка входа

- **`/smartdev`** — cockpit сессии: сводка состояния (ветка, drift, активный план, gate'ы) +
  переключение в нужный режим. Запускай в начале / после `/clear`.
- **Потребителю шаблона** — `docs/getting-started.md`: форк → `/init-service` →
  проектирование стека (FSD-карта — в `<org>/strategy`) → `/de-template` → свой проект.
- **Planning-first.** Любое содержательное изменение идёт через план — секция в
  `.claude/plans/roadmap.md` (skill `/plan`). Прямая правка — только truly-atomic
  и багфиксы.

## Проектирование первично, код вторичен

**FSD-карта проектируется в соседнем `<org>/strategy`** (форк
`business-strategy-template`): слой `docs/projects/<slug>/fsd/<surface>/` —
карта слайсов (entities · features · pages · widgets · app · shared-*),
восходящая к ситуациям/экранам/доменам; там её ведёт его `/fsd-deep-dive`.
Этот репо её **читает** (cross-repo, read-only): `/scaffold` и `/de-template`
разворачивают stable-записи в код и сами выводят `src/<layer>/<slice>/` из
kind + slug. Артефакты платформы — локальные `docs/stack/` (8 kinds). Код
пишется/генерируется по артефактам, не наоборот. Reference-слайсы
`features/auth`, `pages/profile`, `pages/todos`, `features/theme` — учебные
образцы: изучить, потом удалить под свой проект (через `/de-template`).

Резолв соседа — sibling-checkout: поля `project-slug` / `strategy-path`
(дефолт `../strategy`) / `surface` в `docs/stack/service.md`. Соседа нет —
скиллы печатают next-step, не падают.

## Команды

Единый интерфейс через `pnpm <script>` (`package.json`):

| команда | что делает |
|---|---|
| `pnpm dev` | Vite dev-server, mock-режим по умолчанию |
| `pnpm build` | typecheck + Vite prod build |
| `pnpm test` | Vitest (run) |
| `pnpm test:e2e` | Playwright |
| `pnpm steiger` | архитектурный линтер FSD |
| `pnpm gen` | route-tree (TanStack Router CLI) |
| `pnpm check` | **gate**: typecheck + lint + format:check + test + steiger + build + size |

Перед claim «готово» / push — **`pnpm check`** (его же гоняет `lefthook pre-push`).

## Карта: где что

| Тема | Где |
|---|---|
| Архитектура FSD, слои, public API | `docs/reference/architecture.md` + rule `fsd-architecture` |
| Экосистема (6 шаблонов + библиотеки, контракты, оркестрация из `<org>/infra`) | `docs/reference/ecosystem.md` |
| Observability (Sentry, web-vitals) | `docs/reference/observability.md` |
| Deployment (Dockerfile, nginx, runtime config) | `docs/reference/deployment.md` |
| Тесты | rule `tests-pipeline` |
| env, секреты, runtime config | rule `env-local` |
| UI-компоненты (свои, agnostic, свой токен-слой) | rule `shared-ui` |
| FSD-карта (8 kinds, cross-repo) | `../strategy/docs/projects/<slug>/fsd/<surface>/` (канон — `_template/fsd/README.md` в strategy) |
| Stack-артефакты (8 kinds) | `docs/stack/README.md` |
| Forward-only стиль | rule `forward-only` |

## Стиль кода (инварианты)

- **Biome formatter** + **ESLint flat config** обязательны (`pnpm lint`)
- **TypeScript strict** (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`, …) —
  без `as any` без явной причины
- **React Compiler 1.0** (`compilationMode: infer`) — код пишется без ручных
  `useMemo`/`useCallback`/`memo` кроме обоснованных случаев (compiler-правила
  `eslint-plugin-react-hooks` ловят нарушения Rules of React)
- **FSD-импорты** строго нисходящие (Steiger + `eslint-plugin-boundaries` + `no-restricted-imports`)
- **Public API** — `index.ts` на каждом слайсе/сегменте sliceless-слоя, explicit re-exports
- **UI-компоненты пишутся в проекте** — design-system-agnostic, на собственном
  токен-слое (`app/styles/index.css`), без внешней DS (rule `shared-ui`)
- **Комментарии** — только WHY, кратко (rule `comments`)
- **Forward-only** — все доки/комментарии описывают текущее состояние,
  без «было/стало», без changelog'ов в prose

## Git workflow

- **Conventional Commits**: `feat|fix|refactor|docs|test|chore|meta|perf|style`,
  формат `<type>(<scope>)?: <subject>`, subject ≤ 72
- **Push в `main` разрешён** (прямой или через PR); линейная история
- Gate `lefthook pre-push → pnpm check` (skip только при явной просьбе юзера)
- git-хуки ставятся `pnpm prepare` (== `lefthook install`)

## Границы

### Делать всегда
- Перед claim «готово» — `pnpm check`
- **Изменение — через план** (skill `/plan`). Отклонение — осознанное
- Cross-feature — только через подъём в entities/shared или композицию в widget/page
- Compute-side-effects — в `app/init.ts` или в Query (`queryFn`); никогда в рендере
- При правке `docs/stack/*.md` — следить за `status: stable` и `Generates`-секцией;
  FSD-карта правится только в `<org>/strategy` (его `/fsd-deep-dive`), не здесь

### Сначала спросить
- Правка `docker/*`, `.npmrc`, `package.json#dependencies` без записи в `docs/stack/dependencies.md`
- Удаление reference-слайсов вручную (это работа `/de-template`)
- Изменение FSD-структуры (новый слой, переименование сегментов)
- Любой `--no-verify`

### Не делать никогда
- `--no-verify` без явного разрешения юзера
- Коммитить `.env`, `*.pem`, `*.key`
- Прямой `export *` из `index.ts` (только explicit re-exports)
- Импорт из `../*/*/*/*` или мимо public API
- Импорт внешней дизайн-системы / вендорных UI-китов (Material UI, shadcn, chakra…)
- Хардкод сырых цветов/размеров в компонентах вместо семантических токенов (`app/styles/index.css`)

## Forward-only

Любой текст в репо описывает **только текущее состояние** — не «было/стало».
История — в `git log` + Conventional Commits. Полное правило —
`.claude/rules/forward-only.md`.

## Авто-память

Запись в файловую авто-память запрещена глобально (см. `~/.claude/CLAUDE.md`).
Не предлагай «сохранить в память». Долгосрочное знание — в репо: `CLAUDE.md`,
`.claude/rules/`, `state/` каждого скила.
