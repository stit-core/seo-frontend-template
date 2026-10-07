---
id: stack.runtime
kind: runtime
name: runtime
status: draft
---

# runtime

## Процесс

| поле | значение |
|---|---|
| образ | `node:${NODE_VERSION}-alpine` — аргумент сборки, умолчание — Active LTS (24); стадии `pnpm` → `build` и `prod-deps` → `runtime`, `USER node` |
| адаптер | `@astrojs/node` в режиме `standalone`, автостарт выключен |
| обёртка | `docker/server.mjs` — keep-alive, дренаж, fail-fast по env целиком (схема `shared/config`) |
| порт / хост | `PORT=3000` / `HOST=0.0.0.0` |
| liveness | `GET /healthz` → `200 ok`, `Cache-Control: no-store`, без зависимостей |
| graceful shutdown | `SIGTERM`/`SIGINT` → `close()` + `closeIdleConnections()`, потолок `SHUTDOWN_TIMEOUT_MS` (15 с) |
| keep-alive | `KEEP_ALIVE_TIMEOUT_MS` 65 с (> idle-таймаута прокси), `headersTimeout` +5 с |
| сжатие | в процессе нет — жмёт Traefik |
| память | `mem_limit` _768 МБ_, `NODE_OPTIONS=--max-old-space-size` ≈ 75 % лимита |
| реплик | _1_ — модульного состояния в приложении нет, масштабирование горизонтальное |

`stop_grace_period` сервиса в compose держится **больше** `SHUTDOWN_TIMEOUT_MS`,
иначе дренаж обрывается на середине.

## Сборка

| поле | значение |
|---|---|
| Node dev | `24 LTS` (`.nvmrc`); `engines` — `^24.16.0 \|\| >=26.3.0`, минимум зависимостей |
| менеджер пакетов | `pnpm` — версия `packageManager`, ставится `npm i -g` (corepack нет в Node ≥ 25); настройки — `pnpm-workspace.yaml`, в `.npmrc` — только реестр и токены |
| модули | ESM-only (`"type": "module"`) |
| TypeScript | `astro/tsconfigs/strictest`, `astro sync` + `astro-check` в гейте |
| origin на сборке | плейсхолдер `https://__site_origin__`; реальный `SITE_URL` штампует entrypoint |
| предсжатие HTML | **нет** — штамповка не заглянет внутрь `.br`/`.gz` |

## Браузеры

| поле | значение |
|---|---|
| поддержка | актуальные Chrome / Firefox / Safari / Edge; на контентной странице JS не требуется вовсе |
| полифиллы | нет: острова (тема, счётчик) — короткие инлайн-скрипты; `requestIdleCallback` счётчика — с запасным `setTimeout` |

## Generates

- `.nvmrc`, `package.json#engines`
- `docker/Dockerfile` — стадии, `NODE_VERSION` и `HEALTHCHECK`
- `docker/server.mjs` — таймауты и дренаж
- `config.md` — env `PORT`, `HOST`, `NODE_OPTIONS`, `KEEP_ALIVE_TIMEOUT_MS`, `SHUTDOWN_TIMEOUT_MS`
- handoff в `<org>/infra` — `mem_limit`, `stop_grace_period`, число реплик

## Открытые вопросы

- _что_
