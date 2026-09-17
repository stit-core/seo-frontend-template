# Deployment

## Docker image

Один образ — любая среда. Конфиг приходит через env-переменные контейнера на
старте, не через build-time.

### Сборка

```bash
docker build -f docker/Dockerfile -t <registry>/<service>-spa:<tag> .
docker push <registry>/<service>-spa:<tag>
```

### Слои образа

- **build stage**: `node:24-alpine` + corepack + pnpm install + `pnpm build`
- **runtime stage**: `nginx:1.27-alpine` со скопированным `dist/`,
  `docker/nginx.conf` и `docker/nginx-entrypoint.sh`

## Runtime config

`docker/nginx-entrypoint.sh` запускается nginx-base-образом из
`/docker-entrypoint.d/` перед стартом nginx. Генерирует
`/usr/share/nginx/html/config.js` из env-переменных контейнера:

```js
window.__APP_CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL:-/api}",
  API_MODE: "${API_MODE:-real}",
  SENTRY_DSN: "${SENTRY_DSN:-}",
  SENTRY_ENVIRONMENT: "${SENTRY_ENVIRONMENT:-production}",
  RELEASE: "${RELEASE:-unknown}"
}
```

`API_MODE=mock` поднимает контейнер в mock-режиме (MSW) — удобно для
демо-стендов; дефолт прод-образа — `real`.

`index.html` подгружает `/config.js` **до** основного бандла:

```html
<script src="/config.js"></script>
<script type="module" src="/src/app/main.tsx"></script>
```

`src/shared/config/index.ts` валидирует через Zod и кладёт в типизированный
`runtimeConfig`. Любой слой может его читать.

## nginx.conf

- `try_files $uri $uri/ /index.html` — SPA fallback
- `location /assets/` — `Cache-Control: public, immutable; expires 1y`
  (Vite хеширует имена)
- `location = /config.js` — `Cache-Control: no-store` (всегда свежий)
- `location = /healthz` — `200 ok\n` для liveness/readiness
- gzip + basic security headers (X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy)

## Healthcheck

`HEALTHCHECK CMD wget -qO- http://127.0.0.1:8080/healthz` в Dockerfile.

## Release handoff

CI-runner'а в экосистеме нет (сознательное решение — см. канон
`corp-infra-template/docs/ecosystem.md`); build+push делает разработчик
через скилл `/release`:

1. Build image с тегом из git ref (`v1.2.3` или `<sha>`)
2. Push в `<registry>` (`git.${DOMAIN}/<org>/frontend:<v>`)
3. INFRA-HANDOFF: rollout выполняет `<org>/infra` —
   `make bump SVC=frontend TAG=<v>` (правит `FRONTEND_TAG` в `.env` VPS +
   force-recreate)

CD — задача `infra/` репо; отсюда деплой-команды не запускаются.
