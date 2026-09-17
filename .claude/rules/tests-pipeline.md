---
description: Тестовая дисциплина — два проекта Vitest, Container API для .astro, axe-хелпер, Playwright на prod-сборке, состав gate.
globs: ["src/**/*.test.ts", "e2e/**", "vitest.config.ts", "src/shared/lib/testing/**", ".gate-fixtures/**", "scripts/*.mjs"]
---

# Тесты

## Расположение и проекты Vitest

- **Unit** — рядом с модулем (`shared/i18n/locale.test.ts`): проект `dom` (happy-dom)
- **Компонентные `.astro`** — `<name>.astro.test.ts` рядом с компонентом: проект `astro`
  (node-окружение, Container API `experimental_AstroContainer`); проверка HTML-строки +
  `expectNoA11yViolations` из `@/shared/lib/testing` (axe-core; правило `region` для
  фрагмента выключено). Пропсы-сущности — плоские фикстуры (`Post` не тянет `astro:content`)
- **Запросы к контенту** (`entities/*/api/queries.test.ts`) — `astro:content` подменяется
  `vi.mock` с фикстурами через `vi.hoisted`, модуль импортируется после мока: проверяются
  фильтр черновиков и локали, сортировка, twin по `translationKey` — в обоих режимах
  (`vi.stubEnv('DEV', false | true)`: Vitest сам работает в dev-режиме Vite)
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
| `entities/*/ui/*.astro`, `widgets/*/ui/*.astro` | Container API + axe |
| `entities/*/model/schema.ts` | valid/invalid frontmatter, дефолт `draft`, бюджеты, заглушка `image()` |
| `shared/redirects`, `app/middleware/redirects` | pure-тесты: дубли/цепочки/статусы, пустая таблица, query в `Location`, 410; точное совпадение `from` на реальном `content/redirects.yaml` |
| контент целиком (`.md`, `redirects.yaml`, ссылки) | `pnpm check:content` до build, `pnpm check:links` после |
| статусы, заголовки, `lang`, один `<h1>`, «0 script-ресурсов», «нет `__site_origin__`», axe страниц; списки без черновика, 404 на черновик/непереведённое, `/old` → 301 одним хопом, 410 с `noindex` | e2e (`smoke.spec.ts`, `content.spec.ts`) |
| нарушения границ FSD и пустой a11y-конфиг | `.gate-fixtures/` + `pnpm check:gate` |

## Gate

`pnpm check` = typecheck → lint → format:check → test → steiger → check:gate →
check:content → build → check:links → size. `pnpm test:e2e` — отдельный stage, не в gate
(тянет браузер).

## Что не делаем

- ❌ `vitest-axe` (заброшен) — свой хелпер поверх `axe-core`
- ❌ Vitest browser mode / `vitest-browser-astro` (несовместим с Astro 7 / Vitest 5)
- ❌ Тесты, импортирующие соседний слайс мимо public API
- ❌ Snapshot-тесты страниц; тесты CSS
