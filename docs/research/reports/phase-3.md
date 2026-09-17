# Фаза 3 — рендер: отчёт

## 1. Сделано
- **создано**: `src/pages/now.astro` (dynamic: `prerender=false`, `private, no-store`, `noindex`, ISO + `formatDateTime`, 0 JS, ru); `src/app/middleware/index.server.test.ts` (11 тестов, mock `getRuntimeConfig`); `src/widgets/site-footer/ui/site-footer.astro.test.ts`; `scripts/ttfb.mjs` (+ `pnpm ttfb`); `e2e/rendering.spec.ts` (8 тестов); `docs/reference/rendering.md`; `.claude/rules/render-safety.md`
- **изменено**: `src/app/middleware/index.ts` (`Cache-Control: no-cache` на on-demand HTML без заголовка роута); `src/shared/i18n/{format,index}.ts` (`formatDateTime`, UTC) + `format.test.ts`; `dict.ts` (`footer.now`); `site-footer.astro` (ссылка `/now`, `hreflang` вне дефолтной локали); `scripts/lib/routes.mjs` (`mode: static|dynamic`, `dynamic`→`parametrized`) + `check-content.mjs`, `check-links.mjs`; `e2e/smoke.spec.ts` (проверка плейсхолдера переехала в rendering.spec); `src/shared/config/runtime.server.test.ts` (список файлов с литералом); `package.json` (`ttfb`); `CLAUDE.md`, `README.md`, `docs/README.md`, `docs/reference/deployment.md`, `.claude/rules/tests-pipeline.md`
- не тронуто: `astro.config.ts` (без `cache`/`routeRules`), `docker/*`, `docs/research/**`, `roadmap.md`, `docs/stack`, скиллы

## 2. Зависимости
Нет. Опции: `pnpm ttfb` — одна реализация замера (node:http, медиана 20) для ручного прогона и e2e.

## 3. Проверено
- `pnpm check` — exit 0: typecheck 0 errors (1 hint `toThrowError` в identical-файле); lint clean; `vitest` 18 files / 94 tests; steiger ok; check:gate — все нарушения пойманы; check:content 12 записей ok; build 27 страниц; check:links 27 страниц / 369 ссылок ok; size: CSS 3.2 kB, HTML главной 1.58 / en 1.31 / пост 2.29 kB gzip
- `pnpm test:e2e` — **36 passed (5.1s)** (smoke 12, content 16, rendering 8)
- `pnpm kin:diff` — корзина «идентично» совпадает (exit 0)
- TTFB (`pnpm ttfb` на `pnpm start` после штамповки, два прогона, медиана/p90 мс): `/` 0.55/0.94 и 0.44/0.65; пост 0.52/0.65 и 0.49/0.61; `/en` 0.46/0.89; `/now` 1.28/1.75; `/healthz` 0.81/0.89; `/xx` 1.11/1.97. В e2e — мягкий порог ≤ 25 мс (аннотация `ttfb` в отчёте Playwright)
- staging (`ROBOTS_POLICY=noindex`, `pnpm start`): `/now` 200 `private, no-store` + `x-robots-tag: noindex, nofollow`; `/healthz` `no-store` + тег; `/xx` 404 `no-cache` + тег; 410 `no-cache` + тег; `/` (prerendered) — `Cache-Control: public, max-age=0` + ETag, без тега и rid (адаптер, до middleware). Docker не гонял — приёмка главной сессии
- фоновых процессов нет (порты 3000/3201/3299/4321 свободны)

## 4. Отклонения от спецификации
- `pageRoutes()`: поле `dynamic` («маршрут с `[param]`») переименовано в `parametrized` — конфликт имён с режимом `dynamic`
- Проверка «нет плейсхолдера» на `/` убрана из `smoke.spec.ts` — её покрывает обход всех страниц в `rendering.spec.ts`; тест согласованности литерала указывает на новый файл
- TTFB в e2e — через `spawnSync scripts/ttfb.mjs --json` (одна реализация замера, без второй копии в TS)
- `/now` не показывает `RELEASE` — версия наружу не раскрывается (как у `/healthz`); человекочитаемое время — новая `formatDateTime` (`timeStyle: 'long'`, UTC)
- `rendering.md`/правило — forward-only: без имён фаз; будущие on-demand роуты (`robots/sitemap/rss`, `api/*`) описаны как правило, не как план
- On-demand HTML Astro отдаёт с `content-type: text/html` без charset (404, `/now`) — не менял (в документе `<meta charset>`)

## 5. Осталось / риски
- Таблица маршрутов в `rendering.md` ведётся вручную; `pageRoutes()` даёт режим — при желании гейт «таблица ↔ код» (не делал: без замудрённостей)
- `no-cache` на on-demand без ETag = полный ответ на каждый запрос (для 404/410 нормально); prerendered — 304 по ETag адаптера
- `X-Robots-Tag` на prerendered и `/index.html`-дубли — только Traefik (infra, фаза 7); `Astro.request.headers` в prerender даёт warn, не ошибку — держится правилом и ревью
- Порог TTFB 25 мс — может флейкнуть на очень медленном CI (поднять или `test.skip` по `CI`)

## 6. Данные для фазы 4
| путь | файл | режим | Cache-Control | индексируется | в sitemap |
|---|---|---|---|---|---|
| `/`, `/en` | `index.astro`, `en/index.astro` | static | `public, max-age=0` + ETag | да | да |
| `/blog`, `/en/blog` | `blog/index.astro`, `en/blog/index.astro` | static | то же | да | да |
| `/blog/page/N` (+en) | `blog/page/[page].astro` | static | то же | да | да |
| `/blog/<slug>` (+en) | `blog/[slug].astro` | static | то же | да | да (без черновиков) |
| `/blog/tag/<tag>` (+en) | `blog/tag/[tag].astro` | static | то же | да | да |
| `/now` | `now.astro` | dynamic | `private, no-store` | нет (`noindex`) | нет |
| `/healthz` | `healthz.ts` | dynamic | `no-store` | нет | нет |
| 404 / 410 / 301 | `404.astro`, `app/middleware/redirects.ts` | dynamic | `no-cache` / — | нет | нет |
- origin для canonical/hreflang: prerendered `<head>` — build-time `SITE_ORIGIN_PLACEHOLDER` (`shared/config`), штампуется entrypoint'ом; on-demand — `getRuntimeConfig().SITE_URL`; `Astro.site`/`astro:i18n` не использовать (e2e ловит плейсхолдер и в on-demand)
- локали: `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `localePath` (`shared/i18n`); twin для hreflang: `findTranslation(post, locale)` + `postRoute(twin.slug)` (`entities/post`); списки/теги: `alternatePath` уже считается в `pages/_blog/*` и `index.astro` (проп `DocumentLayout`) — hreflang выводить только при `alternatePath`
- on-demand и `noindex`: `/now` (meta + `private, no-store`), `404` (meta), `410` (meta + `X-Robots-Tag`), `/healthz` (не HTML, вне sitemap); будущие `robots.txt`/`sitemap.xml`/`rss.xml`/`api/*` — `prerender=false` + строка в `rendering.md`, вне sitemap
