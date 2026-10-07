# Infra-handoff

Рабочее задание для сессий в соседних репозиториях экосистемы. Этот репозиторий
останавливается на image-in-registry: он собирает и пушит образ сайта, а разворачивает
сервис `<org>/infra` — форк `project-infra-template-compose`. Здесь — контракт, который
инфра обязана выполнить, чтобы образ поехал.

Документ самодостаточен: агенту или человеку в другом репо читать этот репозиторий не
нужно. Ссылки вида `docs/reference/*.md` ведут сюда, в `<org>/site` (форк
`ssr-frontend-template`), и нужны только за подробностями.

В развёрнутом проекте живёт раздел 1 — это и есть задание для его `<org>/infra`;
разделы 2–3 касаются канонических шаблонов экосистемы и проекту не нужны.

## Сервис `site` одним экраном

- **Образ**: `node:24-alpine`, один Node-процесс, `USER node` (uid 1000), `EXPOSE 3000`,
  собственный `HEALTHCHECK` на `/healthz`. `ENTRYPOINT /app/docker/entrypoint.sh`,
  `CMD node ./docker/server.mjs`. Registry-путь — `<registry>/<org>/site:vX.Y.Z`,
  `:latest`/`:edge` не выпускаются.
- **Static-first**: HTML контентных страниц собран на сборке и лежит в `/app/dist/client`;
  его отдаёт статик-хендлер Node-адаптера со своими заголовками (`public, max-age=0` +
  `ETag`), **не доходя до кода приложения**. Рендер на запрос — только у служебных
  маршрутов: `404`, `/healthz`, `/now`, `/robots.txt`, `/sitemap.xml`, `/rss.xml`,
  `/en/rss.xml`, `/<INDEXNOW_KEY>.txt`, `POST /api/contact`. Endpoint изображений Astro
  `/_image` не обслуживается (404): картинки оптимизирует сборка.
- **Один образ на все среды.** Сборка печёт в абсолютные URL плейсхолдер
  `https://__site_origin__`; при старте контейнера entrypoint заменяет его на `SITE_URL`
  в `/app/dist/client/**/*.{html,xml,txt}`, сохраняя mtime файлов (`Last-Modified` и ETag не
  меняются от рестарта). Контейнер завершается с кодом 1, если любой ключ env вне формата
  (строка лога называет ключ), `SITE_URL` пуст, не origin вида `https://example.com`, равен
  плейсхолдеру, выход сборки в `/app/dist/client` пуст или не записывается, или плейсхолдер
  остался в каком-то файле после штамповки.
- **Приложение не сжимает ответы; из заголовков безопасности ставит только
  `Content-Security-Policy`** — у каждой страницы, с `frame-ancestors 'none'`. Сжатие и остальные
  заголовки — Traefik; кто что ставит — один список в 1.3.
  В staging (`ROBOTS_POLICY=noindex`) `X-Robots-Tag: noindex, nofollow` на каждом ответе —
  и prerendered-страниц со статикой, которые отдаёт статик-хендлер до middleware, — ставит
  обёртка процесса. Замок staging (`basicAuth`) — только на Traefik.
- **Публичный `POST /api/contact`**: форма обратной связи работает без JavaScript, одна
  принятая заявка = одно письмо (или один запрос во внутренний сервис). Ограничителя
  частоты в приложении нет by design — счётчик в процессе не переживает рестарт и не
  виден второй реплике.
- **Логи**: одна JSON-строка в stdout на каждый on-demand ответ (`ts, lvl, method, path,
  status, dur_ms, rid`), без IP, cookie, query и тел запросов. `X-Request-Id` принимается
  от прокси или генерируется и возвращается в ответе — по нему сшиваются access-log
  Traefik, лог приложения и событие Sentry.
- **Дренаж**: `SIGTERM` → сервер перестаёт принимать соединения и добивает запросы в
  полёте, потолок — `SHUTDOWN_TIMEOUT_MS` (дефолт 15 000 мс). Без трафика `docker stop`
  укладывается в доли секунды.

## Порядок сессий

| # | репозиторий | что делается | зачем в этом порядке |
|---|---|---|---|
| 1 | `project-infra-template-compose` | `compose/site.yml`, edge, дефекты, скрипты, правила, доки, скиллы | без неё первый деплой невозможен |
| 2 | `spa-frontend-template` | соседство, `infra-svc`, починка команды сборки в `/release` | косметика + один реальный баг |
| 3 | `stit-public` | витрина: README, `docs/roadmap.md`, `docs/templates.md` | публичный слой — последним, по факту |

---

## 1. `project-infra-template-compose`

Основная работа. Всё ниже — по файлам этого репозитория.

### 1.1 `compose/site.yml` — новый файл

Контракт полей (отклонение от любого пункта ломает сервис или SEO):

- **`image`** — `${REGISTRY_HOST:-git.stit.tech}/${PROJECT_NAME}/site:${SITE_TAG}`; тег
  живёт строго в `.env` (`SITE_TAG`), бамп — `make bump SVC=site TAG=vX.Y.Z`.
- **`profiles: [site]`** — сервис opt-in, как `backend`: без опубликованного образа
  `compose up --wait` упал бы на pull'е.
- **Никакого `read_only: true` и тома на `/app/dist/client`.** Штамповка origin перезаписывает
  выход сборки, который живёт в образе. Пустой bind или tmpfs на этом пути — отказ старта
  (`index.html` нет), именованный том после `make bump` отдал бы файлы прошлого релиза, запись
  без прав — отказ со строкой `[entrypoint] cannot stamp …`.
- **`init: true`** — reaper PID-1; обёртка сервера свои сигналы обрабатывает сама.
- **`stop_grace_period: 20s`** — строго больше `SHUTDOWN_TIMEOUT_MS` контейнера
  (дефолт 15 000 мс) с запасом на закрытие сокетов. Меньше — `SIGKILL` на середине
  дренажа. Меняется `SHUTDOWN_TIMEOUT_MS` — меняется и это поле.
- **`mem_limit: 512m` + `NODE_OPTIONS=--max-old-space-size=384`** (≈ 75 % лимита).
  Пара обязана быть согласованной: без `NODE_OPTIONS` GC узнаёт о потолке слишком
  поздно и процесс ловит OOM-kill вместо сборки мусора. `cpus: 1.0`. Картинки
  оптимизируются на сборке, поэтому рантайму хватает этого профиля; 768 МБ нужны
  только если проект включает рендер на запрос с кешем процесса.
- **`deploy.resources` не использовать** (в non-swarm применяется ненадёжно),
  `replicas` несовместимы с `container_name` — масштабирование вертикальное.
- **`networks: [proxy]`**; `backend-net` добавляется, только если заявки с формы уезжают
  во внутренний сервис (`FORM_DELIVERY=backend`). `depends_on` на backend не ставится:
  падение бэкенда не должно мешать сайту подняться и отдать страницы.
- **`healthcheck`** на `/healthz` — контейнерный (у образа свой, compose-уровневый нужен
  правилу `compose-and-services`) и **Traefik-side** на сервисе: docker-healthcheck
  Traefik не читает, и без собственной проверки он при force-recreate отправит трафик в
  ещё не слушающий процесс.
- **`user:` не задавать** — образ уже не root; чужой uid сломает штамповку (файлы
  `dist/` принадлежат `node`).
- **`logging:` не задавать** — ротация json-file (10 МБ × 3) уже настроена на хосте
  ролью `ansible/roles/docker`. Регулятор объёма — `LOG_LEVEL`.

```yaml
services:
  site:
    image: ${REGISTRY_HOST:-git.stit.tech}/${PROJECT_NAME}/site:${SITE_TAG}
    container_name: site
    restart: unless-stopped
    profiles: [site]

    # read_only НЕ ставим: entrypoint штампует SITE_URL в /app/dist/client при старте.
    init: true
    # SHUTDOWN_TIMEOUT_MS образа — 15 с; grace period обязан быть больше.
    stop_grace_period: 20s

    environment:
      # Канонический origin: без него контейнер не стартует. Без хвостового слеша.
      SITE_URL: https://${DOMAIN}
      ROBOTS_POLICY: ${ROBOTS_POLICY:-index}
      RELEASE: ${SITE_TAG}
      LOG_LEVEL: ${SITE_LOG_LEVEL:-info}
      NODE_OPTIONS: --max-old-space-size=384
      INDEXNOW_KEY: ${SITE_INDEXNOW_KEY:-}
      AI_TRAINING: ${SITE_AI_TRAINING:-allow}
      FORM_DELIVERY: ${SITE_FORM_DELIVERY:-smtp}
      SMTP_URL: ${SITE_SMTP_URL:-}
      FORM_TO: ${SITE_FORM_TO:-}
      FORM_FROM: ${SITE_FORM_FROM:-}
      FORM_BACKEND_URL: ${SITE_FORM_BACKEND_URL:-}
      SENTRY_DSN: ${SITE_SENTRY_DSN:-}
      SENTRY_ENVIRONMENT: ${ENV}

    mem_limit: 512m
    cpus: 1.0

    networks: [proxy]

    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 15s

    labels:
      traefik.enable: "true"
      traefik.docker.network: proxy

      # Корневой домен — задокументированное исключение из сабдоменного канона.
      # Заглушку на корне перебивает приоритетом (у неё priority=1).
      # Только GET и HEAD: статик-хендлер отдаёт файл на любой метод, а POST у сайта один — форма.
      traefik.http.routers.site.rule: Host(`${DOMAIN}`) && (Method(`GET`) || Method(`HEAD`))
      traefik.http.routers.site.entrypoints: websecure
      traefik.http.routers.site.tls: "true"
      traefik.http.routers.site.tls.certresolver: letsencrypt
      traefik.http.routers.site.middlewares: crowdsec@file,rate-limit@file,secure-headers@file,strip-index-html@file,compress@file,retry@file${SITE_EDGE_EXTRA_MW:-}

      # Публичный POST формы: свой лимит частоты и лимит тела.
      traefik.http.routers.site-form.rule: Host(`${DOMAIN}`) && Path(`/api/contact`) && Method(`POST`)
      traefik.http.routers.site-form.priority: "100"
      traefik.http.routers.site-form.entrypoints: websecure
      traefik.http.routers.site-form.tls: "true"
      traefik.http.routers.site-form.tls.certresolver: letsencrypt
      traefik.http.routers.site-form.middlewares: crowdsec@file,form-rate-limit@file,form-body-limit@file,secure-headers@file${SITE_EDGE_EXTRA_MW:-}
      traefik.http.routers.site-form.service: site

      # /_image — endpoint изображений Astro: приложение отвечает 404 (картинки готовит сборка),
      # а запрос на трансформацию не должен доходить до процесса — sharp на запрос это CPU и RAM.
      # Маршрут и его подпути, а не префикс имени: public/_images/… сайта правило не задевает.
      traefik.http.routers.site-image.rule: Host(`${DOMAIN}`) && (Path(`/_image`) || PathPrefix(`/_image/`))
      traefik.http.routers.site-image.priority: "100"
      traefik.http.routers.site-image.entrypoints: websecure
      traefik.http.routers.site-image.tls: "true"
      traefik.http.routers.site-image.tls.certresolver: letsencrypt
      traefik.http.routers.site-image.middlewares: crowdsec@file,deny-all@file
      traefik.http.routers.site-image.service: site

      # www → apex одним 301, отдельным роутером: regexp не гоняется на apex-запросах.
      traefik.http.routers.site-www.rule: Host(`www.${DOMAIN}`)
      traefik.http.routers.site-www.entrypoints: websecure
      traefik.http.routers.site-www.tls: "true"
      traefik.http.routers.site-www.tls.certresolver: letsencrypt
      traefik.http.routers.site-www.middlewares: crowdsec@file,www-to-apex@file
      traefik.http.routers.site-www.service: site

      traefik.http.services.site.loadbalancer.server.port: "3000"
      # Traefik не читает docker healthcheck — свой нужен, чтобы при force-recreate
      # трафик не уходил в ещё не слушающий процесс.
      traefik.http.services.site.loadbalancer.healthcheck.path: /healthz
      traefik.http.services.site.loadbalancer.healthcheck.interval: 5s
      traefik.http.services.site.loadbalancer.healthcheck.timeout: 2s
```

### 1.2 Env-контракт

Полная таблица ключей с дефолтами и колонкой «попадает в HTML?» — `docs/reference/deployment.md
§ Env-контракт` в `<org>/site`. Для compose важно следующее.

| ключ `.env` VPS | env контейнера | значение | обязателен |
|---|---|---|---|
| `SITE_TAG` | `RELEASE` | тег образа, он же версия в логах и Sentry | да |
| — | `SITE_URL` | `https://${DOMAIN}` — канонический origin, **без хвостового слеша** | да |
| `ROBOTS_POLICY` | то же | `index` на проде, `noindex` на любой не-прод среде | да |
| `SITE_LOG_LEVEL` | `LOG_LEVEL` | `debug \| info \| warn \| error`, дефолт `info` | нет |
| `SITE_SENTRY_DSN` | `SENTRY_DSN` | пусто — SDK не грузится вовсе; DSN public by design | нет |
| `ENV` | `SENTRY_ENVIRONMENT` | слаг среды | нет |
| `SITE_INDEXNOW_KEY` | `INDEXNOW_KEY` | 8–128 символов `a-zA-Z0-9-`; подтверждается файлом `/<ключ>.txt` | нет |
| `SITE_AI_TRAINING` | `AI_TRAINING` | `allow \| deny` — обучающие AI-краулеры в `robots.txt` | нет |
| `SITE_FORM_DELIVERY` | `FORM_DELIVERY` | `smtp \| backend` — один канал доставки заявки | нет |
| `SITE_SMTP_URL` | `SMTP_URL` | `smtps://user:pass@host` — **секрет** | при `smtp` |
| `SITE_FORM_TO` / `SITE_FORM_FROM` | `FORM_TO` / `FORM_FROM` | адреса письма с заявкой | при `smtp` |
| `SITE_FORM_BACKEND_URL` | `FORM_BACKEND_URL` | адрес внутреннего приёмника заявки | при `backend` |

Из образа уже приходят `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000` — в compose их
не дублируем. `KEEP_ALIVE_TIMEOUT_MS` (65 000) и `SHUTDOWN_TIMEOUT_MS` (15 000) заданы
дефолтами обёртки сервера; переопределяются только вместе с `stop_grace_period` и
idle-таймаутом прокси. Пустое значение любого ключа равносильно незаданному; значение вне
формата — отказ старта с именем ключа в логе, а не полуживой контейнер. Имя ключа с опечаткой
(`ROBOT_POLICY`) контейнер не узнаёт: для него ключ не задан и получает дефолт — поэтому
staging закрывают и контуры Traefik (1.3).

Каждый новый `${VAR}` обязан быть задекларирован в `.env.example` (активной или
закомментированной строкой с комментарием «как получить») — `make validate` грепает
`compose/`, `configs/`, `docker-compose.yml` и краснеет на пропуск.

**Смена `SITE_URL` требует пересоздания контейнера**: origin штампуется в файлы при
старте, у уже проштампованного контейнера плейсхолдера больше нет и заменять нечего.
`make recreate SVC=site` (или `make bump`) создаёт контейнер заново — `make restart`
оставит старый origin в разметке.

### 1.3 `configs/traefik/dynamic/middlewares.yml.tpl` — дельта

**Заголовки безопасности — один список.** Каждый ставит ровно один участник, второй его не
дублирует (HTTP-набор сайта держит, что приложение ставит из них только CSP):

| заголовок | ставит | значение |
|---|---|---|
| `Content-Security-Policy` | приложение — у каждой страницы, prerendered и on-demand | `default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; script-src` и `style-src` — свои файлы и хеши инлайна сборки |
| `Strict-Transport-Security` | Traefik, `secure-headers` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | Traefik, `secure-headers` | `nosniff` |
| `Referrer-Policy` | Traefik, `secure-headers` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Traefik, `secure-headers` | `camera=(), microphone=(), geolocation=()` |

Не ставит никто: `X-Frame-Options` — встраивание во фрейм закрывает `frame-ancestors 'none'`
CSP приложения; `X-XSS-Protection` — фильтра в современных браузерах нет, а в старых он сам
давал утечки. Поэтому из `secure-headers` снимаются `browserXssFilter` и `sslRedirect` (в Traefik v3
его нет, `http → https` делает redirection на entrypoint `web`), `frameDeny` не добавляется:

```yaml
    secure-headers:
      headers:
        forceSTSHeader: true
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        contentTypeNosniff: true
        referrerPolicy: "strict-origin-when-cross-origin"
        # Сервису проекта, которому нужны камера или геолокация, — свой middleware, а не
        # послабление здесь.
        permissionsPolicy: "camera=(), microphone=(), geolocation=()"
```

`crowdsec` и `rate-limit` остаются как есть. Новые middleware:

```yaml
    compress:
      compress:
        # zstd не включаем: выигрыша над br на HTML нет, а зоопарк кодировок дороже.
        encodings: [br, gzip]
        minResponseBodyBytes: 1024

    www-to-apex:
      redirectRegex:
        # ${1} переживает envsubst: это не валидный идентификатор.
        regex: "^https?://www\\.${DOMAIN}/(.*)"
        replacement: "https://${DOMAIN}/${1}"
        permanent: true

    # Дубль каждой страницы: <путь>/index.html отдаётся 200 тем же HTML, но без CSP приложения.
    strip-index-html:
      redirectRegex:
        regex: "^https?://([^/]+)(/.*)?/index\\.html$"
        replacement: "https://${1}${2}"
        permanent: true

    # Публичный POST формы: одна заявка = одно письмо.
    form-rate-limit:
      rateLimit:
        average: 10
        period: 1m
        burst: 5

    form-body-limit:
      buffering:
        # Приложение отвечает 413 на Content-Length выше 64 КиБ; тело без длины (chunked) оно
        # читает до лимита адаптера (1 МиБ) — 64 КиБ для него держит только эта буферизация.
        maxRequestBodyBytes: 65536
        memRequestBodyBytes: 65536

    retry:
      retry:
        attempts: 2
        initialInterval: 100ms

    # Путь без внешнего доступа (/_image): 403 на edge, до процесса.
    deny-all:
      ipAllowList:
        sourceRange: ["127.0.0.1/32"]

    # Не-прод контур: подключается через SITE_EDGE_EXTRA_MW в .env среды.
    staging-auth:
      basicAuth:
        # usersFile, а не users: в dynamic-файле нет удвоения `$`.
        usersFile: /etc/traefik/dynamic/staging.htpasswd
        realm: "staging"

    staging-noindex:
      headers:
        customResponseHeaders:
          X-Robots-Tag: "noindex, nofollow, noarchive"
```

Требования, которые легко потерять:

- **`sourceCriterion` у лимитов не задавать.** Traefik стоит на границе, поэтому по
  умолчанию источником считается TCP-адрес клиента — это верно. `ipStrategy.depth`
  заставил бы читать клиентский `X-Forwarded-For`, который на границе никем не подписан:
  лимит обходится подделкой заголовка. Глубина появляется только вместе с доверенным
  CDN/прокси перед Traefik.
- **Роутер сайта — строго `Host(${DOMAIN})`, `Host` доходит до сервиса как есть
  (`passHostHeader` по умолчанию), порт контейнера наружу не публикуется.** Origin-check формы —
  антиспам-ступень, а не граница CSRF: кроме `SITE_URL` он доверяет origin, собранному из `Host`
  запроса (прямое обращение к контейнеру), и запрос с чужим `Host` и тем же `Origin` прошёл бы.
  Такой запрос до сервиса не доходит только благодаря Host-роутингу edge; catch-all роутер или
  опубликованный порт эту защиту снимают. `X-Forwarded-*` приложение не читает: схему и origin
  оно берёт из `SITE_URL`.
- **Методы — `GET` и `HEAD` на `site`, `POST` — только `site-form`.** Статик-хендлер адаптера
  отдаёт файл на любой метод (`POST /` — 200 со страницей), а `TRACE` — 500 с ошибкой в логе.
- **429, а не 403, для избыточного трафика.** Лимит частоты Traefik отдаёт 429 — это
  сигнал «замедлись», который краулер понимает. Бан (403) для поискового робота —
  выпадение из индекса, поэтому верифицированные боты не должны доходить до WAF-решения
  (см. 1.5).
- **Порядок цепочки**: `crowdsec` (дешёвый отказ) → лимит → `secure-headers` →
  `strip-index-html` (редирект не нужно сжимать) → `compress` → `retry`.
- **`retry` — только на `site`, не на `site-form`**: он добивает единичные гонки при
  force-recreate, но повтор уже отправленного POST — это вторая заявка.
- **`compress` — не для POST формы**: в цепочке `site-form` его нет, он там бесполезен.

Staging-контур включается не отдельным файлом, а переменной среды: в `.env` не-прод VPS
`SITE_EDGE_EXTRA_MW=,staging-auth@file,staging-noindex@file` (ведущая запятая обязательна)
и `ROBOTS_POLICY=noindex`. На проде переменная пустая.

Файл замка — `configs/traefik/dynamic/staging.htpasswd.tpl` с одной строкой
`${STAGING_BASIC_AUTH_USERS}`; его рендерит `scripts/render-configs.sh` вместе с
остальными `.tpl`. Две ловушки самого значения:

- в `.env` оно пишется **в одинарных кавычках** — скрипт рендера делает `. ./.env`, и
  незакавыченные `$` развернёт шелл;
- хеши — **bcrypt** (`$2y$…`). `envsubst` не трогает `$2y` (имя не может начинаться с
  цифры), а вот `$apr1$…` он съест как переменную `apr1`.

### 1.4 `configs/traefik/traefik.yml.tpl` — access-log

```yaml
accessLog:
  filePath: /var/log/traefik/access.log
  format: json
  fields:
    headers:
      names:
        X-Request-Id: keep
  filters:
    # Фильтр по статусам снимается целиком: 2xx нужны и аналитике краулеров,
    # и сценариям CrowdSec (http-crawl-non_statics).
    minDuration: 0s
```

Почему это важно именно для сайта: prerendered-страницы отдаёт статик-хендлер адаптера, и
в логе приложения их нет вовсе. Полная картина трафика — только в access-log Traefik.
`X-Request-Id: keep` сшивает его со строкой лога приложения.

### 1.5 CrowdSec

- **Починить acquisition** — сейчас `configs/crowdsec/acquis.yaml` читает
  `/var/log/traefik/*.log`, а Traefik пишет access-log в stdout: источник пустой, вся
  остальная настройка декоративна. Два варианта:
  - **A (файл)**: `filePath` из 1.4 + named volume `traefik-logs` в `docker-compose.yml`,
    `traefik-logs:/var/log/traefik` в `compose/traefik.yml` и `:ro` в
    `compose/crowdsec.yml`. Ближе к текущему устройству; помнить, что файл внутри volume
    не попадает под ротацию docker-демона — нужен logrotate на хосте.
  - **B (docker-источник)**: `source: docker`, `container_name: [traefik]`,
    `labels: {type: traefik}` в `acquis.yaml` + `/var/run/docker.sock:ro` в
    `compose/crowdsec.yml`. Файла и ротации нет вовсе, цена — сокет у ещё одного
    контейнера.
- **Whitelist поисковиков** — в `compose/crowdsec.yml`:
  `POSTOVERFLOWS: "crowdsecurity/rdns crowdsecurity/seo-bots-whitelist"` рядом с
  существующим `COLLECTIONS`. Без `rdns` whitelist не на чем работать.
- **Локальная страховка** (опционально, если хаб-данные отстают) —
  `configs/crowdsec/postoverflows/seo-bots-local.yaml`: whitelist по
  forward-confirmed rDNS (`.googlebot.com.`, `.google.com.`, `.yandex.ru.`,
  `.yandex.net.`, `.yandex.com.`, `.search.msn.com.`). **Whitelist по User-Agent не
  делать** — UA подделывается.
- **AI-краулеры — продуктовое решение, а не гигиена.** `ClaudeBot`, `GPTBot`, `CCBot`,
  `meta-externalagent` — источник трафика из ответов LLM; на индексируемом сайте они
  управляются `AI_TRAINING` в `robots.txt` сервиса, а не баном на edge.

### 1.6 Остальные файлы репозитория

| файл | что сделать |
|---|---|
| `.env.example` | секция `# ───── profile site (индексируемый сайт) ─────`: `SITE_TAG`, `ROBOTS_POLICY`, `SITE_LOG_LEVEL`, `SITE_SENTRY_DSN`, `SITE_INDEXNOW_KEY`, `SITE_AI_TRAINING`, `SITE_FORM_DELIVERY`, `SITE_SMTP_URL`, `SITE_FORM_TO`, `SITE_FORM_FROM`, `SITE_FORM_BACKEND_URL`, `SITE_EDGE_EXTRA_MW`, `STAGING_BASIC_AUTH_USERS` — у каждой комментарий «как получить», иначе `make validate` красный; в подсказке `COMPOSE_PROFILES` появляется `site` |
| `Makefile` → `bump` | `up -d --no-deps --force-recreate` получает `--wait --wait-timeout 90`: без него верб «успешен» и на битом образе |
| `scripts/deploy.sh` → `ROLE_FILES[edge]` | дописать `compose/site.yml` (список ролей перечислен явно, glob только у `all`) |
| `scripts/preflight-dns.sh` | при активном профиле `site` добавить в `hosts` `www.$DOMAIN` — иначе LE-сертификат на www молча не выпустится, а роутер `site-www` есть |
| `scripts/tools/smoke.d/90-site.sh` | **новый** drop-in (контракт — в шапке `scripts/tools/smoke-run.sh`): блок `-- site --`, read-only, self `exit 0`, проблема — строкой `ATTENTION:` в колонке 0. Проверяет: liveness `docker exec site wget -qO- http://127.0.0.1:3000/healthz`; `/` — 200 и TTFB (на не-прод ожидается 401 — замок стоит); `/robots.txt` — на проде без `Disallow: /` и с абсолютным `Sitemap:`, на не-прод `Disallow: /`; `/sitemap.xml` — непустой список `<loc>`, все URL на своём домене и по https; `X-Robots-Tag: noindex` — на не-прод есть, на проде нет |
| `compose/landing.yml` | заглушка на корне остаётся до первого разворота сайта: она держит выпуск LE-сертификата на `${DOMAIN}`. После разворота `compose/landing.yml` + `configs/landing/` удаляются (сам роутер сайта её и так перебивает приоритетом) |
| `.claude/rules/traefik-routing.md` | раздел «Корневой домен и www»: корень — задокументированное исключение из сабдоменного канона; www — отдельный роутер с `redirectRegex`; `${1}` переживает envsubst; в цепочке публичного сайта, в отличие от API, есть `compress`; в таблице chain'ов `secure-headers@file` — HSTS, nosniff, `Referrer-Policy`, `Permissions-Policy` (камера, микрофон и геолокация закрыты), без XSS-filter: состав из 1.3, он общий для всех публичных роутеров |
| `.claude/rules/compose-and-services.md` | абзац «Node-сервисы с рендером»: `init: true`; `read_only` **несовместим** со штамповкой origin; `stop_grace_period` ↔ `SHUTDOWN_TIMEOUT_MS`; `mem_limit` ↔ `NODE_OPTIONS --max-old-space-size` (≈ 75 %); `deploy.resources` не использовать; `replicas` несовместимы с `container_name` |
| `docs/reference/architecture.md` | `site` переезжает из «Что НЕ в шаблоне (overlay-services)» в основную схему слоёв (корень `${DOMAIN}`, рядом с backend на `api.`); в таблице ролей multi-host у `edge` появляется `site` |
| `docs/project/README.md` § «Generates → инфра» | строка для `frontend` (`hosting: here`): индексируемый сайт → профиль `site` → `compose/site.yml`; текущая формулировка «— (always-on landing)» верна только для статической заглушки |
| `docs/project/_templates/service.md` | в подсказках `Hosting`/`Route` — вариант Node-сервиса на корневом домене: профиль `site`, порт 3000, healthcheck `/healthz`, www-редирект |
| `.claude/skills/add-service/SKILL.md` | вариант «Node-сервис на корневом домене»: два роутера (apex + www), Traefik-side healthcheck на сервисе, `init: true`, запрет `read_only`, обязательный env (`SITE_URL`), лимит частоты на публичный POST; публичный сервис, которому нужны камера, микрофон или геолокация (видеосвязь, карта «рядом со мной»), получает свой headers-middleware вместо `secure-headers@file` — с тем же составом и своим `permissionsPolicy`, а не послабление общего: иначе браузер молча отвечает `NotAllowedError`, в логах ничего |
| `.claude/skills/de-template/SKILL.md` | в списке always-on (`traefik`, `crowdsec`, `landing`) оговорить: при сайте на корне `landing` прунится вместе с `configs/landing/` |

### 1.7 Приёмка первого деплоя

1. `make validate` зелёный, `make ship MSG="feat(site): add site service"` → на VPS
   `make deploy`.
2. `.env` VPS: `COMPOSE_PROFILES` содержит `site`, `SITE_TAG` заполнен, секреты канала
   доставки заполнены. Затем `make bump SVC=site TAG=vX.Y.Z`.
3. `make ps` — `site` healthy; `make logs SVC=site` — строка
   `[entrypoint] stamped https://__site_origin__ -> https://<domain> in /app/dist/client`
   и ни одной ошибки.
4. curl по живому домену:

```bash
curl -sI  https://<domain>/                    # 200, без X-Robots-Tag: noindex
curl -s   https://<domain>/robots.txt          # ожидаемая политика, абсолютный Sitemap:, без Disallow: /
curl -s   https://<domain>/sitemap.xml | grep -c '<loc>'   # ожидаемое число, все URL — https и свой домен
curl -sI  https://<domain>/net-takogo          # 404 (не 200 и не редирект на главную)
curl -sI  http://<domain>/                     # ровно один 301/308 на https
curl -sI  https://www.<domain>/                # ровно один 301 на apex
curl -sI  https://<domain>/index.html          # 301 на /
curl -sI  https://<domain>/about/index.html    # 301 на /about — дубль любой страницы, без CSP
curl -sI  https://<domain>/<любая-страница>/   # 301 без слеша (хвостовой слеш срезается)
curl -sI  https://<domain>/healthz             # 200, Cache-Control: no-store
curl -sI 'https://<domain>/_image?href=/og-default.png&f=webp'   # 403 на edge (без него — 404 приложения)
curl -s   https://<domain>/ | grep -c __site_origin__      # 0 — плейсхолдер проштампован
```

5. Заголовки — по списку 1.3: от edge `Strict-Transport-Security`, `X-Content-Type-Options:
   nosniff`, `Referrer-Policy`, `Permissions-Policy`; от приложения `Content-Security-Policy` с
   `frame-ancestors 'none'`; `X-Frame-Options` и `X-XSS-Protection` нет; `Content-Encoding: br`
   на HTML; `curl -X POST https://<domain>/` и `curl -X TRACE https://<domain>/` — не 200.
6. CrowdSec: `cscli decisions list` — верифицированные боты не забанены;
   `cscli metrics` показывает непустой источник acquisition.
7. Лимит формы: серия POST на `/api/contact` упирается в **429**, а не в 403 и не в
   принятую заявку.
8. На не-прод VPS: `/` отвечает 401 (basicAuth), в ответе `X-Robots-Tag: noindex,
   nofollow, noarchive`, `robots.txt` = `Disallow: /`.
9. Дренаж: `docker stop site` укладывается в `stop_grace_period` без `SIGKILL`.
10. В `<org>/site`: `/seo-audit` по прод-домену — чистый. Он же гоняет полный набор
    проверок выдачи и печатает, что чинить.

---

## 2. `spa-frontend-template`

- `docs/reference/ecosystem.md` — счёт форкаемых шаблонов; в sibling-дереве появляется
  `site/ ← ssr-frontend-template`; абзац «когда SPA, когда сайт»: страницы под поиск —
  сайт, всё за логином — SPA, проект может держать оба (сайт на корне, приложение на
  `app.${DOMAIN}`). Симметричный текст — в `docs/reference/ecosystem.md § Где этот
  шаблон` репозитория `<org>/site`.
- `README.md` — строка-указатель на шаблон индексируемого сайта (в SSR-шаблоне такая же
  строка указывает обратно).
- `docs/stack/_templates/service.md` — бэкпорт поля `infra-svc` в таблицу «Идентичность»
  (`infra-svc: frontend` — по нему `/release` печатает `make bump SVC=frontend TAG=`);
  образец — одноимённый файл в `<org>/site`.
- `.claude/skills/release/SKILL.md` — **баг команды сборки**: `docker buildx build -t
  <registry>/<org>/frontend:vX.Y.Z --push .` не находит Dockerfile (он в `docker/`, в
  корне его нет) и не передаёт секрет `npmrc`, который монтирует `docker/Dockerfile`
  (`--mount=type=secret,id=npmrc`). Форма как у `/release` этого репо:

  ```bash
  docker buildx build -f docker/Dockerfile --secret id=npmrc,src="$HOME/.npmrc" \
    -t <registry>/<org>/frontend:vX.Y.Z --push .
  ```

## 3. `stit-public`

- `README.md` — таблица форкаемых шаблонов: добавить `ssr-frontend-template`
  (индексируемый сайт: Astro · Node · FSD · SEO-гейт, статус «готов») и
  `telegram-bot-template`; счётчик шаблонов в заголовке пересобрать. Колонки «Стек»
  сверить с реальностью репозиториев: у проектной инфры — Traefik · CrowdSec · Postgres
  · MinIO · restic.
- `docs/roadmap.md` — `ssr-frontend-template` переезжает в «Готово»;
  `landing-template` из плана снимается: лендинг — тот же шаблон сайта, из которого
  `/de-template` вычищает лишнее (отдельной механики пресетов нет).
- `docs/templates.md` — раздел про шаблон индексируемого сайта (роль, стек, когда брать,
  граница с SPA); имя `project-docs-template` заменяется на
  `business-strategy-template` здесь и в `docs/getting-started.md`.
- Ссылки на репозиторий: `git.stit.tech/stit-core/ssr-frontend-template`.

---

## Требует решения владельца

| вопрос | варианты | что предлагает этот контракт |
|---|---|---|
| Источник CrowdSec acquisition | A — файл access-log в общем volume; B — docker-источник через сокет | B проще в эксплуатации (нет файла и ротации), A — меньше прав у контейнера |
| Включение staging-контура | переменная `SITE_EDGE_EXTRA_MW` в `.env` среды; отдельный compose-оверрайд | переменная: не плодит файлов и проходит `make validate` |
| Судьба заглушки на корне | прунить `compose/landing.yml` при развороте сайта; переименовать сервис в `placeholder`, чтобы имя не путали с продуктовым лендингом | прунить; переименование трогает скрипты и доки инфры |
| Профиль памяти `site` | 512 МБ / `--max-old-space-size=384`; 768 МБ / 576 при рендере с кешем процесса | 512 МБ: картинки оптимизируются на сборке, рантайм отдаёт готовый HTML |
