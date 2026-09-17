---
id: stack.config
kind: config
name: config
status: draft
---

# config

## Runtime config keys

`window.__APP_CONFIG__` — генерируется nginx-entrypoint.sh из env-переменных
контейнера, валидируется Zod в `src/shared/config/index.ts`.

| key | type | default | назначение | secret? |
|---|---|---|---|---|
| `API_BASE_URL` | string | `/api` | префикс HTTP-запросов | нет |
| `SENTRY_DSN` | string | `""` | DSN Sentry, пустой = выключен | нет (public DSN) |
| `SENTRY_ENVIRONMENT` | string | `production` | tag среды | нет |
| `RELEASE` | string | `unknown` | tag релиза для Sentry | нет |
| _добавить_ | _type_ | _default_ | _что_ | _да/нет_ |

## Build-time env (VITE_*)

| key | values | default | назначение |
|---|---|---|---|
| `VITE_API_MODE` | `mock` / `real` | `mock` | dev-режим API |
| `VITE_API_TARGET` | URL | `http://localhost:8080` | таргет proxy для `real` |
| `VITE_MOCK_SCENARIO` | `empty` / `populated` / `authenticated` / `error` | `populated` | стартовый mock-сценарий |
| `VITE_MOCK_DEVTOOLS` | `0` / `1` | `0` | dev-UI переключателя сценариев |

## Секреты

Cookie-auth: сервер выставляет httpOnly cookie сессии. Фронт токены не хранит.
DSN Sentry public-by-design, безопасно в бандле.

## Generates

- `.env.example` — список build-time env с дефолтами
- `docker/nginx-entrypoint.sh` — все runtime keys с дефолтами
- `src/shared/config/index.ts` — Zod-схема `RuntimeConfig`

## Открытые вопросы

- _что_
