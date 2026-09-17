# Бриф для research-агентов: SSR-шаблон на базе spa-frontend-template

Дата: 2026-09-15. Язык отчётов — русский (технические идентификаторы, имена пакетов,
команды — как есть, на английском).

## Зачем

Экосистема stit (org `stit-core`, Gitea `git.stit.tech`) — набор форкаемых шаблонов.
Сейчас есть `spa-frontend-template` (React SPA, статика за nginx). Нужен второй
фронт-шаблон — **`ssr-frontend-template`** (имя уже стоит в публичном roadmap
`stit-public/docs/roadmap.md` как «в планах»): серверный рендер, чтобы строить
**индексируемые сайты** (Google + Яндекс — заказчики русскоязычные), с прописанным
каноном SEO, и чтобы шаблон был максимально **родственным SPA-шаблону** (тот же стек,
FSD, скиллы, доки, гейт `pnpm check`, деплой образом в registry).

Задача этой сессии — **ресёрч**, не код. Результат — сводный отчёт с решениями,
рисками и планом. Оркестратор (главная сессия) собирает отчёт из потоков.

## Жёсткие ограничения

- **Ничего не менять** ни в одном репозитории под `/home/mm/git/stit-core/`. Только читать.
  Всё временное — только под scratchpad `/tmp/claude-1000/-home-mm-git-stit-core-spa-frontend-template/677b94a8-1830-49f5-865e-2d410f480b0e/scratchpad/`.
- Внешняя дизайн-система `@stit/ui` (`stit-core/ui-lib`) **не используется и не будет**
  (явное указание владельца). Компоненты пишутся в проекте на собственном токен-слое
  (`src/app/styles/index.css`, Tailwind v4 `@theme` + семантические CSS-переменные,
  тема через `data-scheme` на `<html>`). Упоминания `@stit/ui` в чужих ecosystem-доках —
  устаревший drift, не опираться.
- Knowledge cutoff моделей — июнь 2026, сегодня сентябрь 2026. Версии пакетов,
  статусы фреймворков, API — **проверять через web** (npm, GitHub releases, официальные
  доки) и цитировать URL. Явно помечать: «проверено (источник, дата)» vs «предположение».
- Не выдумывать API фреймворков. Если не удалось проверить — так и писать.

## Что такое spa-frontend-template (факты, проверены чтением репо)

Путь: `/home/mm/git/stit-core/spa-frontend-template`. Ветка `main`, чисто.

### Стек (установленные версии из node_modules)

| зона | пакет | версия |
|---|---|---|
| bundler | vite | 8.2.1 (Rolldown) |
| React | react / react-dom | 19.2.8; `babel-plugin-react-compiler` 1.0.0 (`compilationMode: 'infer'`) |
| router | @tanstack/react-router | 1.170.24, file-based через `@tanstack/router-plugin` 1.168.28 (`routesDirectory: src/pages`, `generatedRouteTree: src/app/router/routeTree.gen.ts`, `routeFileIgnorePrefix: '-'`); `@tanstack/router-cli` для `pnpm gen` |
| data | @tanstack/react-query 5.101.4 | `queryClient` — модульный синглтон в `src/app/providers/query.tsx`, передаётся в router `context: { queryClient }` |
| forms | @tanstack/react-form 1.33.4 | валидация Zod-схемой (`validators: { onChange: Schema }`) |
| state | zustand 5.0.14 | `features/theme/model/store.ts` — `persist` в localStorage (`app.theme.v1`), поля `scheme` (light/dark) + `locale` (ru/en) |
| validation | zod 4.4.3 | рукописные контракты API в `entities/<name>/model/schema.ts`, парс ответа прямо в `queryFn`/`mutationFn` |
| i18n | @lingui/core + @lingui/react 5.9.5 | runtime-only (без macro/CLI): глобальный `i18n` из `@lingui/core`, каталоги — рукописные TS-объекты `shared/i18n/locales/{ru,en}.ts`, ленивый `import()`; `initI18n()` в bootstrap; смена локали — `activateLocale` из `useThemeEffect` |
| styling | tailwindcss 4.3.3 (`@tailwindcss/vite`) | свой токен-слой в `src/app/styles/index.css` |
| mock | msw 2.15.0 (`msw/browser` Service Worker), @mswjs/data 0.16, @faker-js/faker 10 | сценарии `empty | populated | authenticated | error`; персист в localStorage `app.mock.db.v1` (дамп каждые 2 с); dev-панель переключателя (`mock/devtools.ts`, ванильный DOM); хендлеры `mock/handlers/{auth,users,todos,error}.ts` — функции `xHandlers(db)`; `buildHandlers(db, errorMode)`; в тестах — `setupServer(...buildHandlers(db,false))` из `msw/node` |
| observability | @sentry/react 8.55.2, web-vitals 4.2.4 | Sentry — `dynamic import` только при непустом `SENTRY_DSN`; web-vitals всегда (dev → console.info; prod → noop/Sentry) |
| lint | @biomejs/biome 2.5.7 (formatter + базовые правила), eslint 9.39.5 flat (react, react-hooks@7 c compiler-правилами, jsx-a11y, testing-library, `eslint-plugin-boundaries` по слоям FSD, `no-restricted-imports` на `@/*/*/*/*`), steiger 0.6.0 + `@feature-sliced/steiger-plugin` 0.7 | |
| tests | vitest 4.1.10 (happy-dom, globals, vitest-axe, coverage v8 порог 60%), @playwright/test 1.62.1 (e2e/, webServer `pnpm dev --port 5173`, env `VITE_API_MODE=mock`, `VITE_MOCK_SCENARIO=authenticated`, `@axe-core/playwright`) | |
| TS | typescript 6.0.3 strict: `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: bundler`, `target ES2024`, alias `@/*` → `src/*` | |
| pkg | pnpm 10.0.0 (corepack), Node 24 (`.nvmrc` 24, engines >=24) | |
| budgets | size-limit (`.size-limit.cjs`): main entry 35 KB, react 65 KB, router 30 KB, query 12 KB, initial total 150 KB (gzip) | Rolldown `codeSplitting.groups` react/router/query |
| git | lefthook: pre-commit biome+eslint --fix, commit-msg commitlint (`feat|fix|refactor|docs|test|chore|meta|perf|style`, subject ≤72), pre-push `pnpm check` | |

`pnpm check` = `typecheck && lint && format:check && test && steiger && build && size`.
Скрипты: `dev` (vite), `build` (`tsc -b && vite build`), `preview`, `test`, `test:e2e`,
`steiger` (`steiger src`), `gen` (`tsr generate`), `gen:msw` (`msw init public/`),
`analyze`, `prepare` (`lefthook install`).

### Структура src (FSD, строго нисходящие импорты app → pages → widgets → features → entities → shared)

```
src/app/            main.tsx (await bootstrap(); createRoot), init.ts (bootstrap: initI18n → initObservability → MSW при API_MODE=mock),
                    root.tsx (AppProviders + RouterProvider), providers/{index,i18n,query}.tsx, router/{index.ts,routeTree.gen.ts}, styles/index.css
src/pages/          __root.tsx (createRootRouteWithContext<{queryClient}>; рендерит <AppShell/> + devtools),
                    index.tsx, login.tsx (beforeLoad: есть сессия → redirect /profile), profile.tsx (beforeLoad guard → /login; loader ensureQueryData(user)),
                    todos.tsx (guard + loader todos; useSuspenseQuery; CRUD с optimistic update)
src/widgets/app-shell/   ui/app-shell.tsx (header с nav, ThemeSwitcher, logout; <Outlet/>), index.ts
src/features/       auth (LoginForm на TanStack Form + useLoginMutation), create-todo, theme (store, useThemeEffect ставит data-scheme + activateLocale, ThemeSwitcher)
src/entities/       session (SessionSchema, sessionQueryOptions GET /v1/session → null при 401, useSession, useLogoutMutation),
                    user (UserSchema, userQueryOptions, UserCard), todo (TodoSchema/NewTodoSchema, queries + 3 мутации, TodoItem + тесты)
src/shared/api/     client.ts (fetch-враппер: `${runtimeConfig.API_BASE_URL}${path}`, credentials 'include', CSRF: cookie `csrf_token` → header `X-CSRF-Token` на мутациях, ApiError(status,url); читает document.cookie), index.ts, mock/**
src/shared/config/  index.ts (Zod RuntimeConfigSchema; источники: `window.__APP_CONFIG__` поверх `import.meta.env.VITE_*`), env.d.ts
src/shared/i18n/    index.ts (SUPPORTED_LOCALES ru|en, DEFAULT ru, activateLocale, initI18n), locales/{ru,en}.ts
src/shared/lib/     cn.ts, invariant.ts (+тесты), index.ts
src/shared/observability/index.ts (initObservability: Sentry cond. + web-vitals)
src/shared/ui/page-header/ (PageHeader)
```

Каждый слайс/сегмент — `index.ts` с explicit re-exports (не `export *`). Запрещены сегменты
`components/ hooks/ utils/ types/`. Steiger-исключения: `routeTree.gen.ts` (public-api off),
`src/pages/index.tsx` (no-layer-public-api off), `src/app/init.ts` (sidestep off — dynamic import
mock мимо index), `src/app/**` (segments-by-purpose off: сегмент `providers`).

### Runtime config («один образ на все среды»)

- `index.html` грузит `/config.js` **до** бандла; `public/config.js` — dev-заглушка `window.__APP_CONFIG__ = {}`.
- В контейнере `docker/nginx-entrypoint.sh` (в `/docker-entrypoint.d/40-runtime-config.sh`) генерирует `config.js` из env:
  `API_BASE_URL` (дефолт `/api`), `API_MODE` (`real`), `SENTRY_DSN` (`""`), `SENTRY_ENVIRONMENT` (`production`), `RELEASE` (`unknown`).
- `shared/config/index.ts`: `API_MODE` дефолт `import.meta.env.DEV ? 'mock' : 'real'`; `MOCK_SCENARIO`, `MOCK_DEVTOOLS` — только build-time `VITE_*`.
- Build-time env (`.env.example`): `VITE_API_MODE`, `VITE_API_TARGET` (dev proxy `/api` → таргет при `real`), `VITE_MOCK_SCENARIO`, `VITE_MOCK_DEVTOOLS`.
- Правило: секреты не в бандле; access-token не в localStorage; cookie-auth httpOnly на стороне бэка; DSN Sentry public by design.

### Docker / деплой SPA

- `docker/Dockerfile`: build `node:24-alpine` (corepack pnpm 10, `pnpm install --frozen-lockfile` с `--mount=type=secret,id=npmrc`, `pnpm build`) → runtime `nginx:1.27-alpine`, `dist/` → `/usr/share/nginx/html`, EXPOSE 8080, HEALTHCHECK `wget http://127.0.0.1:8080/healthz`.
- `docker/nginx.conf`: gzip, security headers (X-Frame-Options SAMEORIGIN, nosniff, Referrer-Policy), `/healthz` → 200, `/assets/` immutable 1y, `/config.js` no-store, SPA fallback `try_files … /index.html`. Проксирования `/api` в nginx **нет** — в проде API_BASE_URL задаётся env.
- Релиз: CI-runner'а в экосистеме нет (сознательно). Разработчик локально `docker buildx build -t git.stit.tech/<org>/frontend:vX.Y.Z --push .` (скилл `/release`), затем handoff в `<org>/infra`: `make bump SVC=frontend TAG=vX.Y.Z` (правит `FRONTEND_TAG` в `.env` VPS + force-recreate). Теги строго `vX.Y.Z`/`<sha>`, `:latest` запрещён.

### Доки и скиллы (агентная обвязка, наследуется форком)

- `CLAUDE.md` (ядро + роутер), `.claude/rules/{forward-only,fsd-architecture,comments,shared-ui,env-local,tests-pipeline}.md`,
  `.claude/plans/roadmap.md` (единый план, planning-first), `.claude/settings.json` (deny `--no-verify`, force-push и т.п.).
- Скиллы: `/smartdev` (cockpit), `/plan`, `/init-service` (оркестратор онбординга форка), `/stack-deep-dive`
  (8 артефактов `docs/stack/{service,runtime,config,routing,api,styling,observability,dependencies}.md`, frontmatter `status: draft|stable`,
  у каждого секция **Generates** — что из него разворачивает `/de-template`), `/de-template` (переименование пакета, README,
  runtime config defaults/nginx entrypoint, prune reference-слайсов auth/profile/todos/theme, удаление `docs/getting-started.md`),
  `/scaffold` (раскладка одного слайса по FSD-канону из stable-записи FSD-карты), `/release`.
- `docs/reference/{architecture,ecosystem,deployment,observability}.md`, `docs/stack/README.md` + `_templates/<kind>.md`, `docs/getting-started.md` ([META], удаляется), `docs/contributing.md`.
- **Forward-only**: любой текст описывает только текущее состояние, без «было/стало», changelog'ов, дат. Комментарии в коде — только WHY, по-русски.

## Экосистема (факты)

- 6 форкаемых шаблонов `stit-core/`: `corp-infra-template` (корп control-plane: Traefik+CrowdSec, Gitea = registry `git.stit.tech`, Authentik, Vaultwarden, MinIO, ntfy), `project-infra-template-compose` (→ `<org>/infra`, VPS проекта), `go-backend-template` (→ `<org>/backend`), `spa-frontend-template` (→ `<org>/frontend`), `telegram-bot-template` (→ `<org>/<bot>`), `business-strategy-template` (→ `<org>/strategy`, design-time SoT). Библиотеки: `golibinfra`, `pylibinfra` (и `ui-lib`, который **не используется**).
- Sibling-checkout: форки одной org лежат рядом `~/git/<org>/{strategy,infra,backend,frontend,<bot>}`; резолв соседа — поля `project-slug` / `strategy-path` (дефолт `../strategy`) / `surface` в `docs/stack/service.md`.
- **FSD-карта** проектируется в `<org>/strategy` (`docs/projects/<slug>/fsd/<surface>/`, 8 файлов: `entities.md, features.md, pages.md, widgets.md, app.md, shared-ui.md, shared-api.md, shared-lib.md`; канон — `business-strategy-template/docs/projects/_template/fsd/README.md` и `_template/*.md`). Фронт-репо её только читает; `/scaffold` выводит `src/<layer>/<slice>/` из kind + slug. В `pages.md` колонки: `slug, name, description, screen, path, guard (public|authenticated|<who>), widgets, features, entities, status`. SEO-полей (title/description/indexable/rendering) в каноне **нет**. Поверхности в `surface.md` имеют `type: web | admin | desktop | embed | bot | api`.
- **Инфра проекта** (`project-infra-template-compose`): один VPS = одна среда; всё в `.env` на VPS; сервис = `compose/<svc>.yml` с pinned image, `container_name`, `restart`, `healthcheck`, явные `networks` (`proxy` наружу, `backend-net` internal), Traefik-labels: `Host(\`<sub>.${DOMAIN}\`)`, entrypoint `websecure`, `tls.certresolver: letsencrypt`, middlewares `crowdsec@file,secure-headers@file,rate-limit@file`. Маршрутизация **по сабдоменам**, не path-based (правило `traefik-routing.md`: «path-based ломает редиректы и cookies»); backend на `api.${DOMAIN}`; на корне `${DOMAIN}` — always-on заглушка `compose/landing.yml` (nginx, `priority: 1`), которую фронт на корне перебивает. Frontend в стеке из коробки **нет** — «добавляется `/add-service`»; `docs/reference/architecture.md` там перечисляет «Frontend (static SPA или SSR) — `compose/frontend.yml` с traefik labels на корневой `${DOMAIN}`» как overlay. CDN в стеке нет. Traefik v3.6, CrowdSec bouncer (в корп-CrowdSec есть сценарий `commercial-crawlers.yaml`). Backend healthcheck `/health`. Образы: `${REGISTRY_HOST:-git.stit.tech}/${PROJECT_NAME}/backend:${BACKEND_TAG}`.
- **Бэкенд** (`go-backend-template`): huma/v2 + chi, OpenAPI 3.1; auth — httpOnly cookies `access_token` + `refresh_token`, `SameSite=Strict`, `Path=/`, `Secure` по env `COOKIE_SECURE`, без атрибута Domain (host-only); эндпоинты `POST /api/auth/{login,refresh,logout,change-password}`. (Reference-mock SPA-шаблона использует свои упрощённые `/api/v1/*` с cookie `app_session`.)
- Операционная модель: `<org>/infra` — хаб; сервис-репо STOP'ают на image-in-registry; деплой тега — `make bump` в infra.
- Публичная витрина `stit-public`: roadmap уже содержит строку `ssr-frontend-template — SSR-фронтенд — в планах` и `landing-template — генератор продающих лендингов`.

## Что хотим получить от ресёрча (сводно)

1. Какой фреймворк/подход SSR брать, чтобы максимально переиспользовать стек SPA (сильный кандидат — TanStack Start, т.к. роутер уже TanStack; но проверить альтернативы и риски).
2. Канон технического SEO для шаблона (Google + Яндекс), который можно зашить в код/тесты/доки.
3. Пошаговый перенос каждого элемента стека SPA → SSR: что идентично, что переписывается, что опасно (синглтоны на сервере, cookie/auth в SSR, mock-режим на сервере, runtime config без nginx, observability, тесты, lint/FSD, бюджеты).
4. Деплой/рантайм: Node-образ, healthcheck, env-контракт, compose/Traefik/CrowdSec для SEO-сайта, кеширование/ISR/prerender без CDN, CSP, staging noindex.
5. Дизайн самого шаблона и его место в экосистеме: отдельный репо vs один шаблон с переключателем рендера, имя форка (`<org>/site`?), изменения в `docs/stack` (новые kinds `seo`/`rendering`?), в скиллах, в каноне FSD-карты strategy, в infra-шаблоне, в ecosystem-доках.
6. Эмпирическая проверка (spike) выбранного пути: собирается ли на текущих версиях, как выглядит output, какие подводные камни.

## Формат отчёта потока

Файл `scratchpad/research/<NN>-<stream>.md`, по-русски, структура:

1. **TL;DR** — 5–10 строк главных выводов.
2. **Findings** — по вопросам; у каждого факта — источник (URL) и пометка «проверено <дата>» / «предположение».
3. **Рекомендации для шаблона** — конкретно: файлы, пакеты (с версиями), конфиги, правила, тесты. Черновики кода/конфигов приветствуются (короткие, помеченные как черновик).
4. **Риски и открытые вопросы** — что должен решить владелец, что нужно проверить дальше.
5. **Источники** — список URL.

В финальном ответе оркестратору — резюме ≤ 300 слов + путь к файлу.
