---
status: in-progress
parent: —
blocked-by: —
---

# runtime-deps — в образе только то, что импортирует сервер

## Цель
В `dependencies` лежат `astro`, `@astrojs/node` и `sharp`, хотя серверный бандл их не импортирует:
стадия prod-deps ставит их в образ, а за ними — сборочную машинерию, которую Dockerfile потом вычищает руками. После
плана в `dependencies` — ровно то, что импортирует рантайм (`dist/server`, `docker/*.mjs`), и это держит гейт.

## Контекст
- Хвост P4 программы `audit-program` (S13 фазы `adopt-design-system`): скан `dist/server` — голые импорты `zod` и
  `@astrojs/rss` (побочный, чанк `seo`), динамически `nodemailer` и `@sentry/node`; `docker/server.mjs` и `docker/stamp.mjs` берут только `dist/server/*` и
  `node:*`. Комментарий стадии prod-deps в `docker/Dockerfile` («entry.mjs импортит astro/zod, сервис картинок —
  sharp») — неправда.
- Решения владельца: R16 (пакет правок `docker/*` разрешён), R24 (стек и политика обновлений); мандат «решения —
  агентам». Прямой признак «серверный бандл без `sharp`» в `seo:check` (P4, R1) остаётся.
- Проверки образа: `pnpm accept:image`; HTTP-набор поднимает копию сборки с `node_modules` репо и недостающую
  зависимость не ловит (Решения).

## Критерии приёмки
- [x] **AC1** — `dependencies` = импорты рантайма: голые импорты `dist/server` и `docker/*.mjs` (статические и
  динамические) — подмножество `dependencies`, и каждая зависимость импортируется; нарушение в любую сторону —
  красный `pnpm check`. Проверка: `pnpm check:gate` (фикстура `.gate-fixtures`); мутации «`zod` в
  `devDependencies`», «лишняя зависимость», «динамический импорт пакета вне `dependencies`» → красный
  - Подтверждено: `zod` в `devDependencies` — `seo:check`, импорт `zod` в 5 модулях; `astro` в `dependencies` —
    `seo:check`, рантайм его не импортирует; `import('js-yaml')` в on-demand маршруте — `seo:check` (шаги до него
    зелёные), в `docker/server.mjs` — `test` и `seo:check`; `check:gate` зелёный и ловит 6 мутаций самой проверки
    (`require`, обёртка, лишняя зависимость, `import()`, scope, текст за импорт) — `M/deps/`
- [x] **AC2** — Образ без сборочной машинерии: стадия prod-deps ставит только `dependencies`, ручная чистка снята,
  комментарии — правда; размер образа и его `node_modules` — до и после. Проверка: сборка образа,
  `pnpm accept:image` → зелёный; в `node_modules` образа нет `astro`, `vite`, `esbuild`, `rollup`, `sharp`, `@img/*`
  - Подтверждено: образ кода `main` — 359,1 МБ, его `node_modules` — 189,7 МБ (16 002 файла, 244 пакета); после
    S2 — 229,2 МБ и 59,7 МБ (7 901 файл, 33 пакета: `zod`, `@astrojs/rss`, `nodemailer`, `@sentry/node` с деревом);
    `astro`, `vite`, `esbuild`, `rollup`, `rolldown`, `sharp`, `@img/*` в образе нет; `pnpm accept:image` — зелёный,
    24 проверки; импорты рантайма грузятся в образе из `dist/server/chunks`, `astro`, `sharp` и `vite` — нет
    (`ERR_MODULE_NOT_FOUND`) — `M/deps/`
- [x] **AC3** — Проза — правда: `docs/reference/deployment.md`, `docs/stack/_templates/dependencies.md`, шаг аудита
  прод-зависимостей `/release` и правила, которые называют состав образа. Проверка: чтение; `pnpm check` → зелёный
  - Подтверждено: прочитаны стадии образа в `deployment.md`, состав, аудит и «Generates» в `dependencies.md`, шаг 2 и
    «Что НЕ делать» `/release`, `SECURITY.md`, сервер HTTP-набора и `seo:check` в `tests-pipeline`, чек-лист
    `/stack-deep-dive`, рецепт D в `rendering.md` — состав образа и аудит названы по факту; `pnpm check` — зелёный

## Шаги
- [x] **S1** — Проверка гейта «зависимости = импорты рантайма» с фикстурой и перенос трёх пакетов в
  `devDependencies` — одним коммитом (по отдельности гейт красный); место проверки — одно, рядом с признаком R1
  - Проверка: `pnpm check:gate`; три мутации AC1 → красный; `pnpm check` → зелёный · Закрывает: AC1 · Зависит от: —
  - Сделано: `seo:check` разбирает импорты `dist/server` и `docker/*.mjs` синтаксисом и сверяет их с `dependencies` в
    обе стороны, признак R1 — на том же разборе; фикстура `.gate-fixtures/seo` (`package.json`, `forma_Fx2.mjs`,
    `docker/server.mjs`, законные формы в `entry.mjs`) — 6 новых строк `expected.json`; `astro`, `@astrojs/node`,
    `sharp` — в `devDependencies`; аудит `/release` — по всему lockfile. `check:gate` зелёный, мутации AC1 —
    красный `pnpm check`, `pnpm check` — зелёный
- [x] **S2** — Dockerfile: prod-deps без ручной чистки, комментарии по факту; замер образа до и после
  - Проверка: сборка образа, `pnpm accept:image` → зелёный; список `node_modules` образа · Закрывает: AC2
    · Зависит от: S1
  - Сделано: стадия prod-deps — один `pnpm install --prod`, ручная чистка (`rm -rf` девяти путей) снята, комментарий —
    по факту; описание стадии в `deployment.md` и строка «Generates» (`dependencies.md`, чек-лист `/stack-deep-dive`)
    — тоже. Образ 359,1 → 229,2 МБ, его `node_modules` 189,7 → 59,7 МБ; `accept:image` — зелёный, `pnpm check` —
    зелёный
- [x] **S3** — Проза и гейт: документы AC3; `pnpm check` на чистом дереве
  - Проверка: `pnpm check` → зелёный · Закрывает: AC3 · Зависит от: S2
  - Сделано: проза AC3 сверена целиком — состав, аудит и гейт правдивы с S1 и S2; снят пункт бэклога `runtime-sharp`
    (его закрыл этот план), рецепт D называет `sharp` в `dependencies` при открытом `/_image`, снята исполненная
    строка Handoff P4. `pnpm check` — зелёный

## Решения
- Состав — по скану, а не по плану: `@astrojs/rss` остаётся в `dependencies` — серверный бандл импортирует его
  (`import "@astrojs/rss"` в чанке `seo`: баррель `shared/seo` тянет `buildFeed`). В `devDependencies` — три пакета;
  перенос бандл не меняет: набор импортов до и после один.
- HTTP-набор берёт `node_modules` репо (`e2e/serve.mjs` — симлинк, все зависимости): с `zod` в `devDependencies` он
  зелёный, 71 из 71. Недостающую зависимость держит статическая проверка `seo:check`, набор не меняется: она видит и
  ветки, которых набор не исполняет (Sentry по DSN, канал SMTP).
- Импорт — разбором синтаксиса (парсер `typescript`, он уже в `devDependencies`), а не регуляркой: в бандле есть данные
  `"from": "…"`, JSDoc `import('./types.js')` и `__require` от `createRequire`. Признак R1 — на том же разборе: способ
  один. В фикстуре `sharp` — в `dependencies` мини-проекта: R1 краснеет и тогда, когда импорт «чинят» переносом пакета.
- Аудит `/release` и цикла обновлений — `pnpm audit --audit-level=high` по всему lockfile, а не `--prod`: после
  переноса `--prod` не видит код `astro` и `@astrojs/node`, который сборка встраивает в `dist/server` (с ним `devalue`,
  `cookie`, `mime-types` — `devalue` через `astro` и был примером STK-03). Три находки линтера `eslint-plugin-boundaries`
  (handlebars — две critical, braces — high) — `auditConfig.ignoreGhsas` с причиной: вход — `eslint.config.js`
  проекта, в образ линтер не едет; без них шаг `/release` красный.
- Проза правится коммитом, который делает её неправдой: S1 — описание гейта, состав `dependencies`, область аудита.
  Стадия prod-deps — комментарии `docker/Dockerfile`, её строка в `deployment.md`, «Generates» — меняется в S2 вместе
  со стадией: после S1 её ручная чистка мёртвая (`--prod` сборочную машинерию больше не ставит). S3 — сверка прозы AC3
  целиком.
- Пункт бэклога `runtime-sharp` закрыт этим планом и снят; его оговорка — рецепту D с открытым `/_image` `sharp` нужен
  в рантайме — теперь в самом рецепте (`rendering.md`): пакет — в `dependencies`, признак R1 снимается. Строку Handoff
  P4 «Владелец: `astro`, `@astrojs/node`, `sharp` — в `dependencies`…» исполнил этот план — она снята.

## Где мы сейчас
S1–S3 сделаны, AC1–AC3 подтверждены: гейт держит состав `dependencies`, образ ставит только их — 229,2 МБ против
359,1 МБ, без сборочной машинерии и ручной чистки; аудит — по всему lockfile; проза — по факту. Следующий шаг —
независимый валидатор (образ и `accept:image`, мутации AC1, `check:gate`, гейт в свежем worktree), затем push в `main`
и закрытие плана — файл удаляется. Материалы — `M/deps/`: скан импортов, логи мутаций, размеры и списки пакетов
образов, приёмка.
