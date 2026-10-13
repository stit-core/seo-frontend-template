# Rendering

Static-first: страница предрендерится на сборке, если её HTML не зависит от запроса — так
устроены все контентные страницы. Рендер на запрос (on-demand) включается только явным
`export const prerender = false` и только для служебных маршрутов. Режим — свойство файла в
`src/pages`, а не конфига: `output: 'static'`, `cache`/`routeRules` в `astro.config.ts` не
задаются. Правило для кода — `.claude/rules/render-safety.md`.

## Режимы

| режим | что значит | `Cache-Control` | здесь |
|---|---|---|---|
| `static` | HTML собран на `astro build` (`dist/client/<path>/index.html`); отдаёт статик-хендлер адаптера до приложения | `public, max-age=0` + `ETag` + `Last-Modified` (адаптер) — браузер перепроверяет и получает 304 | все контентные страницы; так же, файлами сборки, отдаются фиды и карта сайта |
| `dynamic` | рендер на каждый запрос, кеш процесса запрещён; проходит через `app/middleware` | публичный (404, 410) — `no-cache`, умолчание middleware; живой/персональный — `private, no-store`, ставит роут; crawler-файлы — короткий `public, max-age` роута | `404`, `/healthz`, `/now`, `robots.txt`, `/<INDEXNOW_KEY>.txt`, закрытый `/_image`; сюда же относятся обработчики форм `api/*` |
| `cached` | рендер на запрос + кеш процесса (TTL + SWR) | `no-cache` | опция для контента из CMS/API — рецепт D ниже, кода в шаблоне нет |
| `client` | каркас с сервера, данные на клиенте | `private, no-store` | нет и не планируется: приложение за логином — `spa-frontend-template` |

Инварианты: индексируемая страница — `static` (или `cached`), и весь её контент — в первом
HTML-ответе; `dynamic` — всегда `noindex` и вне sitemap (HTML on-demand маршрута без `noindex`
валит HTTP-набор);
`prerender = false` — только со строкой в карте ниже и явным решением о `Cache-Control`.

## Карта маршрутов

`scripts/lib/routes.mjs` (`pageRoutes()`) выводит режим каждого файла `src/pages` по признаку
`prerender = false` — им пользуются `check:content`, `check:links`, `seo:check` и HTTP-набор.
Таблица — та же карта с решениями по кешу и индексации: у каждого on-demand файла здесь строка,
иначе `check:content` красный; колонка «в sitemap» — следствие колонки «индексируется»: карту
сайта пишет сборка, и в ней ровно страницы без `noindex`.

| путь | файл (`src/pages/`) | режим | `Cache-Control` | индексируется | в sitemap |
|---|---|---|---|---|---|
| `/`, `/en` | `index.astro`, `en/index.astro` | `static` | `public, max-age=0` + ETag | да | да |
| `/blog`, `/en/blog` | `blog/index.astro`, `en/blog/index.astro` | `static` | то же | да | да |
| `/blog/page/N`, `/en/blog/page/N` | `blog/page/[page].astro`, `en/blog/page/[page].astro` | `static`, пути из `getStaticPaths` | то же | да | да |
| `/blog/<slug>`, `/en/blog/<slug>` | `blog/[slug].astro`, `en/blog/[slug].astro` | `static`, пути из контента (без черновиков) | то же | да | да |
| `/blog/tag/<tag>`, `/en/blog/tag/<tag>` | `blog/tag/[tag].astro`, `en/blog/tag/[tag].astro` | `static`, теги видимых записей | то же | от трёх записей локали — да; ниже — `noindex` | от трёх записей — да |
| `/about`, `/en/about` | `about.astro`, `en/about.astro` | `static` | то же | да | да |
| `/contacts`, `/en/contacts` | `contacts/index.astro`, `en/contacts/index.astro` | `static` | то же | да | да |
| `/contacts/spasibo`, `/en/contacts/spasibo` | `contacts/spasibo.astro`, `en/contacts/spasibo.astro` | `static` | то же | нет — `noindex` | нет |
| `/legal/privacy` | `legal/privacy.astro` | `static` | то же | да | да |
| `/api/contact` | `api/contact.astro` (страница: без JS ответ на POST — разметка) | `dynamic` | `private, no-store` (роут) | нет — `noindex` | нет |
| `/500.html` | `500.astro` (адаптер читает файл с диска при исключении в on-demand; по `/500` — 404) | `static` | `public, max-age=0` + ETag | нет — `noindex` | нет |
| `/now` | `now.astro` | `dynamic` | `private, no-store` (роут) | нет — `noindex` | нет |
| `/healthz` | `healthz.ts` (endpoint) | `dynamic` | `no-store` (роут) | нет | нет |
| `/_image` | `_image.ts` (endpoint изображений: маршрут вводит сам Astro, `image.endpoint` в `astro.config.ts` подменяет его для сборки; в `astro dev` — штатный) | `dynamic` | `no-cache` (роут) | — (404 текстом, `X-Robots-Tag: noindex`: картинки готовит сборка, трансформация на запрос наружу закрыта, на edge — тоже) | нет |
| `/robots.txt` | `robots.txt.ts` (endpoint) | `dynamic` | `public, max-age=300` (роут) | — (текст; `X-Robots-Tag: noindex`) | нет |
| `/sitemap.xml` | файла маршрута нет: карту пишет интеграция `sitemap-from-build` (`astro.config.ts`, `scripts/lib/sitemap.mjs`) по страницам `dist/client` | `static`, файл сборки | `public, max-age=0` + ETag | — (XML) | сам — карта |
| `/rss.xml`, `/en/rss.xml` | `rss.xml.ts`, `en/rss.xml.ts` (prerendered-эндпоинт, общий `_blog/feed.ts`) | `static` | то же | — (XML) | нет |
| `/<INDEXNOW_KEY>.txt` и любой другой корневой `/*.txt` | `[key].txt.ts` (endpoint; параметризованный — перехватывает весь корневой `*.txt`, кроме статического `robots.txt`) | `dynamic` | `public, max-age=300` (роут); пустой ключ или чужое имя — 404 `text/plain` с `no-cache`, не `404.astro` | — (`X-Robots-Tag: noindex` на обоих ответах) | нет |
| любой путь без файла → 404 | `404.astro` — на языке префикса пути | `dynamic` | `no-cache` (middleware) | нет — статус 404 + `noindex` | нет |
| адреса из `content/redirects.yaml` и неканоническая форма любого адреса | таблица `app/middleware/redirects.ts`: 301/308 отдаёт обёртка процесса `docker/server.mjs` до статик-хендлера, 410 — middleware до роутинга, телом на языке префикса пути | `dynamic` | 301/308 — без кеш-заголовка; 410 — `no-cache` | нет | нет |
| ошибка рендера on-demand → 500 | `500.astro` — адаптер читает `dist/client/500.html` с диска (дефолтная локаль: файл запроса не знает); middleware пишет лог со статусом 500 и тем же `rid` | `dynamic` | нет | нет | нет |
| `/_astro/*` | ассеты сборки | статика | `public, max-age=31536000, immutable` (адаптер) | — | нет |
| `/favicon.ico`, `/icon.svg`, … | `public/` как есть | статика | `public, max-age=0` + ETag (адаптер) | — | нет |

`/now` — образец режима `dynamic` (серверное время в разметке, `noindex`, `private, no-store`,
только `ru`). Ссылка на неё — в подвале, не в основной навигации.

`/api/contact` — второй on-demand HTML: обработчик формы. Он маршрут-страница, а не endpoint,
потому что без JavaScript ответ на POST обязан быть разметкой: успех — 303 на
`/contacts/spasibo` (F5 не переотправляет заявку), ошибка — та же страница контактов с
сохранёнными полями (200) или честный 500 при сбое канала доставки. Отказ до разбора заявки —
короткий текст с теми же заголовками: 403 (чужой или отсутствующий `Origin`), 400 (тело не
форма), 413 (`Content-Length` больше лимита формы). В полях ответа — то, что прислал человек,
поэтому `private, no-store` и `noindex`; GET возвращает на `/contacts` редиректом. Правила
лестницы — `.claude/rules/forms-antispam.md`, требования к прокси (rate-limit) —
`deployment.md`.

`robots.txt` и файл ключа IndexNow — on-demand, потому что их содержимое зависит от env контейнера:
`ROBOTS_POLICY` (staging — `Disallow: /`), `INDEXNOW_KEY`. Карта сайта и фиды от среды зависят
только origin'ом, поэтому они — файлы сборки с плейсхолдером, как страницы: фиды — prerendered-
эндпоинты, а карту пишет интеграция сборки по страницам `dist/client` — в ней ровно страницы без
`noindex`, адресом canonical и с датой последнего изменения записи. Списка страниц нет: карта равна
сборке по построению, а `seo:check` сверяет её со страницами и с датами записей из frontmatter;
правила — `.claude/rules/seo-invariants.md`. В `astro dev` карты нет.

## Абсолютные URL: один образ на все среды

Prerender происходит на сборке, а канонический origin известен только контейнеру
(`SITE_URL` — runtime). Развилка закрыта **вариантом C**:

- сборка печёт `site: 'https://__site_origin__'` (`astro.config.ts`); плейсхолдер попадает во
  все абсолютные URL prerendered-выхода;
- `docker/entrypoint.sh` при старте контейнера штампует `SITE_URL` в
  `dist/client/**/*.{html,xml,txt}` и не запускает сервер, если плейсхолдер где-то остался;
- on-demand маршруты берут origin из runtime `SITE_URL` (`getRuntimeConfig()`,
  `shared/config`) — `dist/server` не штампуется; единственная точка, где к пути добавляется
  origin, — `absoluteUrl()` из `shared/seo`: на prerender она даёт плейсхолдер, на on-demand —
  живое значение;
- `Astro.site` и `astro:i18n` для построения URL не используются: на on-demand они вернули бы
  значение сборки — плейсхолдер;
- абсолютные URL — только в `<head>` (canonical, `og:*`, hreflang, JSON-LD), фидах и sitemap;
  в теле документа — корневые относительные (`/blog/x`): поверхность штамповки минимальна,
  переезд домена не трогает контент;
- HTML на сборке не предсжимается — иначе плейсхолдер уедет внутрь `.br`/`.gz`.

Гейт: HTTP-набор (`e2e/http/pages.spec.ts`, `service.spec.ts`, `seo.spec.ts`) обходит страницы
`dist/client` (`<путь>/index.html`), карту, фиды и on-demand маршруты — плейсхолдера нет нигде, в
`<body>` нет URL своего origin; остаток плейсхолдера в любом файле `dist/client` не даёт стартовать `entrypoint.sh`;
`check:content` не пропускает литерал плейсхолдера в тексты записей;
`shared/config/runtime.server.test.ts` держит литерал согласованным в файлах, которые не
импортируют `shared/config` (конфиг сборки, `docker/*`, приёмка образа).

## Нормализация URL

У адреса одна форма — каноническая (`canonicalPath`, `shared/redirects`): без хвостового и
повторных слешей, без сегментов `.` и `..`, без `index.html` в конце, проценты — в одной записи
(UTF-8 прописными hex; то, что можно не кодировать, раскодировано). Она же — canonical страницы и
её адрес в карте сайта.

- Любая другая форма — **один 301 сразу на конечный адрес**. Отвечает обёртка процесса
  (`docker/server.mjs`) на GET и HEAD раньше статик-хендлера адаптера: тот отдал бы по
  `<путь>/index.html`, `//путь` и пути с точками ту же страницу (дубль с ответом 200), а хвостовой
  слеш срезал бы своим 301 — лишним хопом перед правилом `redirects.yaml`. `/blog/` → `/blog`,
  `/about/index.html` → `/about`, `//blog` → `/blog`, `/%62log` → `/blog`; query переезжает как есть
- Правило `redirects.yaml` находится по каноническому пути, поэтому `/old/`, `//old` и
  `/old/index.html` ведут сразу на цель правила — без остановки на `/old`
- За edge часть форм до процесса не доходит: двойной слеш и сегменты `.` и `..` Traefik схлопывает
  на entryPoint (`sanitizePath`, умолчание безопасности — не выключается), букву процентами
  раскодирует при проксировании. Запрос приходит каноническим, и по публичному адресу `//blog` или
  `/%62log` отвечает страница (200), а не 301. Вторым адресом в индексе она не становится: её
  canonical — каноническая форма, ссылок другой формы в сборке нет (`check:links`), а `.` и `..`
  браузер убирает сам. Хвостовой слеш, `/index.html`, адреса таблицы переездов, заглавные и `%2F`
  edge передаёт как есть — на них отвечает процесс (`infra-handoff.md § 1.3`, приёмка — § 1.7)
- Спрятанный разделитель — `%2F`, `%5C` или обратный слеш в пути — **404** текстом: браузер, прокси
  и статик-хендлер читают такой путь по-разному, адреса с ним у сайта нет
- Регистр не нормализуется: `/Blog` — другой адрес, 404. `/about.html` → 404
  (`build.format: 'directory'`); `www` → apex и `http` → `https` — Traefik
- Форма слеша — без хвостового: `TRAILING_SLASH` (`shared/redirects/table.ts`) получает
  `trailingSlash` Astro, а канон пути срезает слеш сам. Другая форма — правка и настройки, и
  канона; их согласие держит тест таблицы

## Заголовки

- Prerendered (страницы, фиды, карта сайта) и `public/*` отдаёт статик-хендлер адаптера (`send`):
  `Cache-Control: public, max-age=0` + `ETag` + `Last-Modified` от mtime файла (штамповка возвращает файлу mtime
  сборки, рестарт их не меняет) — условный запрос, 304 при совпадении; `/_astro/*` —
  `public, max-age=31536000, immutable`. Приложение (middleware, JSON-лог) их не видит
- On-demand проходит через `app/middleware`: `X-Request-Id`, JSON-лог, `Cache-Control: no-cache`
  для HTML без явного заголовка (404/410 включительно). Роут задаёт заголовок сам, когда ответ
  живой или персональный: `now` — `private, no-store`, `healthz` — `no-store`; middleware его
  не перебивает. Crawler-файлы приложения
  (`robots.txt`, ключ IndexNow) ставят короткий `public, max-age` и
  `X-Robots-Tag: noindex` сами: это не страницы выдачи, а обход их не блокирует
- Staging (`ROBOTS_POLICY=noindex`): `X-Robots-Tag: noindex, nofollow` на каждом ответе процесса —
  prerendered, `public/*`, ассеты и on-demand — ставит обёртка `docker/server.mjs`, последним:
  значение маршрута его не перекрывает. Исключение — отказ самого Node на запрос, не дошедший до
  слушателей (`deployment.md § Обёртка сервера`)
- `Content-Security-Policy` — у каждой страницы: prerendered — статик-хендлер из
  `dist/_headers.json` сборки, on-demand (404, `/now`, ответ формы) — Astro в ответе. Политика
  одна (`contentSecurityPolicy()`, `scripts/lib/site-policy.mjs`): `default-src 'self'`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`; скрипт —
  остров реестра: инлайн — по хешу тела, файл — свой; стиль — свой файл, `<style>` шрифтов
  `<Font>` — по хешу (его добавляет Astro); чужой origin — из `RESOURCE_ORIGINS` и у острова,
  который его грузит (счётчик — при заданном идентификаторе);
  каждая директива печатается один раз, в защитных источников островов нет. Без
  CSP — ответы без страницы: файлы, crawler-файлы, редиректы, тело 410 и отказы формы (скриптов в
  них нет) и `500.html`, которую адаптер при сбое рендера читает с диска мимо `_headers.json`
- Почему `no-cache`, а не `max-age`: без CDN `s-maxage` не на кого рассчитывать, а `max-age` на
  своём домене оставляет у пользователей старую страницу после релиза; `no-cache` — «спроси
  сервер», и для prerendered это дешёвый 304 по ETag
- Стриминга нет: prerendered — файл, on-demand собирается целиком
  (`experimentalDisableStreaming: true`); сжатия в процессе нет — жмёт Traefik (`compress`)

## Измерение TTFB

`pnpm ttfb <origin> <path…>` (`scripts/ttfb.mjs`): медиана/p90 из 20 последовательных запросов
через `node:http` к запущенному серверу (`pnpm start` после штамповки, см.
`deployment.md`). Prerendered локально — единицы миллисекунд. Порога в гейте нет: что страница
отдаётся статикой, а не рендером, HTTP-набор проверяет точно — заголовками статик-хендлера на
каждой странице; медиану главной печатает приёмка образа.

## Рецепт D: `cached` — рендер на запрос с кешем процесса (опция, кода нет)

**Когда нужен.** Контент приходит из CMS/API и должен обновляться без релиза; страниц слишком
много для prerender на каждую сборку; разметка индексируемой страницы зависит от runtime env. Для
git-контента D не нужен: публикация = релиз.

**Что включить.**

- `output: 'server'` целиком либо `export const prerender = false` на нужных маршрутах — при
  `output: 'static'` с адаптером `routeRules` действуют на on-demand маршруты и так;
- `cache: { provider: memoryCache({ max }) }` в `astro.config.ts`: ключ — origin + pathname +
  нормализованный query без трекинг-параметров; cookie и UA в ключ не входят; кешируется только
  GET без `Set-Cookie`;
- `routeRules` с `maxAge` / `swr` / `tags` на кешируемые маршруты; картинки контента из CMS —
  открытый `/_image` (без подмены `image.endpoint` в `astro.config.ts` и блока на edge) с
  `routeRule` и лимитом частоты, иначе каждая картинка проходит полный цикл sharp на запрос;
- `Astro.cache.set({ maxAge, swr, tags })` там, где правило зависит от данных.

**Что обязательно дописать.**

- single-flight в `src/fetch.ts` (`Map<key, Promise<Response>>`): `memoryCache` не дедуплицирует
  параллельные промахи — без него холодный старт под трафиком даёт лавину рендеров;
- прогрев «горячих» URL при старте, фоном, не блокируя `/healthz`;
- `POST /internal/revalidate` (HMAC-подпись тела, `{ paths | tags }`, ответ 202, неизвестный
  путь — 204) и `POST /internal/cache/flush` (тот же секрет, счётчик сброшенных ключей): только
  POST, константное сравнение подписи, rate-limit, `noindex`, вне sitemap;
- публичный `Cache-Control: no-cache` на кешированный HTML — провайдер его не ставит;
- `X-Cache: HIT | STALE | MISS | BYPASS` наружу (провайдер даёт `X-Astro-Cache`);
- список индексируемых `cached`-маршрутов в политике сборки `scripts/lib/site-policy.mjs` (рядом
  с `NOINDEX_ROUTES`): страниц этих маршрутов в `dist/client` нет, поэтому их адреса из списка
  дописывает в карту генератор (`scripts/lib/sitemap.mjs`), а читают его сверка карты в `seo:check`
  и две проверки HTTP-набора — «HTML on-demand маршрута — только с `noindex`»
  (`e2e/http/service.spec.ts`) и «карта сайта = индексируемые страницы» (`e2e/http/seo.spec.ts`).
  Индексируемую on-demand страницу без строки в этом списке гейт роняет.

**Ограничения** (цифры — spike, `docs/research/ssr/round2/08-spike-astro.md` §5, §7.5–7.6):

- кеш выключен в `astro dev` — поведение отличается от прода;
- 200 параллельных запросов на холодный ключ при рендере 300 мс = 141 реальный рендер;
- `/_image` без `routeRule` — 300–420 мс на каждый запрос, с правилом — 3 мс, но картинки живут
  в той же LRU процесса; RSS после 50 параллельных `/_image` — 360 МБ и не возвращается;
- `mem_limit` контейнера — 768 МБ (`NODE_OPTIONS=--max-old-space-size` ≈ 75 %);
- после релиза кеш холодный — прогрев обязателен; инвалидация: релиз · TTL + SWR · вебхук ·
  ручной flush; каждый `cached`-маршрут — строка в карте выше с TTL/SWR, тегами и тем, кто
  инвалидирует.

**Вариант A** (`SITE_URL` как build-arg, свой образ на среду) — только для проекта с одной
средой и с явной записью в артефакте стека `rendering`: образ перестаёт быть переносимым между
staging и prod.
