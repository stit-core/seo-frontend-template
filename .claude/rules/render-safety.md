---
description: Безопасность рендера в трёх моментах — сборка (секреты не в клиенте, build-time значения), запрос (request-only API не в prerender, модульное состояние не в on-demand, prerender=false только с записью в rendering.md и Cache-Control), остров (server islands не для индексируемого).
paths: ["src/pages/**", "src/app/**", "src/**/api/**", "public/**", "astro.config.ts"]
---

# Render-safety

Код живёт в одном из трёх моментов: **сборка** (prerender, `astro build`), **запрос**
(on-demand, middleware, endpoints) и **остров** (клиентский `<script>`). Ошибка — код,
написанный для одного момента, исполняется в другом. Режимы, карта маршрутов и заголовки —
`docs/reference/rendering.md`.

## Сборка (prerender)

- Frontmatter prerender-страницы (и обработчик prerendered-эндпоинта — фида) исполняется один раз
  на `astro build`: `new Date()`,
  `getRuntimeConfig()`, `process.env` дают значения **сборки** (origin — плейсхолдер, который
  штампует entrypoint). Год в подвале — год релиза, это честно; «текущее время» — нет.
  `<meta name="robots">` prerendered-страницы — тоже значение сборки: staging закрывают
  `ROBOTS_POLICY` (`robots.txt` и `X-Robots-Tag` обёртки процесса на каждом ответе) и Traefik
- Request-only API не в prerender-маршрутах: `Astro.request.headers` там пустой (Astro пишет
  warn), `Astro.url.search` и тело запроса — пустые, `Astro.clientAddress` бросает,
  `Astro.cookies` и `Astro.response.headers` ни на что не влияют. Нужен запрос — маршрут
  становится `dynamic` (`prerender = false`)
- Секреты и `process.env` не попадают в клиентский бандл и в HTML: среду читает только
  `shared/config` на сервере (`process.env` в другом модуле `src`, `getRuntimeConfig()` в
  `.astro` и `import.meta.env` кроме `DEV` валят ESLint); в разметку из env — только origin через
  `absoluteUrl()`
- `Astro.site` и `astro:i18n` не строят абсолютные URL: на on-demand они вернули бы значение
  сборки — плейсхолдер. Origin — runtime `SITE_URL` (on-demand) или плейсхолдер в `<head>`
  prerendered-страницы, который штампует контейнер
- HTML на сборке не предсжимается: штамповка не заглянет внутрь `.br`/`.gz`
- `public/` — только файлы, без симлинков: статик-хендлер адаптера идёт по симлинку внутри
  `dist/client`, и ссылка наружу отдала бы чужой файл; метод запроса он не смотрит — лишние
  методы режет edge (`docs/reference/infra-handoff.md § Edge`)

## Запрос (on-demand)

- `export const prerender = false` — только для служебных маршрутов (`404`, `healthz`, `now`,
  `robots.txt`, `[key].txt`, `api/*`) и только со строкой в карте маршрутов
  `docs/reference/rendering.md` (файл маршрута без неё валит `check:content`) и явным решением о
  `Cache-Control`: публичный HTML —
  `no-cache` (умолчание `app/middleware`, 404/410 включительно), живой или персональный —
  `private, no-store` в самом роуте (`Astro.response.headers`), middleware его не перебивает
- Модульное состояние (кеши, счётчики, `Map` на уровне модуля) в on-demand роутах — только по
  явному решению: оно общее для всех запросов процесса, живёт до рестарта и не видно второй
  реплике. Иммутабельные данные сборки (таблица редиректов) — допустимое исключение
- `getRuntimeConfig()` на on-demand — живой `process.env` контейнера; в лог — одна JSON-строка
  без PII, query, cookie и тел запросов, и только через `log()` из `shared/observability`
  (порог `LOG_LEVEL`): `console.*` напрямую мимо порога не пишут ни middleware, ни маршруты —
  ESLint `no-console`
- 404/410 — честный статус, не soft-404, с `noindex`; `X-Robots-Tag` staging ставит обёртка
  процесса (`docker/server.mjs`) на каждый ответ, prerendered включительно, — не middleware
- У адреса одна форма: неканоническую (слеш, `//`, `/index.html`, точки) и переезд из
  `redirects.yaml` обёртка процесса закрывает одним 301 раньше статик-хендлера — той же таблицей,
  что читает middleware (`resolveRequest`); маршрут этим не занимается

## Остров (клиент)

- Без островов нет ни байта JS; клиентский `<script>` — по решению: строка реестра `ISLANDS`
  (`shared/config/islands.ts`) — основание, страницы и бюджет в brotli (rule `shared-ui`).
  Инлайн несёт `data-island` и хеш тела в своей строке: тело без него блокирует CSP (и краснеет
  тест острова); файл — компонент, чей `<script>` собирает Astro. Скрипт вне реестра, остров не
  на своей странице или тяжелее бюджета валит `seo:check`; импорты острова линтит ESLint как
  обычный модуль. Данные острову — атрибутом (`data-*`), а не в коде: тело одно на любое
  значение, и хеш не меняется
- Server islands (`server:defer`) — не для индексируемого контента: бот видит заглушку, а не
  данные; в reference-наборе их нет
- Выбор темы и движения читает только остров — из `localStorage`: prerendered-страница собрана
  без запроса, поэтому сервер о выборе не знает и знать не может
- Hydration mismatch не актуален: фреймворка островов нет, разметку рисует только сервер

## Конфиг

`astro.config.ts`: `output: 'static'`, `build.format: 'directory'` (`'file'` с node-адаптером
отдаёт 404 на `/blog` и `/en`), `trailingSlash` — из `TRAILING_SLASH` (`shared/redirects/table.ts`:
рядом с каноном пути обёртки, который срезает слеш сам, — другая форма меняет оба места, их
согласие держит тест таблицы), `session: false` (fs-драйвер сессий пишет в cacheDir), `prefetch: false` и без `<ClientRouter/>` (без островов — ни байта JS; переход между страницами — CSS View Transitions токен-слоя, rule `shared-ui`),
`experimentalDisableStreaming: true`, `markdown.syntaxHighlight: false` (Shiki инлайнит сырые
цвета мимо токен-слоя), `fonts` — семейства списка шрифтов ДС `src/app/styles/fonts.ts` (Fonts API,
локальный провайдер; запасные гарнитуры — хвост стека семейства в файле токенов, rule `shared-ui`), `image` — без адаптивных стилей и раскладки Astro (`responsiveStyles`, `layout`: их CSS вторым файлом грузила бы страница с картинкой; выбор файла и размеры даёт её компонент, rule `shared-ui`), `vite.build.assetsInlineLimit: 0` (сборка ничего не встраивает в страницу:
короткий скрипт компонента без импортов остаётся модулем, по которому реестр `ISLANDS` узнаёт
остров-файл, стиль страницы и ресурс — файлами на `'self'` CSP, а не `data:`-адресом), Vite-плагины `yaml-modules` (`content/*.yaml`, снимок strategy `strategy/` и реестр ботов `shared/seo/crawlers.yaml` → данные на сборке),
`slot-sizes` (`sizes` картинок в контейнере секции — длины ролей файла токенов, модуль `virtual:slot-sizes`:
`var()` в `sizes` не читается, rule `shared-ui`) и
`wrapper-entries` (модули приложения, которые `docker/*` берут по имени файла: схема env
`shared/config/runtime.ts` — `dist/server/runtime-config.mjs`, её импортируют `docker/server.mjs` и
`docker/stamp.mjs` до старта приложения; таблица адресов `app/middleware/redirects.ts` —
`dist/server/redirects.mjs`, по ней обёртка отвечает на адрес раньше статик-хендлера; без этих
файлов контейнер не стартует); `cache`/`routeRules` не задаются — рецепт D
(`cached`) описан в `docs/reference/rendering.md` и включается решением проекта, не шаблона.
`image.endpoint` для `astro build` — `src/pages/_image.ts` (404): его ставит локальная
интеграция `closed-image-endpoint` в самом конфиге — часть канона, а не подключаемый пакет;
картинки оптимизирует сборка, трансформации на запрос наружу нет; в `astro dev` endpoint
штатный. Вторая локальная интеграция — `sitemap-from-build`: хук `astro:build:done` пишет
`dist/client/sitemap.xml` по собранным страницам (`scripts/lib/sitemap.mjs`: страницы без
`noindex`, адрес — canonical); в `astro dev` карты нет. Интеграций-пакетов `@astrojs/react`
(фреймворк островов ради одного переключателя) и `@astrojs/sitemap` (`lastmod` не из дат записи,
отбор страниц — `filter`, а не `noindex` самой страницы, шарды вместо одного файла) нет.

CSP — `security.csp` из политики сборки (`contentSecurityPolicy()`, `scripts/lib/site-policy.mjs`:
защитные директивы, чужие origin, хеши островов; хеши своих стилей — и `<style>` шрифтов `<Font>`
— и `font-src 'self'` Astro добавляет сам) и
`staticHeaders: true` адаптера: prerendered-страница получает заголовок из `dist/_headers.json`
(статик-хендлер), on-demand — от Astro в ответе. Заголовком, а не `<meta>`: `frame-ancestors`
в `<meta>` не действует. Каждая директива — одна: браузер действует по первому вхождению, поэтому
`sources` острова сливаются с директивой, а в защитных (`object-src`, `base-uri`, `form-action`,
`frame-ancestors`) они — ошибка сборки. Адаптер читает `_headers.json` по абсолютному пути сборки
из `entry.mjs`: в образе сборка и запуск — один каталог `/app`, копия HTTP-набора переписывает путь
на свой. Модули `scripts/lib`, которые импортирует этот конфиг, — политика, генератор карты
сайта, разбор HTML и обход каталога — в контексте сборки образа (`.dockerignore`).

CSP у prerendered-страниц одна на все: запись `_headers.json` статик-хендлер берёт первую, чей путь
*содержит* путь запроса (`/` получает запись `/500`, `/blog` — `/blog/page/2`). Свой инлайн-стиль
или источник у страницы дал бы ей чужую CSP — HTTP-набор краснеет на инлайн-стиле без хеша,
браузерный — на нарушении CSP; поэтому стиль страницы — файл (сборка не встраивает ничего). Атрибут
`style` в теле записи CSP блокирует так же — его отклоняет `check:content` до сборки.

Два значения там же живут ради единственного POST-маршрута: `security.checkOrigin: false`
(за прокси адаптер строит URL запроса как `http://<Host>` — origin сверяет `contact-form` с
runtime `SITE_URL`) и `bodySizeLimit` адаптера (дефолт 1 ГиБ выше потолка памяти процесса).
Правило — `.claude/rules/forms-antispam.md`.
