---
description: Тестовая дисциплина — где живут тесты, что покрывают, что в gate.
globs: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}", "e2e/**", "vitest.config.ts"]
---

# Тесты

## Расположение

- **Unit/component** — рядом со слайсом: `features/auth/ui/login-form.test.tsx`
- **E2E** (Playwright) — отдельный `e2e/`, вне FSD-графа
- **Тестовые утилиты** — `src/shared/lib/testing/` (если нужны)

## Что покрываем

- `entities/<name>/model/schema.ts` — Zod-схема (valid/invalid)
- `entities/<name>/api/queries.ts` — мутации (mock МSW) + invariants
- `features/<name>/ui/*` — поведение формы / действия + axe-доступность
- `widgets/<name>/ui/*` — рендер с разными состояниями + axe
- `pages/*.tsx` — route guards, основной сценарий (e2e лучше)
- `shared/lib/*` — pure-утилиты

## A11y

- В компонент-тестах — `vitest-axe` (`expect(container).toHaveNoViolations()`)
- В критичных e2e — `@axe-core/playwright`

## Gate

`pnpm test` (== `vitest run`) обязателен в `pnpm check`. E2E (`pnpm test:e2e`) —
**отдельный CI-stage**, не в gate, чтобы local-цикл оставался быстрым.

## Mocks в тестах

- Для запросов — переиспользуем `src/shared/api/mock/handlers/*` через
  `setupServer(...buildHandlers(db, false))` из `msw/node`
- Сценарии (`empty | populated | …`) — те же, что в dev

## Что не делаем

- ❌ Тесты внутри слайса, импортирующие из другого слайса напрямую — это
  нарушает FSD-границы и в production-коде, и в тестовом
- ❌ Snapshot-тесты целых страниц (ломкие, нечитаемые)
- ❌ Тестируем CSS — это задача visual regression (отдельный таргет)
