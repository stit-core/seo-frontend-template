---
description: env Node-процесса, SITE_URL и плейсхолдер origin, whitelist в HTML, секреты. Активируется при правке .env*, shared/config, docker/, astro.config.ts.
paths: [".env*", "src/shared/config/**", "docker/**", "astro.config.ts", "e2e/playwright.config.ts", "e2e/serve.mjs"]
---

# env и секреты

## Только runtime

Всё, что меняется между средами, — env Node-процесса контейнера; читается через
`getRuntimeConfig()` (`shared/config`, Zod по `process.env`). `import.meta.env`/`VITE_*`
для среды не используется: сборка среды не знает. Пустое значение ключа равносильно
незаданному — берётся дефолт. `import.meta.env.DEV` — признак `astro dev` (черновики
контента), не конфигурация среды.

Новый ключ — три места: Zod-схема `src/shared/config/runtime.ts`, строка в `.env.example`,
строка в таблице `docs/reference/deployment.md`.

На prerender `getRuntimeConfig()` видит значения **сборки**; на on-demand
(`prerender = false`) и в middleware — живой `process.env`.

## `SITE_URL` и плейсхолдер

- Сборка печёт `site: 'https://__site_origin__'` (`astro.config.ts`, при пустом или
  незаданном `SITE_URL`); `docker/entrypoint.sh` при старте штампует `SITE_URL` в
  `dist/client/**/*.{html,xml,txt}` и падает, если плейсхолдер остался в любом файле
  `dist/client` (`DIST_DIR` — тот же скрипт для копии сборки в e2e, `e2e/serve.mjs`).
  `dist/server` не штампуется: on-demand маршруты берут origin из runtime `SITE_URL`
- Штамповка пишет в `/app/dist/client` — сервис без `read_only: true` либо writable-bind
  этого пути
- Рантайм без `SITE_URL`, с плейсхолдером или с не-`http(s)` URL **не стартует**
  (`docker/entrypoint.sh`, `docker/server.mjs`)
- HTML на сборке не предсжимать — плейсхолдер уедет внутрь `.br`/`.gz`
- Абсолютные URL — только в `<head>`, JSON-LD, фидах, sitemap; в теле — корневые
  относительные
- `Astro.site` и `astro:i18n` для абсолютных URL не годятся (build-time origin) —
  только runtime `SITE_URL`
- Все файлы с литералом плейсхолдера сверяет `shared/config/runtime.server.test.ts`

## Что попадает в HTML

Только `PUBLIC_CONFIG_KEYS` через `getPublicConfig()`; `process.env` целиком не
сериализуется. Новый ключ в HTML — строка в whitelist + строка в таблице
`docs/reference/deployment.md` (колонка «в HTML?»).

**Публичный per-site идентификатор — не env, а поле `shared/config/site.ts`** (`METRIKA_ID`,
`SITE_VERIFICATION`, при появлении — site-key капчи): prerendered-страница печатается на
сборке, образ собирается без env, и runtime-значение до неё не доходит. Пустое значение
означает «ничего не печатать»; проектные подставляет `/de-template`. Секреты — наоборот, только
env: их читает on-demand код (`api/contact`, наблюдаемость), где `process.env` живой. `INDEXNOW_KEY` в HTML не попадает — файл
`/<ключ>.txt` (on-demand); `AI_TRAINING` и `ROBOTS_POLICY` читает `robots.txt`.

## Файлы и секреты

- `.env.example` — закоммичен, описывает runtime env с дефолтами; `.env*` — в `.gitignore`;
  локальный `.env` читает только `pnpm start`, в образ он не попадает
- Секреты — только env контейнера (`SMTP_URL`, `FORM_BACKEND_URL`, `CAPTCHA_SECRET`); в логах —
  без PII, без тел запросов и без тела заявки. Пишет один `log()` (`shared/observability`) с
  порогом `LOG_LEVEL` — и middleware, и форма; Sentry DSN public by design, но пустой по
  умолчанию — пакет тогда не грузится вовсе

## Что нельзя

- ❌ `import.meta.env.VITE_*` для конфигурации среды
- ❌ Логировать `process.env`, cookie, query-строку, тело запроса
- ❌ Читать `process.env` мимо `shared/config`. Исключения — код вне приложения:
  `astro.config.ts` (build-time плейсхолдер), `docker/*` (обёртка процесса стартует до
  приложения), `e2e/*` (профили и порты прогона), `scripts/*`
