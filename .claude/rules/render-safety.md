---
description: Безопасность рендера в трёх моментах — сборка (секреты не в клиенте, build-time значения), запрос (request-only API не в prerender, модульное состояние не в on-demand, prerender=false только с записью в rendering.md и Cache-Control), остров (server islands не для индексируемого).
globs: ["src/pages/**", "src/app/**", "src/**/api/**", "astro.config.ts"]
---

# Render-safety

Код живёт в одном из трёх моментов: **сборка** (prerender, `astro build`), **запрос**
(on-demand, middleware, endpoints) и **остров** (клиентский `<script>`). Ошибка — код,
написанный для одного момента, исполняется в другом. Режимы, карта маршрутов и заголовки —
`docs/reference/rendering.md`.

## Сборка (prerender)

- Frontmatter prerender-страницы исполняется один раз на `astro build`: `new Date()`,
  `getRuntimeConfig()`, `process.env` дают значения **сборки** (origin — плейсхолдер, который
  штампует entrypoint). Год в подвале — год релиза, это честно; «текущее время» — нет
- Request-only API не в prerender-маршрутах: `Astro.request.headers` там пустой (Astro пишет
  warn), `Astro.url.search` и тело запроса — пустые, `Astro.clientAddress` бросает,
  `Astro.cookies` и `Astro.response.headers` ни на что не влияют. Нужен запрос — маршрут
  становится `dynamic` (`prerender = false`)
- Секреты и `process.env` не попадают в клиентский бандл и в HTML: среду читает только
  `shared/config` на сервере; в разметку — только `PUBLIC_CONFIG_KEYS` через
  `getPublicConfig()`; `import.meta.env.VITE_*`/`PUBLIC_*` для среды не используются
- `Astro.site` и `astro:i18n` не строят абсолютные URL: на on-demand они вернули бы значение
  сборки — плейсхолдер. Origin — runtime `SITE_URL` (on-demand) или плейсхолдер в `<head>`
  prerendered-страницы, который штампует контейнер
- HTML на сборке не предсжимается: штамповка не заглянет внутрь `.br`/`.gz`

## Запрос (on-demand)

- `export const prerender = false` — только для служебных маршрутов (`404`, `healthz`, `now`,
  `robots.txt`/`sitemap.xml`/`rss.xml`, `api/*`) и только со строкой в карте маршрутов
  `docs/reference/rendering.md` и явным решением о `Cache-Control`: публичный HTML —
  `no-cache` (умолчание `app/middleware`, 404/410 включительно), живой или персональный —
  `private, no-store` в самом роуте (`Astro.response.headers`), middleware его не перебивает
- Модульное состояние (кеши, счётчики, `Map` на уровне модуля) в on-demand роутах — только по
  явному решению: оно общее для всех запросов процесса, живёт до рестарта и не видно второй
  реплике. Иммутабельные данные сборки (таблица редиректов) — допустимое исключение
- `getRuntimeConfig()` на on-demand — живой `process.env` контейнера; в лог — одна JSON-строка
  без PII, query, cookie и тел запросов
- 404/410 — честный статус, не soft-404, с `noindex`; `X-Robots-Tag` staging действует только
  на on-demand — на prerendered его ставит Traefik

## Остров (клиент)

- Без островов нет ни байта JS; клиентский `<script>` — по решению, со строкой бюджета в
  `.size-limit.cjs` (rule `shared-ui`); его импорты линтит ESLint как обычный модуль
- Server islands (`server:defer`) — не для индексируемого контента: бот видит заглушку, а не
  данные; в reference-наборе их нет
- Hydration mismatch не актуален: фреймворка островов нет, разметку рисует только сервер

## Конфиг

`astro.config.ts`: `output: 'static'`, `build.format: 'directory'`, `trailingSlash: 'never'`,
`session: false`, `prefetch: false`, `experimentalDisableStreaming: true`; `cache`/`routeRules`
не задаются — рецепт D (`cached`) описан в `docs/reference/rendering.md` и включается решением
проекта, не шаблона.
