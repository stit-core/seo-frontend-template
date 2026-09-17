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
- **Серверные и процессные** — `<name>.server.test.ts`: проект `astro` (node-окружение, родные
  `Request`/`Response`): `app/middleware` с подменённым `getRuntimeConfig` (`vi.mock`
  `@/shared/config`) и `next`-заглушками; `docker/*` гоняется через `spawnSync` (fail-fast
  `server.mjs`, отказ и штамповка `entrypoint.sh` на временном `dist`)
- **E2E** — `e2e/*.spec.ts`, Playwright на **prod-сборке**: webServer = `pnpm build` с
  плейсхолдером + `docker/entrypoint.sh` + `docker/server.mjs` на порту 3201, `url` —
  `/healthz` (не `/`), прод-профиль (`ROBOTS_POLICY=index`, демо-`INDEXNOW_KEY`). Сырой HTML —
  через `request` (в т.ч. `User-Agent: Googlebot`), поведение — через `page`; общие хелперы
  (список prerendered-страниц из `dist/client`, демо-ключ) — `e2e/site.ts`

## Что покрываем

| что | чем |
|---|---|
| `shared/config` | дефолты, пустые значения, валидация, whitelist; `server.mjs`/`entrypoint.sh` — отказ без `SITE_URL`, с плейсхолдером и без схемы, штамповка `dist/client`, остаточная проверка, идемпотентность; согласованность литерала плейсхолдера |
| `shared/i18n`, `shared/lib` | pure-тесты |
| `entities/*/ui/*.astro`, `widgets/*/ui/*.astro` | Container API + axe |
| `entities/*/model/schema.ts` | valid/invalid frontmatter, дефолт `draft`, бюджеты, заглушка `image()` |
| `shared/redirects`, `app/middleware/redirects` | pure-тесты: дубли/цепочки/статусы, пустая таблица, query в `Location`, 410; точное совпадение `from` на реальном `content/redirects.yaml` |
| `app/middleware` | prerendered проходит как есть; `X-Request-Id` принят/сгенерирован; `Cache-Control: no-cache` на on-demand HTML и не перебивает заголовок роута; `X-Robots-Tag` только при `noindex`; редирект/410 до `next`; ошибка → лог 500 с тем же `rid` + rethrow; уровни лога, без query/cookie |
| `shared/seo` | pure-тесты: `normalizePath`/`absoluteUrl` (runtime origin, плейсхолдер без env), `alternates` (взаимный набор, x-default, пусто без перевода), `buildRobotsTxt` (прод/staging/AI-блок), `buildSitemap` (lastmod, экранирование, лимит), `buildFeed` (self-ссылка, язык, лимит записей), фабрики JSON-LD — их выход проходит Zod-схему здесь, не на рендере; Container API: `seo-head.astro` (canonical, hreflang, OG, noindex), `json-ld.astro`, `widgets/breadcrumbs` (видимые крошки, без скриптов, axe) |
| head каждой страницы сборки (`dist/client`) | `pnpm seo:check` после build: один `<title>`/`<h1>`, description с `content`, self-canonical, `lang`, OG с существующей картинкой, hreflang у каждой пары переводов (списки/теги под обоими префиксами, записи по `translationKey`; взаимный, + x-default), уникальность title/description, JSON-LD (типы, Organization/WebSite на главной, форма BreadcrumbList); парсер `<head>` общий с e2e и `check:links` — `scripts/lib/html.mjs` |
| контент целиком (`.md`, `redirects.yaml`, ссылки) | `pnpm check:content` до build, `pnpm check:links` после |
| статусы, заголовки, `lang`, один `<h1>`, «0 script-ресурсов», axe страниц; списки без черновика, 404 на черновик/непереведённое, `/old` → 301 одним хопом, 410 с `noindex` | e2e (`smoke.spec.ts`, `content.spec.ts`) |
| режимы рендера: «нет `__site_origin__`» на всех страницах `dist/client` и on-demand ответах, «в `<body>` нет абсолютных URL своего origin», `/now` (200, `private, no-store`, `noindex`, время меняется, 0 JS, axe), 404/410 с `no-cache`, prerendered с `public, max-age=0` + ETag, TTFB (медиана 20 через `scripts/ttfb.mjs`, мягкий порог) | e2e (`rendering.spec.ts`) |
| SEO на сыром HTML: title/description, self-canonical, hreflang взаимный + x-default (главная ↔ `/en`, запись ↔ перевод, ничего у непереведённой), OG и `og:image` (дефолт 1200×630 у записи без обложки; обложка с её размерами, 200, `immutable`), JSON-LD по типу страницы в `<head>` и ни одного `<script>` в `<body>`, 404/`/now` без canonical/OG, нет `noindex`/`keywords` в прод-профиле, `robots.txt` (Allow, абсолютный Sitemap, без AI-блока), `sitemap.xml` = prerendered-страницы `dist/client` (все 200, `lastmod` только у `updatedDate`), фиды (self-ссылка, язык, абсолютные ссылки, ≤ 20), `/<ключ>.txt`, размер HTML < 300 КБ | e2e (`seo.spec.ts`) |
| нарушения границ FSD и пустой a11y-конфиг | `.gate-fixtures/` + `pnpm check:gate` |

## Gate

`pnpm check` = typecheck → lint → format:check → test → steiger → check:gate →
check:content → build → check:links → seo:check → size. `pnpm test:e2e` — отдельный stage, не в
gate (тянет браузер).

## Что не делаем

- ❌ `vitest-axe` (заброшен) — свой хелпер поверх `axe-core`
- ❌ Vitest browser mode / `vitest-browser-astro` (несовместим с Astro 7 / Vitest 5)
- ❌ Тесты, импортирующие соседний слайс мимо public API
- ❌ Snapshot-тесты страниц; тесты CSS
