---
id: stack.observability
kind: observability
name: observability
status: draft
---

# observability

## Лог процесса

| поле | значение |
|---|---|
| формат | одна JSON-строка на событие: `ts`, `lvl`, `method`, `path`, `status`, `dur_ms`, `rid` |
| кто пишет | единственный `log()` (`src/shared/observability`); `console.*` мимо него не пишут |
| порог | `LOG_LEVEL` = `debug \| info \| warn \| error` (дефолт `info`) |
| корреляция | `X-Request-Id` — принимается от прокси или генерируется; тот же `rid` в логе и в Sentry |
| что видит лог | только on-demand ответы: prerendered отдаёт статик-хендлер адаптера до приложения |
| куда уходит | stdout контейнера → сборщик логов VPS |

**Чего в логе нет**: IP (он в access-log прокси), cookie, query-строки, тел запросов и тела
заявки. Это не настройка, а инвариант — PII в логах превращает журнал в объект 152-ФЗ.

## Ошибки

| поле | значение |
|---|---|
| приёмник | Sentry SaaS или self-hosted GlitchTip (совместим по API/SDK) |
| DSN | `SENTRY_DSN`; пусто (дефолт) — `@sentry/node` не грузится вовсе |
| что отправляется | исключение рендера с тегами `rid` и `path` |
| трассировка | выключена (`tracesSampleRate: 0`) — иначе нужен init до импорта приложения |
| среда и версия | `SENTRY_ENVIRONMENT`, `RELEASE` |

Отказы антиспам-лестницы (403/400/413) в Sentry не уходят: иначе один бот сжигает квоту.

## Клиентская телеметрия

| поле | значение |
|---|---|
| RUM / web-vitals | **нет** — на контентной странице 0 КБ JS, а RUM это скрипт на каждой странице |
| чем меряется скорость | `pnpm ttfb` на запущенном сервере, e2e-порог TTFB, PageSpeed Insights по ключевым URL, поле CWV в Search Console и Вебмастере |

## Здоровье

| поле | значение |
|---|---|
| liveness | `GET /healthz` → `200 ok`, `no-store`, без зависимостей; его же ждут `HEALTHCHECK` и Playwright |
| readiness | отдельного нет: процесс без внешних зависимостей готов, как только слушает порт |
| алерты | _на стороне `<org>/infra`: контейнер не поднялся, healthcheck красный, 5xx в access-log_ |

## Generates

- `src/shared/observability/*` — `log()` и отправка исключений
- `src/app/middleware/index.ts` — `X-Request-Id`, строка лога, лог ошибки рендера
- `src/pages/healthz.ts`
- `config.md` — env `LOG_LEVEL`, `RELEASE`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`

## Открытые вопросы

- _что_
