---
description: Безопасность рендера в трёх моментах — сборка (секреты не в клиенте, build-time значения), запрос (request-only API не в prerender, модульное состояние не в on-demand, prerender=false только с записью в rendering.md и Cache-Control), остров (server islands не для индексируемого).
paths: ["src/pages/**", "src/app/**", "src/**/api/**", "astro.config.ts"]
---

# Render-safety

Код живёт в одном из трёх моментов: **сборка** (prerender, `astro build`), **запрос**
(on-demand, middleware, endpoints) и **остров** (клиентский `<script>`). Ошибка — код,
написанный для одного момента, исполняется в другом. Режимы, карта маршрутов и заголовки —
`docs/reference/rendering.md`.

## Сборка (prerender)

- Frontmatter prerender-страницы исполняется один раз на `astro build`: `new Date()`,
  `getRuntimeConfig()`, `process.env` дают значения **сборки** (origin — плейсхолдер, который
  штампует entrypoint). Год в подвале — год релиза, это честно; «текущее время» — нет.
  `<meta name="robots">` prerendered-страницы — тоже значение сборки: staging закрывают
  `ROBOTS_POLICY` на on-demand (`robots.txt`, `X-Robots-Tag`) и Traefik
- Request-only API не в prerender-маршрутах: `Astro.request.headers` там пустой (Astro пишет
  warn), `Astro.url.search` и тело запроса — пустые, `Astro.clientAddress` бросает,
  `Astro.cookies` и `Astro.response.headers` ни на что не влияют. Нужен запрос — маршрут
  становится `dynamic` (`prerender = false`)
- Секреты и `process.env` не попадают в клиентский бандл и в HTML: среду читает только
  `shared/config` на сервере (`process.env` в другом модуле `src` валит ESLint); в разметку — только `PUBLIC_CONFIG_KEYS` через
  `getPublicConfig()`; `import.meta.env.VITE_*`/`PUBLIC_*` для среды не используются
- `Astro.site` и `astro:i18n` не строят абсолютные URL: на on-demand они вернули бы значение
  сборки — плейсхолдер. Origin — runtime `SITE_URL` (on-demand) или плейсхолдер в `<head>`
  prerendered-страницы, который штампует контейнер
- HTML на сборке не предсжимается: штамповка не заглянет внутрь `.br`/`.gz`

## Запрос (on-demand)

- `export const prerender = false` — только для служебных маршрутов (`404`, `healthz`, `now`,
  `robots.txt`/`sitemap.xml`/`rss.xml`, `[key].txt`, `api/*`) и только со строкой в карте маршрутов
  `docs/reference/rendering.md` и явным решением о `Cache-Control`: публичный HTML —
  `no-cache` (умолчание `app/middleware`, 404/410 включительно), живой или персональный —
  `private, no-store` в самом роуте (`Astro.response.headers`), middleware его не перебивает
- Модульное состояние (кеши, счётчики, `Map` на уровне модуля) в on-demand роутах — только по
  явному решению: оно общее для всех запросов процесса, живёт до рестарта и не видно второй
  реплике. Иммутабельные данные сборки (таблица редиректов) — допустимое исключение
- `getRuntimeConfig()` на on-demand — живой `process.env` контейнера; в лог — одна JSON-строка
  без PII, query, cookie и тел запросов, и только через `log()` из `shared/observability`
  (порог `LOG_LEVEL`): `console.*` напрямую мимо порога не пишут ни middleware, ни маршруты —
  ESLint `no-console`
- 404/410 — честный статус, не soft-404, с `noindex`; `X-Robots-Tag` staging действует только
  на on-demand — на prerendered его ставит Traefik

## Остров (клиент)

- Без островов нет ни байта JS; клиентский `<script>` — по решению: имя в `ISLANDS`
  (`scripts/lib/site-policy.mjs`), `data-island` на теге и строка бюджета (rule `shared-ui`);
  другой исполняемый скрипт валит `seo:check`; импорты острова линтит ESLint как обычный модуль
- Server islands (`server:defer`) — не для индексируемого контента: бот видит заглушку, а не
  данные; в reference-наборе их нет
- Cookie темы читает только остров: `Astro.cookies` на prerendered — значение сборки, поэтому
  сервер о выборе темы не знает и знать не может
- Hydration mismatch не актуален: фреймворка островов нет, разметку рисует только сервер

## Конфиг

`astro.config.ts`: `output: 'static'`, `build.format: 'directory'` (`'file'` с node-адаптером
отдаёт 404 на `/blog` и `/en`), `trailingSlash: 'never'`, `session: false` (fs-драйвер сессий
пишет в cacheDir), `prefetch: false` и без `<ClientRouter/>` (без островов — ни байта JS),
`experimentalDisableStreaming: true`, `markdown.syntaxHighlight: false` (Shiki инлайнит сырые
цвета мимо токен-слоя), плагин `yaml-modules` (`content/*.yaml` → данные на сборке);
`cache`/`routeRules` не задаются — рецепт D (`cached`) описан в `docs/reference/rendering.md` и
включается решением проекта, не шаблона. Интеграций `@astrojs/react` (фреймворк островов ради
одного переключателя) и `@astrojs/sitemap` (строит URL от build-time origin) нет.

Два значения там же живут ради единственного POST-маршрута: `security.checkOrigin: false`
(за прокси адаптер строит URL запроса как `http://<Host>` — origin сверяет `contact-form` с
runtime `SITE_URL`) и `bodySizeLimit` адаптера (дефолт 1 ГиБ выше потолка памяти процесса).
Правило — `.claude/rules/forms-antispam.md`.
