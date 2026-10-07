---
description: env Node-процесса, SITE_URL и плейсхолдер origin, что из env попадает в HTML, секреты. Активируется при правке .env*, shared/config, docker/, astro.config.ts.
paths: [".env*", "src/shared/config/**", "docker/**", "astro.config.ts", "e2e/playwright.config.ts", "e2e/serve.mjs"]
---

# env и секреты

## Только runtime

Всё, что меняется между средами, — env Node-процесса контейнера; читается через
`getRuntimeConfig()` (`shared/config`, Zod по `process.env`, один разбор на набор значений —
запрос получает готовый объект). `import.meta.env`/`VITE_*` для среды не используется: сборка
среды не знает. Пустое значение ключа равносильно незаданному — берётся дефолт; значение вне
формата — отказ старта. `import.meta.env.DEV` — признак `astro dev` (черновики контента), не
конфигурация среды.

Новый ключ — три места: Zod-схема `src/shared/config/runtime.ts`, строка в `.env.example`,
строка в таблице `docs/reference/deployment.md`.

На prerender `getRuntimeConfig()` видит значения **сборки**; на on-demand
(`prerender = false`) и в middleware — живой `process.env`.

## `SITE_URL` и плейсхолдер

- Сборка печёт `site: 'https://__site_origin__'` (`astro.config.ts`, при пустом или
  незаданном `SITE_URL`); `docker/entrypoint.sh` при старте запускает `docker/stamp.mjs`: он
  заменяет плейсхолдер на `SITE_URL` строкой (не `sed` и не регулярным выражением — данные из
  env не исполняются) в тех `dist/client/**/*.{html,xml,txt}`, где он есть, возвращает файлу
  mtime сборки (`Last-Modified` и ETag не меняются от рестарта) и падает, если плейсхолдер
  остался в любом файле `dist/client` (`DIST_DIR` — тот же скрипт для копии сборки в e2e,
  `e2e/serve.mjs`). `dist/server` не штампуется: on-demand маршруты берут origin из runtime
  `SITE_URL`
- Штамповка пишет в `/app/dist/client` образа — сервис без `read_only: true`, без `user:` и
  без тома на этом пути; без `index.html` в `dist/client` (пустой bind) и при записи без прав
  процесс не стартует — строка `[entrypoint]` с причиной
- `SITE_URL` — ровно origin: схема `http(s)`, хост в нижнем регистре из непустых меток (IDN —
  punycode) и порт 1–65535; путь, query, userinfo, пробелы и спецсимволы — отказ. Правило одно — поле схемы
  `shared/config/runtime.ts`
- Рантайм **не стартует**, если env не проходит схему (значение вне формата — сообщение с
  ключом и правилом, без значения; свободные строки канала формы и DSN проверяет их потребитель,
  имя ключа с опечаткой — просто незаданный ключ), без `SITE_URL` или с плейсхолдером: `docker/stamp.mjs` и
  `docker/server.mjs` проверяют env целиком (`loadServerConfig`; модуль схемы сборка кладёт
  отдельным файлом `dist/server/runtime-config.mjs`) — до записи файлов и до загрузки
  приложения
- HTML на сборке не предсжимать — плейсхолдер уедет внутрь `.br`/`.gz`
- Абсолютные URL — только в `<head>`, JSON-LD, фидах, sitemap; в теле — корневые
  относительные
- `Astro.site` и `astro:i18n` для абсолютных URL не годятся (build-time origin) —
  только runtime `SITE_URL`
- Все файлы с литералом плейсхолдера сверяет `shared/config/runtime.server.test.ts`

## Что попадает в HTML

Из env в разметку попадает только origin `SITE_URL` — через `absoluteUrl()` (`shared/seo`):
плейсхолдер на сборке, который штампует entrypoint, и живое значение на on-demand. Остальное
env читает серверный код (`.ts`), а не разметка: `getRuntimeConfig()` в `.astro`, `process.env`
вне `shared/config` и `import.meta.env` (кроме `DEV`) валят ESLint, клиентскому `<script>`
`@/shared/config` недоступен. Колонка
«в HTML?» таблицы `docs/reference/deployment.md` — для каждого ключа.

**Публичный per-site идентификатор — не env, а поле `shared/config/site.ts`** (`METRIKA_ID`,
`SITE_VERIFICATION`, при появлении — site-key капчи): prerendered-страница печатается на
сборке, образ собирается без env, и runtime-значение до неё не доходит. Пустое значение
означает «ничего не печатать»; тип поля — `string`, а не литерал пустой строки: с проектным
значением проверка «задано ли» иначе не компилируется (держит тест типа у потребителя). Проектные
подставляет `/de-template`. Секреты — наоборот, только
env: их читает on-demand код (`api/contact`, наблюдаемость), где `process.env` живой. `INDEXNOW_KEY` в HTML не попадает — файл
`/<ключ>.txt` (on-demand); `AI_TRAINING` и `ROBOTS_POLICY` читает `robots.txt`.

## Файлы и секреты

- `.env.example` — закоммичен, описывает runtime env с дефолтами; `.env*` — в `.gitignore`;
  локальный `.env` читает только `pnpm start`, в образ он не попадает
- Секреты — только env контейнера (`SMTP_URL`, `FORM_BACKEND_URL`, `CAPTCHA_SECRET`); в логах —
  без PII, без тел запросов и без тела заявки. Пишет один `log()` (`shared/observability`) с
  порогом `LOG_LEVEL` — и middleware, и форма (`console` в `src` вне `log.ts` и тестов валит
  ESLint); Sentry DSN public by design, но пустой по
  умолчанию — пакет тогда не грузится вовсе

## Что нельзя

- ❌ `import.meta.env.<KEY>` для конфигурации среды (ESLint: из него — только `DEV`)
- ❌ Логировать `process.env`, cookie, query-строку, тело запроса
- ❌ Читать `process.env` мимо `shared/config` — в `src` (кроме тестов) это ошибка ESLint
  `no-restricted-properties`. Исключения — код вне приложения:
  `astro.config.ts` (build-time плейсхолдер), `docker/*` (обёртка процесса стартует до
  приложения), `e2e/*` (профили и порты прогона), `scripts/*`
