# Deployment

Один Node-образ (`node:24-alpine`) на любую среду. Сборка ничего не знает о среде: в
prerendered-выход запекается плейсхолдер origin, а при старте контейнера он штампуется
в реальный `SITE_URL`. Всё остальное приходит env-переменными процесса.

## Образ

```bash
docker build -f docker/Dockerfile --secret id=npmrc,src=$HOME/.npmrc \
  -t <registry>/<org>/site:<tag> .
```

Стадии `docker/Dockerfile`:

- **build** — corepack + pnpm 10, `pnpm install --frozen-lockfile --ignore-scripts` (store
  через `--mount=type=cache`, приватный registry через `--mount=type=secret,id=npmrc`;
  скрипты зависимостей сборке не нужны, а `prepare` → `lefthook install` требует git),
  `pnpm build` без `SITE_URL` — `astro.config.ts` подставляет плейсхолдер
  `https://__site_origin__`
- **prod-deps** — `pnpm install --prod --ignore-scripts` + прунинг build-машинерии,
  которую `astro` тянет в `dependencies` (gnu-варианты rolldown / sharp-libvips /
  lightningcss / `@astrojs/compiler` / satteri, `@types/node`, `caniuse-lite`, `prismjs`):
  выход Astro не self-contained, `entry.mjs` импортит `astro`/`zod`, `/_image` — `sharp`
- **runtime** — `node_modules` из prod-deps, `dist/`, `package.json`, `docker/{entrypoint.sh,
  server.mjs}`; `USER node`, `EXPOSE 3000`, `HEALTHCHECK wget …:${PORT:-3000}/healthz`,
  `ENTRYPOINT entrypoint.sh`, `CMD node ./docker/server.mjs`

В контекст сборки попадают только `package.json`, `pnpm-lock.yaml`, `.npmrc`,
`astro.config.ts`, `tsconfig.json`, `src/` (включая контент `src/entities/*/content/**`),
`public/`, `content/` (`redirects.yaml` разбирается на сборке, в серверный бандл попадают
данные), `docker/`
(`.dockerignore`; его `*.md` исключает только корневые файлы).

## Запуск

```bash
docker run --rm -p 3000:3000 -e SITE_URL=https://example.com <image>
```

Контейнер не стартует (код 1, сообщение с префиксом `[entrypoint]` / `[server]`), если
`SITE_URL` пуст, без схемы `http(s)://`, равен плейсхолдеру сборки или после штамповки
плейсхолдер где-то остался.

## Штамповка origin (`docker/entrypoint.sh`)

Заменяет `https://__site_origin__` на `SITE_URL` (все хвостовые слеши срезаются) в
`*.html | *.xml | *.txt` внутри `dist/client`, затем проверяет, что в `dist/client` не
осталось ни одного файла с плейсхолдером (иначе — код 1 со списком файлов: расширение не
учтено). `dist/server` не трогается: on-demand маршруты берут origin из runtime `SITE_URL`
(`Astro.site` для URL не используется), а в бандле лежит константа плейсхолдера, по
которой конфиг отличает «не задано». Занимает единицы миллисекунд, пишет одну строку в лог;
повторный старт того же контейнера проходит чисто.

- `DIST_DIR` (дефолт `/app/dist`) — тот же скрипт штампует локальный `dist/` в e2e
- HTML на сборке **не предсжимается** — иначе плейсхолдер уедет внутрь `.br`/`.gz`
- Штамповка пишет в `/app/dist/client` (`sed -i`): сервис `site` в compose — без
  `read_only: true`, либо этот путь — writable-bind

## Обёртка сервера (`docker/server.mjs`)

Адаптер `@astrojs/node` не даёт ни graceful shutdown, ни keep-alive. Обёртка запускает
`startServer()` адаптера (`ASTRO_NODE_AUTOSTART=disabled`) и добавляет:

- `keepAliveTimeout` 65 с (> idle-таймаута Traefik) и `headersTimeout` +5 с — иначе
  прокси переиспользует соединение, которое Node уже закрывает, и ловит 502
- дренаж на `SIGTERM`/`SIGINT`: `close()` + `closeIdleConnections()` каждые 200 мс,
  потолок `SHUTDOWN_TIMEOUT_MS` (15 с; держать ≤ `stop_grace_period` compose);
  `docker stop` без трафика — доли секунды, запрос в полёте доезжает
- fail-fast: `SITE_URL` пустой, с плейсхолдером или не абсолютный `http(s)`-URL — выход с
  кодом 1 до загрузки приложения; занятый порт — код 1 с `[server] listen failed`
- `KEEP_ALIVE_TIMEOUT_MS` / `SHUTDOWN_TIMEOUT_MS`: пусто — дефолт, не число или ≤ 0 —
  предупреждение и дефолт

## Env-контракт

| имя | назначение | дефолт | в HTML? |
|---|---|---|---|
| `PORT` / `HOST` | слушатель адаптера (тот же `PORT` читает `HEALTHCHECK`) | `3000` / `0.0.0.0` | нет |
| `NODE_ENV` | режим Node | `production` (в образе) | нет |
| `NODE_OPTIONS` | например `--max-old-space-size=384` (≈ 75 % `mem_limit`) | — | нет |
| `SITE_URL` | канонический origin без хвостового слеша; **обязателен** | — | да (штамповка) |
| `ROBOTS_POLICY` | `index` \| `noindex` → `X-Robots-Tag: noindex, nofollow` на on-demand ответах | `index` | да |
| `RELEASE` | версия для логов | `unknown` | нет |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` — JSON-лог запросов | `info` | нет |
| `KEEP_ALIVE_TIMEOUT_MS` / `SHUTDOWN_TIMEOUT_MS` | обёртка сервера | `65000` / `15000` | нет |

Пустое значение (`ROBOTS_POLICY=`) равносильно незаданному — берётся дефолт. Чтение —
`src/shared/config` (`getRuntimeConfig()`, Zod по `process.env`); в HTML попадает только
whitelist `PUBLIC_CONFIG_KEYS`. Шаблон локального `.env` — `.env.example`; его читает
`pnpm start` (`node --env-file-if-exists=.env`), в образе файла нет.

## Что отдаёт процесс

- **Prerendered** страницы, `public/*` и `/_astro/*` отдаёт статик-хендлер адаптера **до**
  приложения со своими заголовками (`Cache-Control: public, max-age=0` + `ETag` +
  `Last-Modified`; ассеты — `immutable`): middleware, `X-Robots-Tag`, JSON-лог их не видят.
  Staging закрывается на Traefik (`basicAuth` + `customResponseHeaders: X-Robots-Tag`);
  `/index.html` и `/en/index.html` отвечают 200 — дубли главных, прикрываются
  `redirectRegex` там же
- **On-demand** (`prerender = false`: `/healthz`, `/now`, `404.astro` — то есть любой путь
  без статического файла) проходит через `app/middleware`: редиректы из
  `content/redirects.yaml` (301/308 с `Location`, query сохраняется; 410 с минимальным
  телом и `X-Robots-Tag: noindex`; один хоп, до роутинга), `X-Request-Id` (принимается или
  генерируется), JSON-лог одной строкой (`ts, lvl, method, path, status, dur_ms, rid`, без
  PII; успешный `/healthz` — только на `debug`; 404/410 — `warn`; ошибка рендера
  логируется со статусом 500 и тем же `rid`, ответ строит Astro), `Cache-Control: no-cache`
  на HTML без явного заголовка (404/410 включительно; `now` ставит `private, no-store`
  сам), `X-Robots-Tag` при `ROBOTS_POLICY=noindex`. Режимы и карта маршрутов —
  `rendering.md`
- Нормализация: `/en/` → 301 `/en` (адаптер — для каталогов `dist/client`, Astro — для
  остальных путей до middleware, поэтому `/old/` → `/old` → правило из `redirects.yaml`),
  `/about.html` → 404 при `build.format: 'directory'`
- Сжатия в процессе нет — жмёт Traefik (`compress`)
- Security-заголовки (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`) ставит Traefik (`secure-headers@file`);
  приложение их не дублирует

## `/healthz`

Liveness без зависимостей: `200 ok`, `Cache-Control: no-store`, версия не раскрывается.
Его же ждёт `HEALTHCHECK` образа и `webServer.url` Playwright.

## Локально как в контейнере

```bash
pnpm build
DIST_DIR=dist SITE_URL=http://localhost:3000 sh docker/entrypoint.sh pnpm start
```

## Release handoff

CI-runner'а в экосистеме нет; build + push делает разработчик:

1. `docker buildx build -f docker/Dockerfile --secret id=npmrc,src=$HOME/.npmrc
   -t <registry>/<org>/site:vX.Y.Z --push .`
2. INFRA-HANDOFF: rollout выполняет `<org>/infra` — `make bump SVC=site TAG=vX.Y.Z`
   (правит `SITE_TAG` в `.env` VPS + force-recreate)

CD — задача `infra/` репо; отсюда деплой-команды не запускаются.
