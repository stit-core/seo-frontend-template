---
description: Тестовая дисциплина — два проекта Vitest, Container API для .astro, axe-хелпер, Playwright на prod-сборке (HTTP-набор в gate, браузерный — в /release), покрытие с порогами-храповиком, состав gate.
paths: ["src/**/*.test.ts", "e2e/**", "vitest.config.ts", "src/shared/lib/testing/**", ".gate-fixtures/**", "scripts/*.mjs"]
---

# Тесты

## Расположение и проекты Vitest

- **Unit** — рядом с модулем (`shared/i18n/locale.test.ts`): проект `dom` (happy-dom)
- **Компонентные `.astro`** — `<name>.astro.test.ts` рядом с компонентом: проект `astro`
  (node-окружение, Container API `experimental_AstroContainer`); проверка HTML-строки +
  `expectNoA11yViolations` из `@/shared/lib/testing` (axe-core; правило `region` для
  фрагмента выключено; в happy-dom нет CSS — контраст видит только браузерный набор
  `e2e/browser/a11y.spec.ts`). Пропсы-сущности — плоские фикстуры (`Post` не тянет `astro:content`)
- **Запросы к контенту** (`entities/*/api/queries.test.ts`) — `astro:content` подменяется
  `vi.mock` с фикстурами через `vi.hoisted`, модуль импортируется после мока: проверяются
  фильтр черновиков и локали, сортировка, twin по `translationKey` — в обоих режимах
  (`vi.stubEnv('DEV', false | true)`: Vitest сам работает в dev-режиме Vite)
- **Серверные и процессные** — `<name>.server.test.ts`: проект `astro` (node-окружение, родные
  `Request`/`Response`): `app/middleware` с подменённым `getRuntimeConfig` (`vi.mock`
  `@/shared/config`) и `next`-заглушками; `docker/*` гоняется через `spawnSync` с таймаутом —
  зависший процесс роняет тест, а не подвешивает гейт (fail-fast `server.mjs`, отказ, штамповка
  и `exec` `entrypoint.sh` на временном `dist`)
- **Маршруты и страницы** — `src/pages/_tests/` (каталог с `_` Astro не маршрутизирует):
  эндпоинты вызываются напрямую (`endpoints.server.test.ts`), страницы рендерит Container API
  целиком (`partial: false`), а где важны статус и заголовки — `renderToResponse`; контент —
  общие фикстуры `fixtures.ts` через `vi.mock('astro:content')`, режим сборки —
  `vi.stubEnv('DEV', false)`. Логика секции — в `.ts`-модели рядом с ней
  (`_blog/sections.ts`), её unit-тест — там же
- **E2E** — Playwright на **prod-сборке** (`e2e/playwright.config.ts`). Сервер — как контейнер
  (`e2e/serve.mjs`): копия `dist/` в раскладке образа, штамповка `docker/entrypoint.sh`,
  `docker/server.mjs`, живость — по `/healthz` (не `/`). Порты — свободные, свои у каждого
  прогона: чужой сервер не переиспользуется (`reuseExistingServer: false`), а `dist/` остаётся
  с плейсхолдером. Цели — из сборки и контента, не демо-slug'и (`e2e/site.ts`: prerendered- и
  индексируемые страницы `dist/client`, on-demand маршруты `src/pages`, записи коллекций по
  реестру гейтов, правила `redirects.yaml`). Заявки уходят в локальный приёмник
  `e2e/form-stub.mjs` — наружу тесты не ходят. Два набора:
  - **HTTP** (`e2e/http/`, `pnpm test:http`, шаг `pnpm check` после build) — только `request`,
    браузер не нужен: профили прод (`ROBOTS_POLICY=index`, демо-`INDEXNOW_KEY`) и staging
    (`ROBOTS_POLICY=noindex`, проект `staging`)
  - **браузерный** (`e2e/browser/`, `pnpm test:e2e`, обязательный шаг `/release`) — axe, тема,
    форма без JavaScript в настоящем браузере

## Что покрываем

| что | чем |
|---|---|
| `shared/config` | дефолты, пустые значения, валидация, whitelist; `server.mjs`/`entrypoint.sh` — отказ без `SITE_URL`, с плейсхолдером и без схемы, штамповка `dist/client` (несколько вхождений в строке), остаточная проверка, идемпотентность, `exec` (PID команды — PID entrypoint) и код выхода команды; согласованность литерала плейсхолдера |
| `shared/i18n`, `shared/lib` | pure-тесты |
| `entities/*/ui/*.astro`, `widgets/*/ui/*.astro` | Container API + axe |
| `entities/*/model/schema.ts` | valid/invalid frontmatter, дефолт `draft`, бюджеты — граничными литералами, а не константами модуля, заглушка `image()` |
| `shared/redirects`, `app/middleware/redirects` | pure-тесты: дубли/цепочки/статусы, пустая таблица, query в `Location`, 410; точное совпадение `from` на реальном `content/redirects.yaml` |
| `app/middleware` | prerendered проходит как есть; `X-Request-Id` принят/сгенерирован; `Cache-Control: no-cache` на on-demand HTML и не перебивает заголовок роута; `X-Robots-Tag` только при `noindex`; редирект/410 до `next`; ошибка → лог 500 с тем же `rid` + rethrow; уровни лога и порог `LOG_LEVEL`, без query/cookie |
| `shared/observability` | `captureServerError` с подменённым `@sentry/node` — каждый кейс своим путём (`vi.resetModules()` + динамический импорт: клиент мемоизирован промисом модуля): без `SENTRY_DSN` клиент не грузится, с ним — один `init` на процесс и `captureException` с тегами `rid` и `path`, сбой клиента не роняет ответ; порог `LOG_LEVEL` проверяют оба потребителя `log()` — middleware и `contact-form` |
| `shared/seo` | pure-тесты: `normalizePath`/`absoluteUrl` (runtime origin, плейсхолдер без env), `alternates` (взаимный набор, x-default, пусто без перевода), `buildRobotsTxt` (прод/staging/AI-блок), `buildSitemap` (lastmod, экранирование, лимит), `buildFeed` (self-ссылка, язык, лимит записей), фабрики JSON-LD — полный объект (`toEqual`) и Zod-схема здесь, не на рендере; Container API: `seo-head.astro` (canonical, hreflang, OG, noindex), `json-ld.astro`, `widgets/breadcrumbs` (видимые крошки, без скриптов, axe) |
| служебные маршруты (`src/pages/*.ts`) | `endpoints.server.test.ts`: `robots.txt` в профилях прод, staging и `AI_TRAINING=deny`; `sitemap.xml` — ровно индексируемые страницы фикстур, `lastmod` только у правки; фиды своей локали без черновика; ключ IndexNow и 404 чужого имени; `/healthz`; заголовки каждого |
| страницы (`src/pages/**/*.astro`) | `pages.astro.test.ts`: язык, self-canonical или только `noindex`, hreflang пары, типы JSON-LD, один `h1`; маршруты с параметрами — ровно адреса `getStaticPaths` своей локали без черновиков; `/now` — время запроса и `private, no-store` |
| логика секций блога (`_blog/sections.ts`) | `sections.server.test.ts`: ссылка на перевод у записи, страницы списка и тега, сниппет страниц 2…N, крошки, `BlogPosting` из полей записи и обложка |
| обработчик формы `/api/contact` | `contact.astro.test.ts` (`renderToResponse`): PRG 303 на подтверждение своей локали, GET → 303 на форму, отказы 403/400/413 коротким текстом, ошибка валидации → 200 с полями, сбой доставки → 500; каждый ответ — `private, no-store` и вне индекса |
| head каждой страницы сборки (`dist/client`) | `pnpm seo:check` после build: один `<title>`/`<h1>`, description с `content`, self-canonical, `lang`, OG с существующей картинкой, hreflang у каждой пары переводов (списки/теги под обоими префиксами, записи по `translationKey`; взаимный, + x-default), уникальность title/description, JSON-LD (типы, Organization/WebSite на главной, форма BreadcrumbList), ни одного HTML-комментария в разметке; сборка против источника — страница у каждой опубликованной записи и prerendered-маршрута `src/pages`, hreflang только у страниц сверенных пар; парсер `<head>` общий с e2e и `check:links` — `scripts/lib/html.mjs` |
| контент целиком (`.md`, `redirects.yaml`, ссылки) | `pnpm check:content` до build, `pnpm check:links` после |
| prerendered-страницы как в контейнере: каждая страница сборки — 200 от статик-хендлера (`public, max-age=0` + ETag, без `X-Request-Id` и `X-Robots-Tag`), плейсхолдер проштампован, canonical индексируемой — на runtime origin, в `<body>` нет своего origin, HTML < 300 КБ; исполняемый скрипт — только инлайн-остров темы в `<head>`; ассеты `_astro` — `immutable` | HTTP-набор (`pages.spec.ts`) |
| on-demand: каждый маршрут `prerender = false` отвечает из приложения (`X-Request-Id`, без плейсхолдера и своего origin в теле); адрес вне сборки (неизвестный, черновик, непереведённая запись под чужим префиксом) — 404 служебной страницей с `no-cache`, её ссылки живые; хвостовой слеш — один 301; `/healthz`; `/now` (`private, no-store`, `noindex`, время меняется); редиректы `redirects.yaml` — один хоп, query в `Location`, 410 с `noindex` | HTTP-набор (`service.spec.ts`) |
| `robots.txt` прод-профиля; `sitemap.xml` = индексируемые страницы `dist/client` (все 200, `lastmod` только у записей с `updatedDate`); фиды (self-ссылка, язык, живые абсолютные ссылки своей локали, ≤ 20, без черновиков); `/<ключ>.txt`; запись с переводом — hreflang взаимный, `article:*_time`, `BlogPosting` про эту страницу (headline = h1, `mainEntityOfPage` = canonical, `image` = `og:image`), видимые крошки = `BreadcrumbList` | HTTP-набор (`seo.spec.ts`) |
| обработчик формы на prod-сервере: PRG 303 на подтверждение своей локали и доставка в приёмник, ловушка без доставки, ошибка валидации с полями и `private, no-store`, недоступный канал → 500, чужой и отсутствующий Origin → 403, Origin сайта при чужом `Host` → 303, не-форма и битое тело → 400, большое тело → 413, GET → 303 | HTTP-набор (`forms.spec.ts`) |
| staging (`ROBOTS_POLICY=noindex`): `robots.txt` — `Disallow: /` без карты, каждый ответ приложения — `X-Robots-Tag: noindex, nofollow` | HTTP-набор (`staging.spec.ts`) |
| форма: значения и бюджеты полей, согласие `literal(true)`; обработчик (`.server.test.ts`): ловушка без доставки, чужой и отсутствующий Origin, враждебные Origin и Referer (двойник с доменом сайта в начале, поддомен, порт, схема, userinfo, `null`; Origin важнее Referer), origin сайта при чужом URL запроса («за прокси»), 413 по `Content-Length` на границе 64 КБ и 400 на не-форму, три попытки, отказ капчи, ненастроенный канал, порог `LOG_LEVEL`, ни на одном исходе тела заявки в логе (`afterEach`); прод-расписание повторов на fake timers; канал smtp (`delivery.server.test.ts`, `nodemailer` подменён): письмо с ответом отправителю и доказательством согласия, три попытки с закрытием транспорта, ненастроенный канал; разметка формы (пустая и с ошибками) + axe | unit + Container API `features/contact-form` |
| остров темы: ровно один инлайн-скрипт без `src`, без комментариев и прагм, и его размер в байтах (единственная мера бюджета острова); поведение — скрипт исполняется в happy-dom: выбор из cookie до отрисовки, переключатель выбирает тему, противоположную видимой, cookie на весь сайт (`path=/`) на год; кнопка с подписью и без скриптов + axe; счётчик: без идентификатора разметка пуста, с ним — один инлайн-скрипт после idle и `init` без `defer` (иначе просмотры не считаются) | Container API `features/theme`, `app/analytics` |
| axe (WCAG 2.2 AA + best-practice) на каждой странице сборки, 404, `/now` и ответе формы с ошибками — в обеих темах; выбор темы ставит `data-scheme` и cookie на весь сайт; без JS переключателя нет; форма в браузере без JavaScript — PRG на подтверждение и доставка, без согласия не отправляется | браузерный набор (`a11y.spec.ts`, `forms.spec.ts`) |
| гейт на гейт: нарушения границ FSD и пустой a11y-конфиг (линтеры на `.gate-fixtures/src`), регресс своих скриптов гейта (`seo:check`, `check:links`, `check:content` на мини-проектах `.gate-fixtures/{seo,links,content}`); найденное = `expected.json` до строки, пустая или урезанная секция — красный | `pnpm check:gate` |

## Покрытие

- Считает сам `pnpm test` (`vitest run --coverage`): объём — `src/**/*.{ts,astro}` вместе с
  `app/` и `pages/`; в выводе — файлы с дырами и сводка, факт ниже порога роняет шаг `test`
- Исключения — только связки без своей логики (баррели, входы Astro, `model/collection.ts`,
  тест-хелперы и фикстуры), каждое — строкой с причиной в `vitest.config.ts`. Код, который
  трудно покрыть, — повод для теста или для `.ts`-модели рядом с секцией, а не для исключения
- Пороги — храповик по statements, branches, functions и lines: факт, округлённый вниз, но не
  выше 99 % (метрика на 100 % без запаса роняет гейт от первой сгенерированной функции).
  Выросло покрытие — пороги растут тем же коммитом; опускаются только вместе с удалением
  покрытого кода или сменой инструмента — с причиной в коммите и не ниже пола 90 %. Цель — 95 %
- Обновление Vitest, Astro или Node сдвигает подсчёт: пороги пересчитываются к факту тем же
  коммитом, что и обновление
- Точечный прогон — `pnpm vitest run <путь>`: пороги считаются только по полному `pnpm test`
  (`pnpm test <путь>` краснеет на подмножестве)
- Новая страница, маршрут, секция или модуль приходят со своим тестом (`/scaffold`), а не с
  исключением
- Покрытие говорит, что код исполнялся, а не что он проверен: тест пишется по смыслу — исход и
  контракт (статус, заголовок, разметка, строка лога), а не строки реализации; граница бюджета —
  литералом, а не константой модуля под тестом

## Gate

`pnpm check` = plan:check → typecheck → lint → format:check → test (с покрытием и порогами
`vitest.config.ts`) → steiger → check:gate → check:content → build → check:links → seo:check →
size → test:http (HTTP-набор на prod-сервере из этой сборки). `pnpm test:e2e` — браузерный
набор: обязательный шаг `/release`, в gate не входит (тянет браузер).

## Что не делаем

- ❌ `vitest-axe` (заброшен) — свой хелпер поверх `axe-core`
- ❌ Vitest browser mode / `vitest-browser-astro` (несовместим с Astro 7 / Vitest 5)
- ❌ Тесты, импортирующие соседний слайс мимо public API
- ❌ Snapshot-тесты страниц; тесты CSS
