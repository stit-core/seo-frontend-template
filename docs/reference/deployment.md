# Deployment

Один Node-образ (`node:24-alpine`) на любую среду. Сборка ничего не знает о среде: в
prerendered-выход запекается плейсхолдер origin, а при старте контейнера он штампуется
в реальный `SITE_URL`. Всё остальное приходит env-переменными процесса.

## Образ

```bash
docker build -f docker/Dockerfile --secret id=npmrc,src=$HOME/.npmrc \
  -t <registry>/<org>/site:<tag> .
```

Без `~/.npmrc` флаг `--secret` убирают: buildx падает на отсутствующем файле секрета, а
Dockerfile монтирует его необязательно.

Стадии `docker/Dockerfile`:

- **build** — corepack + pnpm 10, `pnpm install --frozen-lockfile --ignore-scripts` (store
  через `--mount=type=cache`, `~/.npmrc` оператора — через необязательный
  `--mount=type=secret,id=npmrc`; скрипты зависимостей сборке не нужны, а `prepare` →
  `lefthook install` требует git),
  `pnpm build` без `SITE_URL` — `astro.config.ts` подставляет плейсхолдер
  `https://__site_origin__`
- **prod-deps** — `pnpm install --prod --ignore-scripts` + прунинг build-машинерии,
  которую `astro` тянет в `dependencies` (gnu-варианты rolldown / sharp-libvips /
  lightningcss / `@astrojs/compiler` / satteri, `@types/node`, `caniuse-lite`, `prismjs`):
  выход Astro не self-contained, `entry.mjs` импортит `astro`/`zod`, сервис картинок — `sharp`
- **runtime** — `node_modules` из prod-deps, `dist/`, `package.json`, `docker/{entrypoint.sh,
  stamp.mjs,server.mjs}`; `USER node`, `EXPOSE 3000`, `HEALTHCHECK wget …:${PORT:-3000}/healthz`,
  `ENTRYPOINT entrypoint.sh`, `CMD node ./docker/server.mjs`

В контекст сборки попадают только `package.json`, `pnpm-lock.yaml`, `.npmrc`,
`astro.config.ts`, `tsconfig.json`, `src/` (включая контент `src/entities/*/content/**`),
`public/`, `content/` (`redirects.yaml` разбирается на сборке, в серверный бандл попадают
данные), `docker/` и политика сборки `scripts/lib/site-policy.mjs` (из неё конфиг строит CSP)
(`.dockerignore`; его `*.md` исключает только корневые файлы).

## Запуск

```bash
docker run --rm -p 3000:3000 -e SITE_URL=https://example.com <image>
```

Контейнер не стартует (код 1, сообщение с префиксом `[entrypoint]` / `[server]`), если
любой ключ env не проходит схему (сообщение называет ключ и правило, значение не печатает),
`SITE_URL` пуст, не origin вида `https://example.com`, равен плейсхолдеру сборки, в
`dist/client` нет `index.html`, файл не записать или после штамповки плейсхолдер где-то
остался.

## Штамповка origin (`docker/entrypoint.sh` → `docker/stamp.mjs`)

`entrypoint.sh` запускает `node docker/stamp.mjs` и затем `exec` команды. Штамповка
проверяет env той же схемой, что старт сервера (`loadServerConfig` из
`dist/server/runtime-config.mjs`): `SITE_URL` — ровно origin (схема `http(s)`, хост в нижнем
регистре из непустых меток — IDN в punycode — и порт 1–65535; ни пути, ни query, ни userinfo,
ни пробелов; хвостовые слеши срезаются), иначе код 1 до записи файлов. Затем заменяет
`https://__site_origin__` на `SITE_URL` строкой (данные из env не исполняются: ни `sed`, ни
регулярных выражений) в тех `*.html | *.xml | *.txt` внутри `dist/client`, где он есть, и
возвращает каждому файлу mtime сборки: от него `Last-Modified` и ETag статик-хендлера, поэтому
старт и рестарт не делают страницы «изменёнными». Плейсхолдер в файле другого типа — код 1
со списком файлов (расширение не учтено). `dist/server` не трогается: on-demand маршруты берут
origin из runtime `SITE_URL` (`Astro.site` для URL не используется), а в бандле лежит
константа плейсхолдера, по которой конфиг отличает «не задано». Пишет одну строку в лог с числом
проштампованных файлов; повторный старт того же контейнера файлов не трогает.

- `DIST_DIR` (дефолт `/app/dist`) — тот же скрипт штампует копию локальной сборки в e2e (`e2e/serve.mjs`)
- HTML на сборке **не предсжимается** — иначе плейсхолдер уедет внутрь `.br`/`.gz`
- Штамповка перезаписывает выход сборки в `/app/dist/client` образа: сервис `site` в compose —
  без `read_only: true`, без `user:` и без тома на этом пути. Пустой bind или tmpfs — код 1
  (`index.html` в `dist/client` нет), именованный том отдал бы файлы прошлого релиза; запись без
  прав — код 1 со строкой `[entrypoint] cannot stamp <файл>: <код ошибки>`

## Обёртка сервера (`docker/server.mjs`)

Адаптер `@astrojs/node` не даёт ни graceful shutdown, ни keep-alive. Обёртка запускает
`startServer()` адаптера (`ASTRO_NODE_AUTOSTART=disabled`) и добавляет:

- `keepAliveTimeout` 65 с (> idle-таймаута Traefik) и `headersTimeout` +5 с — иначе
  прокси переиспользует соединение, которое Node уже закрывает, и ловит 502
- дренаж на `SIGTERM`/`SIGINT`: `close()` + `closeIdleConnections()` каждые 200 мс,
  потолок `SHUTDOWN_TIMEOUT_MS` (15 с; держать ≤ `stop_grace_period` compose);
  `docker stop` без трафика — доли секунды, запрос в полёте доезжает
- fail-fast: env целиком проверяется до загрузки приложения той же схемой, что его читает
  (`loadServerConfig` из `src/shared/config/runtime.ts`; сборка кладёт этот модуль отдельным
  файлом `dist/server/runtime-config.mjs`, и экземпляр у обёртки и приложения общий — запросы
  читают уже разобранный конфиг). Значение вне формата, пустой `SITE_URL` или плейсхолдер —
  код 1 и строка `[server] invalid env — <ключ>: <правило>`; занятый порт — код 1 с
  `[server] listen failed`
- `KEEP_ALIVE_TIMEOUT_MS` / `SHUTDOWN_TIMEOUT_MS` — ключи той же схемы: пусто — дефолт, не
  целое число больше нуля — отказ старта
- staging (`ROBOTS_POLICY=noindex`): `X-Robots-Tag: noindex, nofollow` на каждом ответе
  процесса — и статики адаптера, до которой приложение не доходит, и on-demand; заголовок
  ставится в `writeHead` ответа последним, поэтому значение маршрута его не перекрывает

## Env-контракт

| имя | назначение | дефолт | в HTML? |
|---|---|---|---|
| `PORT` / `HOST` | слушатель адаптера (тот же `PORT` читает `HEALTHCHECK`) | `3000` / `0.0.0.0` | нет |
| `NODE_ENV` | режим Node | `production` (в образе) | нет |
| `NODE_OPTIONS` | например `--max-old-space-size=384` (≈ 75 % `mem_limit`) | — | нет |
| `SITE_URL` | канонический origin `https://example.com`: схема, хост в нижнем регистре, порт — без пути, query и userinfo (хвостовые слеши срезаются); **обязателен** | — | да (штамповка) |
| `ROBOTS_POLICY` | `index` \| `noindex` → `X-Robots-Tag: noindex, nofollow` на каждом ответе процесса и `robots.txt` = `Disallow: /` | `index` | нет (заголовок и `robots.txt`) |
| `RELEASE` | версия для логов | `unknown` | нет |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` — JSON-лог запросов | `info` | нет |
| `KEEP_ALIVE_TIMEOUT_MS` / `SHUTDOWN_TIMEOUT_MS` | обёртка сервера | `65000` / `15000` | нет |
| `INDEXNOW_KEY` | ключ IndexNow (8–128 символов `a-zA-Z0-9-`), подтверждается файлом `/<ключ>.txt` | `''` — файла нет | нет (файл `.txt`) |
| `AI_TRAINING` | `allow` \| `deny` — запрет обучающих AI-краулеров в `robots.txt` | `allow` | нет (`robots.txt`) |
| `FORM_DELIVERY` | канал доставки заявки: `smtp` \| `backend` | `smtp` | нет |
| `SMTP_URL` | строка подключения SMTP (`smtps://user:pass@host`) — канал `smtp` | `''` | нет (секрет) |
| `FORM_TO` / `FORM_FROM` | получатель и отправитель письма с заявкой — канал `smtp` | `''` | нет |
| `FORM_BACKEND_URL` | адрес внутреннего сервиса, принимающего заявку JSON-ом — канал `backend` | `''` | нет |
| `CAPTCHA_PROVIDER` | шов капчи; реализаций провайдеров в шаблоне нет | `none` | нет |
| `CAPTCHA_SECRET` / `CAPTCHA_FAIL_MODE` | ключ верификации и поведение при недоступности провайдера (`open` \| `closed`) | `''` / `open` | нет (секрет) |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | отправка серверных исключений; пусто — `@sentry/node` не грузится | `''` / `production` | нет |

Пустое значение (`ROBOTS_POLICY=`) равносильно незаданному — берётся дефолт; значение вне
формата (enum, число, ключ IndexNow, origin) — отказ старта с именем ключа. Свободные строки —
адрес и учётные данные канала формы, DSN — проверяет их потребитель при отправке; имя ключа с
опечаткой (`ROBOT_POLICY`) схема не знает — для неё ключ не задан и берёт дефолт, поэтому
staging закрывают и контуры Traefik. Чтение — `src/shared/config` (`getRuntimeConfig()`, Zod
по `process.env`, один разбор на набор значений); в HTML из env попадает только
origin `SITE_URL` через `absoluteUrl()`. Шаблон локального `.env` — `.env.example`; его читает
`pnpm start` (`node --env-file-if-exists=.env`), в образе файла нет.

Публичные идентификаторы сайта — счётчик Метрики (`METRIKA_ID`) и токены подтверждения
домена (`SITE_VERIFICATION`) — живут не в env, а полями `src/shared/config/site.ts`:
prerendered-страница печатается на сборке, а образ собирается без env, и runtime-значение до
неё не доходит. `/de-template` подставляет проектные; пустое значение означает «ничего не
печатать» — ни счётчика, ни тега. Альтернатива для подтверждения домена — HTML-файл в
`public/` (`google<token>.html`, `yandex_<token>.html`) или запись DNS TXT.

## Что отдаёт процесс

- **Prerendered** страницы, `public/*` и `/_astro/*` отдаёт статик-хендлер адаптера **до**
  приложения со своими заголовками (`Cache-Control: public, max-age=0` + `ETag` +
  `Last-Modified`; ассеты — `immutable`): middleware и JSON-лог их не видят, `X-Robots-Tag`
  staging ставит обёртка процесса. Каждая страница отвечает и по `<путь>/index.html`
  (`/index.html`, `/about/index.html`) — 200 тем же HTML, но без CSP: заголовки сборки адаптер
  ищет по маршруту, а такой путь маршрутом не является; дубли закрывает `strip-index-html` на
  Traefik (301 на путь без `/index.html`). Метод запроса хендлер не смотрит (`POST /` —
  200 со страницей, `TRACE` — 500 с ошибкой в логе): лишние методы режет edge. По симлинку внутри
  `dist/client` он отдаёт файл, на который тот указывает, — в `public/` симлинков нет
- **On-demand** (`prerender = false`: `/healthz`, `/now`, `/api/contact`, `robots.txt`,
  `sitemap.xml`, фиды `rss.xml` и `en/rss.xml`, `/<INDEXNOW_KEY>.txt`, `404.astro` — то есть
  любой путь без статического файла, и закрытый `/_image` — 404 текстом; список держит карта
  `rendering.md`)
  проходит через `app/middleware`: редиректы из
  `content/redirects.yaml` (301/308 с `Location`, query сохраняется; 410 с минимальным
  телом и `X-Robots-Tag: noindex`; один хоп, до роутинга), `X-Request-Id` (принимается или
  генерируется), JSON-лог одной строкой (`ts, lvl, method, path, status, dur_ms, rid`, без
  PII; успешный `/healthz` — только на `debug`; 404/410 — `warn`; ошибка рендера
  логируется со статусом 500 и тем же `rid`, ответ строит Astro), `Cache-Control: no-cache`
  на HTML без явного заголовка (404/410 включительно; `now` ставит `private, no-store`
  сам). Режимы и карта маршрутов — `rendering.md`
- Нормализация: `/en/` → 301 `/en` (адаптер — для каталогов `dist/client`, Astro — для
  остальных путей до middleware, поэтому `/old/` → `/old` → правило из `redirects.yaml`),
  `/about.html` → 404 при `build.format: 'directory'`
- Сжатия в процессе нет — жмёт Traefik (`compress`)
- Заголовки безопасности поделены: `Content-Security-Policy` (с `frame-ancestors 'none'`) ставит
  приложение у каждой страницы — prerendered из `dist/_headers.json`, on-demand в ответе
  (`rendering.md § Заголовки`); `Strict-Transport-Security`, `X-Content-Type-Options`,
  `Referrer-Policy` и `Permissions-Policy` — Traefik (`secure-headers@file`). Список со
  значениями — `infra-handoff.md § 1.3`; приложение заголовков edge не ставит (держит HTTP-набор)

## Требования к прокси (чек-лист оператора)

- **Rate-limit на `/api/contact` — обязателен до того, как форма открыта наружу.** Это
  публичный POST-эндпоинт, и одна принятая заявка = одно письмо (или один запрос в бэкенд):
  без ограничителя один бот превращает форму в рассылку. Ставится на Traefik, в приложении
  счётчика нет — он не переживает рестарт и не виден второй реплике. Значения — пример,
  а не догма: middleware `rateLimit` с `average: 10`, `period: 1m`, `burst: 5` на роутер
  этого пути. `sourceCriterion` не задаётся: прокси стоит на границе, и источником по
  умолчанию считается адрес клиента — `ipStrategy.depth` заставил бы читать клиентский
  `X-Forwarded-For`, который никем не подписан
- Роутер сайта — строго `Host(<домен>)`, методы `GET` и `HEAD`; `POST` — только `/api/contact`,
  порт контейнера наружу не публикуется. Origin-check формы — антиспам, а не граница CSRF: он
  доверяет и origin из `Host` запроса, и чужой `Host` с тем же `Origin` до процесса не доходит
  только благодаря Host-роутингу. `X-Forwarded-*` приложение не читает: TLS терминируется
  снаружи, процесс видит запрос как `http://<Host>`, поэтому канонический origin — только
  `SITE_URL`, а origin заявки сверяет с ним `features/contact-form` (`security.checkOrigin` Astro
  выключен — он отвечал бы 403 на любой POST формы из браузера)
- `/_image` закрыт и на edge (роутер на `Path(/_image)` и `PathPrefix(/_image/)` с отказом —
  `public/_images/…` он не задевает): приложение отвечает 404, но трансформация картинок на
  запрос не должна доходить до процесса
- Тело формы прокси ограничивает буферизацией (64 КБ): приложение отвечает `413` на
  `Content-Length` больше 64 КБ и не читает такое тело, но тело без длины (`Transfer-Encoding:
  chunked`) читает до `bodySizeLimit` адаптера (1 МБ, дальше — `400`) — 64 КБ для него держит
  только прокси
- Staging закрывается и там: `basicAuth` + `customResponseHeaders: X-Robots-Tag` — независимо
  от `ROBOTS_POLICY` контейнера; `redirectRegex` для `<путь>/index.html`,
  `www` → apex и `http` → `https`, `compress`, `secure-headers@file`

Готовый `compose/site.yml`, роутеры и middleware Traefik, CrowdSec и приёмка первого
деплоя — [`infra-handoff.md`](./infra-handoff.md): рабочее задание для сессии в `<org>/infra`.

## `/healthz`

Liveness без зависимостей: `200 ok`, `Cache-Control: no-store`, версия не раскрывается.
Его же ждёт `HEALTHCHECK` образа и `webServer.url` Playwright.

## Локально как в контейнере

```bash
pnpm build
DIST_DIR=dist SITE_URL=http://localhost:3000 sh docker/entrypoint.sh pnpm start
```

## Release handoff

CI-runner'а в экосистеме нет: сборку, приёмку (`pnpm accept:image`), тег и пуш образа делает
разработчик по `/release` (`.claude/skills/release/SKILL.md`). Выкатку выполняет `<org>/infra` —
`make bump SVC=site TAG=vX.Y.Z` (правит `SITE_TAG` в `.env` VPS + force-recreate); отсюда
деплой-команды не запускаются.
