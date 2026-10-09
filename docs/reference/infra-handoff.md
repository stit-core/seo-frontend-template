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

- **Образ**: `node:24-alpine` (мажор Node — аргумент сборки), один Node-процесс, `USER node` (uid
  1000), `EXPOSE 3000`, собственный `HEALTHCHECK` на `/healthz`. `ENTRYPOINT /app/docker/entrypoint.sh`,
  `CMD node ./docker/server.mjs`. Registry-путь — `<registry>/<org>/site:vX.Y.Z`,
  `:latest`/`:edge` не выпускаются.
- **Static-first**: HTML контентных страниц собран на сборке и лежит в `/app/dist/client`;
  его отдаёт статик-хендлер Node-адаптера со своими заголовками (`public, max-age=0` +
  `ETag`), **не доходя до кода приложения**; так же, файлами сборки, отдаются `/sitemap.xml` и
  фиды `/rss.xml`, `/en/rss.xml`. Рендер на запрос — только у служебных маршрутов: `404`,
  `/healthz`, `/now`, `/robots.txt`, `/<INDEXNOW_KEY>.txt`, `POST /api/contact`. Endpoint изображений Astro
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
  обёртка процесса; без него уходит только отказ самого Node на битый запрос (400, 408, 413,
  417, 431). Замок staging (`basicAuth`) — только на Traefik.
- **Ботам — тот же ответ, что человеку.** Приложение не ветвится по `User-Agent`: поисковый робот
  и ИИ-бот получают те же 200 и тот же HTML. Кого пускать, решает `robots.txt` — политика
  ИИ-ботов сайта, поле сборки (`allow-all` | `allow-search-deny-training` | `deny-all`); её
  значение печатает handoff релиза. Edge этот ответ не портит: требования — 1.4 и 1.5.
- **У адреса одна форма.** Хвостовой слеш, `/index.html` и адрес старого сайта из таблицы
  переездов процесс закрывает одним 301 на конечный адрес — раньше, чем отдаст файл; заглавные в
  своём адресе и закодированный слеш — 404. Двойной слеш, сегменты `.` и `..` и букву, записанную
  процентами, Traefik приводит сам до проксирования: в процесс такой запрос приходит уже
  каноническим, и по публичному адресу отвечает страница — дубль закрывает её canonical. Правил
  приведения пути у edge нет (1.3).
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
  живёт строго в `.env` (`SITE_TAG`), ставит и меняет его `make bump SVC=site TAG=vX.Y.Z`.
- **`profiles: [site]`** — сервис opt-in, как `backend`: без опубликованного образа
  `compose up --wait` упал бы на pull'е. Первый разворот — в этом порядке: профиль в
  `COMPOSE_PROFILES`, затем `make bump` — он ставит `SITE_TAG`. Профиль без тега роняет
  `make deploy` (`invalid reference format`), а `make bump` без профиля поднимает сервис,
  которым `make deploy` не управляет.
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
  правилу `compose-and-services`) с `start_interval: 1s` и **Traefik-side** на сервисе.
  Docker-провайдер Traefik строит роутеры контейнера после первой удачной пробы его healthcheck
  и снимает их при `unhealthy`: пока контейнер в состоянии `starting`, роутеров сайта нет, и
  частая проба на старте сокращает это окно при пересоздании (`make bump`) с ~5 до ~2 с. В окне
  на адресах сайта отвечает заглушка корня, пока она в стеке (1.6): `/` — её страница с кодом
  200, остальные пути — её 404; без заглушки — 404 Traefik. Проверка на стороне Traefik снимает
  с балансировки зависший процесс за секунды, не дожидаясь трёх провалов healthcheck контейнера.
- **Docker Engine ≥ 25 на VPS** — его требует ключ `start_interval`: на движке старше compose
  контейнер не создаёт, а плагин compose до v2.20.2 не разбирает сам файл — тогда падает любой
  верб. Версию называет `make doctor`.
- **`user:` не задавать** — образ уже не root; чужой uid сломает штамповку (файлы
  `dist/` принадлежат `node`).
- **`logging:` не задавать** — ротация json-file (10 МБ × 3) уже настроена на хосте
  ролью `ansible/roles/docker`. Регулятор объёма — `LOG_LEVEL`.
- **Роутер `site-www` только редиректит — сервиса сайта у него нет.** Его сервис —
  `noop@internal`, а не `site`: в цепочке этого роутера нет ни лимитов, ни запрета `/_image`,
  ни контура не-прод, поэтому запрос, на котором редирект не сработал, получает 418 от Traefik,
  а не сайт. Механизм и требование к записям `Host` — 1.3.
- **`site-www` — роутер apex-домена.** У среды на поддомене (`staging.<domain>`) имени
  `www.staging.<domain>` обычно нет: сертификат на него не выпускается, Traefik пишет ошибку
  ACME, а preflight DNS (1.6) предупреждает на каждом деплое. Это шум, а не отказ; его снимает
  DNS-запись `www.<поддомен>` (или wildcard).

```yaml
services:
  site:
    image: ${REGISTRY_HOST:-git.stit.tech}/${PROJECT_NAME}/site:${SITE_TAG}
    container_name: site
    restart: unless-stopped
    # Opt-in: COMPOSE_PROFILES=site. Без опубликованного образа `compose up --wait`
    # упадёт на pull'е — первый тег ставит `make bump SVC=site TAG=<tag>`.
    profiles: [site]
    # При старте entrypoint штампует SITE_URL в выход сборки внутри образа
    # (/app/dist/client), поэтому здесь нет read_only, тома на этом пути и user:
    # (файлы принадлежат node — чужой uid ломает штамповку).
    init: true
    # Больше SHUTDOWN_TIMEOUT_MS образа (15 с): меньше — SIGKILL посреди дренажа.
    stop_grace_period: 20s
    # Ключи формы и наблюдаемости — с умолчаниями (.env.example § profile site):
    # обязательная переменная выключенного профиля уронила бы `compose config` всего стека.
    environment:
      # Канонический origin, без хвостового слеша. Смена домена — пересоздание
      # контейнера (make recreate), не restart: origin уже проштампован в файлы.
      SITE_URL: https://${DOMAIN}
      ROBOTS_POLICY: ${ROBOTS_POLICY:-index}
      RELEASE: ${SITE_TAG}
      LOG_LEVEL: ${SITE_LOG_LEVEL:-info}
      # ≈ 75 % mem_limit: без потолка GC узнаёт о лимите поздно — OOM-kill вместо сборки мусора.
      NODE_OPTIONS: --max-old-space-size=384
      INDEXNOW_KEY: ${SITE_INDEXNOW_KEY:-}
      FORM_DELIVERY: ${SITE_FORM_DELIVERY:-smtp}
      SMTP_URL: ${SITE_SMTP_URL:-}
      FORM_TO: ${SITE_FORM_TO:-}
      FORM_FROM: ${SITE_FORM_FROM:-}
      FORM_BACKEND_URL: ${SITE_FORM_BACKEND_URL:-}
      SENTRY_DSN: ${SITE_SENTRY_DSN:-}
      SENTRY_ENVIRONMENT: ${ENV}
    mem_limit: 512m
    cpus: 1.0
    # Порт наружу не публикуется: чужой Host до сервиса не пускает только роутинг edge.
    networks:
      - proxy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 15s
      # Роутеры контейнера в состоянии starting Traefik не строит: при пересоздании
      # запросы уходят мимо сайта до первой удачной пробы — на старте она частая.
      # Ключу нужен Docker Engine ≥ 25: версию называет make doctor.
      start_interval: 1s
    labels:
      traefik.enable: "true"
      traefik.docker.network: proxy

      # Корень ${DOMAIN} — исключение из сабдоменного канона; заглушку (priority 1)
      # роутер перебивает приоритетом. Только GET и HEAD: статик-хендлер отдаёт файл
      # на любой метод, а POST у сайта один — форма.
      traefik.http.routers.site.rule: Host(`${DOMAIN}`) && (Method(`GET`) || Method(`HEAD`))
      traefik.http.routers.site.entrypoints: websecure
      traefik.http.routers.site.tls: "true"
      traefik.http.routers.site.tls.certresolver: letsencrypt
      # Хвост цепочки — контур не-прод среды, и включает его сам пароль: пока задан
      # STAGING_BASIC_AUTH_USERS, роутеры site и site-form закрыты цепочкой staging@file.
      traefik.http.routers.site.middlewares: crowdsec@file,rate-limit@file,secure-headers@file,compress@file,retry@file${STAGING_BASIC_AUTH_USERS:+,staging@file}

      # Публичный POST формы: свой лимит частоты и тела; без retry (повтор — вторая
      # заявка) и без compress.
      traefik.http.routers.site-form.rule: Host(`${DOMAIN}`) && Path(`/api/contact`) && Method(`POST`)
      traefik.http.routers.site-form.priority: "100"
      traefik.http.routers.site-form.entrypoints: websecure
      traefik.http.routers.site-form.tls: "true"
      traefik.http.routers.site-form.tls.certresolver: letsencrypt
      traefik.http.routers.site-form.middlewares: crowdsec@file,form-rate-limit@file,form-body-limit@file,secure-headers@file${STAGING_BASIC_AUTH_USERS:+,staging@file}
      traefik.http.routers.site-form.service: site

      # /_image — endpoint изображений Astro: картинки готовит сборка, и запрос на
      # трансформацию (sharp — CPU и RAM) не должен доходить до процесса. Маршрут и
      # его подпути, а не префикс имени: public/_images/… правило не задевает.
      # Приоритет по умолчанию — длина правила, у site она растёт с доменом: 1000
      # выше её при любом домене.
      traefik.http.routers.site-image.rule: Host(`${DOMAIN}`) && (Path(`/_image`) || PathPrefix(`/_image/`))
      traefik.http.routers.site-image.priority: "1000"
      traefik.http.routers.site-image.entrypoints: websecure
      traefik.http.routers.site-image.tls: "true"
      traefik.http.routers.site-image.tls.certresolver: letsencrypt
      traefik.http.routers.site-image.middlewares: crowdsec@file,deny-all@file
      traefik.http.routers.site-image.service: site

      # www → apex одним 301, отдельным роутером: regexp не гоняется на запросах apex.
      # Роутер не проксирует — сервис noop@internal: запрос, на котором редирект не
      # сработал, получает 418 от Traefik, а не сайт в обход цепочек роутеров apex.
      traefik.http.routers.site-www.rule: Host(`www.${DOMAIN}`)
      traefik.http.routers.site-www.entrypoints: websecure
      traefik.http.routers.site-www.tls: "true"
      traefik.http.routers.site-www.tls.certresolver: letsencrypt
      traefik.http.routers.site-www.middlewares: crowdsec@file,www-to-apex@file
      traefik.http.routers.site-www.service: noop@internal

      traefik.http.services.site.loadbalancer.server.port: "3000"
      # Проверка на стороне Traefik снимает сервер с балансировки, когда процесс
      # перестал отвечать, не дожидаясь трёх провалов healthcheck контейнера.
      traefik.http.services.site.loadbalancer.healthcheck.path: /healthz
      traefik.http.services.site.loadbalancer.healthcheck.interval: 5s
      traefik.http.services.site.loadbalancer.healthcheck.timeout: 2s
```

### 1.2 Env-контракт

Полная таблица ключей с дефолтами и колонкой «попадает в HTML?» — `docs/reference/deployment.md
§ Env-контракт` в `<org>/site`. Для compose важно следующее.

| ключ `.env` VPS | env контейнера | значение | обязателен |
|---|---|---|---|
| `SITE_TAG` | `RELEASE` | тег образа, он же версия в логах и Sentry; ставит `make bump` (1.1) | да |
| — | `SITE_URL` | `https://${DOMAIN}` — канонический origin, **без хвостового слеша**; хост — в нижнем регистре, IDN — в punycode: другая запись `DOMAIN` — отказ старта | да |
| `ROBOTS_POLICY` | то же | `index` на проде — умолчание compose, `noindex` на любой не-прод среде | на не-прод |
| `SITE_LOG_LEVEL` | `LOG_LEVEL` | `debug \| info \| warn \| error`, дефолт `info` | нет |
| `SITE_SENTRY_DSN` | `SENTRY_DSN` | пусто — SDK не грузится вовсе; DSN public by design | нет |
| `ENV` | `SENTRY_ENVIRONMENT` | слаг среды | нет |
| `SITE_INDEXNOW_KEY` | `INDEXNOW_KEY` | 8–128 символов `a-zA-Z0-9-`; подтверждается файлом `/<ключ>.txt` | нет |
| `SITE_FORM_DELIVERY` | `FORM_DELIVERY` | `smtp \| backend` — один канал доставки заявки | нет |
| `SITE_SMTP_URL` | `SMTP_URL` | `smtps://user:pass@host` — **секрет** | при `smtp` |
| `SITE_FORM_TO` / `SITE_FORM_FROM` | `FORM_TO` / `FORM_FROM` | адреса письма с заявкой | при `smtp` |
| `SITE_FORM_BACKEND_URL` | `FORM_BACKEND_URL` | адрес внутреннего приёмника заявки | при `backend` |
| `STAGING_BASIC_AUTH_USERS` | — | замок не-прод среды, `'user:hash'`; в контейнер не уходит — хвост цепочек роутеров и пользователь `staging-auth` (1.3) | на не-прод |

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
    # Состав общий для всех публичных роутеров. Content-Security-Policy ставит приложение;
    # X-Frame-Options и X-XSS-Protection не ставит никто.
    secure-headers:
      headers:
        forceSTSHeader: true
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        contentTypeNosniff: true
        referrerPolicy: "strict-origin-when-cross-origin"
        # Сервису, которому нужны камера, микрофон или геолокация, — свой middleware,
        # а не послабление здесь.
        permissionsPolicy: "camera=(), microphone=(), geolocation=()"
```

`rate-limit` остаётся как есть. У `crowdsec` отказ — 429 вместо 403, умолчания плагина:

```yaml
    crowdsec:
      plugin:
        crowdsec-bouncer:
          # Отказ WAF — 429, как у лимита частоты: краулер читает его как «приходи позже»,
          # а 403 — как «страницы нет». До сервиса запрос не доходит при любом коде.
          remediationStatusCode: 429
```

Новые middleware:

```yaml
    compress:
      compress:
        # zstd не включаем: выигрыша над br на HTML нет.
        encodings: [br, gzip]
        minResponseBodyBytes: 1024

    www-to-apex:
      redirectRegex:
        # Хост regexp не называет: его уже выбрал роутер, а Host с портом, заглавными
        # или точкой в конце правило Host() принимает — названный здесь хост на такой
        # записи не совпал бы. ${1} переживает envsubst: это не имя переменной.
        regex: "^https?://[^/]+/(.*)"
        replacement: "https://${DOMAIN}/${1}"
        permanent: true

    # Публичный POST формы: одна принятая заявка — одно письмо.
    form-rate-limit:
      rateLimit:
        average: 10
        period: 1m
        burst: 5

    form-body-limit:
      buffering:
        # Тело без Content-Length (chunked) приложение читает до 1 МиБ — 64 КиБ для него
        # держит только эта буферизация.
        maxRequestBodyBytes: 65536
        memRequestBodyBytes: 65536

    # Только для идемпотентных роутеров: повтор POST — вторая заявка.
    retry:
      retry:
        attempts: 2
        initialInterval: 100ms

    # Путь без внешнего доступа: 403 на edge, до процесса.
    deny-all:
      ipAllowList:
        sourceRange: ["127.0.0.1/32"]

    # Не-прод контур — одна цепочка: состав и порядок заданы здесь, а не значением .env.
    # staging-noindex стоит перед staging-auth, иначе ответ 401 уходит без X-Robots-Tag.
    # Роутеры сайта получают цепочку, пока задан STAGING_BASIC_AUTH_USERS (compose/site.yml).
    staging:
      chain:
        middlewares: [staging-noindex, staging-auth]

    staging-noindex:
      headers:
        customResponseHeaders:
          X-Robots-Tag: "noindex, nofollow, noarchive"

    staging-auth:
      basicAuth:
        # users, а не usersFile: смена пароля меняет этот файл, и Traefik пересобирает
        # цепочку сам; правка отдельного файла пользователей пересборку не вызывает, и
        # прежний пароль жил бы до рестарта. Форму значения держит scripts/preflight-env.sh.
        users:
          - '${STAGING_BASIC_AUTH_USERS}'
        realm: "staging"
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
- **Ни одна запись `Host` не даёт запросу обойти цепочку edge.** До процесса запрос доходит
  только через `site` и `site-form` — с их цепочками целиком. Правило `Host()` Traefik
  сопоставляет с приведённым хостом — без порта, в нижнем регистре, точку в конце прощает, —
  поэтому `Host: <domain>:443`, хост заглавными и `<domain>.` попадают в роутеры apex, те же
  записи `www` — в `site-www`, а чужой хост — ни в один (404 edge).
- **Роутер, который только редиректит, — с `service: noop@internal`.** `redirectRegex`
  сопоставляет regexp с адресом, собранным из сырого `Host`, и запрос, на котором regexp не
  сработал, отдаёт сервису роутера. Regexp с именем хоста (`^https?://www\.${DOMAIN}/(.*)`) не
  срабатывает на `Host: www.<domain>:443`, `WWW.<domain>` и `www.<domain>.`, которые правило
  `Host()` принимает: при сервисе `site` такой запрос проходит в сайт мимо замка не-прод,
  лимитов формы, запрета `/_image` и ограничения методов — DNS-записи `www` для этого не нужно,
  хватает адреса сервера. Поэтому `www-to-apex` хост не называет — его уже выбрал роутер, — а
  сам роутер проксировать не может: несработавший редирект — 418 от Traefik. Regexp — не граница
  безопасности.
- **Методы — `GET` и `HEAD` на `site`, `POST` — только `site-form`.** Статик-хендлер адаптера
  отдаёт файл на любой метод (`POST /` — 200 со страницей), на `TRACE` процесс отвечает 400.
- **429, а не 403, — и у лимита, и у WAF.** Лимит частоты Traefik отдаёт 429 — это сигнал
  «замедлись», который краулер понимает. Отказ CrowdSec по умолчанию — 403: для поискового
  робота это выпадение из индекса, для ИИ-бота, который строит ответы или идёт за страницей по
  запросу человека, — из ответов нейросети. Лимит от бана не бережёт: сценарий обхода
  `http-crawl-non_statics` срабатывает на сорока разных страницах подряд быстрее двух в секунду —
  намного ниже лимита сайта (100 запросов в секунду) — и статус ответа не смотрит, так что 429
  лимита он считает наравне с 200. Поэтому отказ bouncer — тоже 429 (`remediationStatusCode`
  выше), а боты, которых пускает политика сайта, до WAF-решения не доходят вовсе — allowlist
  (1.5).
- **Порядок цепочки**: `crowdsec` (дешёвый отказ) → лимит → `secure-headers` → `compress` →
  `retry`; контур не-прод `staging` — хвостом, и его отказ 401 уходит с заголовками edge.
- **Правил приведения пути у edge нет, `sanitizePath` остаётся включённым.** Хвостовой слеш, `/index.html`
  и адреса таблицы переездов приложение приводит само — один 301 сразу на конечный адрес;
  `redirectRegex` на путь в Traefik дал бы второй хоп перед таблицей. Двойной слеш и сегменты `.` и
  `..` Traefik схлопывает на entryPoint до роутеров (`sanitizePath`, умолчание `true`), букву,
  записанную процентами (`/%61bout`), раскодирует при проксировании — такой запрос приходит в
  процесс каноническим, и по адресу `https://<domain>//about` отвечает страница с кодом 200.
  Выключать `sanitizePath` ради редиректа нельзя: по приведённому пути сопоставляются правила
  роутеров всех сервисов entryPoint, и правило на путь — тот же запрет `/_image` — обходилось бы
  записью `//_image`. Вторым адресом в индексе такая форма не становится: canonical страницы —
  каноническая форма, ссылок другой формы сайт не печатает (держит `check:links` сайта), а `.` и
  `..` браузер убирает из адреса до запроса. Путь с закодированным слешем (`%2F`) edge не
  раскодирует — приложение отдаёт 404.
- **`retry` — только на `site`, не на `site-form`**: он добивает единичные гонки при
  force-recreate, но повтор уже отправленного POST — это вторая заявка.
- **`compress` — не для POST формы**: в цепочке `site-form` его нет, он там бесполезен.

Staging-контур включает сам пароль: в `.env` не-прод VPS `STAGING_BASIC_AUTH_USERS='user:hash'` и
`ROBOTS_POLICY=noindex`, на проде ключ замка пуст. Пока значение задано, роутеры `site` и
`site-form` получают хвостом цепочку `staging@file` (1.1). Отдельной переменной включения нет:
замок, названный в цепочке при пустом списке пользователей, роняет edge — Traefik v3.6.16
паникует в `basicAuth` без пользователей, применение dynamic-конфига рвётся, и после рестарта
Traefik 404 отвечают все роутеры. Нет и файла замка: пользователь задан в самом
dynamic-конфиге. Состав и порядок контура заданы цепочкой `staging` шаблона, а не значением
`.env`: `staging-noindex` перед `staging-auth`. Отказ замка (401) рождается в `staging-auth`, и
`X-Robots-Tag` на нём ставит только звено, которое стоит в цепочке раньше: при порядке «замок,
заголовок» ответ 401 уходит без `X-Robots-Tag` (Traefik v3.6.16: с паролем заголовок есть при
любом порядке, без пароля — только при этом).

Значение замка — одна строка `'user:hash'` в одинарных кавычках: так `$` хеша одинаково читают
шелл рендера (`. ./.env`) и compose. Хеш — bcrypt (`htpasswd -nbB <user> '<пароль>'`) как самый
стойкий из тех, что принимает `basicAuth`. Замок держат три правила:

- **Битое значение — отказ до деплоя.** Строку без `:`, с пробелом или кавычкой `basicAuth` не
  разбирает, и роутеры сайта с замком не собираются — на его адресах отвечает заглушка. Значение
  другой формы отвергают `make render`, `make deploy` (до `compose up`) и `make doctor`
  (`scripts/preflight-env.sh`). Неполная пара контуров при профиле `site` — `noindex` без замка
  или замок без `noindex` — предупреждение тех же вербов.
- **Пустое значение рендерится пользователем, под которым не войти** — `nobody:*`
  (`scripts/render-configs.sh`). Снятие замка рендерится раньше, чем compose пересоздаёт сайт без
  цепочки `staging`: с пустым пользователем `basicAuth` не собирается
  (`error parsing BasicUser`), и до пересоздания на адресах сайта отвечала бы заглушка; с
  `nobody:*` роутер эти секунды остаётся закрытым.
- **Смена пароля — `make deploy`, без рестарта Traefik.** Пользователь задан в самом
  dynamic-конфиге (`users`): его правку Traefik подхватывает и пересобирает цепочку. Отдельный
  файл пользователей (`usersFile`) он читает только при сборке цепочки: правку файла не
  замечает, и прежний пароль жил бы до рестарта.

### 1.4 `configs/traefik/traefik.yml.tpl` — access-log

```yaml
accessLog:
  filePath: /var/log/traefik/access.log
  format: json
  fields:
    headers:
      names:
        X-Request-Id: keep
        User-Agent: keep
  filters:
    # Фильтр по статусам снимается целиком: 2xx нужны и аналитике краулеров,
    # и сценариям CrowdSec (http-crawl-non_statics).
    minDuration: 0s
```

Журнал — файл в каталоге хоста: `/var/log/traefik:/var/log/traefik` в `compose/traefik.yml`. Файл
вне json-file докер-демона и сам не ротируется — ротация живёт в стеке `<org>/infra`. Его читают
CrowdSec (1.5) и отчёт сайта «бот × статус».

Почему это важно именно для сайта: prerendered-страницы отдаёт статик-хендлер адаптера, и
в логе приложения их нет вовсе. Полная картина трафика — только в access-log Traefik.
`X-Request-Id: keep` сшивает его со строкой лога приложения. `User-Agent: keep` — без него
боты не видны ни в одном логе: заголовки запроса Traefik по умолчанию в лог не пишет
(`fields.headers.defaultMode: drop`), и отчёту «какой бот приходил и что получил»
(`docs/reference/observability.md § Боты в access-log`), как и сценарию CrowdSec по User-Agent,
работать не на чем.

### 1.5 CrowdSec

- **Починить acquisition** — `configs/crowdsec/acquis.yaml` читает `/var/log/traefik/*.log`, а
  Traefik пишет access-log в stdout: источник пустой, вся остальная настройка декоративна.
  Источник — файл журнала из 1.4: этот путь `acquis.yaml` уже называет, а каталог хоста
  `/var/log` у `crowdsec` уже смонтирован на чтение. Docker-источник (`source: docker` и сокет
  демона у `crowdsec`) не используется: с `filePath` он несовместим и отдаёт сокет контейнеру,
  который разбирает чужой ввод.
- **Whitelist поисковиков** — в `compose/crowdsec.yml`:
  `POSTOVERFLOWS: "crowdsecurity/rdns crowdsecurity/seo-bots-whitelist"` рядом с
  существующим `COLLECTIONS`. Без `rdns` whitelist не на чем работать. Своей копии суффиксов
  rDNS рядом не заводить — это рукописный дубль списка хаба CrowdSec. **Whitelist по User-Agent
  не делать** — UA подделывается.
- **ИИ-боты — продуктовое решение, а не гигиена.** На индексируемом сайте ими управляет
  политика сайта — поле сборки `AI_BOTS_POLICY`, именная группа в `robots.txt` сервиса, — а не
  бан на edge. Трафик из ответов нейросетей приносят поисковые ИИ-боты (`OAI-SearchBot`,
  `PerplexityBot`, `Claude-SearchBot`) и загрузки по запросу человека (`ChatGPT-User`,
  `Perplexity-User`, `Claude-User`); обучающие (`GPTBot`, `ClaudeBot`, `CCBot`) трафика не несут —
  их пускают или нет по политике.
- **Allowlist ИИ-ботов — по спискам вендоров.** `seo-bots-whitelist` знает rDNS классических
  поисковиков, ИИ-ботов в нём нет: бот, который обходит карту сайта, упирается в сценарии
  `http-crawl-non_statics` и `http-probing` и получает бан — на его срок сайт для этой системы
  закрыт, при повторах он выпадает из её ответов. Поэтому сети ботов, которых пускает политика
  сайта, вносятся в allowlist CrowdSec (`cscli allowlists`, CrowdSec ≥ 1.6.8) и обновляются по
  расписанию, раз в неделю: вендоры меняют адреса. Источник — реестр ботов сайта `src/shared/seo/crawlers.yaml` (копия
  `crawlers.yaml` базы strategy): у записи `bots[]` поле `ip_list_url` — список сетей вендора,
  `rdns_suffix` — суффиксы обратного DNS. Печать источников — команда пакета сайта, в `<org>/site`
  на теге релиза:

  ```bash
  pnpm -s bots:sources
  # crawlers.yaml sha256:<64 знака>
  search YandexBot — yandex.ru,yandex.net,yandex.com
  search OAI-SearchBot https://openai.com/searchbot.json —
  training meta-externalagent — —
  ```

  Первая строка — версия реестра: sha256 копии, закреплённый в политике сборки сайта (его первые
  12 знаков называет строка `AI-BOTS` handoff релиза). Дальше — по строке на бота, который ходит в
  сеть за поиском, по запросу человека или за обучением; в строке четыре поля через пробел:
  назначение (`search` | `user_fetch` | `training`), токен `User-Agent`, `ip_list_url` или `—`,
  суффиксы `rdns_suffix` через запятую или `—`. Формат держит тест сайта — своей копии команды хаб
  не носит.

  Строка с `ip_list_url` — сети в `cscli allowlists`. Строка только с `rdns_suffix` (Яндекс) —
  её суффиксы несёт rDNS-whitelist хаба CrowdSec (`seo-bots-whitelist`): `cscli allowlists`
  принимает адреса и сети, а не имена. Строка без обоих полей — вендор списка не публикует: в
  allowlist ей нечем попасть. Такой бот при обходе получает бан сценария и на срок бана — 429
  (1.3), а не проход: отказ говорит ему «приходи позже», а не «страницы нет». По User-Agent
  allowlist не строится — как и whitelist поисковиков: UA подделывается.
- **Edge согласован с `robots.txt`: кого политика сайта пускает — в allowlist, кого закрывает —
  нет.** Политику инфра у себя не хранит, а читает с сайта — с `robots.txt` сервиса
  (`http://site:3000/robots.txt` в сети `proxy`), а не с публичного адреса: на не-прод тот за
  замком и отвечает 401. Бот, которого называет именная группа с `Disallow: /`, в allowlist не
  идёт; сервис не отвечает — allowlist не меняется. При `allow-all` именной
  группы нет — идут все строки печати, и обучающие (`training`): `CCBot` числится в списке
  `http-bad-user-agent` хаба CrowdSec, и без allowlist edge забанит бота, которого `robots.txt`
  пускает. При `allow-search-deny-training` группа называет обучающих, при `deny-all` — ещё и
  ИИ-поиск с загрузками по запросу человека: остаются классические поисковики.
- **Где живёт список.** Вывод `pnpm -s bots:sources` как есть — файл репо инфры
  (`configs/crowdsec/ai-bots.sources`), а не данные VPS: репо сайта на VPS нет, а в образе реестр — часть
  серверной сборки. Файл обновляет сессия в `<org>/infra`, когда строка `AI-BOTS` handoff релиза
  называет другую политику или другую версию реестра; еженедельное задание на VPS читает из него
  `ip_list_url`, сверяет токены с именной группой `robots.txt` сервиса и обновляет
  `cscli allowlists`.

### 1.6 Остальные файлы репозитория

| файл | что сделать |
|---|---|
| `.env.example` | секция `# ───── profile site (индексируемый сайт на корне DOMAIN, www → корень) ─────`: `SITE_TAG`, `ROBOTS_POLICY`, `SITE_LOG_LEVEL`, `SITE_SENTRY_DSN`, `SITE_INDEXNOW_KEY`, `SITE_FORM_DELIVERY`, `SITE_SMTP_URL`, `SITE_FORM_TO`, `SITE_FORM_FROM`, `SITE_FORM_BACKEND_URL`, `STAGING_BASIC_AUTH_USERS` — у каждой комментарий «как получить», иначе `make validate` красный; `ROBOTS_POLICY` ставит `make new-env` по `ENV`: `prod` — `index`, любая другая среда — `noindex`; в подсказке `COMPOSE_PROFILES` появляется `site` |
| `Makefile` → `bump` | `up -d --no-deps --force-recreate` получает `--wait --wait-timeout 90`: без него верб «успешен» и на битом образе; при отказе верб возвращает прежний тег в `.env` и поднимает сервис на нём, код верба ≠ 0: несостоявшийся тег в `.env` роняет следующий `make deploy`, а неподнявшийся контейнер оставляет на адресах сайта заглушку. У первого тега прежнего нет — он остаётся в `.env` |
| `scripts/deploy.sh` → `ROLE_FILES[edge]` | дописать `compose/site.yml` (список ролей перечислен явно, glob только у `all`) |
| `scripts/preflight-dns.sh` | при активном профиле `site` добавить в `hosts` `www.$DOMAIN` — иначе LE-сертификат на www молча не выпустится, а роутер `site-www` есть; у среды на поддомене имени `www` обычно нет — проверка предупреждает, а не отказывает (1.1) |
| `scripts/tools/smoke.d/90-site.sh` | **новый** drop-in (контракт — в шапке `scripts/tools/smoke-run.sh`): блок `-- site --`, read-only, self `exit 0`, проблема — строкой `ATTENTION:` в колонке 0. Проверяет: liveness `docker exec site wget -qO- http://127.0.0.1:3000/healthz`; через edge — статус и заголовки: `/` — 200 и TTFB, на не-прод — 401 (замок стоит) и `X-Robots-Tag: noindex`, на проде заголовка нет; содержимое — у контейнера тем же `docker exec site wget` (на не-прод edge без пароля отвечает 401 на всё): `/robots.txt` — на проде группа `*` с `Allow: /` и абсолютный `Sitemap:`, на не-прод `Disallow: /`; `/sitemap.xml` — непустой список `<loc>`, все URL на своём домене и по https |
| `compose/landing.yml` | заглушка на корне остаётся до первого разворота сайта: она держит выпуск LE-сертификата на `${DOMAIN}`. После разворота `compose/landing.yml` + `configs/landing/` удаляются (сам роутер сайта её и так перебивает приоритетом): пока заглушка в стеке, на адресах сайта она отвечает всякий раз, когда его роутеров нет, — в окне пересоздания при выкате (1.1) и пока контейнер не healthy: `/` — её страница с кодом 200, остальные пути — её 404 |
| `.claude/rules/traefik-routing.md` | раздел «Корневой домен и www»: корень — задокументированное исключение из сабдоменного канона; www — отдельный роутер с `redirectRegex` и сервисом `noop@internal` (роутер, который только редиректит, не проксирует); `${1}` переживает envsubst; в цепочке публичного сайта, в отличие от API, есть `compress`; в таблице chain'ов `secure-headers@file` — HSTS, nosniff, `Referrer-Policy`, `Permissions-Policy` (камера, микрофон и геолокация закрыты), без XSS-filter: состав из 1.3, он общий для всех публичных роутеров; `staging@file` — контур не-прод одной цепочкой, хвостом роутеров сайта |
| `.claude/rules/compose-and-services.md` | абзац «Node-сервисы с рендером»: `init: true`; `read_only` **несовместим** со штамповкой origin; `stop_grace_period` ↔ `SHUTDOWN_TIMEOUT_MS`; `mem_limit` ↔ `NODE_OPTIONS --max-old-space-size` (≈ 75 %); `deploy.resources` не использовать; `replicas` несовместимы с `container_name`; `healthcheck.start_interval` — Docker Engine ≥ 25 |
| `docs/reference/architecture.md` | `site` переезжает из «Что НЕ в шаблоне (overlay-services)» в основную схему слоёв (корень `${DOMAIN}`, рядом с backend на `api.`); в таблице ролей multi-host у `edge` появляется `site` |
| `docs/project/README.md` § «Generates → инфра» | строка для `frontend` (`hosting: here`): индексируемый сайт → профиль `site` → `compose/site.yml`; текущая формулировка «— (always-on landing)» верна только для статической заглушки |
| `docs/project/_templates/service.md` | в подсказках `Hosting`/`Route` — вариант Node-сервиса на корневом домене: профиль `site`, порт 3000, healthcheck `/healthz`, www-редирект |
| `.claude/skills/add-service/SKILL.md` | вариант «Node-сервис на корневом домене»: два роутера (apex + www; www только редиректит — сервис `noop@internal`), Traefik-side healthcheck на сервисе, `init: true`, запрет `read_only`, обязательный env (`SITE_URL`), лимит частоты на публичный POST; публичный сервис, которому нужны камера, микрофон или геолокация (видеосвязь, карта «рядом со мной»), получает свой headers-middleware вместо `secure-headers@file` — с тем же составом и своим `permissionsPolicy`, а не послабление общего: иначе браузер молча отвечает `NotAllowedError`, в логах ничего |
| `.claude/skills/de-template/SKILL.md` | в списке always-on (`traefik`, `crowdsec`, `landing`) оговорить: при сайте на корне `landing` прунится вместе с `configs/landing/` |

### 1.7 Приёмка первого деплоя

1. `make validate` зелёный, `make ship MSG="feat(site): add site service"` → на VPS
   `make deploy`.
2. `.env` VPS: `COMPOSE_PROFILES` содержит `site`, секреты канала доставки заполнены; на не-прод
   среде — ещё `ROBOTS_POLICY=noindex` и замок (1.3). Затем `make bump SVC=site TAG=vX.Y.Z` — он
   ставит `SITE_TAG`.
3. `make ps` — `site` healthy; `make logs SVC=site` — строка
   `[entrypoint] stamped https://__site_origin__ -> https://<domain> in /app/dist/client`
   и ни одной ошибки.
4. curl по живому домену; `<страница>` — путь любой страницы из `sitemap.xml` сайта (страницы у
   проекта свои), `<раздел>/<страница>` — путь из двух сегментов:

```bash
curl -sI  https://<domain>/                    # 200, без X-Robots-Tag: noindex
curl -s   https://<domain>/robots.txt          # группа * — Allow: /, строка Clean-param, абсолютный Sitemap:; именная группа — по политике ИИ-ботов сайта
curl -s   https://<domain>/sitemap.xml | grep -c '<loc>'   # ожидаемое число, все URL — https и свой домен
curl -sI  https://<domain>/net-takogo          # 404 (не 200 и не редирект на главную)
curl -sI  http://<domain>/                     # ровно один 301/308 на https
curl -sI  https://www.<domain>/                # ровно один 301 на apex
# Запись Host редирект www не обходит: с портом, заглавными и точкой в конце — тот же 301 на https://<domain>/<страница>, а не страница
for host in 'www.<domain>:443' 'WWW.<domain>' 'www.<domain>.'; do
  curl -s -o /dev/null -w "$host %{http_code} %{redirect_url}\n" -H "Host: $host" https://www.<domain>/<страница>
done
curl -sI  https://<domain>/index.html          # 301 на / — форму адреса приводит приложение
curl -sI  https://<domain>/<страница>/index.html   # 301 на /<страница>, одним хопом
curl -sI  https://<domain>/<страница>/             # 301 без слеша (хвостовой слеш срезается)
curl -sI  https://<domain>/<раздел>%2F<страница>   # 404: закодированный слеш edge не раскодирует
curl -s   https://<domain>//<страница> | grep -o '<link rel="canonical"[^>]*>'   # двойной слеш схлопывает edge: страница, canonical — https://<domain>/<страница>
curl -sI  https://<domain>/healthz             # 200, Cache-Control: no-store
curl -sI 'https://<domain>/_image?href=/og-default.png&f=webp'   # 403 на edge (без него — 404 приложения)
curl -s   https://<domain>/ | grep -c __site_origin__      # 0 — плейсхолдер проштампован
curl -sI  https://<domain>/llms.txt            # 404 text/plain: файла нет, заглушки тоже
# UA-проба: edge не режет ботов по User-Agent — каждому 200
for ua in OAI-SearchBot PerplexityBot Claude-SearchBot ChatGPT-User; do
  curl -s -o /dev/null -w "$ua %{http_code}\n" -A "Mozilla/5.0 (compatible; $ua/1.0)" https://<domain>/
done
```

5. Заголовки — по списку 1.3: от edge `Strict-Transport-Security`, `X-Content-Type-Options:
   nosniff`, `Referrer-Policy`, `Permissions-Policy`; от приложения `Content-Security-Policy` с
   `frame-ancestors 'none'`; `X-Frame-Options` и `X-XSS-Protection` нет; `Content-Encoding: br`
   на HTML — у ответа на GET (`curl -s -o /dev/null -D - -H 'Accept-Encoding: br'
   https://<domain>/`): на HEAD Traefik не сжимает, `curl -sI` заголовка не покажет;
   `curl -X POST https://<domain>/` и `curl -X TRACE https://<domain>/` — не 200.
6. CrowdSec: `cscli decisions list` — ни верифицированных поисковых ботов, ни адресов из
   списков вендоров ИИ-ботов среди забаненных нет; `cscli allowlists list` — списки вендоров на
   месте (при политике сайта `allow-all` — с сетями обучающих ботов); `cscli metrics` показывает
   непустой источник acquisition; в записи access-log есть `request_User-Agent`; адрес под
   решением (`cscli decisions add --ip <свой адрес> --duration 2m`; прежний вердикт bouncer держит
   в кеше до минуты) получает от edge 429, а не 403.
7. Лимит формы: серия POST на `/api/contact` упирается в **429**, а не в 403 и не в
   принятую заявку.
8. На не-прод VPS через edge без пароля `/` отвечает 401 (basicAuth), и уже этот отказ несёт
   `X-Robots-Tag: noindex, nofollow, noarchive` — порядок цепочки `staging` из 1.3. Запись `Host`
   замок не обходит: цикл по записям `www` из п. 4 без пароля даёт те же 301 на apex, а не
   страницу, apex в тех же записях (`-H 'Host: <domain>:443'`, заглавными, с точкой в конце) —
   401. Содержимое без пароля edge не отдаёт: `robots.txt` = `Disallow: /` читается с паролем
   (`curl -su <user>:<pass> https://<domain>/robots.txt`) или у контейнера (`docker exec site
   wget -qO- http://127.0.0.1:3000/robots.txt`).
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
| Включение staging-контура | паролем `STAGING_BASIC_AUTH_USERS` в `.env` среды; отдельный compose-оверрайд | паролем: не плодит файлов, проходит `make validate`, а замок без пользователей и другой порядок звеньев не становятся состояниями `.env` |
| Судьба заглушки на корне | прунить `compose/landing.yml` при развороте сайта; переименовать сервис в `placeholder`, чтобы имя не путали с продуктовым лендингом | прунить: пока она в стеке, при выкате и неподнявшемся контейнере на адресах сайта отвечает она — с кодом 200 на `/`; переименование трогает скрипты и доки инфры |
| Профиль памяти `site` | 512 МБ / `--max-old-space-size=384`; 768 МБ / 576 при рендере с кешем процесса | 512 МБ: картинки оптимизируются на сборке, рантайм отдаёт готовый HTML |
