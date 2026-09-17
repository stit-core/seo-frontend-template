# Архитектура

## Слои FSD

```
app → pages → widgets → features → entities → shared
```

Импорт строго **нисходящий**. `app` и `shared` — sliceless (слой == слайс,
внутри сегменты могут импортировать друг друга свободно). Остальные слои —
со слайсами, между слайсами **импорт запрещён**.

### Ответственности

| слой | что лежит |
|---|---|
| `app/` | bootstrap (`main.tsx`, `init.ts`), providers, router-config, root-стили |
| `pages/` | 1 page = 1 route (file-based TanStack Router); page-локальная композиция |
| `widgets/` | переиспользуемые UI-блоки на ≥2 pages (Header, Sidebar, AppShell…) |
| `features/` | пользовательские сценарии (LoginForm, CreateTodo, ThemeSwitcher) |
| `entities/` | доменные сущности (Session, User, Todo) — schema + queries + ui-presenter |
| `shared/` | инфра: api-клиент, mock-слой, config, i18n, lib, ui-компоненты |

## Сегменты слайса

```
features/<slice>/
├─ ui/         React-компоненты
├─ model/      стор, schema, types, бизнес-логика
├─ api/        запросы и мапперы
├─ lib/        хелперы слайса
├─ config/     константы, feature-flags
└─ index.ts    public API (explicit re-exports)
```

**Запрещены** сегменты группировки по типу: `components/`, `hooks/`,
`utils/`, `types/`. Группировка — только по назначению.

## Public API

- `index.ts` обязателен на каждом слайсе **и** сегменте sliceless-слоя
- Explicit re-exports, не `export *`
- Внутри слайса — относительные пути, снаружи — только через `index.ts`
- В `shared/ui` и `shared/lib` — отдельный `index.ts` на компонент/утилиту
  (для tree-shake)

## Pages-first

При декомпозиции новой функциональности — **начинать с pages**, спускаться
вниз только при реальном переиспользовании. Не выносить «на будущее» —
Steiger ловит `insignificant-slice`.

## Cross-feature

Фича A не импортирует фичу B напрямую. Варианты:

1. Поднять общее в `entities/` или `shared/` (предпочтительно)
2. Композировать в `widget` или `page` (родитель видит обе)
3. `@x`-нотация **только для `entities/`** (`entities/song/@x/playlist.ts`),
   не для `features/`

## UI-компоненты

Внешней дизайн-системы нет — все компоненты пишутся в проекте и делаются
design-system-agnostic: опираются только на собственный токен-слой
(`app/styles/index.css` — Tailwind v4 `@theme` + семантические переменные,
тема через `data-scheme`), не на вендорную DS.

- `shared/ui/` — переиспользуемые примитивы и обёртки с layout-/biz-семантикой
  (PageHeader, DataTable…)
- слайс-локальный UI — в `ui/`-сегменте слайса, поднимается в `shared/ui/`
  при реальном переиспользовании

Дисциплина — rule `shared-ui`.

## Линт-стек

| инструмент | задача |
|---|---|
| TypeScript strict | типы (verbatimModuleSyntax, noUncheckedIndexedAccess, …) |
| Biome 2 | format + базовые JS/TS правила |
| ESLint 9 flat | React, jsx-a11y, react-compiler, testing-library, boundaries |
| Steiger | архитектурный линтер FSD (forbidden-imports, public-api, slice-discipline) |
| size-limit | бандл-бюджеты на entry-чанки |

## Тесты

- Unit/component — рядом со слайсом (`*.test.tsx`)
- E2E — отдельный `e2e/` (Playwright) вне FSD-графа
- A11y — `vitest-axe` на компонент-уровне, `@axe-core/playwright` на критичных flow

## Gate `pnpm check`

```
typecheck → lint → format:check → test → steiger → size → build
```

E2E и visual-regression — отдельные таргеты, не в gate (платформозависимы).
