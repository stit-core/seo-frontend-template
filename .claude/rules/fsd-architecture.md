---
description: Жёсткие правила FSD v2.1 — слои, импорты, public API, размещение конкретики.
globs: ["src/**/*.ts", "src/**/*.tsx"]
---

# FSD-архитектура

## Слои (строго нисходяще)

```
app → pages → widgets → features → entities → shared
```

- `app` и `shared` — sliceless (слой == слайс)
- Остальные — слайсы; **между слайсами одного слоя импорт запрещён**
- Импорт **только** в более низкий слой через public API

Полная карта — `docs/reference/architecture.md`.

## Сегменты слайса (по назначению, не по типу)

| сегмент | для чего |
|---|---|
| `ui/` | React-компоненты |
| `model/` | store, schema, types, бизнес-логика |
| `api/` | запросы, мапперы |
| `lib/` | хелперы слайса |
| `config/` | константы, feature-flags |
| `index.ts` | **обязательный** public API |

**Запрещены** сегменты `components/`, `hooks/`, `utils/`, `types/` — это
группировка по типу. Steiger ловит как `no-reserved-folder-names`.

## Public API

- `index.ts` на каждом **слайсе** и **сегменте sliceless-слоя**
- **Explicit re-exports** — `export { foo } from './foo'`, не `export *`
- Внутри слайса — относительные пути; снаружи — `@/<layer>/<slice>`
- Deep-import (`@/<layer>/<slice>/ui/file`) — запрещён
  (`no-restricted-imports` + Steiger `no-public-api-sidestep`)

## Размещение

| что | где |
|---|---|
| Zod schema сущности (контракт API) | `src/entities/<name>/model/schema.ts` |
| HTTP-клиент | `src/shared/api/client.ts` |
| Route-tree (autogen) | `src/app/router/routeTree.gen.ts` |
| File-based routes | `src/pages/<slug>.tsx` или `src/pages/<slug>/route.ts` |
| Mock-слой | `src/shared/api/mock/` |
| Проектные UI-компоненты | `src/shared/ui/<name>/` |
| Семантические токены, темы | `src/app/styles/index.css` |

## Cross-feature

Фича A не импортирует фичу B напрямую. Варианты:

1. Поднять общее в `entities/` или `shared/`
2. Композировать в `widget`/`page`
3. `@x`-нотация — **только для `entities/`** (не для `features/`)

## Pages-first

При новой функциональности — начинаем с `pages/<slug>.tsx`. Выносим в
widget/feature **только когда** реально переиспользуется. Steiger ловит
`insignificant-slice` (widget с 1 референсом).

## UI-компоненты

Внешней дизайн-системы нет — компоненты пишутся в проекте и делаются
design-system-agnostic (опираются только на собственный токен-слой
`app/styles/index.css`). Полное правило — `shared-ui`.

- `shared/ui/` — переиспользуемые примитивы и обёртки (layout-/biz-семантика)
- слайс-локальный UI — в `ui/`-сегменте слайса, поднимается в `shared/ui/`
  при реальном переиспользовании
