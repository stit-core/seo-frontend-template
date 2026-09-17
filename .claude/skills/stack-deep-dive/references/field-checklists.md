# Чек-листы полей по kind

По разделу на каждый из 8 stack-kinds. В каждом разделе:

- **Обязательные секции** — что должно быть и непусто к stable.
- **Что в Generates** — конкретика, которую правит `de-template`.
- **Cross-kind ссылки** — куда роллапается решение.
- **Главные anti-patterns**.

Полный канон — `docs/stack/README.md` + `_templates/<kind>.md`. Здесь — выжимка
для скилла. Базовые выборы шаблона уже зашиты; здесь — проектные вариации.

---

## service

**Обязательные секции**: `Идентичность`, `Связь с экосистемой`, `Generates`.

**Generates содержит**: `package.json#name`, README-шапка, registry-путь
образа, `docker/Dockerfile` LABEL.

**Cross-kind**: registry/имя сервиса — якорь для `deployment.md`;
`project-slug` / `strategy-path` (дефолт `../strategy`) / `surface` — резолв
FSD-карты и продуктового контекста в соседнем `<org>/strategy`
(`<strategy-path>/docs/projects/<slug>/`), по ним ходят `/scaffold` и
`/de-template`.

**Anti-patterns**:
- `package.json#name` остался шаблонным (`@stit/spa-frontend-template`).
- Image-теги `:latest`/`:edge`.

---

## runtime

**Обязательные секции**: `Node`, `Browser`, `React`, `Generates`.

**Generates содержит**: `.nvmrc`/`engines`, browserslist target, React Compiler
mode в `vite.config.ts`.

**Cross-kind**: browser target ↔ `styling.md` (Tailwind target).

**Anti-patterns**:
- React Compiler выключен без обоснования.
- Browser target шире, чем поддерживает DS.

---

## config

**Обязательные секции**: `Runtime config keys`, `Build-time env (VITE_*)`,
`Секреты`, `Generates`.

**Generates содержит**: `shared/config` Zod-схема, `nginx-entrypoint.sh` →
`config.js`, `.env.example`.

**Cross-kind (роллап)**: каждый env/DSN, объявленный любым kind'ом, обязан быть
здесь. `API_BASE_URL` совпадает с тем, что использует `shared/config`.

**Anti-patterns**:
- Секрет в `VITE_*` (попадает в публичный бандл).
- `SENTRY_DSN` объявлен в `observability.md`, но не в `Runtime config keys`.

---

## routing

**Обязательные секции**: `TanStack Router`, `Layouts`, `Guards`, `Generates`.

**Generates содержит**: `routeTree.gen.ts` (vite-плагин), layout-роуты,
guard-обвязка.

**Cross-kind**: guards ↔ `api.md § Auth scheme`; layouts ↔ `app.md` (fsd).

**Anti-patterns**:
- Guard в рендере вместо `beforeLoad`.
- File-based маршрут без соответствия page в `fsd/pages.md`.

---

## api

**Обязательные секции**: `HTTP-клиент`, `Контракт API`, `Auth scheme`,
`Mock-стратегия`, `Generates`.

**Generates содержит**: `shared/api/client.ts`, `entities/*/model/schema.ts`,
mock-handlers.

**Cross-kind**: контракт API ↔ `backend/openapi.json` (референс); mock-сущности ↔
`fsd/entities.md`.

**Anti-patterns**:
- Вторая линия HTTP-клиента (пакет-обёртка) рядом со своим fetch-враппером.
- Схема без парса ответа в `queryFn`/`mutationFn`.

---

## styling

**Обязательные секции**: `Источники`, `Корневой импорт`, `Темизация — оси`,
`Layout-конвенции проекта`, `Generates`.

**Generates содержит**: Tailwind v4 config, активные оси темизации
(scheme/brand/density), корневой CSS-импорт.

**Cross-kind**: оси темизации ↔ токен-слой `app/styles/index.css` (rule `shared-ui`).

**Anti-patterns**:
- Хардкод сырых цветов/размеров вместо семантических токенов `index.css`.
- Произвольный CSS вместо Tailwind-утилит без обоснования.

---

## observability

**Обязательные секции**: `Sentry`, `Web Vitals`, `Generates`.

**Generates содержит**: Sentry init (conditional), web-vitals репортер.

**Cross-kind**: `SENTRY_DSN` ↔ `config.md § Runtime config keys`.

**Anti-patterns**:
- Секрет-токен в фронт-бандле.
- Sentry активен, но DSN не объявлен в `config.md`.

---

## dependencies

**Обязательные секции**: `Базовая подборка (наследуется из шаблона)`,
`Проектные добавления`, `Запрещено`, `Generates`.

**Generates содержит**: проектные записи `package.json` + обоснование каждой.

**Cross-kind**: проектные deps не противоречат `package.json`; внешние сервисы
↔ `api.md`/`observability.md`.

**Anti-patterns**:
- Проектная dep без обоснования в `Проектные добавления`.
- Dep, дублирующая то, что уже даёт базовая подборка.
