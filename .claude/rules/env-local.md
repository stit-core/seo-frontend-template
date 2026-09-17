---
description: Работа с env и секретами. Активируется при правке .env*, runtime config, docker/.
globs: [".env*", "src/shared/config/**", "docker/**", "vite.config.ts"]
---

# env и секреты

## Build-time vs runtime

| тип | где | пример |
|---|---|---|
| **build-time** | `import.meta.env.VITE_*` (Vite) | `VITE_API_MODE` |
| **runtime** | `window.__APP_CONFIG__` (генерится nginx-entrypoint.sh) | `API_BASE_URL`, `API_MODE`, `SENTRY_DSN` |

**Правило**: всё, что должно меняться **между средами без пересборки**, —
в runtime config. Всё, что **меняет поведение шаблонной сборки** (mock vs real
в dev) — build-time.

## .env-файлы

- `.env.example` — **закоммичен**, описывает build-time env с дефолтами
- `.env.local.example` — **закоммичен**, шаблон локального override
- `.env`, `.env.local`, `.env.*` — **в `.gitignore`**, никогда не коммитим

## Секреты

- Не хранятся в фронт-бандле. Cookie-auth (httpOnly) на стороне бэка.
- Sentry DSN — public by design, безопасно в runtime config.
- В CI секреты приходят через env переменные → в Docker контейнер →
  nginx-entrypoint впишет в `config.js` (только не-секретные).

## Что нельзя

- ❌ Хранить access-token в localStorage / sessionStorage (XSS-риск)
- ❌ Подтягивать секреты в `import.meta.env.VITE_*` (попадают в публичный бандл)
- ❌ Логировать содержимое `runtimeConfig` целиком (если добавляешь не-public поле — фильтруй)
