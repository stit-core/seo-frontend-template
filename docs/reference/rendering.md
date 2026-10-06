# Rendering

Static-first: страница предрендерится на сборке, если её HTML не зависит от запроса — так
устроены все контентные страницы. Рендер на запрос (on-demand) включается только явным
`export const prerender = false` и только для служебных маршрутов. Режим — свойство файла в
`src/pages`, а не конфига: `output: 'static'`, `cache`/`routeRules` в `astro.config.ts` не
задаются. Правило для кода — `.claude/rules/render-safety.md`.

## Режимы

| режим | что значит | `Cache-Control` | здесь |
|---|---|---|---|
| `static` | HTML собран на `astro build` (`dist/client/<path>/index.html`); отдаёт статик-хендлер адаптера до приложения | `public, max-age=0` + `ETag` + `Last-Modified` (адаптер) — браузер перепроверяет и получает 304 | все контентные страницы |
| `dynamic` | рендер на каждый запрос, кеш процесса запрещён; проходит через `app/middleware` | публичный (404, 410) — `no-cache`, умолчание middleware; живой/персональный — `private, no-store`, ставит роут; crawler-файлы — короткий `public, max-age` роута | `404`, `/healthz`, `/now`, `robots.txt`, `sitemap.xml`, `rss.xml`, `/<INDEXNOW_KEY>.txt`; сюда же относятся обработчики форм `api/*` |
| `cached` | рендер на запрос + кеш процесса (TTL + SWR) | `no-cache` | опция для контента из CMS/API — рецепт D ниже, кода в шаблоне нет |
| `client` | каркас с сервера, данные на клиенте | `private, no-store` | нет и не планируется: приложение за логином — `spa-frontend-template` |

Инварианты: индексируемая страница — `static` (или `cached`), и весь её контент — в первом
HTML-ответе; `dynamic` — всегда `noindex` и вне sitemap (HTML on-demand маршрута без `noindex`
валит HTTP-набор);
`prerender = false` — только со строкой в карте ниже и явным решением о `Cache-Control`.

## Карта маршрутов

`scripts/lib/routes.mjs` (`pageRoutes()`) выводит режим каждого файла `src/pages` по признаку
`prerender = false` — им пользуются `check:content` и `check:links`. Таблица — та же карта с
решениями по кешу и индексации; колонка «в sitemap» — намерение для генератора карты сайта.

| путь | файл (`src/pages/`) | режим | `Cache-Control` | индексируется | в sitemap |
|---|---|---|---|---|---|
| `/`, `/en` | `index.astro`, `en/index.astro` | `static` | `public, max-age=0` + ETag | да | да |
| `/blog`, `/en/blog` | `blog/index.astro`, `en/blog/index.astro` | `static` | то же | да | да |
| `/blog/page/N`, `/en/blog/page/N` | `blog/page/[page].astro`, `en/blog/page/[page].astro` | `static`, пути из `getStaticPaths` | то же | да | да |
| `/blog/<slug>`, `/en/blog/<slug>` | `blog/[slug].astro`, `en/blog/[slug].astro` | `static`, пути из контента (без черновиков) | то же | да | да |
| `/blog/tag/<tag>`, `/en/blog/tag/<tag>` | `blog/tag/[tag].astro`, `en/blog/tag/[tag].astro` | `static`, теги видимых записей | то же | да | да |
| `/about`, `/en/about` | `about.astro`, `en/about.astro` | `static` | то же | да | да |
| `/contacts`, `/en/contacts` | `contacts/index.astro`, `en/contacts/index.astro` | `static` | то же | да | да |
| `/contacts/spasibo`, `/en/contacts/spasibo` | `contacts/spasibo.astro`, `en/contacts/spasibo.astro` | `static` | то же | нет — `noindex` | нет |
| `/legal/privacy` | `legal/privacy.astro` | `static` | то же | да | да |
| `/api/contact` | `api/contact.astro` (страница: без JS ответ на POST — разметка) | `dynamic` | `private, no-store` (роут) | нет — `noindex` | нет |
| `/500` | `500.astro` (адаптер читает файл с диска при исключении в on-demand) | `static` | `public, max-age=0` + ETag | нет — `noindex` | нет |
| `/now` | `now.astro` | `dynamic` | `private, no-store` (роут) | нет — `noindex` | нет |
| `/healthz` | `healthz.ts` (endpoint) | `dynamic` | `no-store` (роут) | нет | нет |
| `/robots.txt` | `robots.txt.ts` (endpoint) | `dynamic` | `public, max-age=300` (роут) | — (текст; `X-Robots-Tag: noindex`) | нет |
| `/sitemap.xml` | `sitemap.xml.ts` (endpoint) | `dynamic` | `public, max-age=3600` (роут) | — (`X-Robots-Tag: noindex`) | сам — карта |
| `/rss.xml`, `/en/rss.xml` | `rss.xml.ts`, `en/rss.xml.ts` (endpoint, общий `_blog/feed.ts`) | `dynamic` | `public, max-age=600` (роут) | — (`X-Robots-Tag: noindex`) | нет |
| `/<INDEXNOW_KEY>.txt` и любой другой корневой `/*.txt` | `[key].txt.ts` (endpoint; параметризованный — перехватывает весь корневой `*.txt`, кроме статического `robots.txt`) | `dynamic` | `public, max-age=300` (роут); пустой ключ или чужое имя — 404 `text/plain` с `no-cache`, не `404.astro` | — (`X-Robots-Tag: noindex` на обоих ответах) | нет |
| любой путь без файла → 404 | `404.astro` | `dynamic` | `no-cache` (middleware) | нет — статус 404 + `noindex` | нет |
| адреса из `content/redirects.yaml` | `app/middleware/redirects.ts`, до роутинга | `dynamic` | 301/308 — без кеш-заголовка; 410 — `no-cache` | нет | нет |
| ошибка рендера on-demand → 500 | `500.astro` — адаптер читает `dist/client/500.html` с диска; middleware пишет лог со статусом 500 и тем же `rid` | `dynamic` | нет | нет | нет |
| `/_astro/*` | ассеты сборки | статика | `public, max-age=31536000, immutable` (адаптер) | — | нет |
| `/favicon.ico`, `/icon.svg`, … | `public/` как есть | статика | `public, max-age=0` + ETag (адаптер) | — | нет |

`/now` — образец режима `dynamic` (серверное время в разметке, `noindex`, `private, no-store`,
0 JS, только `ru`). Ссылка на неё — в подвале, не в основной навигации.

`/api/contact` — второй on-demand HTML: обработчик формы. Он маршрут-страница, а не endpoint,
потому что без JavaScript ответ на POST обязан быть разметкой: успех — 303 на
`/contacts/spasibo` (F5 не переотправляет заявку), ошибка — та же страница контактов с
сохранёнными полями (200) или честный 500 при сбое канала доставки. Отказ до разбора заявки —
короткий текст с теми же заголовками: 403 (чужой или отсутствующий `Origin`), 400 (тело не
форма), 413 (`Content-Length` больше лимита формы). В полях ответа — то, что прислал человек,
поэтому `private, no-store` и `noindex`; GET возвращает на `/contacts` редиректом. Правила
лестницы — `.claude/rules/forms-antispam.md`, требования к прокси (rate-limit) —
`deployment.md`.

`robots.txt`, `sitemap.xml`, фиды и файл ключа IndexNow — on-demand, потому что их содержимое
зависит от runtime env: `SITE_URL` (абсолютные URL), `ROBOTS_POLICY` (staging — `Disallow: /`),
`AI_TRAINING`, `INDEXNOW_KEY`. Источник карты сайта — те же запросы к контенту, что и
`getStaticPaths` страниц, поэтому карта совпадает с prerendered-выходом один в один (HTTP-набор
гейта сверяет с `dist/client`); правила — `.claude/rules/seo-invariants.md`.

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

Гейт: HTTP-набор (`e2e/http/pages.spec.ts`, `service.spec.ts`) обходит все страницы `dist/client`
и on-demand маршруты — плейсхолдера нет нигде, в `<body>` нет URL своего origin; `check:content` не пропускает литерал
плейсхолдера в тексты записей; `shared/config/runtime.server.test.ts` держит литерал
согласованным во всех файлах, где он есть.

## Нормализация URL

- `trailingSlash: 'never'`: `/blog/` → **301** `/blog`. Для каталогов `dist/client` это делает
  статик-хендлер адаптера, для остальных путей — Astro; оба до middleware, поэтому `/old/` —
  два хопа (`/old`, затем правило из `redirects.yaml`)
- `/index.html` и `/en/index.html` отвечают 200 — дубли главных; закрываются на Traefik
  (`redirectRegex` → `/`, `/en`, репо infra). `/about.html` → 404 (`build.format: 'directory'`)
- Регистр пути не нормализуется; `www` → apex и `http` → `https` — Traefik

## Заголовки

- Prerendered и `public/*` отдаёт статик-хендлер адаптера (`send`): `Cache-Control: public,
  max-age=0` + `ETag` + `Last-Modified` — условный запрос, 304 при совпадении; `/_astro/*` —
  `public, max-age=31536000, immutable`. Приложение (middleware, `X-Robots-Tag`, JSON-лог) их
  не видит — staging закрывает Traefik: `basicAuth` + `customResponseHeaders: X-Robots-Tag`
- On-demand проходит через `app/middleware`: `X-Request-Id`, JSON-лог, `Cache-Control: no-cache`
  для HTML без явного заголовка (404/410 включительно), `X-Robots-Tag: noindex, nofollow` при
  `ROBOTS_POLICY=noindex`. Роут задаёт заголовок сам, когда ответ живой или персональный:
  `now` — `private, no-store`, `healthz` — `no-store`; middleware его не перебивает. Crawler-файлы
  (`robots.txt`, `sitemap.xml`, фиды, ключ IndexNow) ставят короткий `public, max-age` и
  `X-Robots-Tag: noindex` сами: это не страницы выдачи, а обход их не блокирует
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
много для prerender на каждую сборку; нужна runtime-политика на индексируемых страницах (тогда
`X-Robots-Tag` ставит приложение). Для git-контента D не нужен: публикация = релиз.

**Что включить.**

- `output: 'server'` целиком либо `export const prerender = false` на нужных маршрутах — при
  `output: 'static'` с адаптером `routeRules` действуют на on-demand маршруты и так;
- `cache: { provider: memoryCache({ max }) }` в `astro.config.ts`: ключ — origin + pathname +
  нормализованный query без трекинг-параметров; cookie и UA в ключ не входят; кешируется только
  GET без `Set-Cookie`;
- `routeRules` с `maxAge` / `swr` / `tags` на кешируемые маршруты, **включая `/_image`** —
  иначе каждая картинка проходит полный цикл sharp на запрос;
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
  с `NOINDEX_ROUTES`) и его чтение в двух проверках HTTP-набора: «HTML on-demand маршрута — только
  с `noindex`» (`e2e/http/service.spec.ts`) и «карта сайта = индексируемые страницы `dist/client`»
  (`e2e/http/seo.spec.ts`). Индексируемую on-demand страницу без строки в этом списке гейт роняет.

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
