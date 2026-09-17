---
description: Тестовая дисциплина — два проекта Vitest, Container API для .astro, axe-хелпер, Playwright на prod-сборке, состав gate.
globs: ["src/**/*.test.ts", "e2e/**", "vitest.config.ts", "src/shared/lib/testing/**", ".gate-fixtures/**", "scripts/check-gate.mjs"]
---

# Тесты

## Расположение и проекты Vitest

- **Unit** — рядом с модулем (`shared/i18n/locale.test.ts`): проект `dom` (happy-dom)
- **Компонентные `.astro`** — `<name>.astro.test.ts` рядом с компонентом: проект `astro`
  (node-окружение, Container API `experimental_AstroContainer`); проверка HTML-строки +
  `expectNoA11yViolations` из `@/shared/lib/testing` (axe-core; правило `region` для
  фрагмента выключено)
- **Процессные** — `<name>.server.test.ts`: проект `astro`; `docker/*` гоняется через
  `spawnSync` (fail-fast `server.mjs`, отказ и штамповка `entrypoint.sh` на временном `dist`)
- **E2E** — `e2e/*.spec.ts`, Playwright на **prod-сборке**: webServer = `pnpm build` с
  плейсхолдером + `docker/entrypoint.sh` + `docker/server.mjs` на порту 3201, `url` —
  `/healthz` (не `/`). Сырой HTML — через `request` (в т.ч. `User-Agent: Googlebot`),
  поведение — через `page`

## Что покрываем

| что | чем |
|---|---|
| `shared/config` | дефолты, пустые значения, валидация, whitelist; `server.mjs`/`entrypoint.sh` — отказ без `SITE_URL`, с плейсхолдером и без схемы, штамповка `dist/client`, остаточная проверка, идемпотентность; согласованность литерала плейсхолдера |
| `shared/i18n`, `shared/lib` | pure-тесты |
| `widgets/*/ui/*.astro` | Container API + axe |
| статусы, заголовки, `lang`, один `<h1>`, «0 script-ресурсов», «нет `__site_origin__`», axe страниц | e2e |
| нарушения границ FSD и пустой a11y-конфиг | `.gate-fixtures/` + `pnpm check:gate` |

## Gate

`pnpm check` = typecheck → lint → format:check → test → steiger → check:gate → build →
size. `pnpm test:e2e` — отдельный stage, не в gate (тянет браузер).

## Что не делаем

- ❌ `vitest-axe` (заброшен) — свой хелпер поверх `axe-core`
- ❌ Vitest browser mode / `vitest-browser-astro` (несовместим с Astro 7 / Vitest 5)
- ❌ Тесты, импортирующие соседний слайс мимо public API
- ❌ Snapshot-тесты страниц; тесты CSS
