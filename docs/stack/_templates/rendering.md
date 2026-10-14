---
id: stack.rendering
kind: rendering
name: rendering
status: draft
---

# rendering

## Режимы

| режим | когда | `Cache-Control` |
|---|---|---|
| `static` | HTML не зависит от запроса — дефолт всех контентных страниц | `public, max-age=0` + ETag (адаптер) |
| `dynamic` | ответ зависит от запроса или живой — `export const prerender = false` | `no-cache` (middleware) или `private, no-store` (роут) |
| `cached` | контент из CMS/API, меняется чаще релиза | `no-cache` + кеш процесса (TTL/SWR) |
| `client` | персональное за логином | нет — это `spa-frontend-template`, не сайт |

Инварианты: индексируемая страница — `static` (или `cached`), и весь её контент в первом
HTML-ответе; `dynamic`-маршрут — `noindex` и вне sitemap; `prerender = false` — только со
строкой в карте ниже и явным решением о кеш-заголовке. Рецепт `cached` (кеш процесса,
single-flight, прогрев, инвалидация) — `docs/reference/rendering.md`; кода в шаблоне нет.

## Карта маршрутов

Каждая страница `routing.md` — строка здесь. Полная карта reference-набора —
`docs/reference/rendering.md`; сюда попадают проектные маршруты и отклонения от дефолта.

| путь | режим | `Cache-Control` | индексируется | в sitemap |
|---|---|---|---|---|
| контентные страницы и списки | `static` | `public, max-age=0` + ETag | да | да |
| `/contacts/spasibo` | `static` | то же | нет — `noindex` | нет |
| страницы ошибок `404`, `500` | `dynamic` / `static` | `no-cache` | нет | нет |
| `/healthz`, `/now` | `dynamic` | `no-store` / `private, no-store` | нет | нет |
| `robots.txt`, `/<ключ>.txt` | `dynamic` | короткий `public, max-age` | — | нет |
| `sitemap.xml`, фиды | `static`, файлы сборки | `public, max-age=0` + ETag | — | нет |
| `/api/*` (обработчики форм) | `dynamic` | `private, no-store` | нет | нет |
| _<path>_ | _режим_ | _заголовок_ | _да/нет_ | _да/нет_ |

## Абсолютные URL и один образ на все среды

| поле | значение |
|---|---|
| источник origin | `SITE_URL` — runtime env контейнера |
| как origin попадает в prerendered HTML | штамповка плейсхолдера `https://__site_origin__` при старте (`docker/entrypoint.sh`) |
| правило | абсолютные URL — только в `<head>`, JSON-LD, фидах и sitemap; в теле — корневые относительные |
| запрещено | `Astro.site`/`astro:i18n` для абсолютных URL; предсжатие HTML на сборке |

Альтернатива «`SITE_URL` как build-arg» делает образ непереносимым между средами и
включается только явной записью здесь.

## Интерактивность (острова)

| фича | остров | основание | страницы | бюджет, brotli |
|---|---|---|---|---|
| предпочтения: тема и движение | инлайн-`<script>` в `<head>` | кнопка темы (`THEME.switcher`), переключатель движения (`MOTION.switcher`) | весь сайт — при кнопке темы или переключателе движения; без выбора — нигде | 750 Б |
| счётчик | инлайн-`<script>` в `<head>` | идентификатор `METRIKA_ID` | весь сайт — при заданном идентификаторе | 325 Б |
| форма обратной связи | **нет** — нативный POST и PRG | — | — | — |
| _<фича>_ | _инлайн / файл / нет_ | _момент спецификации движения или плана страницы_ | _пути_ | _байт_ |

0 JS — дефолт. Остров = момент спецификации движения или плана страницы + строка реестра
`ISLANDS` (`src/shared/config/islands.ts`): основание, страницы и бюджет в brotli; инлайн — ещё
хеш тела (его пропускает CSP), файл — компонент, чей `<script>` собирает Astro. Сумму по уровню
страницы судят ворота strategy; server islands (`server:defer`) для индексируемого контента не
используются.

## Generates

- `export const prerender` в файлах `src/pages/**` и `Astro.response.headers` в on-demand роутах
- `docs/reference/rendering.md § Карта маршрутов` — строка на каждый on-demand маршрут
- `src/shared/config/islands.ts` — строки `ISLANDS`; `.size-limit.cjs` — бюджеты CSS и HTML
- HTTP-набор `e2e/http/{pages,service}.spec.ts` — статусы, заголовки, отсутствие плейсхолдера
- `config.md` — env `SITE_URL`

## Открытые вопросы

- _что_
