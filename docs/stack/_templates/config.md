---
id: stack.config
kind: config
name: config
status: draft
---

# config

Роллап всех ключей: env, объявленный любым другим kind'ом, обязан быть здесь. Читает их
только `src/shared/config` (`getRuntimeConfig()`, Zod по `process.env`); пустое значение
равносильно незаданному — берётся дефолт, значение вне формата — процесс не стартует
(`docker/server.mjs` проверяет env целиком до загрузки приложения).

## Runtime env контейнера

Колонка «в HTML?» — попадает ли значение в разметку: из env — только `SITE_URL` (штамповка
prerendered-выхода, `absoluteUrl()` на on-demand); публичные идентификаторы — поля `site.ts`.

| ключ | назначение | дефолт | в HTML? | секрет |
|---|---|---|---|---|
| `SITE_URL` | канонический origin без хвостового слеша; **обязателен** | — | да (штамповка) | нет |
| `PORT` / `HOST` | слушатель адаптера | `3000` / `0.0.0.0` | нет | нет |
| `NODE_OPTIONS` | например `--max-old-space-size=384` | — | нет | нет |
| `ROBOTS_POLICY` | `index \| noindex` — весь контур | `index` | нет | нет |
| `INDEXNOW_KEY` | ключ IndexNow; файл `/<ключ>.txt` | `''` | нет | нет |
| `RELEASE` | версия для логов и Sentry | `unknown` | нет | нет |
| `LOG_LEVEL` | порог JSON-лога | `info` | нет | нет |
| `KEEP_ALIVE_TIMEOUT_MS` / `SHUTDOWN_TIMEOUT_MS` | обёртка сервера | `65000` / `15000` | нет | нет |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | серверные исключения | `''` / `production` | нет | нет (DSN public by design) |
| `FORM_DELIVERY` | канал доставки заявки | `smtp` | нет | нет |
| `SMTP_URL` | подключение SMTP | `''` | нет | **да** |
| `FORM_TO` / `FORM_FROM` | получатель и отправитель письма | `''` | нет | нет |
| `FORM_BACKEND_URL` | адрес внутреннего приёмника заявок | `''` | нет | нет |
| `CAPTCHA_PROVIDER` | шов капчи | `none` | нет | нет |
| `CAPTCHA_SECRET` / `CAPTCHA_FAIL_MODE` | ключ верификации и поведение при недоступности | `''` / `open` | нет | **да** / нет |
| _<ключ>_ | _что_ | _дефолт_ | _да/нет_ | _да/нет_ |

Ключи формы и капчи нужны только при заведённом `api.md`. Полная таблица контракта с
пояснениями — `docs/reference/deployment.md`.

## Публичные идентификаторы сайта

Не env, а поля `src/shared/config/site.ts`: prerendered-страница печатается на сборке,
а образ собирается без env — runtime-значение до неё не доходит.

| поле | назначение | пусто значит |
|---|---|---|
| `SITE_NAME`, `SITE_DESCRIPTION`, `SITE_SAME_AS`, `SITE_LOGO_PATH` | идентичность и JSON-LD | — |
| `OG_DEFAULT_IMAGE` | социальная карточка по умолчанию | — |
| `AI_BOTS_POLICY` | политика ИИ-ботов: именная группа `robots.txt` и мета `deny-all` | — (умолчание `allow-all`) |
| `METRIKA_ID` | счётчик | сторонних скриптов нет |
| `SITE_VERIFICATION.google` / `.yandex` | подтверждение домена | тега нет |
| `PRIVACY_POLICY_VERSION` | редакция политики ПДн, уезжает с заявкой | — |

## Секреты

Секреты живут только в env контейнера и читаются on-demand кодом, где `process.env`
живой. Разметка env напрямую не читает (`process.env` вне `shared/config`, `import.meta.env`
кроме `DEV` и `getRuntimeConfig()` в `.astro` валят ESLint): из env в HTML уходит `SITE_URL`;
`.env` в образ не попадает. Значение для HTML — поле `site.ts` **и** строка в таблице `deployment.md`.

## Generates

- `src/shared/config/runtime.ts` — Zod-схема env
- `src/shared/config/site.ts` — идентичность и публичные идентификаторы
- `.env.example` — все ключи с дефолтами
- `docs/reference/deployment.md § Env-контракт`
- handoff в `<org>/infra` — какие ключи дописать в `.env` VPS

## Открытые вопросы

- _что_
