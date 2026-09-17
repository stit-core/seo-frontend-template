# 04 · Runtime & Deploy: упаковка, деплой и эксплуатация SSR-фронта в экосистеме stit

Дата: 2026-09-15. Поток 04. Ресёрч, не код.
Читаемые репо (read-only): `spa-frontend-template`, `project-infra-template-compose`, `corp-infra-template`.

---

## 1. TL;DR

1. **Артефакт — один self-contained Node-образ.** TanStack Start + Nitro собирают
   `.output/`, который не требует `node_modules` в рантайме; запуск —
   `node .output/server/index.mjs`, порт из `PORT` (дефолт 3000). Runtime-стадия
   Dockerfile сводится к `COPY --from=build /app/.output ./.output` (проверено, см. §2.1).
   Оценка размера ≈ 170–200 МБ uncompressed против ≈ 52 МБ у nginx-образа SPA.
2. **nginx-sidecar не нужен** (§8). Nitro отдаёт `.output/public` по встроенному
   манифесту (MIME/ETag/mtime/size, без `stat()` на запрос) + pre-compressed
   gzip/brotli с билда. Sidecar удваивает поверхность и создаёт риск version-skew.
3. **Главный слом относительно SPA — исчезает `nginx-entrypoint.sh`/`/config.js`.**
   Конфиг читается сервером из `process.env` на каждом запросе, а в HTML попадает
   только явный public-подсет. Появляется **новая граница безопасности**: внутренний
   `API_BASE_URL=http://backend:8080` не должен утечь в разметку. Нужен тест.
4. **Кеш без CDN — три слоя**: prerender на билде (статичные страницы) → Nitro
   `routeRules.swr` в памяти процесса (полудинамика) → `no-cache` + ETag для
   персонализированного HTML. Драйвер кеша по умолчанию — **memory**: релиз
   (новый контейнер) сам инвалидирует кеш, fs/redis требуют ручного flush.
5. **В инфре есть разрыв: CrowdSec сейчас не видит HTTP-трафик.** `accessLog` Traefik
   пишется в stdout (нет `filePath`), а `configs/crowdsec/acquis.yaml` читает
   `/var/log/traefik/*.log`, которого никто не создаёт. Плюс `filters.statusCodes:
   ["400-599"]` отрезал бы 2xx даже если бы поток был. Следствие: WAF по HTTP не
   работает вообще — и краулеры не банятся тоже. Чинить acquisition **вместе с**
   установкой `crowdsecurity/rdns` + `crowdsecurity/seo-bots-whitelist`, иначе первый
   же рабочий WAF начнёт банить Googlebot/YandexBot (§2.6, §3.7).
6. **CSP с nonce ставит приложение, не Traefik.** Traefik `headers`-middleware
   статичен и перезаписывает upstream-заголовок; nonce per-request он выдать не может.
   `secure-headers@file` оставляем за HSTS/nosniff/referrer, `contentSecurityPolicy`
   там не заводим (§2.10, §3.6).
7. **Staging noindex — двойной замок**: `ROBOTS_POLICY=noindex` в приложении
   (источник истины, тестируемо в `pnpm test`) + Traefik `basicAuth` на staging
   (401 индексацию убивает надёжнее любого заголовка).
8. **Zero-downtime**: `make bump` = `up -d --force-recreate` = окно 1–5 с 502-х.
   Лечится не репликами (`container_name` запрещает `replicas` — проверено), а
   **Traefik-side healthcheck сервиса** (`loadbalancer.healthcheck.path=/healthz`) +
   `--wait` в `make bump`. Тогда Traefik не шлёт трафик в ещё не слушающий Node.
9. **Самый вероятный production-папиркат** — рассинхрон keep-alive Node ↔ Traefik
   (Node по умолчанию закрывает idle-соединение раньше, чем прокси перестаёт его
   переиспользовать → спорадические 502). Обязательный пункт спайка (§2.8, §5).
10. **Nitro v3 на 2026-09-03 всё ещё beta** (`v3.0.260903-beta`), при этом
    TanStack Start официально документирует именно `nitro/vite` из v3. Это
    осознаваемый риск шаблона, а не деталь (§5).

---

## 2. Findings

### 2.1 Артефакт сборки: что реально кладём в образ

| Факт | Статус |
|---|---|
| TanStack Start собирается Vite'ом с плагинами `tanstackStart()` + `nitro()` из `nitro/vite`; старт — `node .output/server/index.mjs` | **проверено** 2026-09-15 — [TanStack Start · Hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) |
| Клиентские ассеты собираются в `dist/client`, серверный бандл — `.output/server/index.mjs` | **проверено** — там же |
| `.output` self-contained: «the Nitro build bundles its own dependencies into `.output`», `node_modules` в runtime-стадии не нужен; канонический Dockerfile — `COPY --from=build /app/.output ./.output` + `CMD ["node", ".output/server/index.mjs"]` | **проверено** — [Railway · Deploy a TanStack Start App](https://docs.railway.com/guides/tanstack-start) |
| `.output/public` получает клиентские ассеты с `maxAge` 1 год через nitro `publicAssets` | **проверено (вторичный источник)** — [DeepWiki · TanStack Router 5.7 Start Deployment](https://deepwiki.com/TanStack/router/5.7-start-deployment). **Обязательно перепроверить `curl -I` на спайке** — есть открытый баг про `build.assetsDir` vs `publicAssets` ([TanStack/router#5754](https://github.com/TanStack/router/issues/5754)) |
| Nitro `output` по умолчанию: `{ dir: '.output', serverDir: '.output/server', publicDir: '.output/public' }` | **проверено** — [Nitro · Config](https://nitro.build/config) |
| Дефолтный production-пресет Nitro — Node.js server; форс — `NITRO_PRESET=<preset>` (рекомендован для CI/CD), `--preset`, или `preset` в `nitro.config.ts` | **проверено** — [Nitro · Deploy](https://nitro.build/deploy) |
| `public/` копируется в `.output/public` со **встроенным манифестом** (MIME, ETag, mtime, размер) — «enabling high-performance serving without filesystem scanning» | **проверено** — [Nitro · Assets](https://nitro.build/docs/assets) |

**Env node-сервера** (проверено — [Nitro · Node.js runtime](https://nitro.build/deploy/runtimes/node)):

| Env | Дефолт | Смысл |
|---|---|---|
| `NITRO_PORT` / `PORT` | `3000` | порт |
| `NITRO_HOST` / `HOST` | все интерфейсы | bind |
| `NITRO_UNIX_SOCKET` | — | слушать unix-сокет |
| `NITRO_SSL_CERT` / `NITRO_SSL_KEY` | — | HTTPS (по докам «intended for testing only», прод — за реверс-прокси) |
| `NITRO_SHUTDOWN_DISABLED` | `'false'` | graceful shutdown включён |
| `NITRO_SHUTDOWN_SIGNALS` | `'SIGINT SIGTERM'` | какие сигналы ловим |
| `NITRO_SHUTDOWN_TIMEOUT` | `'30000'` (мс) | сколько ждём дренаж |
| `NITRO_SHUTDOWN_FORCE` | `'true'` | добить по таймауту |
| `NITRO_CLUSTER_WORKERS` | кол-во CPU | только для пресета `node_cluster` |

> **Важное следствие:** graceful shutdown ставится самим Nitro явными хендлерами,
> то есть Node как PID 1 нормально реагирует на SIGTERM (обычная проблема «PID 1 не
> имеет дефолтных обработчиков» здесь не срабатывает). Но дефолт
> `NITRO_SHUTDOWN_TIMEOUT=30000` **больше** дефолтного `stop_grace_period` compose (10 с)
> → docker успеет SIGKILL'нуть. Значения надо согласовать (§3.4).

### 2.2 Версии и статус (все — проверено 2026-09-15 по npm registry / GitHub Releases)

| Пакет / продукт | Версия | Комментарий |
|---|---|---|
| `nitro` (v3) | `3.0.260903-beta` (dist-tag `latest`), релиз 2026-09-03 | **всё ещё beta**; предыдущие — `3.0.260610-beta`, `3.0.260603-beta`. [GitHub Releases](https://github.com/nitrojs/nitro/releases) |
| `nitropack` (v2) | `2.13.4` (stable) | легаси-линия, на неё смотрит `@tanstack/nitro-v2-vite-plugin` |
| `@tanstack/react-start` | `1.168.54` (latest) | dist-tags: `pre 1.168.33-pre.0`, `alpha 1.132.0-alpha.25` |
| `@tanstack/nitro-v2-vite-plugin` | `1.155.2`, deps `nitropack ^2.13.4`, peer `vite >=7` | запасной путь на стабильный Nitro v2 |
| Traefik | `v3.7.13` (2026-09-04). В `project-infra-template-compose` пришпилен `v3.6.16` | дрейф на минор, не блокер |
| CrowdSec | в шаблоне `v1.7.7` | — |
| Node.js | **v24 (Krypton) — Active LTS**; v26 — Current (с 2026-05-05); v25 — EOL; v22 — Maintenance | [Node · Previous releases](https://nodejs.org/en/about/previous-releases). Выбор Node 24 в SPA-шаблоне остаётся правильным |
| `@sentry/node` | `latest 10.74.0`, `next 11.0.0-beta.2` | SPA-шаблон сидит на `@sentry/react` 8.55.2 — две мажорки назад |
| `@sentry/tanstackstart-react` | существует, **alpha**; min TanStack Start `1.111.12` | [Sentry docs](https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/) |

Из релиз-нот Nitro `v3.0.260903-beta` (**проверено**, важно для §2.7):
- новый route-rules-движок из h3: «rules matched on canonical path», сиблинги
  сортируются по специфичности; автоматический `HEAD` для `GET`; правило `cors`;
- `ocache` поднят до 0.3: «safer defaults, bounded memory»; **`swr` теперь
  по умолчанию `false`**, query-параметры по умолчанию игнорируются в ключе кеша,
  **cookies вырезаются из закешированного ответа**, если не разрешены явно;
- у Nitro больше нет peer-зависимостей — резолвит из проекта пользователя.

### 2.3 Docker-рантайм Node 24

| Факт | Статус / источник |
|---|---|
| `node:24-bookworm-slim` **вычищает `curl` и `wget`** (`apt-get purge -y --auto-remove` после установки node и yarn) | **проверено** — [docker-node 24/bookworm-slim/Dockerfile](https://raw.githubusercontent.com/nodejs/docker-node/main/24/bookworm-slim/Dockerfile). Следствие: HEALTHCHECK через `wget` на slim **не работает**; на alpine работает (busybox wget) |
| Официальный образ содержит непривилегированного пользователя `node`; канон — `COPY --chown=node:node` + `USER node` | **проверено** — [Snyk · 10 best practices](https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/) |
| Node ≥ 20 container-aware: читает cgroup `memory.max` и подбирает максимальный heap; ручной ориентир — `--max-old-space-size` ≈ 75 % лимита контейнера | **проверено** — [Red Hat · Node.js 20+ memory management in containers](https://developers.redhat.com/articles/2025/10/10/nodejs-20-memory-management-containers) |
| Multi-stage срезает ~70 % размера; `.output` не тянет `node_modules` | **проверено** (общая практика + Railway-гайд) |
| Alpine vs slim: alpine меньше, но нативные модули с C++-биндингами могут не собраться без доп. пакетов | **проверено** — [DEV · Dockerizing Node.js 2026](https://dev.to/axiom_agent/dockerizing-nodejs-for-production-the-complete-2026-guide-7n3) |

Оценка размера (**предположение**, мерить на спайке): `node:24-alpine` ≈ 150 МБ +
`.output/server` (бандл React/Router/Query/Start) 10–25 МБ + `.output/public` 1–5 МБ
(+ gzip/br-варианты) ⇒ **≈ 170–200 МБ uncompressed, ≈ 60–80 МБ слоями в registry**.
Для сравнения SPA-образ: `nginx:1.27-alpine` ≈ 50 МБ + `dist` ≈ 1 МБ.

### 2.4 Инфра проекта: как устроен деплой (из чтения репо)

- `docker-compose.yml` — только сети (`proxy` bridge, `backend-net` bridge+`internal: true`) и
  named volumes; сервисы — `compose/<svc>.yml`, склейка в `Makefile`
  (`-f docker-compose.yml` + `$(wildcard compose/*.yml)`, `--env-file .env`).
- Инварианты сервиса (`.claude/rules/compose-and-services.md`): pinned image,
  `container_name` == ключ сервиса, `restart: unless-stopped`, `healthcheck`,
  явный `networks`; опционально `mem_limit`, `read_only: true` + `tmpfs: ["/tmp"]`.
- Секреты/конфиг: только `${VAR}` из `.env` на VPS; каждый `${VAR}` обязан быть
  в `.env.example` (ловит `make validate`).
- `scripts/deploy.sh`: `git pull --ff-only` → `render-configs.sh` (envsubst по
  `configs/**/*.tpl`) → `preflight-dns.sh` → `compose up -d --remove-orphans --wait
  --wait-timeout 180` → рестарт сервисов с изменившимися bind-mount-конфигами по git-diff.
  Есть `HOST_ROLE`-маппинг `ROLE_FILES`: у роли `edge` список compose-файлов **жёстко
  перечислен** — новый `compose/site.yml` туда надо дописывать явно.
- `make bump SVC= TAG=`: правит `<SVC>_TAG` в `.env` (`SVC` → `UPPER_SNAKE` + `_TAG`) и
  `docker compose up -d --no-deps --force-recreate <svc>` — **без `--wait`**.
- `compose/landing.yml`: заглушка на корне `Host(\`${DOMAIN}\`)` c `priority: "1"`,
  чтобы её перебил любой явный роутер на корень.
- Роутинг: **сабдомены** (`.claude/rules/traefik-routing.md`: «Не path-based — это
  ломает редиректы и cookies»); корень занят только landing'ом; frontend в стеке
  из коробки **нет** — `docs/reference/architecture.md` перечисляет
  `compose/frontend.yml` в «overlay-services».
- `docs/project/README.md` § «Generates → инфра»: `frontend` (`hosting: here`) →
  «— (always-on `landing`)» → `compose/landing.yml`. Для SSR-фронта эта строка
  **неверна** и должна стать отдельным профилем.

Проверка приоритетов Traefik: «The priority is directly equal to the length of the
rule… a value of 0 for the priority is ignored» (**проверено** —
[Traefik · Rules & Priority](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/)).
`Host(\`example.com\`)` даёт приоритет ≈ 19 > 1 ⇒ комментарий в `landing.yml` верен,
SSR-роутер перебьёт заглушку без правок landing'а.

### 2.5 Traefik: что есть, чего нет, что просрочено

Текущий `configs/traefik/dynamic/middlewares.yml.tpl` содержит `crowdsec`,
`secure-headers`, `rate-limit`.

| Находка | Статус |
|---|---|
| **`sslRedirect` в `secure-headers` удалён в Traefik v3.** Дословно: «sslRedirect, sslTemporaryRedirect, sslHost, sslForceHost and featurePolicy options of the Headers middleware have been removed» | **проверено** — [v2→v3 details](https://raw.githubusercontent.com/traefik/traefik/master/docs/content/migrate/v2-to-v3-details.md). В шаблоне `sslRedirect: true` присутствует. Неизвестное поле в file-провайдере может уронить парсинг всего файла (`field not found, node: …`) — **проверить на живом стеке**: `docker logs traefik 2>&1 \| grep -i 'field not found'` |
| Редирект http→https и так делается на entrypoint `web` (`redirections.entryPoint`), так что `sslRedirect` избыточен | **проверено** чтением `traefik.yml.tpl` |
| `compress`-middleware в шаблоне **нет**. Опции v3: `excludedContentTypes`, `includedContentTypes`, `minResponseBodyBytes` (дефолт 1024), `encodings` (дефолт `gzip, br, zstd`), `defaultEncoding` | **проверено** — [Compress](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/) |
| `text/event-stream` исключается из сжатия автоматически; при flush/chunked `minResponseBodyBytes` игнорируется и данные сжимаются — то есть streaming SSR сжимается | **проверено** — [traefik#12673](https://github.com/traefik/traefik/issues/12673), [PR #11511](https://github.com/traefik/traefik/pull/11511) |
| `redirectRegex` для www→apex: `regex` / `replacement` / `permanent`; предупреждение доки — писать `${1}`, а не `$1x` | **проверено** — [RedirectRegex](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/redirectregex/) |
| `${1}` в `.tpl` **переживает `envsubst`** (не валидный идентификатор), т.е. `render-configs.sh` (envsubst без varlist) его не съест | **проверено экспериментально** (GNU gettext-runtime 0.23.1, запуск в scratchpad) |
| `rateLimit`: `average` / `period` (дефолт 1s) / `burst` / `sourceCriterion` (`ipStrategy` / `requestHeaderName` / `requestHost`); дефолт — по remote address | **проверено** — [RateLimit](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/ratelimit/). Текущие 100 r/s avg + 200 burst на IP для краулеров безвредны |
| `basicAuth`: `users` / `usersFile` / `realm` / `headerField` / `removeHeader`; в docker-labels `$` надо удваивать — `usersFile` в dynamic-файле от этого избавляет | **проверено** — [BasicAuth](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/basicauth/) |
| `headers.customResponseHeaders` — штатный способ навесить `X-Robots-Tag` | **проверено** — [Headers](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/) |
| HTTP/3: только с TLS; UDP-порт entrypoint'а занимается автоматически; `http3.advertisedPort` переопределяет alt-svc | **проверено** — [EntryPoints](https://doc.traefik.io/traefik/v3.4/routing/entrypoints/). Требует `- "443:443/udp"` в `compose/traefik.yml` |
| **103 Early Hints** — подтверждения поддержки в Traefik найти не удалось | **не подтверждено**, из плана выкинуть |
| `deploy.resources.limits` в non-swarm compose применяется ненадёжно (по ряду источников — только с `--compatibility`); `mem_limit`/`cpus` на уровне сервиса работают | **частично проверено** (вторичные источники; официальная дока формулировки не даёт). Практический вывод: **использовать `mem_limit`/`cpus`**, что и так записано инвариантом инфра-шаблона |
| `container_name` несовместим с `replicas`/`scale`: «Docker requires each container to have a unique name. Remove the custom name to scale the service» | **проверено** — [docker/compose#3722](https://github.com/docker/compose/issues/3722) и форум Docker |

### 2.6 CrowdSec: краулеры и текущий разрыв

**Разрыв (проверено чтением конфигов, не наблюдением живого VPS):**

- `configs/traefik/traefik.yml.tpl` → `accessLog: { format: json, filters: { statusCodes: ["400-599"] } }` — **без `filePath`**, значит лог идёт в stdout контейнера.
- `compose/traefik.yml` — нет volume, куда бы этот лог писался на хост.
- `configs/crowdsec/acquis.yaml` → `filenames: [/var/log/traefik/*.log], labels: {type: traefik}`; `compose/crowdsec.yml` монтирует `/var/log:/var/log:ro` с хоста.

⇒ `/var/log/traefik/*.log` не существует. CrowdSec реально обрабатывает только
`/var/log/auth.log` (sshd). **HTTP-сценарии коллекции `crowdsecurity/traefik` не
получают событий.** Плюс фильтр `400-599` отрезал бы 2xx, на которых строится
`http-crawl-non_statics`.

Практический вывод для SEO-сайта: сегодня краулеров WAF не банит **потому что WAF
по HTTP не работает**. Как только acquisition починят, риск бана появится — значит
починка и whitelist едут одним изменением.

**Как правильно не банить поисковых ботов (проверено):**

- Верификация — по **reverse DNS**, не по User-Agent: «the crowdsecurity/rdns
  postoverflow is used to enrich overflows with reverse dns information of the
  offending IP» ([CrowdSec · postoverflow whitelists](https://docs.crowdsec.net/docs/next/log_processor/whitelist/create_postoverflow/)).
- В хабе есть готовый `crowdsecurity/seo-bots-whitelist` (postoverflow, требует
  `crowdsecurity/rdns`), whitelist'ит **Google, Yandex, Bing, DuckDuckGo, Baidu,
  Yahoo, Qwant, Sogou** + Facebook/Pinterest/Amazon, по трём выражениям:
  `rdns_seo_bots.txt` (суффиксы rDNS), `rdns_seo_bots.regex`, `ip_seo_bots.txt`
  (IP-диапазоны). Установка: `cscli postoverflows install crowdsecurity/seo-bots-whitelist`
  ([hub](https://app.crowdsec.net/hub/author/crowdsecurity/configurations/seo-bots-whitelist)).
- В docker-образе это ставится env-переменной: образ поддерживает
  `COLLECTIONS`, `PARSERS`, `SCENARIOS`, **`POSTOVERFLOWS`**, `CONTEXTS`,
  `APPSEC_CONFIGS`, `APPSEC_RULES` и парные `DISABLE_*`
  ([build/docker/README.md](https://raw.githubusercontent.com/crowdsecurity/crowdsec/master/build/docker/README.md)).
- В postoverflow `evt.Parsed` пуст — работать надо через `evt.Overflow.*` и
  `evt.Enriched.reverse_dns` (проверено, там же).

**Корп-сторона** (`corp-infra-template`): `configs/crowdsec/scenarios/commercial-crawlers.yaml`
ловит по UA `SemrushBot, AhrefsBot, MJ12bot, DotBot, BLEXBot, PetalBot, DataForSeoBot,
meta-externalagent, ClaudeBot, GPTBot, CCBot, Bytespider, ICC-Crawler` (leaky, 5/30 с,
ban 6 ч). Googlebot/YandexBot там нет — сценарий безопасен для SEO. Но для **публичного
сайта клиента** его копирование — бизнес-решение: `ClaudeBot`/`GPTBot`/`CCBot`/
`meta-externalagent` — это трафик из LLM-ответов, а не только паразитная нагрузка.
`configs/crowdsec/postoverflows/skip-corp-ui-probing.yaml` — хороший образец того, как
глушить false-positive `http-probing`/`http-crawl-non_statics` по FQDN.

### 2.7 Кеширование без CDN (Nitro)

| Факт | Источник |
|---|---|
| `routeRules` ключи: `headers`, `redirect`, `proxy`, `cors`, `cache`, `swr`, `static`, `prerender`, `isr`. Правила матчатся от менее специфичного к более специфичному, опции **мержатся**, более специфичное побеждает; `false` отключает унаследованное; можно скоупить методом (`'POST /api/**': {...}`) | **проверено** — [Nitro · Routing](https://nitro.build/docs/routing) |
| `swr: true` == `cache: { swr: true }`; `swr: <n>` == `cache: { swr: true, maxAge: n }` | **проверено** — [Nitro · Cache](https://nitro.build/docs/cache) |
| `isr` — «Incremental Static Regeneration (Vercel)», кладёт ответ в **CDN-кеш платформы** (Netlify/Vercel). **Без CDN бессмысленно** — для нас это `swr` | **проверено** — там же |
| `prerender: true` — маршрут фетчится на билде и кладётся в `.output/public` статикой | **проверено** — там же |
| Кеш живёт в storage-слое под префиксом `cache:`; **по умолчанию mount не задан ⇒ in-memory, не переживает рестарт**. Persist — `storage: { cache: { driver: 'redis', … } }`; для dev — `devStorage` | **проверено** — [Nitro · Cache](https://nitro.build/docs/cache) |
| Опции кеша: `maxAge` (дефолт 1 с), `swr` (дефолт **false** с ocache 0.3), `staleMaxAge`, `base`, `name`, `group`, `varies`; для хендлеров — `allowQuery`, `allowCookies`, `allowAuthorization`, `sendCacheControl` (дефолт true), `cacheStatusHeader` (дефолт true → заголовок `X-Cache`) | **проверено** — там же |
| unstorage-драйверы: memory/`lru-cache` (дефолт max 1000), `fs`, `redis` (тянет `ioredis`), и др. В dev Nitro сам монтирует `cache` на fs (`.nitro/cache`) | **проверено** — [unstorage · LRU Cache](https://unstorage.unjs.io/drivers/lru-cache), [Nitro · KV Storage](https://nitro.build/docs/storage) |
| `publicAssets[].maxAge` даёт `Cache-Control: public, max-age=<v>, immutable` — **только когда `fallthrough: false`**; у корневой public-директории `fallthrough` по умолчанию `true` (⇒ по умолчанию только ETag/Last-Modified, без Cache-Control) | **проверено** — [Nitro · Assets](https://nitro.build/docs/assets) |
| `compressPublicAssets: boolean \| {gzip, brotli, zstd}`, дефолт `false`; пре-жмёт public-ассеты **и prerendered-маршруты** > 1 КБ | **проверено** — [Nitro · Config](https://nitro.build/config) |
| Prerender-опции: `routes`, `crawlLinks` (дефолт false в Nitro), `ignore`, `failOnError` (false), `autoSubfolderIndex` (true), `concurrency` (1) | **проверено** — [Nitro · Config](https://nitro.build/config) |
| TanStack Start свой слой prerender: `enabled`, `crawlLinks` (дефолт **true**), `autoSubfolderIndex`, `autoStaticPathsDiscovery`, `concurrency` (14), `filter`, `retryCount` (2), `retryDelay` (1000), `maxRedirects` (5), `failOnError`, `onSuccess`, и массив `pages` с `path`/`prerender`/`outputPath` | **проверено** — [TanStack Start · Static Prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering) |

### 2.8 Процессная модель и ёмкость

- **Один Node-процесс на контейнер.** Пресет `node_cluster` (форки по числу CPU) —
  не брать: на 1–2 vCPU он только множит RSS, а на большем железе правильнее
  масштабировать контейнерами. Оставить как документированный escape-hatch.
- **RSS** (оценка, **предположение**): idle 90–150 МБ (Node baseline 40–60 + React +
  route-tree + QueryClient), под нагрузкой с тёплым SWR-кешем 200–350 МБ.
  `mem_limit: 512m`, `NODE_OPTIONS=--max-old-space-size=384` (≈ 75 % от лимита — правило
  из Red Hat-статьи, проверено).
- **CPU** (оценка): SSR типичной страницы 3–15 мс CPU ⇒ на 1 vCPU теоретически
  70–300 рендеров/с, реалистично 30–80 r/s при p95-безопасной загрузке. Prerender +
  SWR срезают большую часть.
- **Цели p95 TTFB** (предложение, не измерение): prerender/SWR-hit ≤ 100 мс (RU→RU VPS);
  SSR-miss с одним вызовом backend ≤ 400 мс; `/healthz` ≤ 20 мс.
- **OOM**: контейнер получает SIGKILL → `restart: unless-stopped` → кеш холодный →
  возможен thundering herd. Смягчение: ocache 0.3 «bounded memory» по умолчанию
  (проверено по релиз-нотам), запас по `mem_limit`, и сигнал в cockpit
  (`smoke.d/90-site.sh` смотрит `OOMKilled`/restart-count).
- **Keep-alive — главный риск.** Классика: у Node дефолтный `server.keepAliveTimeout`
  ≈ 5 с, у реверс-прокси idle-таймаут заметно больше ⇒ прокси пишет запрос в
  соединение, которое сервер уже закрывает ⇒ спорадические 502. Подтверждено как
  класс проблемы ([iximiuz](https://iximiuz.com/en/posts/reverse-proxy-http-keep-alive-and-502s/),
  [traefik#10932](https://github.com/traefik/traefik/issues/10932),
  [nodejs/node#52649](https://github.com/nodejs/node/issues/52649)).
  Значения по умолчанию у srvx/Nitro **не проверены** — обязательный пункт спайка.
  Лечение (любое одно): поднять на сервере `keepAliveTimeout` выше прокси-таймаута
  (и `headersTimeout` ещё выше), либо задать Traefik
  `serversTransport.forwardingTimeouts.idleConnTimeout` меньше серверного, либо
  `maxIdleConnsPerHost: -1` (отключить переиспользование — ценой производительности).

### 2.9 Health / логи / наблюдаемость

- **`/healthz` — liveness, без зависимостей.** В TanStack Start это server route:
  файл в `routes/` с `createFileRoute('/healthz')` и свойством `server: { handlers: { GET } }`
  (**проверено** — [TanStack Start · Server Routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)).
- **`/readyz` не нужен** (аргументированное решение). В этой топологии readiness
  ни на что не влияет: `depends_on: service_healthy` работает только на старте, а
  Traefik роутит по labels. Если сделать readiness зависящим от backend'а, падение
  backend'а уронит **весь сайт** вместо деградации до страницы ошибки — это хуже.
  Диагностика глубины — отдельный `/healthz?deep=1`, который **всегда** 200 и лишь
  сообщает достижимость backend в теле.
- **Логи приложения** — структурный JSON в stdout, одна строка на запрос, без PII:
  без IP (он уже в Traefik access-log), без cookies, без query-строки целиком
  (только allowlist ключей). Поля: `ts, lvl, msg, method, path, route, status,
  dur_ms, cache (из X-Cache), rid, rel`.
- **`X-Request-Id`**: Traefik не генерирует его сам. Пусть приложение принимает
  входящий или генерирует свой и возвращает в заголовке; Traefik логирует заголовок
  через `accessLog.fields.headers.names` — так два лога сшиваются.
- **Traefik access-log**: сейчас `filters.statusCodes: ["400-599"]`. Для
  индексируемого сайта нужны 2xx (аналитика ботов) и они же нужны CrowdSec'у.
  Фильтр снять или расширить, а шум `/healthz` глушить через
  `accessLog.filters`/`fields.names` drop по пути.
- **Метрики**: Prometheus в стеке нет, и **добавлять не надо** — это отдельный
  overlay (prom + grafana + retention + ещё один публичный роут) ради одного сервиса.
  Вместо него: (а) Sentry performance (p95 по маршрутам, sampled) и
  (б) drop-in `scripts/tools/smoke.d/90-site.sh` в существующем cockpit-механизме —
  `curl -o /dev/null -sw '%{time_starttransfer}'` по 2–3 ключевым URL + `OOMKilled`/
  restart-count, с выводом `ATTENTION:` при превышении. Это ровно тот шов, который
  `add-service` уже описывает.
- **Sentry server-side**: есть `@sentry/tanstackstart-react` (**alpha**, min Start
  1.111.12), инструментирует клиент + серверные функции. Альтернатива —
  `@sentry/node` 10.x + `@sentry/react` 10.x одной мажоркой. Детали — поток 03.

### 2.10 Безопасность: CSP, HSTS, noindex, /api

- **CSP с nonce обязан ставиться приложением.** Traefik `headers` — статическая
  конфигурация, per-request nonce он не умеет; более того, `headers`-middleware
  **перезаписывает** одноимённый заголовок из upstream. Значит:
  `contentSecurityPolicy` в `secure-headers@file` не заводим вообще, CSP формирует SSR.
- Черновик политики (см. §3.6): `script-src 'self' 'nonce-<n>' 'strict-dynamic'`.
  Два подводных камня, оба на спайк:
  1. **Анти-FOUC inline-скрипт темы** (`data-scheme` из localStorage до первой
     отрисовки — перенос reference-слайса `features/theme`) требует nonce.
  2. **Поддерживает ли TanStack Start проброс nonce** в собственные inline-скрипты
     (гидрационный payload, module-preload) — **не проверено**. Если нет —
     деградация до hash-CSP или до `'unsafe-inline'` в `script-src` (что убивает
     смысл), и это меняет весь раздел.
  Раскатывать через `Content-Security-Policy-Report-Only` минимум один релиз.
- **HSTS** уже есть (`stsSeconds: 31536000`, `stsIncludeSubdomains: true`).
  `stsPreload` не включён и включать по умолчанию не стоит — это односторонняя дверь
  (сабмит в hstspreload.org, откат месяцами).
- **Staging noindex** — приложение как источник истины (`ROBOTS_POLICY=noindex` →
  `X-Robots-Tag: noindex, nofollow` на всех HTML-ответах + `robots.txt: Disallow: /`),
  Traefik — второй замок на staging-VPS. Если обе стороны ставят заголовок, они
  обязаны совпадать (Traefik перезапишет). В prod Traefik его **не ставит вообще**.
- **Basic-auth на staging** через Traefik `basicAuth` с `usersFile` (а не `users` в
  labels — уходит проблема удвоения `$`). 401 надёжнее любого `noindex`. Цена:
  ломает внешние Lighthouse/PageSpeed-прогоны и e2e без кредов.
- **`/api` и SSR.** Рекомендация — сохранить конвенцию экосистемы: браузер ходит в
  `https://api.${DOMAIN}` (`PUBLIC_API_BASE_URL`), а **сервер** при SSR ходит в
  `http://backend:8080` по `backend-net` (`API_BASE_URL`) — без интернета и TLS.
  Cookie-модель backend'а (`SameSite=Strict`, host-only, без атрибута Domain)
  переживает пару `example.com` ↔ `api.example.com`: это один site, Strict-куки
  отправляются. CORS на backend нужен (`Allow-Credentials` + явный origin).
  Альтернатива «same-origin» — один route-rule
  `'/api/**': { proxy: 'http://backend:8080/api/**' }`, убирает CORS полностью, но
  переносит весь API-трафик через Node и под middleware-цепочку сайта (а не
  `api.`-роутера). Оставить как задокументированную опцию, не как дефолт.

---

## 3. Рекомендации для шаблона (с черновиками)

### 3.1 `docker/Dockerfile` (черновик)

```dockerfile
# ── build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
# NITRO_PRESET фиксируем явно: пресет не должен зависеть от автодетекта окружения.
ENV NITRO_PRESET=node-server
RUN pnpm build

# ── runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NITRO_SHUTDOWN_TIMEOUT=15000

# .output self-contained: node_modules в рантайме не нужен.
COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

# busybox wget есть в alpine; на node:24-slim curl/wget вычищены — там нужен
# node -e "fetch(...)".
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", ".output/server/index.mjs"]
```

Заметки:
- `--mount=type=secret,id=npmrc` сохранён (как в SPA). **Но**: скилл `/release`
  SPA-шаблона зовёт `docker buildx build -t … --push .` — **без `-f docker/Dockerfile`
  и без `--secret`**, а корневого `Dockerfile` в репо нет (проверено `ls`). В
  SSR-шаблоне это надо починить сразу: `docker buildx build -f docker/Dockerfile
  --secret id=npmrc,src=$HOME/.npmrc -t … --push .`.
- Для slim-варианта HEALTHCHECK меняется на
  `CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`.
- distroless (`gcr.io/distroless/nodejs24`) даёт меньший образ, но нет shell/wget и
  другой источник образа — для шаблона не берём, оставляем комментарием.
- corepack: следить за планами Node по его отвязке; фолбэк — `npm i -g pnpm@10.0.0`.

### 3.2 `.dockerignore` — дельта к SPA-версии

```
+ .output
+ .nitro
+ .tanstack
  dist                 # остаётся (dist/client тоже мусор в контексте)
- docker/Dockerfile    # убрать: с -f он читается вне контекста, запись бессмысленна
```

### 3.3 Nitro / prerender / routeRules (черновик)

```ts
// vite.config.ts — черновик
export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: { enabled: true, crawlLinks: true, failOnError: true },
      pages: [
        { path: '/',        prerender: { enabled: true } },
        { path: '/about',   prerender: { enabled: true } },
        { path: '/pricing', prerender: { enabled: true } },
      ],
    }),
    nitro(),      // из 'nitro/vite'
    viteReact(),
  ],
})
```

```ts
// nitro.config.ts — черновик
export default defineConfig({
  preset: 'node-server',
  compressPublicAssets: { gzip: true, brotli: true },

  // Дефолт — memory (lru-cache): релиз = новый контейнер = пустой кеш =
  // автоматическая инвалидация. fs/redis требуют ручного flush при бампе.
  storage: { cache: { driver: 'lru-cache', max: 500 } },

  routeRules: {
    // Базовая линия для HTML: всегда перепроверяем, ETag отдаёт 304.
    '/**': { headers: { 'cache-control': 'no-cache' } },

    // Хешированные ассеты Vite. Базу проверить на спайке (Vite default /assets/).
    '/assets/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },

    // Полудинамика: SWR в памяти процесса.
    '/blog/**':    { swr: 600 },
    '/catalog/**': { swr: 300 },

    // Персонализированное — никогда.
    '/profile/**': { cache: false, headers: { 'cache-control': 'private, no-store' } },
    '/api/**':     { cache: false },

    '/robots.txt':  { headers: { 'cache-control': 'public, max-age=3600' } },
    '/sitemap.xml': { headers: { 'cache-control': 'public, max-age=3600' } },
  },
})
```

Правила, которые стоит зафиксировать текстом в `.claude/rules/` шаблона:

1. **HTML с сессией не кешируется никогда.** Любой маршрут с guard'ом или
   session-зависимой разметкой — `cache: false`. (ocache 0.3 по умолчанию вырезает
   cookies из закешированного ответа и игнорирует query — то есть утечка требует
   явной ошибки в `allowCookies`/`varies`, но правило всё равно пишем.)
2. **`isr` в этом шаблоне запрещён** — он про CDN-кеш Vercel/Netlify, у нас его нет;
   вместо него `swr`.
3. **Инвалидация = релиз.** Драйвер кеша `memory` by design. Переход на `fs`/`redis`
   обязан добавлять `RELEASE` в `base`/`name` ключа или flush на старте.
4. **Cache-Control HTML**: `no-cache`, не `max-age`. `max-age` на HTML на своём домене
   без CDN даёт только застрявшие у пользователей страницы после релиза.
5. Prerender — для страниц **без** персонализации и **без** свежих данных.
   Prerendered HTML тоже отдаётся с `no-cache` + ETag (файл статичен, но его
   содержимое меняется от релиза к релизу).
6. **CDN — не в шаблоне.** Швы (`s-maxage`, `isr`) остаются; если проект позже
   решит, сравнивать надо Cloudflare (быстро, но для РФ-аудитории — отдельная
   оценка доступности/латентности) и Yandex Cloud CDN (origin-pull, договор).
   *Это оценка, не проверенный факт.*

### 3.4 `compose/site.yml` для infra-шаблона (черновик)

```yaml
services:
  site:
    image: ${REGISTRY_HOST:-git.stit.tech}/${PROJECT_NAME}/site:${SITE_TAG}
    container_name: site
    restart: unless-stopped
    profiles: [site]

    # PID-1 reaper: Nitro сам ставит обработчики SIGTERM/SIGINT, но init бесплатен.
    init: true
    read_only: true
    tmpfs: ["/tmp"]
    # NITRO_SHUTDOWN_TIMEOUT (15s) должен помещаться в grace period, иначе SIGKILL.
    stop_grace_period: 20s

    environment:
      NODE_ENV: production
      PORT: "3000"
      NITRO_SHUTDOWN_TIMEOUT: "15000"
      NODE_OPTIONS: --max-old-space-size=384
      ENV: ${ENV}
      SITE_URL: https://${DOMAIN}
      # Server-side: внутренний адрес, в HTML не попадает.
      API_BASE_URL: http://backend:8080
      # Browser-side: уезжает в разметку.
      PUBLIC_API_BASE_URL: https://api.${DOMAIN}
      API_MODE: ${SITE_API_MODE:-real}
      ROBOTS_POLICY: ${ROBOTS_POLICY:-index}
      SENTRY_DSN: ${SITE_SENTRY_DSN:-}
      SENTRY_ENVIRONMENT: ${ENV}
      RELEASE: ${SITE_TAG}
      LOG_LEVEL: ${SITE_LOG_LEVEL:-info}
      CACHE_SWR_TTL: ${SITE_CACHE_SWR_TTL:-600}

    mem_limit: 512m
    cpus: 1.0

    # proxy — вход от Traefik; backend-net — SSR-фетчи в backend.
    # depends_on намеренно нет: падение backend'а не должно мешать сайту
    # подняться и отрисовать страницу ошибки.
    networks: [proxy, backend-net]

    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 15s

    labels:
      traefik.enable: "true"
      traefik.docker.network: proxy

      # Корневой домен — исключение из сабдоменного канона; перебивает landing
      # (у того priority=1, у нас default = длина правила).
      traefik.http.routers.site.rule: Host(`${DOMAIN}`)
      traefik.http.routers.site.entrypoints: websecure
      traefik.http.routers.site.tls: "true"
      traefik.http.routers.site.tls.certresolver: letsencrypt
      traefik.http.routers.site.middlewares: crowdsec@file,rate-limit@file,secure-headers@file,compress@file

      # Отдельный роутер под www: 301 на apex, дальше ничего не считаем.
      traefik.http.routers.site-www.rule: Host(`www.${DOMAIN}`)
      traefik.http.routers.site-www.entrypoints: websecure
      traefik.http.routers.site-www.tls: "true"
      traefik.http.routers.site-www.tls.certresolver: letsencrypt
      traefik.http.routers.site-www.middlewares: crowdsec@file,www-to-apex@file
      traefik.http.routers.site-www.service: site

      traefik.http.services.site.loadbalancer.server.port: "3000"
      # Traefik не читает docker healthcheck — свой нужен, чтобы при
      # force-recreate трафик не уходил в ещё не слушающий процесс.
      traefik.http.services.site.loadbalancer.healthcheck.path: /healthz
      traefik.http.services.site.loadbalancer.healthcheck.interval: 5s
      traefik.http.services.site.loadbalancer.healthcheck.timeout: 2s
```

Про масштабирование: `replicas`/`scale` **несовместимы** с `container_name`
(проверено). Инвариант инфра-шаблона требует `container_name` (на нём висят
`make logs/restart/recreate/exec`). Вывод: **вертикальное** масштабирование
(`cpus`/`mem_limit`) — дефолт; горизонтальное = осознанный отказ от `container_name`
для одного сервиса + пересмотр ops-вербов. В шаблон не закладываем, пишем как
известное ограничение.

Про `deploy.resources`: не использовать (в non-swarm применяется ненадёжно);
`mem_limit`/`cpus` — то, что инфра-правило уже и предлагает.

### 3.5 Env-контракт SSR-сервиса

| Имя | Назначение | Дефолт | Секрет | Откуда | Попадает в HTML |
|---|---|---|---|---|---|
| `PORT` | порт слушателя | `3000` | нет | Dockerfile `ENV` | нет |
| `HOST` | bind-адрес | `0.0.0.0` | нет | Dockerfile `ENV` | нет |
| `NODE_ENV` | режим | `production` | нет | Dockerfile `ENV` | нет |
| `NODE_OPTIONS` | `--max-old-space-size=384` (≈75 % `mem_limit`) | — | нет | compose | нет |
| `NITRO_SHUTDOWN_TIMEOUT` | дренаж, мс; ≤ `stop_grace_period` | `15000` | нет | compose | нет |
| `ENV` | слаг среды (`dev`/`staging`/`prod`) | — | нет | `.env` VPS | нет |
| `SITE_URL` | канонический абсолютный origin (canonical/OG/sitemap/robots) | `https://${DOMAIN}` | нет | compose из `DOMAIN` | **да** |
| `API_BASE_URL` | база для **серверных** фетчей | `http://backend:8080` | нет | compose | **нет (инвариант)** |
| `PUBLIC_API_BASE_URL` | база для **браузерных** фетчей | `https://api.${DOMAIN}` | нет | compose | **да** |
| `API_MODE` | `real` \| `mock` | `real` | нет | `.env` (`SITE_API_MODE`) | да |
| `ROBOTS_POLICY` | `index` \| `noindex` → `X-Robots-Tag` + `robots.txt` | `index` (на staging-VPS `noindex`) | нет | `.env` | да (как мета/заголовок) |
| `SENTRY_DSN` | DSN | `""` | public by design | `.env` (`SITE_SENTRY_DSN`) | да (клиентская половина) |
| `SENTRY_ENVIRONMENT` | окружение Sentry | `${ENV}` | нет | compose | да |
| `RELEASE` | версия для Sentry/логов | `${SITE_TAG}` | нет | compose | да |
| `LOG_LEVEL` | `debug`\|`info`\|`warn`\|`error` | `info` | нет | `.env` | нет |
| `CACHE_SWR_TTL` | TTL SWR-кеша HTML, с | `600` | нет | `.env` | нет |
| `CACHE_DRIVER` | `memory`\|`fs`\|`redis` | `memory` | нет | `.env` (опц.) | нет |
| `REDIS_URL` | только при `CACHE_DRIVER=redis` | — | **да** | `.env` (опц.) | нет |
| `STAGING_BASIC_AUTH_USERS` | htpasswd-строки для Traefik `basicAuth` | — | **да** | `.env`, рендерится в dynamic-конфиг | нет |

**Инвариант, которого не было в SPA:** в SPA весь конфиг был публичным по построению
(он жил в `/config.js`). В SSR внутренние значения физически лежат в том же
`process.env`, что и публичные. Поэтому:

- `src/shared/config/server.ts` — Zod-валидированный **полный** конфиг, импорт
  разрешён только из серверного графа;
- `src/shared/config/public.ts` — явный whitelist ключей, только он сериализуется
  в `window.__APP_CONFIG__`;
- ESLint `no-restricted-imports` на `shared/config/server` вне `app/`/`*/api/` +
  unit-тест: «в отрендеренном HTML нет подстроки `backend:8080` и нет ни одного
  ключа, которого нет в whitelist».

### 3.6 Дельта к `configs/traefik/dynamic/middlewares.yml.tpl` (черновик)

```yaml
http:
  middlewares:
    # ── существующие: crowdsec, secure-headers, rate-limit ──
    secure-headers:
      headers:
        # sslRedirect УДАЛЁН в Traefik v3 (и избыточен: http→https делает
        # redirection на entrypoint web). contentSecurityPolicy здесь НЕ ставим —
        # CSP с nonce формирует приложение, middleware перезаписал бы его.
        forceSTSHeader: true
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        contentTypeNosniff: true
        referrerPolicy: "strict-origin-when-cross-origin"
        frameDeny: true

    # ── новое ──
    compress:
      compress:
        # text/event-stream исключается автоматически; при chunked/flush
        # minResponseBodyBytes игнорируется — streaming SSR сжимается.
        minResponseBodyBytes: 1024

    www-to-apex:
      redirectRegex:
        # ${1} переживает envsubst (не валидный идентификатор) — проверено.
        regex: "^https?://www\\.${DOMAIN}/(.*)"
        replacement: "https://${DOMAIN}/${1}"
        permanent: true

    # staging-only: подключается к роутеру только когда ENV != prod
    staging-noindex:
      headers:
        customResponseHeaders:
          X-Robots-Tag: "noindex, nofollow, noarchive"

    staging-auth:
      basicAuth:
        # usersFile, а не users: в dynamic-файле нет удвоения `$`.
        usersFile: /etc/traefik/dynamic/staging.htpasswd
        realm: "staging"

    retry:
      retry:
        attempts: 2
        initialInterval: 100ms
```

Порядок цепочки сайта: `crowdsec` (WAF дешевле всего) → `rate-limit` →
`secure-headers` → `compress`. `www-to-apex` висит на отдельном роутере `site-www`,
чтобы не гонять regexp на каждом apex-запросе.

`rate-limit` для сайта **оставляем как есть** (100 r/s avg / 200 burst на IP):
Googlebot и близко столько не даёт, а нижняя планка защищает от простого флуда.
Отдельного «мягкого» лимита для ботов не нужно — верифицированные боты и так
проходят по rate-limit, а от WAF их защищает whitelist (§3.7).

### 3.7 CrowdSec: черновики

**(а) Починить acquisition** (без этого всё остальное декоративно). Два варианта:

```yaml
# Вариант A — файл (минимальная правка acquis.yaml не требуется):
# traefik.yml.tpl:
accessLog:
  filePath: /var/log/traefik/access.log
  format: json
  fields:
    headers:
      names:
        X-Request-Id: keep
  filters:
    # 2xx нужны и аналитике ботов, и http-crawl-non_statics.
    minDuration: 0s
# compose/traefik.yml:  volumes: [ traefik-logs:/var/log/traefik ]
# compose/crowdsec.yml: volumes: [ traefik-logs:/var/log/traefik:ro ]
```

```yaml
# Вариант B — docker-источник (без общего volume):
# configs/crowdsec/acquis.yaml
---
source: docker
container_name:
  - traefik
labels:
  type: traefik
# + crowdsec нужен доступ к /var/run/docker.sock:ro
```

Вариант A ближе к текущему устройству (уже есть `acquis.yaml` с `type: traefik`),
вариант B не требует бинда `/var/log` с хоста. Выбор — за владельцем инфра-шаблона.

**(б) Whitelist поисковиков** — одна строка в `compose/crowdsec.yml`:

```yaml
environment:
  COLLECTIONS: "crowdsecurity/traefik crowdsecurity/linux crowdsecurity/sshd"
  POSTOVERFLOWS: "crowdsecurity/rdns crowdsecurity/seo-bots-whitelist"
  GID: "1000"
```

**(в) Локальная страховка** — если хаб-данные отстают (черновик,
`configs/crowdsec/postoverflows/seo-bots-local.yaml`):

```yaml
name: project/seo-bots-local
description: "Страховка поверх crowdsecurity/seo-bots-whitelist: rDNS Google/Yandex"
# rDNS уже обогащён crowdsecurity/rdns. Whitelist по UA НЕ делаем — UA подделывается.
whitelist:
  reason: "verified search engine crawler (forward-confirmed rDNS)"
  expression:
    - |
      evt.Enriched.reverse_dns endsWith ".googlebot.com."
      || evt.Enriched.reverse_dns endsWith ".google.com."
      || evt.Enriched.reverse_dns endsWith ".yandex.ru."
      || evt.Enriched.reverse_dns endsWith ".yandex.net."
      || evt.Enriched.reverse_dns endsWith ".yandex.com."
      || evt.Enriched.reverse_dns endsWith ".search.msn.com."
```

**(г) Корп-сторона.** `commercial-crawlers.yaml` менять не обязательно (Googlebot/
YandexBot там нет). Но для **проектного** сайта, если его когда-нибудь скопируют,
нужна пометка: UA `ClaudeBot`/`GPTBot`/`CCBot`/`meta-externalagent` — это источник
трафика из LLM-ответов, бан их — продуктовое решение, а не гигиена. Предлагаю
завести в `corp-infra-template/.claude/rules/crowdsec-whitelist.md` абзац «поисковые
и AI-краулеры на индексируемых поверхностях» и не копировать сценарий в проект
как есть.

### 3.8 Release / rollout

Изменения в скилле `/release` SSR-шаблона относительно SPA-версии:

1. **Команда сборки** — чинится баг SPA-версии:
   ```bash
   docker buildx build \
     -f docker/Dockerfile \
     --secret id=npmrc,src="$HOME/.npmrc" \
     -t "$REGISTRY/$ORG/site:vX.Y.Z" --push .
   ```
2. **Один Node-образ**, формулировка «build node → nginx» уходит; runtime config
   через `/config.js` уходит; вместо неё — «среда конфигурируется env-переменными
   контейнера, сервер читает их на каждом запросе».
3. **Имя сервиса и тега.** Если форк называется `<org>/site` → `SVC=site`, `SITE_TAG`.
   Это позволяет проекту одновременно иметь `frontend` (SPA-приложение на
   `app.${DOMAIN}`) и `site` (SSR-витрина на корне). Итоговое имя — решение потока 05.
4. **INFRA-HANDOFF** — блок `ENV:` перестаёт быть «обычно —», у SSR он практически
   всегда непустой при первом развороте:
   ```
   === INFRA HANDOFF · <org>/site vX.Y.Z ===
   WHAT:   новый образ git.stit.tech/<org>/site:vX.Y.Z
   ACTION: в <org>/infra: make bump SVC=site TAG=vX.Y.Z
   ENV:    SITE_TAG, SITE_URL, PUBLIC_API_BASE_URL, ROBOTS_POLICY,
           SITE_SENTRY_DSN, SITE_LOG_LEVEL, SITE_CACHE_SWR_TTL
           (+ COMPOSE_PROFILES += site; при первом развороте — снять landing)
   RISK:   окно 1–5 с при force-recreate; кеш SWR холодный после бампа
   ===
   ```
5. **Retirement `landing.yml`.** Первый разворот SSR на корень: `landing` можно
   не трогать (его перебьёт приоритет), но правильный финал — удалить
   `compose/landing.yml` + `configs/landing/`. Это работа `/de-template` в
   infra-репо, триггер — запись в `stack § Service map` с `subtype: frontend`,
   `hosting: here`, роут = корень.
6. **Zero-downtime.** `make bump` → `up -d --no-deps --force-recreate` — окно
   недоступности. Меры (по возрастанию цены):
   - Traefik-side healthcheck сервиса (§3.4) — Traefik не шлёт трафик в
     неподнявшийся контейнер, клиент видит 503, а не 502-«connection refused»;
   - `retry@file` на цепочке — добивает единичные гонки;
   - `--wait --wait-timeout 90` в `make bump` — команда не завершается «успешно»
     при битом образе;
   - blue/green двумя сервисами с флипом `priority` — **избыточно** для одного VPS,
     в шаблон не кладём.
7. **Rollback** — тот же верб со старым тегом: `make bump SVC=site TAG=v1.2.2`.
   Работает без изменений.

### 3.9 Что менять в `project-infra-template-compose`

| Файл | Что |
|---|---|
| `compose/site.yml` | **новый**, образец из §3.4, профиль `site` |
| `compose/landing.yml` | не менять код; в комментарии — явный триггер retirement (SSR на корне) |
| `compose/crowdsec.yml` | `POSTOVERFLOWS: "crowdsecurity/rdns crowdsecurity/seo-bots-whitelist"`; volume/сокет под починку acquisition |
| `compose/traefik.yml` | volume `traefik-logs` (вариант A); `- "443:443/udp"` если включаем HTTP/3 |
| `configs/traefik/traefik.yml.tpl` | `accessLog.filePath`, снять/расширить `filters.statusCodes`, `fields.headers.names.X-Request-Id: keep`; (опц.) `http3` на websecure; (опц.) `serversTransport.forwardingTimeouts.idleConnTimeout` под keep-alive |
| `configs/traefik/dynamic/middlewares.yml.tpl` | убрать `sslRedirect`; добавить `compress`, `www-to-apex`, `retry`, `staging-noindex`, `staging-auth` (§3.6) |
| `configs/crowdsec/acquis.yaml` | под выбранный вариант acquisition |
| `configs/crowdsec/postoverflows/seo-bots-local.yaml` | **новый** (страховка, §3.7в) |
| `.env.example` | секция `# ───── profile site (SSR frontend) ─────`: `SITE_TAG`, `SITE_API_MODE`, `ROBOTS_POLICY`, `SITE_SENTRY_DSN`, `SITE_LOG_LEVEL`, `SITE_CACHE_SWR_TTL`, `STAGING_BASIC_AUTH_USERS` — у каждой комментарий «как получить» (иначе `make validate` красный) |
| `Makefile` → `bump` | добавить `--wait --wait-timeout 90` |
| `scripts/deploy.sh` → `ROLE_FILES[edge]` | дописать `compose/site.yml` (список ролей перечислен явно) |
| `scripts/preflight-dns.sh` | при профиле `site` добавить в `hosts` `www.$DOMAIN` (иначе LE на www не выпустится молча) |
| `scripts/tools/smoke.d/90-site.sh` | **новый** drop-in: TTFB по 2–3 URL, `OOMKilled`, restart-count → `ATTENTION:` |
| `.claude/rules/traefik-routing.md` | раздел «Корневой домен и www»: корень — задокументированное исключение из сабдоменного канона; www — отдельный роутер с `redirectRegex`; `${1}` и envsubst |
| `.claude/rules/compose-and-services.md` | абзац «SSR/Node-сервисы»: `init: true`, `read_only` + `tmpfs`, согласование `stop_grace_period` ↔ `NITRO_SHUTDOWN_TIMEOUT`, `mem_limit` вместо `deploy.resources`, запрет `replicas` при `container_name` |
| `docs/reference/architecture.md` | `site` переезжает из «overlay-services» в основную схему (корень `${DOMAIN}`); строка про `compose/frontend.yml` актуализируется |
| `docs/project/README.md` § «Generates → инфра» | новая строка: `frontend` (`hosting: here`, SSR) → профиль `site` → `compose/site.yml`; текущее «`frontend (hosting: here)` → — (always-on landing)» верно только для статики |
| `docs/project/_templates/service.md` | в подсказках `Hosting`/`Route` упомянуть SSR-вариант (профиль `site`, корневой домен, www-редирект, порт 3000) |
| `.claude/skills/add-service/SKILL.md` | вариант «SSR-сервис на корневом домене»: два роутера, Traefik-side healthcheck, `init`, env-контракт public/server |
| `.claude/skills/de-template/…` | при SSR-фронте на корне — прунить `compose/landing.yml` + `configs/landing/` |

### 3.10 Что менять в самом SSR-шаблоне (относительно SPA)

| Файл SPA | Судьба |
|---|---|
| `docker/nginx.conf` | **удалить** (SPA-fallback, `/assets` immutable, `/config.js` no-store, `/healthz`, gzip — всё переезжает в `routeRules` + Traefik `compress` + server route) |
| `docker/nginx-entrypoint.sh` | **удалить** (конфиг читается из `process.env` на сервере) |
| `public/config.js` + `<script src="/config.js">` в `index.html` | **удалить**; public-конфиг инлайнится сервером в SSR-разметку с nonce |
| `docker/Dockerfile` | переписан (§3.1) |
| `.dockerignore` | +`.output`, `.nitro`, `.tanstack` (§3.2) |
| `docs/reference/deployment.md` | переписан целиком: Node-образ, env-контракт (§3.5), кеш-слои (§3.3), health/логи, rollout |
| `.claude/skills/release/SKILL.md` | §3.8 |
| `docs/stack/config.md` (kind `config`) | § «Runtime config keys» получает колонку **«в HTML? да/нет»** — это новый инвариант |
| `docs/stack/runtime.md` | Node-рантайм, пресет, graceful shutdown, лимиты, keep-alive |
| новый `src/routes/healthz.ts` | server route, 200 `ok` (без версии — лишнее раскрытие) |
| новый `.claude/rules/cache-and-rendering.md` | 6 правил из §3.3 |
| `pnpm check` | без изменений по составу; в `test` добавляется проверка «нет внутренних URL в HTML» |

---

## 4. Кеширование без CDN — сводная таблица решений

| Тип контента | Механизм | `Cache-Control` | Инвалидация |
|---|---|---|---|
| Хешированные JS/CSS (`/assets/**`) | `.output/public` + pre-compressed | `public, max-age=31536000, immutable` | смена хеша в имени |
| Прочая статика (`/favicon.ico`, `/og/*.png`) | `.output/public` | `public, max-age=86400` | ручная / имя файла |
| Prerendered HTML (лендинг, /about, /legal) | `prerender` на билде | `no-cache` + ETag | релиз (новый образ) |
| Полудинамика (блог, каталог) | `routeRules.swr: N` в memory | `no-cache` + ETag (ответ может быть stale) | TTL + релиз |
| SSR-miss (динамика без сессии) | рендер на запрос | `no-cache` + ETag | — |
| Персонализированный HTML | `cache: false` | `private, no-store` | — |
| `robots.txt` / `sitemap.xml` | server route | `public, max-age=3600` | TTL |
| Ответы API через SSR-прокси (если включён) | `cache: false` | как отдал backend | — |

Когда какой драйвер кеша:

| Драйвер | Когда | Цена |
|---|---|---|
| `lru-cache` (memory) — **дефолт** | один контейнер, TTL минуты | кеш холодный после релиза/рестарта (и это фича: авто-инвалидация) |
| `fs` | дорогой рендер (внешние API, тяжёлый markdown), холодный старт заметен | нужен writable volume (ломает `read_only`), нужен flush при релизе |
| `redis` | >1 реплики или split-хосты | новый сервис в стеке (`compose/redis.yml` + backend-net), новый секрет, новый backup-вопрос |

---

## 5. Альтернатива «SSR-сервер + nginx sidecar для статики» — вердикт: **не нужна**

Аргументы против (по убыванию веса):

1. **Проблемы, ради которой sidecar ставят, здесь нет.** Классический аргумент
   «Node медленно отдаёт статику» — про `express.static` со `stat()` на запрос.
   Nitro кладёт в `.output/public` **встроенный манифест** (MIME/ETag/mtime/size) и
   отдаёт «without filesystem scanning» (проверено), плюс `compressPublicAssets`
   снимает сжатие с рантайма на билд.
2. **Version skew.** Sidecar'у нужны те же ассеты: либо второй образ, либо общий
   volume, наполняемый из первого. Оба варианта ломают «один образ = один артефакт
   релиза» и создают окно, когда nginx отдаёт старые хеши к новому HTML → белый
   экран у пользователя.
3. **Удвоение эксплуатационной поверхности** на одном VPS: ещё один
   `container_name`, healthcheck, набор labels, конфиг, апдейт базового образа —
   против инварианта «один сервис = один файл, минимум движущихся частей».
4. **Роутинг усложняется**: `/assets/**` на nginx, остальное на Node → path-based
   разделение на корневом домене, ровно то, от чего инфра-правило отговаривает.
5. **Правильный рычаг находится выше.** Если статика однажды станет узким местом,
   ответ — CDN или кеш на Traefik, а не второй контейнер за тем же Traefik'ом на
   том же диске и том же сетевом стеке.

Единственный сценарий, где sidecar выигрывает: раздача десятков ГБ
пользовательских файлов с локального диска. В этом стеке это работа MinIO
(`s3.${DOMAIN}`), а не nginx.

**Компромисс, если очень хочется**: не sidecar, а `traefik` + плагин кеша, или
перенос `/assets/**` на отдельный `static.${DOMAIN}` (тот же образ, другой роутер) —
но и это выглядит как преждевременная оптимизация.

---

## 6. Риски и открытые вопросы

### Требуют решения владельца

1. **Имя сервиса/форка**: `site` vs `frontend`. От него зависят `SITE_TAG`/`FRONTEND_TAG`,
   имя compose-файла, INFRA-HANDOFF и то, может ли проект иметь одновременно SPA-
   приложение и SSR-витрину. (Пересекается с потоком 05.)
2. **Nitro v3 в beta.** TanStack Start документирует `nitro/vite` (v3 beta,
   `3.0.260903-beta`), стабилен только `nitropack` 2.13.4 через
   `@tanstack/nitro-v2-vite-plugin`. Шаблон, который форкают клиенты, встаёт на beta.
   Варианты: (а) принять и пришпилить точную beta-версию, (б) стартовать на
   nitro-v2-плагине и мигрировать, (в) отложить шаблон до v3 stable.
3. **Банить ли AI-краулеров** (`GPTBot`, `ClaudeBot`, `CCBot`, `meta-externalagent`)
   на клиентских сайтах. Это продуктовое решение, не гигиена.
4. **HTTP/3 включать?** Стоит `- "443:443/udp"` + `http3: {}`; выигрыш для RU-мобайла
   реальный, но это правка static-конфига Traefik (рестарт) и +1 порт в firewall.
5. **Basic-auth на staging** — да/нет. Ломает внешние Lighthouse/PageSpeed-прогоны.

### Проверить на спайке (обязательно)

1. **Keep-alive Node ↔ Traefik.** Какие дефолты у srvx/Nitro для `keepAliveTimeout`/
   `headersTimeout` и можно ли их задать без кастомного `server.ts`. Без ответа —
   риск спорадических 502 в проде (§2.8).
2. **`.output/public` действительно содержит клиентский бандл** и отдаёт его с
   `Cache-Control: …immutable` (`curl -I`). Есть открытый баг про `build.assetsDir`
   vs `publicAssets` ([TanStack/router#5754](https://github.com/TanStack/router/issues/5754)).
   Заодно — реальная база ассетов (`/assets/` или иная).
3. **Nonce-CSP в TanStack Start**: пробрасывается ли nonce в гидрационный inline-скрипт
   и module-preload. Если нет — весь §2.10 переписывается.
4. **`sslRedirect` в живом Traefik v3.6/3.7**: ронит ли неизвестное поле весь
   dynamic-файл (`docker logs traefik | grep 'field not found'`). Если да — в
   текущем шаблоне `secure-headers@file`/`rate-limit@file`/`crowdsec@file`
   **не применяются вовсе**, и это критичнее всего остального в отчёте.
5. **CrowdSec acquisition**: подтвердить на живом VPS, что `/var/log/traefik/*.log`
   пуст/отсутствует (`docker exec crowdsec cscli metrics` → строки по acquisition).
6. **Реальный размер образа и RSS** под нагрузкой (`docker stats`, `ab`/`oha` на
   prerendered vs SSR-маршрут) — подтвердить `mem_limit: 512m` и `cpus: 1.0`.
7. **Поведение Traefik `compress` поверх уже пре-сжатых ассетов** (Nitro отдаёт
   `Content-Encoding: br`) — нет ли двойного сжатия/битых ответов.
8. **Streaming SSR через Traefik**: не буферизуется ли первый чанк (`curl -N`,
   тайминг первого байта против `--no-buffer` напрямую в контейнер).

### Принятые компромиссы (документировать, не чинить)

- Окно недоступности 1–5 с при `make bump` — цена отсутствия HA на одном VPS.
- Горизонтальное масштабирование несовместимо с `container_name` — шаблон выбирает
  `container_name` (на нём ops-вербы).
- Кеш SWR холодный после каждого релиза — сознательный размен на отсутствие
  ручной инвалидации.
- Метрик Prometheus нет; наблюдаемость = Sentry + smoke-drop-in в cockpit.

---

## 7. Источники

**TanStack Start / Nitro**
- https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
- https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- https://nitro.build/deploy
- https://nitro.build/deploy/runtimes/node
- https://nitro.build/docs/routing
- https://nitro.build/docs/cache
- https://nitro.build/docs/assets
- https://nitro.build/docs/storage
- https://nitro.build/docs/vite
- https://nitro.build/config
- https://nitro.build/examples/vite-ssr-tss-react
- https://github.com/nitrojs/nitro/releases
- https://github.com/TanStack/router/issues/5754
- https://deepwiki.com/TanStack/router/5.7-start-deployment
- https://docs.railway.com/guides/tanstack-start
- https://registry.npmjs.org/nitro · /nitropack · /@tanstack/react-start · /@tanstack/nitro-v2-vite-plugin · /@sentry/node
- https://unstorage.unjs.io/drivers/lru-cache

**Node / Docker**
- https://nodejs.org/en/about/previous-releases
- https://raw.githubusercontent.com/nodejs/docker-node/main/24/bookworm-slim/Dockerfile
- https://developers.redhat.com/articles/2025/10/10/nodejs-20-memory-management-containers
- https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/
- https://dev.to/axiom_agent/dockerizing-nodejs-for-production-the-complete-2026-guide-7n3
- https://github.com/docker/compose/issues/3722
- https://docs.docker.com/reference/compose-file/deploy/

**Traefik**
- https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/
- https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/
- https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/ratelimit/
- https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/redirectregex/
- https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/basicauth/
- https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/
- https://doc.traefik.io/traefik/v3.4/routing/entrypoints/
- https://raw.githubusercontent.com/traefik/traefik/master/docs/content/migrate/v2-to-v3-details.md
- https://github.com/traefik/traefik/releases/tag/v3.7.13
- https://github.com/traefik/traefik/issues/12673
- https://github.com/traefik/traefik/pull/11511
- https://github.com/traefik/traefik/issues/10932
- https://iximiuz.com/en/posts/reverse-proxy-http-keep-alive-and-502s/
- https://github.com/nodejs/node/issues/52649

**CrowdSec**
- https://app.crowdsec.net/hub/author/crowdsecurity/configurations/seo-bots-whitelist
- https://docs.crowdsec.net/docs/next/log_processor/whitelist/create_postoverflow/
- https://docs.crowdsec.net/docs/next/whitelist/create/
- https://raw.githubusercontent.com/crowdsecurity/crowdsec/master/build/docker/README.md

**Sentry**
- https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/

**Локальные репо (read-only)**
- `/home/mm/git/stit-core/spa-frontend-template/{docker/*,docs/reference/deployment.md,.claude/skills/release/SKILL.md,.dockerignore,package.json}`
- `/home/mm/git/stit-core/project-infra-template-compose/{README.md,CLAUDE.md,Makefile,docker-compose.yml,compose/*.yml,configs/**,scripts/{deploy,render-configs,preflight-dns}.sh,.env.example,.claude/rules/*.md,.claude/skills/add-service/SKILL.md,docs/reference/architecture.md,docs/project/{README.md,_templates/service.md}}`
- `/home/mm/git/stit-core/corp-infra-template/{configs/crowdsec/**,.claude/rules/crowdsec-whitelist.md}`
