# Фаза 2 — контент-слой: отчёт

Репо `/home/mm/git/stit-core/ssr-frontend-template`, от HEAD `a7d7b2d`; не коммичено (17 изменённых, 16 новых путей).

## 1. Сделано
- **Контент** `src/entities/post/`: `model/schema.ts` (Zod `strictObject`, `import { z } from 'zod'`; бюджеты title 25–65 / description 70–170 внутри схемы; `cover` через `image()` + обязательный `coverAlt`; `draft` default false; `translationKey`; язык — каталог, поля `lang` нет) + тест; `model/collection.ts` (`glob({ base: 'src/entities/post/content' })`, id = `<locale>/<slug>`); `api/queries.ts` (`listPosts/getPost/listByTag/listTags/findTranslation/renderPost`, черновики отфильтрованы всегда) + тест с `vi.mock('astro:content')`; `lib/paginate.ts` (5/стр, страницы вне диапазона не существуют) и `lib/paths.ts` + тесты; `ui/{post-card,post-article,tag-list}.astro` + Container API/axe-тесты; `index.ts` — только реэкспорты; `content/ru/*.md` ×9 (8 опубликованных + 1 `draft: true`), `content/en/*.md` ×3 (twin по `translationKey`), `content/covers/*.png` ×3 (1600×900, sharp, без текста, цвета токенов).
- **Страницы** (prerender, ru + en): `blog/index`, `blog/page/[page]` (2…N; `/blog/page/1` не создаётся), `blog/[slug]`, `blog/tag/[tag]`; общая разметка ru/en — секции `src/pages/_blog/{blog-list-page,post-page,tag-page}.astro`; `alternatePath` в шапку — только при реальном twin (пост/страница списка/тег). `widgets/post-list` (карточки + пагинация `<a href>`). `src/content.config.ts` импортирует коллекцию напрямую.
- **Редиректы**: `content/redirects.yaml` (`/old` → 301 `/blog`; `/blog/staraya-zametka` → 410); `shared/lib/yaml` (строгое подмножество YAML, без зависимости) и `shared/redirects` (Zod + Map: дубли, петли, цепочки, статусы) + тесты; `app/middleware/redirects.ts` (YAML вшит через `?raw`, таблица при загрузке бандла; 301/308 `Location`, 410 — минимальный HTML + `X-Robots-Tag: noindex`); `pages/404.astro` → `prerender = false` (иначе адаптер отдаёт `404.html` с диска до middleware — проверено по исходникам Astro).
- **Гейты**: `scripts/check-content.mjs` (схема каждого `.md`, путь `<locale>/<slug>`, тело: h1/скачки/alt/`<img>`/`<script>`/meta refresh, ссылки по списку маршрутов src/pages + контент + public, черновик-ссылки, `translationKey` уникален, `redirects.yaml`: from ≠ маршрут, to существует), `scripts/check-links.mjs` (все `href/src/srcset` в `dist/client` существуют; хвостовой слеш, `.html`, ссылки на адреса из redirects — ошибка), `scripts/lib/routes.mjs`; `package.json` — `check:content`, `check:links`, `check` = … check:gate → check:content → build → check:links → size; `.size-limit.cjs` — «HTML поста» (самый тяжёлый, 25 KB).
- **Прочее**: `shared/i18n` (+ строки блога, `formatDate/isoDate`), `site-header` — ссылка «Блог», `document.astro` prop `alternatePath?: string | undefined`, `index.css` — `.prose` на токенах + `--font-mono`, `astro.config.ts` — `markdown.syntaxHighlight: false`, `env.d.ts` — `*.yaml?raw`; e2e `e2e/content.spec.ts` (12 тестов); правило `.claude/rules/content-invariants.md`; правки `fsd-architecture.md`, `tests-pipeline.md`, `CLAUDE.md`, `README.md`, `docs/reference/deployment.md`.

## 2. Зависимости
Новых нет. Опции: `markdown.syntaxHighlight: false` — Shiki инлайнит сырые цвета мимо токен-слоя и не знает про light/dark; подсветка контент-сайту не обязательна (включение — `shikiConfig` `css-variables`). `?raw`-импорт YAML — файл в контейнере не нужен, старт fail-fast. Скрипты `.mjs` импортируют «листовые» `.ts` (Node 24 strip-types, без флагов и предупреждений).

## 3. Проверено
- `pnpm check` → exit 0: astro check 0 errors (81 файл); biome+eslint чисто; format чисто; vitest 16 файлов / 84 теста; steiger «No problems»; check:gate все 10 ожидаемых нарушений пойманы; `check:content: 12 записей (ru 9, en 3; черновиков 1), 2 редиректов, 5 внутренних ссылок — ok`; build 27 HTML; `check:links: 27 страниц, 342 внутренних ссылок — ok`; size: CSS 3.13 kB, главная 1.55/1.28 kB, пост 2.25 kB gzip.
- `pnpm test:e2e` → 26 passed (4.5s): /blog 200 (один h1, без черновика, `/blog/page/2`, без `/page/1`), /blog/page/{1,3} 404, пост h1=title + twin-ссылка, непереведённое под /en 404, /blog/net-takogo 404, черновик 404, тег 200, /en/blog 200, /old → 301 /blog одним хопом, 410 + noindex + rid, 0 script-ресурсов на /blog, посте, /en/blog, axe /blog, пост, тег.
- `pnpm kin:diff` → «корзина идентично совпадает» (13 ✓). Негативные фикстуры check:content: 14 нарушений пойманы с `file:line`; сообщения redirects точные («у 410 цели нет», «цепочка /a → /b → …»). `astro dev` (демон, порт 4331): все маршруты/статусы как в проде, остановлен `astro dev stop`, фоновых процессов нет. Docker-контекст (`COPY . /ctx` в alpine): 12 `.md` и `content/redirects.yaml` на месте — `*.md` в `.dockerignore` действует только на корень.

## 4. Отклонения от спецификации
- `lang` не поле, а каталог (`ru/`, `en/`): один источник, расхождения невозможны; в `queries.toPost` — invariant на форму id.
- Бюджеты title/description — в Zod-схеме (сборка тоже их держит), `check:content` их не дублирует.
- `404.astro` — on-demand: без этого путь без файла не доходит до middleware (Astro `resolveRouteData` подставляет custom404 только если он не prerendered). Побочно 404/410 получают rid, лог (warn) и `X-Robots-Tag` при noindex.
- `paginate` из `getStaticPaths` не используется (страница 1 = `/blog`); свой `lib/paginate.ts`. Секции страниц в `src/pages/_blog/` вместо дублирования разметки в ru/en.
- Добавлены `PostArticle`/`TagList` (entity ui), ссылка «Блог» в шапке, `.prose` в токен-слое; обложки в UI не рендерятся (картинки — фаза 5), схема и файлы готовы.
- Dev-исключения для черновиков нет: одно поведение во всех режимах; просмотр — снять флаг локально.
- size-limit суммирует glob — строка поста указывает на самый тяжёлый `blog/*/index.html`.

## 5. Осталось / риски
- e2e и check-content знают reference-slug'и/маршруты блога (константы в `content.spec.ts`, реестр `collections` в `check-content.mjs`) — `/de-template`/`/scaffold` обновляют их.
- Скрипты импортируют только листовые TS-модули (без `@/`, без относительных импортов) — зафиксировано в правиле; нарушение видно сразу (падает `check:content`).
- Сканеры на несуществующие URL дают `warn`-строки лога (по дизайну фазы 1); при шуме — `LOG_LEVEL=error`.
- Приёмка главной сессии: docker build/run (не гонялся), визуальная проверка (скриншоты в scratchpad: `blog-{light,dark}.png`, `post-light.png`, `post-mobile-dark.png`, `tag-light.png`).

## 6. Данные для фазы 3
| путь | файл | режим | локали |
|---|---|---|---|
| `/`, `/en` | `pages/index.astro`, `pages/en/index.astro` | prerender | ru, en |
| `/blog`, `/en/blog` | `pages/{,en/}blog/index.astro` → `_blog/blog-list-page.astro` | prerender | ru, en |
| `/blog/page/N` (N ≥ 2) | `pages/{,en/}blog/page/[page].astro` | prerender (`getStaticPaths`) | ru (N=2), en (нет) |
| `/blog/<slug>` | `pages/{,en/}blog/[slug].astro` → `_blog/post-page.astro` | prerender | ru 8, en 3 |
| `/blog/tag/<tag>` | `pages/{,en/}blog/tag/[tag].astro` → `_blog/tag-page.astro` | prerender | ru 7, en 4 |
| `/404` (любой путь без файла) | `pages/404.astro` | **on-demand** | — |
| `/healthz` | `pages/healthz.ts` | on-demand | — |
Редиректы: `/old` → 301 `/blog`; `/blog/staraya-zametka` → 410. Переиспользовать: `@/entities/post` (`listPosts`, `findTranslation` для hreflang, `blogRoute/postRoute/tagRoute`, `PostData.updatedDate` — lastmod, `renderPost`), `@/shared/i18n` (`localePath`, `formatDate`, `isoDate`), `@/shared/redirects` (исключить `from` из sitemap), `scripts/lib/routes.mjs` (`pageRoutes()` с флагом prerender — основа `seo:check` и таблицы `rendering.md`).
