# 02 — Канон технического SEO и индексируемости для `ssr-frontend-template`

Поток 02 ресёрч-сессии по SSR-шаблону. Дата: 2026-09-15.
Целевые поисковики: **Google + Яндекс**. Рантайм: React 19.2 SSR (TanStack Start на Vite),
Node-образ за Traefik v3 + CrowdSec, **без CDN**, сайты ru/en, часть страниц приватная.

Пометки источников: **[П]** — проверено фетчем первоисточника в этой сессии (URL + дата);
**[П~]** — проверено, но источник вторичный/старый (указано); **[?]** — предположение,
первоисточником не подтверждено.

Сопутствующие файлы потока (детальные выкладки суб-исследований):
`research/_sub-yandex.md` (Яндекс, 15 разделов), `research/_sub-meta.md` (метаданные и
структурированные данные), `research/_sub-og.md` (генерация OG-картинок в Node/alpine, превью
в мессенджерах). Раздел 2.5 (производительность) исследован напрямую — выделенный суб-агент
по перформансу до завершения сессии результат не отдал, так что раздел построен на собственных
проверках первоисточников; отдельного `_sub-perf.md` в этом потоке нет.

---

## 1. TL;DR

1. **SSR обязателен, а не «желателен».** Google рендерит JS эвергрин-Chromium'ом, но вторым
   проходом из очереди («may stay on this queue for a few seconds, but it can take longer»),
   и сам рекомендует SSR/prerender; **dynamic rendering у Google официально помечен как
   deprecated workaround** (обновление доки 2025-12-10). Яндекс держит JS-рендеринг в **бете**
   и прямо пишет: «Запретите рендеринг, если на сайте реализован SSR или пререндеринг».
   → Канон: **всё индексируемое должно быть в первом HTML-ответе**; `ssr: false` — только для
   приватных/неиндексируемых роутов.
2. **Статус-коды — первоклассный SEO-артефакт SSR.** Шаблон обязан уметь честно отдавать
   200/301/308/404/410/429/503 из роутов. В TanStack Start это **не бесплатно**: `notFound()`
   исторически ломался по статусу в SSR, `setResponseStatus` не работал в server routes (issue
   #5377, закрыт) и в global middleware (issue #5407). → нужен e2e-гейт на статусы.
3. **Канон URL — один нормализованный вид.** `trailingSlash: 'never'`, lowercase, apex-или-www
   (одно), http→https, обязательный self-canonical абсолютным URL. Для параметров: у Google —
   `rel=canonical` + robots.txt для фасетов, у Яндекса — **`Clean-param`** (Яндекс сам
   рекомендует его вместо canonical для параметров, а cross-domain canonical **не поддерживает**).
4. **Два разных робота — две разные таблицы директив.** Яндекс поддерживает только
   `noindex/nofollow/none/noarchive` (+ разрешающие), **и при конфликте у него побеждает
   разрешающая директива**, а у Google — наиболее строгая. `nosnippet`, `max-snippet`,
   `max-image-preview`, `indexifembedded`, `unavailable_after` — Google-only.
   `Crawl-delay` и `Host` у Яндекса мертвы; `<noindex>` (фрагмент текста) — жив.
5. **robots.txt и sitemap.xml — серверные роуты, а не статические файлы**, потому что их
   содержимое зависит от `PUBLIC_ORIGIN` и от среды (staging vs prod). Один образ на все среды =
   robots.txt генерится из runtime config. Лимиты: 50 000 URL / 50 МБ на файл, sitemap index до
   50 000 файлов, вложенность индексов запрещена, `lastmod` — только если он честный
   (`changefreq`/`priority` Google игнорирует).
6. **Staging не должен индексироваться двумя независимыми контурами**: basic-auth на Traefik
   **и** `X-Robots-Tag: noindex, nofollow` из приложения по env. Приватные страницы —
   `noindex` + `Cache-Control: private, no-store`.
7. **i18n: префикс пути `/en/`** (Google: subdirectory — «easy to set up, low maintenance»),
   дефолтная локаль `ru` без префикса, **никаких авто-редиректов по `Accept-Language`**
   (Googlebot ходит из США и не шлёт этот заголовок), полный взаимный `hreflang` + `x-default`.
   Для Яндекса hreflang — слабый сигнал (единственный первоисточник от 2013 г.), региональность
   задаётся в Вебмастере.
8. **CSP с nonce конфликтует с кешированием и prerender'ом** (nonce уникален на запрос).
   Это архитектурная развилка шаблона: либо nonce + `no-store` на HTML, либо hash-based CSP
   и кешируемый HTML. TanStack Start поддерживает `ssr.nonce` через global middleware.
9. **CrowdSec/rate-limit обязан пропускать проверенных ботов**: `cscli postoverflows install
   crowdsecurity/seo-bots-whitelist` (rDNS + IP-листы). Троттлить краулеров надо **429/503**,
   а не 403/404 — Google явно пишет «Don't use 401/403 for rate limiting».
10. **IndexNow даёт Яндекс/Bing, но не Google** (Google IndexNow не поддерживает; Indexing API
    ограничен `JobPosting`/`BroadcastEvent`). Мониторинг индексации — URL Inspection API
    (2000 запросов/сутки на property) + Яндекс.Вебмастер. **`llms.txt` — не поддерживается никем
    официально**, в шаблон закладывать не нужно (MAY).
11. **Streaming SSR — главная ловушка шаблона.** Соц-краулеры (X, Facebook, Slack, LinkedIn)
    читают **первый чанк** и отключаются: «дописанный» позже `<head>` = сломанные превью.
    А **React 19.2 изменил поведение**: начальный HTML теперь содержит Suspense-fallback'и даже
    для ботов. → Канон: весь `<head>` и основной контент — **до первого байта**;
    Suspense только для второстепенного; bot-aware переключение на `renderRouterToString`
    по `isbot`.
12. **Свежее в 2026, что ломает старые гайды:** (а) Googlebot качает **первые 2 МБ**
    несжатого документа и **молча обрезает** остальное — для SSR это реальный риск при жирном
    `dehydrate()` + инлайн-CSS, нужен бюджет размера HTML; (б) **JSON-файлы с IP-диапазонами
    Google переехали** в `/crawling/ipranges/`, `googlebot.json` → `common-crawlers.json`,
    старые адреса умерли 07.04.2026 — любой скопированный whitelist сломан;
    (в) **FAQ rich results отключены 07.05.2026**, HowTo — с 2023, sitelinks searchbox — с
    21.11.2024, Turbo-страницы Яндекса — с апреля 2025: всё это не надо закладывать в шаблон;
    (г) `<script type="application/ld+json">` — **data block, CSP `script-src` его не проверяет**,
    nonce ему не нужен.

---

## 2. Findings

### 2.1. Индексируемость

#### 2.1.1. Как Google рендерит JS (и почему SSR критичен)

**[П]** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

- Три фазы: **crawling → rendering → indexing**. Дословно: *«Googlebot queues all pages with a
  `200` HTTP status code for rendering, unless a robots `meta` tag or header tells Google not to
  index the page. The page may stay on this queue for a few seconds, but it can take longer than
  that.»*
- Рендер — **evergreen Chromium**.
- Если URL закрыт в robots.txt — *«Google Search won't render JavaScript from blocked files or on
  blocked pages»*. Практический вывод: **нельзя закрывать в robots.txt `/assets/*`, `/_build/*`,
  JSON-эндпойнты лоадеров** — иначе рендер будет неполным.
- JS-инъекция ссылок и JSON-LD допустима, но: *«you shouldn't use JavaScript to change the
  canonical URL to something else than the URL you specified as the canonical URL in the original
  HTML»*, и *«Using JavaScript to change or remove the robots meta tag from `noindex` may not work
  as expected»* — то есть **canonical и robots-мета должны приходить в первом HTML**.
- Fragment-роутинг (`#/page`) — запрещён: *«Don't use fragments to load different page content»*.
- Итоговая рекомендация Google: *«Server-side or pre-rendering is still a great idea because it
  makes your website faster for users and crawlers, and not all bots can run JavaScript.»*

**Dynamic rendering — deprecated.** **[П]**
https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering
(last updated 2025-12-10): *«Dynamic rendering was a workaround and not a long-term solution for
problems with JavaScript-generated content in search engines»*; рекомендуются SSR, static
rendering, hydration. → В шаблон **не закладывать** prerender-прокси/rendertron-схемы.

#### 2.1.2. Как индексирует JS Яндекс

**[П]** https://yandex.ru/support/webmaster/ru/yandex-indexing/rendering (см. `_sub-yandex.md`)

- Фича «Рендеринг страниц JavaScript» — **бета (β)** и в сентябре 2026.
- Дефолт — «на усмотрение робота Яндекса»; официальная рекомендация: **«Запретите рендеринг,
  если на сайте реализован SSR или пререндеринг»**.
- Предупреждение: *«При выполнении JavaScript-кода робот может создавать дополнительную нагрузку
  на ваш сервер»*.
- `window.YandexRotorSetting` (для отложенного контента): `WaiterEnabled`, `IsLoaded` (bool или
  функция), `IsError`, `FailOnTimeout`, `NoJsRedirectsToMain`.
- **Вывод для шаблона:** при полном SSR объект `YandexRotorSetting` не нужен; в чек-листе
  релиза — пункт «в Вебмастере выключить JS-рендеринг». Это единственный правильный ответ на
  вопрос «а Яндекс же умеет JS?» — умеет, но в бете и нестабильно.

#### 2.1.3. Полнота SSR-HTML: что обязано быть в первом ответе

Нормативно из источников выше + практика. **Обязательно в первом HTML** (до любого JS):

| Элемент | Почему |
|---|---|
| `<title>`, `<meta name="description">` | формируют сниппет; JS-инъекция работает только после рендер-очереди |
| `<link rel="canonical">` (абсолютный) | Google: JS не должен менять canonical относительно исходного HTML |
| `<meta name="robots">` / `X-Robots-Tag` | Google: снятие `noindex` через JS «may not work as expected» |
| `hreflang` (все версии + self + x-default) | признаётся только при взаимности |
| `<html lang>` | a11y + языковой сигнал |
| основной контент страницы (H1, текст, ссылки) | вторая волна рендера может отстать на дни |
| JSON-LD | SSR снимает вопрос «увидит ли робот» целиком |
| навигация обычными `<a href>` | *«crawlers don't "click" buttons and generally don't trigger JavaScript functions»* **[П]** (pagination doc) |

**Можно догружать после гидрации** (MAY, не индексируется и не должно): виджеты авторизации,
персонализированные блоки, аналитика, чаты, карты, комментарии, «похожие товары» из приватного
API, всё под `ssr: false`.

**TanStack Start:** `ssr: true` (дефолт) / `'data-only'` / `false`; наследование только
в сторону ужесточения; есть функциональная форма `ssr: ({ params, search }) => …`.
**[П]** https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
Дока сама пишет: *«Setting `ssr: false` means search engines receive a shell without content»*.

#### 2.1.4. HTTP-статусы из SSR

**[П]** https://developers.google.com/search/docs/crawling-indexing/http-network-errors

| Код | Как трактует Google | Применение в шаблоне |
|---|---|---|
| 200 | контент идёт в индексацию (не гарантированно) | нормальная публичная страница |
| 301 / 308 | *«strong signal that the redirect target should be processed»* | нормализация URL, переезд |
| 302 / 303 / 307 | слабый сигнал | временное; **не использовать для нормализации** |
| 304 | сигнал «не изменилось» | conditional GET с ETag |
| 4xx (400/401/403/404/410/411) | *«Google doesn't use the content from URLs that return 4xx status codes»*, ранее проиндексированные удаляются | 404 — нет ресурса; 410 — удалён навсегда |
| 429 | сигнал перегрузки сервера | правильный код для rate-limit; **не 403** |
| 5xx | краул замедляется, контент со временем выпадает | 503 на плановые работы |
| soft-404 | 200 с признаками ошибки → Search Console «soft 404» | **главный риск SPA-стиля**: «Ничего не найдено» с кодом 200 |

Максимум **10 редирект-хопов**; цепочки редиректов недопустимы.
**[П]** crawl budget: 5xx и 429 снижают crawl capacity;
https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget

**Состояние TanStack Start по статусам (риск!):**
- `notFound()` — есть, бросается из `beforeLoad`/`loader`, есть `notFoundComponent`
  и `defaultNotFoundComponent`. **[П]**
  https://tanstack.com/router/latest/docs/framework/react/guide/not-found-errors —
  но в самой доке **нет раздела про SSR-статус ответа**.
- Issue #1086 «HTTP status code not set to 404 when page not found», issue #4663 «Router Status
  Code does not change from 404 to 200» (открыт 2025-07-16, закрыт через PR #4664, версия 1.127.9),
  issue #5960 «404 error handling broken in loaders and server functions». **[П~]** (GitHub)
- `setResponseStatus` **не работал в server routes** — issue #5377 (открыт 2025-10-05, закрыт);
  воркэраунд — возвращать `new Response(body, { status })`. **[П]**
- `setResponseHeaders`/`setResponseStatus` **не работают в global middleware**, `setResponseHeader`
  (единственное число) работает — issue #5407. **[П~]**

→ **Вывод:** статусы в шаблоне надо проверять e2e на каждой сборке, а не доверять фреймворку.
Это прямой пункт в `pnpm check`/`test:e2e`.

#### 2.1.5. Нормализация URL и редиректы

**[П]** https://developers.google.com/search/docs/crawling-indexing/url-structure — дефисы вместо
подчёркиваний, читаемые слова, percent-encoding для не-ASCII, **URL регистрозависимы**
(«convert all text to the same case»), не класть session ID в URL.

**[П~]** Trailing slash: Google (Mueller) — слеш в конце это другой URL; правило «быть
консистентным, редиректить на один вариант, его же в sitemap и canonical».

Канон шаблона (единый нормализатор на входе, **308**):
1. `http` → `https` (на Traefik, а не в приложении).
2. `www` ↔ apex — выбрать один (для sub-domain-маршрутизации stit обычно apex `${DOMAIN}`).
3. Trailing slash: **`never`** (TanStack Router `createRouter({ trailingSlash: 'never' })` **[П~]**
   https://tanstack.com/router/latest/docs/api/router/RouterOptionsType). Важно: опция роутера
   нормализует клиентскую навигацию — **серверный 308 всё равно нужен отдельно**.
4. Нижний регистр пути.
5. Сортировка/вычистка неизвестных query-параметров у публичных страниц (сохраняя whitelist).

**Query-параметры:**
- Google: `rel=canonical` на чистый URL + `robots.txt disallow` для фасетов; **[П]**
  https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation
  — ранжирование по эффективности: robots.txt disallow > URL-фрагменты (`#`) > canonical > nofollow;
  разделитель только `&`; для несуществующих комбинаций фильтров — **404, а не редирект**.
- Яндекс: **`Clean-param`** (межсекционная директива, лимит правила 500 символов);
  `utm_*`, `ysclid`, `yrclid` Яндекс отбрасывает сам; при конфликте `Disallow` сильнее
  `Clean-param`. **[П]** https://yandex.ru/support/webmaster/ru/robot-workings/clean-param

#### 2.1.6. `rel=canonical`

**[П]** https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Сила сигналов: **редирект > `rel=canonical` > sitemap**.
- Только **абсолютные** URL; self-canonical на самой канонической странице; **это hint, не
  директива**.
- Нельзя: разные canonical разными способами, фрагмент в canonical, `noindex` как средство
  канонизации, robots.txt как средство канонизации.
- Поддерживается HTTP-заголовок `Link: <URL>; rel="canonical"` (нужен для не-HTML: PDF и т.п.).

**Яндекс** **[П]** https://yandex.ru/support/webmaster/ru/robot-workings/canonical
- Поддерживает `<link>` **и** HTTP-заголовок `Link`.
- **Cross-domain canonical НЕ поддерживается** (игнорируется).
- Игнорирует: несколько canonical на странице, цепочки canonical, canonical на закрытую/редиректящую
  страницу.
- Для http→https — **301/302**, не canonical. Для параметров — **Clean-param**, не canonical.

#### 2.1.7. `robots.txt`

**Google** **[П]** https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
- Действует на **host + protocol + port**; для каждого поддомена — свой файл.
- Поля: `user-agent`, `disallow`, `allow`, `sitemap`. `*` и `$` поддерживаются;
  хвостовой `*` игнорируется.
- Матчинг — **по длине пути правила**, при равенстве **побеждает `allow`**.
- Лимит **500 KiB**, дальше игнорируется. Кеш **до 24 часов** (зависит от `Cache-Control`).
- 4xx (кроме 429) → «файла нет» (всё разрешено). 5xx → краул стоп на 12 часов, дальше
  кешированная версия до 30 дней.
- **`noindex` в robots.txt не поддерживается**; закрытый в robots.txt URL может попасть в индекс
  «без сниппета».

**Яндекс** **[П]** https://yandex.ru/support/webmaster/ru/controlling-robot/robots-txt
- Директивы: `User-agent`, `Disallow`, `Allow`, `Sitemap`, `Clean-param`.
- **`Host` отменена 12.03.2018** (вместо неё 301 + заявка на переезд);
  **`Crawl-delay` не учитывается** (вместо неё «Скорость обхода» в Вебмастере).
- Приоритет — по длине правила, при равенстве побеждает `Allow`; пустой `Allow:` игнорируется
  (с 10.06.2016).
- Лимит **500 КБ**, только UTF-8, **кириллица в файле запрещена** (punycode/percent-encoding),
  сервер должен отвечать **200**; если файл некорректен/недоступен — «сайт считается открытым».
- Блочная иерархия: наличие `User-agent: Yandex` полностью отменяет для него блок `User-agent: *`.

**AI-краулеры — какая политика разумна по умолчанию.**
Официальные токены и списки IP (все **[П]**):

| Вендор | Токены | IP-лист |
|---|---|---|
| OpenAI | `GPTBot` (обучение), `OAI-SearchBot` (поиск ChatGPT), `ChatGPT-User` (по действию юзера; *«robots.txt rules may not apply»*) | `openai.com/gptbot.json`, `openai.com/searchbot.json`, `openai.com/chatgpt-user.json` |
| Anthropic | `ClaudeBot` (обучение), `Claude-SearchBot` (поиск), `Claude-User` (по действию юзера) — **все три соблюдают robots.txt** | `claude.com/crawling/bots.json` |
| Perplexity | `PerplexityBot`, `Perplexity-User` | `perplexity.com/perplexitybot.json`, `perplexity.com/perplexity-user.json` **[П~]** |
| Google | `Google-Extended` — *«manage whether content Google crawls from their sites may be used for training future generations of Gemini models»*; **не влияет на Search** | `developers.google.com/static/crawling/ipranges/common-crawlers.json` и др. |
| Apple | `Applebot-Extended` (только обучение, не влияет на поиск) | — |
| Common Crawl | `CCBot` | — |
| ByteDance | `Bytespider` | **официальной документации нет [?]** |

Разумный дефолт для **коммерческого сайта заказчика** (цель — трафик и цитируемость):
- **Разрешать** поисково-ответные боты: `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`,
  `Googlebot`, `YandexBot`, `Bingbot`.
- **Оставлять выключенным-но-готовым** (закомментированный блок в шаблоне) запрет обучающих:
  `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bytespider`.
- Решение «блокировать обучение или нет» — **бизнес-решение владельца сайта**, а не дефолт
  шаблона. Шаблон даёт переключатель (`SEO_AI_TRAINING=allow|deny` в runtime config).
- **`llms.txt` — не закладывать.** Google (Illyes/Mueller) публично говорит, что не использует и не
  планирует; ни один крупный вендор не подтвердил чтение. **[П~]** (вторичные, но консистентные
  источники; официальной страницы «мы поддерживаем llms.txt» ни у кого нет). MAY — если заказчик
  просит.

#### 2.1.8. `meta robots` / `X-Robots-Tag`

**Google** **[П]** https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Директивы: `all`, `noindex`, `nofollow`, `none`, `noarchive`, `nosnippet`, `indexifembedded`,
  `max-snippet:[n]`, `max-image-preview:[none|standard|large]`, `max-video-preview:[n]`,
  `notranslate`, `noimageindex`, `unavailable_after:[date]`.
- Таргетинг: `<meta name="googlebot">`, `<meta name="googlebot-news">`;
  в заголовке — `X-Robots-Tag: googlebot: noindex, nofollow`.
- **При конфликте применяется более строгое правило.**
- **Критично:** если URL закрыт в `robots.txt`, мета/заголовок **никогда не будут прочитаны**.
  Значит: чтобы страница выпала из индекса — её надо **разрешить** к обходу и отдать `noindex`.

**Яндекс** **[П]** https://yandex.ru/support/webmaster/ru/controlling-robot/meta-robots
- Поддерживает **только**: `noindex`, `nofollow`, `none`, `noarchive` + разрешающие
  `index`, `follow`, `archive`, `all`.
- `nosnippet`, `max-snippet`, `max-image-preview`, `notranslate`, `noimageindex`,
  `unavailable_after`, `indexifembedded` — **не документированы**, считать неподдерживаемыми.
- **X-Robots-Tag поддерживается полностью** (тот же набор директив).
- Токен таргетинга — `<meta name="yandex" content="noindex"/>`; учитываются одновременно и
  `robots`, и `yandex`.
- **Инверсия относительно Google:** *«Разрешающие директивы имеют приоритет в сочетании
  с запрещающими»* — при `noindex, index` Яндекс выберет `index`.
  → **Никогда не смешивать разрешающие и запрещающие директивы в одном значении.**

**`<noindex>` Яндекса** **[П]** https://yandex.ru/support/webmaster/ru/robot-workings/vision
— жив; скрывает **фрагмент текста** (не страницу), не блокирует переход по ссылкам внутри,
не чувствителен к вложенности; **без закрывающего тега скрывает всё до конца документа**.
Для шаблона — MAY (хелпер `<YandexNoIndex>`), полезен для юридических дисклеймеров и
дублирующихся блоков.

**Staging и приватные страницы:**
- Google **[П~]** https://developers.google.com/search/docs/crawling-indexing/block-indexing —
  для полной изоляции нужна HTTP-аутентификация; `noindex` требует, чтобы страницу **дали
  обойти**.
- Канон шаблона: **два независимых контура** —
  (а) Traefik `basicAuth` на staging-роутере,
  (б) `X-Robots-Tag: noindex, nofollow` из приложения при `SEO_INDEXABLE=false`,
  (в) robots.txt на staging = `User-agent: *\nDisallow: /`.
  Три слоя, потому что каждый по отдельности отказывает (basic-auth снимают на демо;
  robots.txt не мешает попаданию URL в индекс; `noindex` не читается под basic-auth).

#### 2.1.9. `sitemap.xml`

**[П]** https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
и https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps

- Лимиты: **50 МБ несжатых / 50 000 URL** на файл. Sitemap index — до **50 000 `<loc>`**;
  **вложенные индексы запрещены**; файлы, на которые ссылается индекс, должны лежать в том же
  каталоге или ниже. До **500 sitemap index на сайт** в Search Console.
- `<loc>` обязателен, URL **абсолютные**, UTF-8, entity-escaped.
- `<changefreq>` и `<priority>` — *«Google ignores»*. `<lastmod>` — используется, **только если
  он «consistently and verifiably accurate»**; формат W3C Datetime, минимум `YYYY-MM-DD`; означает
  дату **значимого** изменения; если не уверен — **лучше не выводить** `lastmod` вовсе.
  **[П~]** https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping
- **Ping-эндпойнт sitemap у Google удалён (2023)** — подавать через строку `Sitemap:` в robots.txt
  и через Search Console.
- hreflang в sitemap: поддерживается через `xmlns:xhtml` + `<xhtml:link rel="alternate" …>`,
  включая `x-default`; каждый `<url>` перечисляет все версии, включая себя. **[П]**

**Яндекс** **[П]** https://yandex.ru/support/webmaster/ru/controlling-robot/sitemap
- Те же 50 000 / 50 МБ; URL ≤ 2048 символов; форматы XML и TXT;
  `lastmod`/`changefreq`/`priority` — поддержаны как опциональные (≤100 байт);
  неизвестные элементы игнорируются; ответ **200**; **кросс-доменные sitemap не предусмотрены**.
- **hreflang внутри sitemap и gzip у Яндекса не подтверждены документацией** → для Яндекса
  hreflang класть в `<head>`/HTTP-`Link`, а не только в sitemap.

**Выводы для шаблона:** sitemap — **динамический server route**, а при малом сайте —
**встроенная генерация TanStack Start** (см. 2.6). Разбиение на index + под-карты — когда > 50 000
URL или > нескольких МБ. Секции: `sitemap-static.xml`, `sitemap-<entity>.xml`.

#### 2.1.10. Пагинация, бесконечный скролл, фасеты

**[П]** https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- `rel=next`/`rel=prev` — *«Google no longer uses these tags»*.
- У каждой страницы пагинации — **свой URL** (`?page=n`) и **self-canonical**
  («Don't use the initial page as canonical»).
- Боты *«don't "click" buttons and generally don't trigger JavaScript functions»* → «Load more» /
  infinite scroll должны иметь **реальные ссылки** на `?page=n` (можно скрытые для мыши, но в DOM)
  и/или все URL должны быть в sitemap.
- Фасеты — см. 2.1.5.

#### 2.1.11. Лимит байтов Googlebot — новое в 2026, прямо бьёт по SSR

**[П]** https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers:
*«By default, Google's crawlers and fetchers only crawl the first 15MB of a file, and any content
beyond this limit is ignored»*; *«individual projects may set different limits … For example, a
Google crawler like Googlebot may have a smaller size limit (for example, 2MB)»*.

**[П~]** (документация обновлена 2026-02-06, расширена 2026-03-31; подтверждено множеством
независимых источников, цитирующих официальный текст):
- **Googlebot для Google Search качает первые 2 МБ** поддерживаемого файла (раньше в доке
  фигурировало 15 МБ) и **первые 64 МБ PDF**.
- Лимит считается по **несжатым** данным (и включает HTTP-заголовки ответа).
- При достижении лимита **скачивание обрывается**, и **уже скачанная часть уходит в индексацию
  как если бы это был весь документ** — то есть HTML обрезается посередине, `</html>` не будет,
  а всё, что ниже, «не существует» для Google.
- **Каждый подгружаемый ресурс** (CSS/JS, которые тянет WRS) имеет **свой отдельный счётчик**
  и не расходует бюджет родительской страницы.
- Медианная HTML-страница ~33 КБ, так что 2 МБ — это много; затронуто < 0.01% сайтов.

**Почему это важно именно для SSR-шаблона.** В SSR-HTML, кроме контента, едет:
сериализованное состояние роутера/Query (dehydrate), инлайн-скрипты гидрации, потоковые
Suspense-чанки, потенциально инлайн критический CSS и base64-картинки. Это единственный
класс страниц, который реально способен подобраться к 2 МБ (большая таблица + жирный
`dehydrate()` + инлайн CSS). Google прямо предупреждает, что раздутые инлайн base64-картинки,
огромные блоки инлайн CSS/JS и мегабайты меню в начале документа могут **вытолкнуть настоящий
контент и структурированные данные за границу лимита**.

→ **MUST:** бюджет на размер SSR-HTML (предлагаю **≤ 300 КБ несжатого** на публичную страницу как
жёсткий потолок в e2e-тесте, с алертом на 150 КБ) и правило «контент и JSON-LD — в начале
документа, сериализованное состояние — в конце `<body>`».

**Протоколы и сжатие** **[П]** (та же страница): Google поддерживает **HTTP/1.1 и HTTP/2**
(по умолчанию HTTP/1.1), content-encoding — **gzip, deflate, brotli**. **zstd на этой странице
не упомянут** → Traefik `compress` с `zstd` в списке безопасен только потому, что выбор идёт по
`Accept-Encoding`; **но `defaultEncoding: zstd` (применяется, когда заголовка нет) ставить
нельзя** — можно отдать краулеру то, что он не разожмёт.

---

### 2.2. Метаданные

Подробности по OG-генерации и превью — в `research/_sub-og.md`.

#### 2.2.1. `<title>` и `meta description`

**[П]** https://developers.google.com/search/docs/appearance/title-link
- Google собирает title link не только из `<title>`: ещё из главного визуального заголовка,
  `<h1>`, **`og:title`**, заметного стилизованного текста, анкоров входящих ссылок и
  **`WebSite` structured data**.
- Дословно про длину: *«While there's no limit on how long a `<title>` element can be, the title
  link is truncated in Google Search results as needed, typically to fit the device width.»*
  → **Официального лимита в символах/пикселях нет.** Все «50–60 символов» — практика, а не норма.
- Переписывает title при: устаревшей информации, неточном описании, неясном главном заголовке,
  несовпадении языка, микро-бойлерплейте.
- Best practice: уникальный на каждой странице, описательный, без повторов ключевых слов,
  имя сайта — скупо и только в начале/конце через разделитель.

**[П]** https://developers.google.com/search/docs/appearance/snippet
- Google *«primarily uses the content on the page»* для сниппета, а `meta description` берёт,
  *«when it describes the page better than other parts of the content»* → **description не
  гарантирован к показу**, но задавать обязательно.
- Про длину: *«There's no limit on how long a meta description can be, but the snippet is
  truncated … typically to fit the device width.»*
- Управление: `nosnippet`, `max-snippet:[n]`, атрибут `data-nosnippet` на `div`/`span`/`section`.

**Практический бюджет для линтера шаблона** (не норматив Google, а способ ловить очевидные
ошибки): title 25–65 симв., description 70–170 симв., оба непустые и уникальные.
Проверяется unit-тестом `shared/seo/meta.test.ts` и e2e-регуляркой.

**Яндекс**: отдельной публичной спецификации по длинам нет; правило то же — уникальный
описательный title и description.

#### 2.2.2. Open Graph

**[П]** https://ogp.me/ — **четыре обязательных базовых свойства**: `og:title`, `og:type`,
`og:image`, `og:url` (последний — канонический постоянный URL объекта).
Опциональные: `og:description`, `og:site_name`, `og:locale` (формат `language_TERRITORY`,
дефолт `en_US` → для нас `ru_RU`/`en_US`), `og:locale:alternate` (массив — остальные локали),
`og:determiner`, `og:audio`, `og:video`.
Структурные свойства изображения: `og:image:url`, `og:image:secure_url`, `og:image:type`,
`og:image:width`, `og:image:height`, `og:image:alt` (спека рекомендует alt, если задан image).
**Сам протокол не задаёт требований к размеру/весу изображения** — пример 400×300 там
чисто иллюстративный.

⚠️ **`og:title` — не только про соцсети.** Google перечисляет его среди источников title link
**[П]** → в хелпере `<title>` и `og:title` должны браться из одного значения по умолчанию
(с возможностью раздельного override), иначе они разъедутся.

Требования потребителей:

| Потребитель | Требования | Статус |
|---|---|---|
| Facebook/Meta | рекомендуется **≥ 1200×630**, минимум **200×200**, соотношение ~**1.91:1**, вес до **8 МБ**; отладка — Sharing Debugger | **[П]** https://developers.facebook.com/docs/sharing/webmasters/images |
| X / Twitter | типы карточек 2026 — практически только `summary` и `summary_large_image`; минимум тегов: `twitter:card` + `twitter:image` (title/description **фолбэчатся на OG**); если картинка < **300×157** — X молча понижает до `summary`; ~1200×628, макс 4096×4096, вес до 5 МБ. **Twitter Card Validator не существует с 2022 года**, замены нет | **[?]** `developer.x.com` отдал **HTTP 402** (у X с февраля 2026 pay-per-use API); цифры из вторичных источников — перепроверить вручную |
| Telegram | превью документировано на уровне протокола (`webPage`, в т.ч. «OpenGraph descriptions») **[П]** https://core.telegram.org/constructor/webPage; пользовательской спецификации с лимитами нет; превью **агрессивно кешируется без задокументированного TTL**, уже отправленные сообщения не обновляются никогда; сброс для будущих пересылок — бот **`@WebpageBot`**; закешированный `noindex` тоже «залипает». Instant View — отдельная фича (свой шаблон на instantview.telegram.org), к OG-карточке отношения не имеет | частично **[П]**, лимиты **[?]** |
| ВКонтакте | стандартный OG-набор; встречается VK-специфичный `vk:image` как приоритетный оверрайд **[?]**; требования к сниппет-картинке: соотношение **1:1 или 5:2**, мин. ширина **500px**, < 160px по стороне → уменьшенная 150×83; форматы JPG/PNG/BMP/TIF/GIF(без анимации), **макс 5 МБ**; краулер — UA `vkShare`. Публичного веб-дебаггера нет, есть **API `pages.clearCache`** (`api.vk.com/method/pages.clearCache?url=…&access_token=…`, токен сообщества) | **[?]** `dev.vk.com` не отдался фетчем; цифры вторичные |
| Max (RU) | `dev.max.ru/docs-api` — **только Bot API**, ни слова про OG/превью. Есть параметр Bot API, отключающий автопревью → механизм существует, но публично не документирован | **[П]** (подтверждено отсутствие документации) |

→ **Канон шаблона:** один размер **1200×630 PNG/JPEG** (1.91:1 — общий знаменатель
Facebook/X/VK/Telegram/Slack/Discord/WhatsApp), `og:image:width/height/alt` всегда,
**абсолютный HTTPS-URL** (относительные пути большинство скрейперов не резолвят),
вес < 1 МБ (с запасом под все лимиты). Отдельных «VK-» и «Telegram-тегов» заводить не надо —
они читают OG.
⚠️ Поведение X с отображением заголовка поверх карточки исторически менялось → **текст
заголовка стоит запекать прямо в OG-картинку**, а не рассчитывать на подпись от потребителя.

#### 2.2.3. Генерация OG-изображений на сервере (Node 24, alpine/musl, без CDN)

Сравнение (версии npm на 2026-09-15, **[П]** — см. `_sub-og.md`):

| Инструмент | Версия | musl/alpine | Вердикт |
|---|---|---|---|
| **`satori`** | 0.33.4, MPL-2.0 | чистый JS + WASM, нативных бинарников нет → работает | **берём** (layout HTML/CSS→SVG). ⚠️ **не читает WOFF2** — только TTF/OTF/WOFF |
| **`@resvg/resvg-js`** | 2.6.2, MPL-2.0 | официальные пребилды `linux-x64-musl` / `linux-arm64-musl` | **берём** (SVG→PNG), быстрее растеризации через sharp по бенчмарку репо |
| `@vercel/og` | 1.0.2 | обёртка над satori + `@resvg/resvg-wasm` | не нужна вне Next/Vercel; WASM медленнее нативного |
| `@napi-rs/canvas` | 1.0.9, MIT | musl-пребилды есть | запасной вариант; императивный canvas-API вместо CSS-layout |
| `canvas` (node-canvas) | 3.2.3 | **musl-пребилдов нет**, сборка из исходников + `cairo-dev/pango-dev/...` | нет |
| `playwright`/`puppeteer` | — | **Alpine официально не поддерживается Playwright** | нет |
| `sharp` | 0.35.4, Apache-2.0 | musl-пребилды есть, но нужен явный `--os=linux --libc=musl` / `pnpm.supportedArchitectures` | опционально (постобработка/JPEG-фолбэк), **не** layout-движок |

⚠️ В матрице поддержки `@resvg/resvg-js` Node 24 явно не перечислен (N-API ABI стабилен, но это
**[?]**) → нужен smoke-тест в CI на `node:24-alpine`.
⚠️ В alpine **нет системных шрифтов** — кириллический TTF кладём в репозиторий/образ и передаём
в satori явно.

Черновик — в `_sub-og.md` §1. Кеширование (собственный синтез, **[?]** — специализированного
официального гайда нет):
- ключ = `sha256(title + subtitle + templateVersion)`;
- **иммутабельный URL** `/og/{hash}.png` → `Cache-Control: public, max-age=31536000, immutable`;
- «логический» URL `/blog/<slug>/og.png` → короткий `max-age` + `stale-while-revalidate` + `ETag`
  = тот же хеш (даёт 304);
- серверный кеш: in-memory LRU + дисковый каталог (переживает рестарт; PNG ~50–150 КБ).

#### 2.2.4. Favicon, manifest, theme-color

**[П~]** https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs
(статья обновляется; версия 2026). Минимальный набор:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
```
`favicon.ico` 32×32 (легаси-фолбэк, краулеры стучатся на `/favicon.ico` напрямую),
`icon.svg` (тёмная тема — через `@media (prefers-color-scheme: dark)` **внутри** SVG),
`apple-touch-icon.png` 180×180, манифест с иконками 192/512 (+ `purpose: "maskable"`).

⚠️ Утверждение части блогов «Android требует растр, SVG в manifest не работает» **MDN не
подтверждает** — `"sizes": "any", "type": "image/svg+xml"` в `icons` манифеста разрешён **[П]**
https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons.
Практика: держать PNG 192/512 (+ один `maskable`) как гарантированно совместимый путь, SVG —
дополнительно, не вместо.

`theme-color` с `media="(prefers-color-scheme: …)"`:
```html
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">
```
Поддержка `media`-варианта — Safari 15+ (macOS/iOS), Chrome/Samsung Internet на Android,
установленные PWA; **Firefox desktop `theme-color` игнорирует** **[П~]** (MDN).
⚠️ Есть вторичное сообщение, что iOS 26 Safari перестал поддерживать `theme-color`; официальными
WebKit release notes **не подтверждено** **[?]** → ставим (вреда нет), но не полагаемся.

`<meta name="color-scheme" content="light dark">` — **MUST и дёшево**: тег в `<head>` до CSS
позволяет браузеру отрисовать нативные виджеты формы, скроллбар и фон в нужной схеме **до
применения авторского CSS**, устраняя white-flash при первой отрисовке в тёмной теме.
Поддержка: Chrome/Edge 81+, Firefox 96+, Safari 13+ **[П~]** https://web.dev/articles/color-scheme.
Для SSR это критично: значение темы должно быть известно **на сервере** (из cookie), чтобы
`data-scheme` на `<html>` и `color-scheme` совпали с первого байта — иначе тёмная тема мигает
белым до гидрации. Это прямое продолжение уже существующего в SPA-шаблоне механизма
`features/theme` + `data-scheme`, но в SSR **обязательно** переносится на сервер
(в TanStack Start — через `ScriptOnce`/серверное чтение cookie, не через `useEffect`).

#### 2.2.5. `<html lang>` и верификации

- `<html lang="{locale}">` (+ `dir`) рендерится на сервере из активной локали.
- `<meta name="google-site-verification" content="…">` и `<meta name="yandex-verification"
  content="…">` — только если значение задано в runtime config (иначе тег не выводится).
  Яндекс требует размещения **строго в `<head>` главной страницы**; альтернативы — HTML-файл в
  корне или DNS TXT **[П]**.
- **`<meta name="keywords">` не добавлять** — Google: *«not used by Google Search, and it has no
  effect on indexing and ranking at all»* **[П]**.

#### 2.2.6. Сводная таблица тегов

| Тег | Уровень | Кто читает | Где генерится |
|---|---|---|---|
| `<title>` | MUST | Google, Яндекс, соцсети (фолбэк) | `head()` роута, шаблон из `shared/seo/meta` |
| `meta description` | MUST | Google, Яндекс | `head()` |
| `meta robots` | MUST (когда не `index,follow`) | Google, Яндекс | `head()` + `X-Robots-Tag` |
| `link canonical` | MUST | Google, Яндекс | `head()` (или `Link`-заголовок) |
| `link alternate hreflang` + `x-default` | MUST | Google (полноценно), Яндекс (слабо) | `head()` |
| `html lang` | MUST | Google, скринридеры | `__root.tsx` |
| `og:title/description/type/url/site_name/locale` | MUST | FB, VK, Telegram, X (фолбэк), Max(?) | `head()` |
| `og:image` + `:width/:height/:alt` | MUST | те же | `head()` + `/og/*` роут |
| `twitter:card` | SHOULD | X | `head()` |
| `meta color-scheme` | SHOULD | браузеры | `__root.tsx` |
| `theme-color` (light/dark) | SHOULD | мобильные браузеры, PWA | `__root.tsx` |
| favicon-набор + manifest | SHOULD | браузеры, PWA | `public/` + `__root.tsx` |
| `google-site-verification` / `yandex-verification` | SHOULD | GSC / Вебмастер | `__root.tsx` из runtime config |
| `meta keywords` | **NEVER** | никто | — |

---

### 2.3. Структурированные данные (JSON-LD)

#### 2.3.1. Что Google реально поддерживает в 2026

**[П]** https://developers.google.com/search/docs/appearance/structured-data/search-gallery
(состав галереи на 2026-09-15): Article, Breadcrumb, Carousel, Course list, Dataset,
Discussion forum, Education Q&A, Employer aggregate rating, Event, Image metadata, Job posting,
**Local business**, Math solver, Movie, **Organization**, **Product**, Profile page, Q&A, Recipe,
Review snippet, Software app, Speakable, Subscription/paywalled content, Vacation rental, Video.

**Чего в галерее больше нет (важно — типовые «шаблонные» решения это ещё тянут):**
- **FAQ / FAQPage** — rich results **перестали показываться 7 мая 2026**; отчёты и поддержка в
  Rich Results Test убираются в июне 2026, в Search Console API — в августе 2026. Разметка
  остаётся валидной schema.org и Google продолжает её парсить для понимания страницы, но
  **как инструмент видимости мертва**. **[П~]** (консистентные вторичные источники; в галерее
  тип отсутствует — это уже первичное подтверждение)
- **HowTo** — rich results выключены на десктопе с сентября 2023. **[П~]**
- **Sitelinks searchbox** (`WebSite` + `potentialAction: SearchAction`) — снят **21 ноября 2024**,
  официальный пост «Farewell, Sitelinks Search Box»
  https://developers.google.com/search/blog/2024/10/sitelinks-search-box; разметка ничего не даёт,
  но и ошибок не вызывает. **[П~]** (заголовок поста подтверждён, тело не фетчилось)
- В июне 2025 выведены ещё 7 типов (Book Actions, Course Info, Claim Review, Estimated Salary,
  Learning Video, Special Announcement, Vehicle Listing). **[П~]**

→ **Шаблон не должен генерировать `FAQPage`, `HowTo` и `SearchAction` «по умолчанию»** — это
карго-культ 2020-х. FAQPage — MAY, если заказчик хочет семантику.

`WebSite` **остаётся нужным** — но не ради searchbox, а ради **имени сайта в выдаче**:
**[П]** https://developers.google.com/search/docs/appearance/site-names — `WebSite` с `name`
и `url` **на корне домена**; вторичные сигналы — `og:site_name`, `<title>`, заголовки.

#### 2.3.2. Правила размещения и качества

**[П]** https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Форматы: **JSON-LD (рекомендуется)**, Microdata, RDFa.
- *«Don't block your structured data pages to Googlebot using robots.txt, `noindex`, or any other
  access control methods.»*
- **Главное качественное правило:** *«Don't mark up content that is not visible to readers of the
  page.»* → JSON-LD описывает то, что реально отрендерено (цена в разметке = цена на странице;
  хлебные крошки в разметке = видимые хлебные крошки).
- Полнота обязательных свойств типа; нарушения → **manual action** (теряется право на rich
  results, обычный веб-поиск не страдает).
- *«Google does not guarantee that your structured data will show up in search results, even if
  your page is marked up correctly.»*

**Размещение.** Google принимает `<script type="application/ld+json">` **и в `<head>`, и в
`<body>`** — дословно *«A JavaScript notation embedded in a `<script>` tag in the `<head>` and
`<body>` elements of an HTML page»* **[П]**
https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data.
Там же: *«Google can read JSON-LD data when it is dynamically injected into the page's contents,
such as by JavaScript code or embedded widgets»* — то есть даже клиентская инъекция читается,
а при SSR вопрос снимается полностью.
→ Для FSD это значит: JSON-LD можно объявлять там, где живут данные (page/widget через `head()`),
не поднимая всё в корневой `app`.
Несколько независимых блоков **или** один блок с `@graph` — оба паттерна валидны и понимаются
валидаторами (прямой цитаты Google «можно оба» не нашлось — **[?]**, но это общепринято).

**CSP — важное уточнение (проверено по спецификации, опровергает распространённое заблуждение):**
`<script type="application/ld+json">` — это **data block**, а не исполняемый скрипт.
В алгоритме HTML «prepare the script element» тип определяется на шагах 8–13, и шаг 13 гласит
*«Otherwise, return. (No script is executed, and el's type is left as null.)»*, тогда как проверка
CSP выполняется только на **шаге 21** — то есть до неё элемент с типом `application/ld+json`
просто не доходит. **[П]** https://html.spec.whatwg.org/multipage/scripting.html
→ **`script-src` не блокирует JSON-LD, и nonce ему не нужен.** Ставить nonce на JSON-LD —
карго-культ. Nonce/хеш нужны только настоящим исполняемым inline-скриптам (инлайны гидрации
TanStack Start, `ScriptOnce`, счётчики).

В TanStack Start JSON-LD задаётся через
`head().scripts[{ type: 'application/ld+json', children: JSON.stringify(...) }]` **[П]**.

**Динамический JSON-LD при этом не мешает hash-based CSP** — это снимает одно из главных
возражений против кешируемого HTML без nonce.

#### 2.3.3. Яндекс

**[П]** https://yandex.ru/support/webmaster/ru/schema-org/what-is-schema-org,
https://yandex.ru/support/webmaster/ru/json-ld/about.html
- Поддерживаются **JSON-LD, microdata, RDFa, микроформаты, Open Graph**; *«Наши алгоритмы не
  отдают предпочтения какому-либо одному типу разметки»*, Schema.org рекомендован как более
  современный.
- Разметка **не влияет на ранжирование**, только на расширенные сниппеты; применение — **~2 недели**.
- Подтверждённые типы: `Organization`/`Address`, `Product`/`Offer`/`OfferCatalog`, `Recipe`,
  `Movie`, `SoftwareApplication`, `QAPage`, `Essay`, `ImageObject`, **`VideoObject`**
  (без разметки видео **вообще не индексируется** в видеопоиске), `BreadcrumbList` (JSON-LD,
  поля `name`/`url`/`position`, рекомендация ≤ ~3 звена), `AggregateRating`.
- Ключи и значения JSON-LD **регистрозависимы**.

→ **Хорошая новость:** пересечение с Google достаточно велико, чтобы один слой JSON-LD обслуживал
обоих. Минимальный универсальный набор: `Organization` + `WebSite` (главная),
`BreadcrumbList` (вложенные), `Article`/`Product`/`LocalBusiness`/`Event`/`VideoObject`
(по типу страницы).

#### 2.3.4. Валидация

| Инструмент | URL | Когда |
|---|---|---|
| Rich Results Test | https://search.google.com/test/rich-results | ручная проверка перед релизом (MUST) |
| Schema Markup Validator | https://validator.schema.org/ | ручная, синтаксис schema.org |
| Валидатор Яндекса | **https://webmaster.yandex.ru/site/tools/microtest/** | ручная, MUST для ru-проектов **[П]** |
| Search Console «Улучшения» | — | мониторинг после индексации |

**В CI автоматизировать нечего готового** (честный вывод, **[П]**):
- `structured-data-testing-tool` — последняя публикация ~2020, мёртв;
- `web-auto-extractor` — ~2018, мёртв;
- живого CLI-эквивалента Rich Results Test не нашлось.

Что **реально** делается в CI:
1. **`schema-dts` 2.0.0** (Apache-2.0, репозиторий `google/schema-dts` активен: 556 коммитов,
   но в README *«This is not an officially supported Google product»*) — compile-time типизация
   JSON-LD, нулевая рантайм-стоимость. **[П]** https://registry.npmjs.org/schema-dts/latest
2. Собственная **Zod-схема** на то, что проект реально эмитит (обязательные поля типа,
   абсолютные URL, отсутствие `undefined`) + unit-тест на `JSON.stringify`.
3. E2E: JSON-LD в сыром HTML парсится и содержит ожидаемый `@type`.

Генератора Zod-схем из онтологии schema.org не нашлось **[?]** (отсутствие не доказано).

---

### 2.4. i18n-SEO

#### 2.4.1. Стратегия URL

**[П]** https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites

| Вариант | Оценка Google | Вердикт для шаблона |
|---|---|---|
| ccTLD (`example.de`) | «Clear geotargeting», но дорого и по одной стране | нет (у нас один VPS/один домен) |
| Поддомен (`en.example.com`) | просто, гибко, но сигнал не очевиден пользователю | нет (маршрутизация stit по сабдоменам занята сервисами) |
| **Подкаталог (`example.com/en/`)** | **«Easy to set up, Low maintenance»** | **да, дефолт шаблона** |
| Query-параметр (`?loc=de`) | **«Not recommended»** | нет |

- **Авто-редирект по `Accept-Language`/гео — запрещён**: *«Avoid automatically redirecting users
  from one language version of a site to a different language version»*; причина — такие редиректы
  *«could prevent users (and search engines) from viewing all the versions of your site»*, и
  «the Googlebot crawler usually originates from the USA» и не шлёт `Accept-Language`.
  → Шаблон MAY показывать **баннер-подсказку** «есть версия на вашем языке» (без редиректа)
  и MAY использовать `Accept-Language` **только** для выбора языка при заходе на голый `/`
  с **302** и `Vary: Accept-Language`… — но даже это рискованно; **дефолт канона: `/` = дефолтная
  локаль, без сниффинга**.
- Дефолтная локаль **без префикса** (`/about` = ru), вторая — с префиксом (`/en/about`).
  Альтернатива «обе с префиксом + `/` → 308 на `/ru/`» тоже валидна; главное —
  **ровно один канонический URL на (страница × локаль)**.

**TanStack Router**: официальный i18n-гайд предлагает **опциональный path-параметр**
`createFileRoute('/{-$locale}/about')`, который матчит и `/about`, и `/en/about`; валидация
локали в `beforeLoad` (иначе `notFound()`); есть `rewrite: { input, output }` для де/локализации
URL на границе роутера. **[П]**
https://tanstack.com/router/latest/docs/guide/internationalization-i18n
⚠️ В официальном примере при невалидной локали бросается `new Error`, а не `notFound()` —
**в шаблоне обязательно `notFound()`**, иначе `/xx/about` вернёт 500 вместо 404.

#### 2.4.2. `hreflang`

**[П]** https://developers.google.com/search/docs/specialty/international/localized-versions
- Три способа: `<link rel="alternate" hreflang>` в `<head>`, HTTP-заголовок `Link:`,
  `xhtml:link` в sitemap. Набор ссылок **идентичен на всех версиях**.
- **Взаимность обязательна**: *«If two pages don't both point to each other, the tags will be
  ignored»*; каждая версия перечисляет **и себя**.
- `x-default` — фолбэк «when no other language/region matches the user's browser setting»;
  для языкового селектора.
- Формат: ISO 639-1 (+ опционально ISO 3166-1 alpha-2). Нельзя указывать только регион;
  `EU`, `UN`, `UK` — невалидны (для Британии `en-GB`).
- Это **сигнал, а не директива**.

**Яндекс**: hreflang + `x-default` поддерживаются, но единственный найденный первоисточник —
блог 2013 г. **[П~]** https://webmaster.yandex.ru/blog/15326; актуальной страницы в
`/support/webmaster/` нет. Практика: Яндекс опирается прежде всего на **региональность в
Вебмастере**. → hreflang делаем (Google его использует полноценно), но для Яндекса
дублируем сигнал понятной структурой URL (`/en/`) и региональной настройкой.

#### 2.4.3. Прочее

- `<html lang="ru">` / `lang="en"` (+ `dir` если появятся RTL-локали) — MUST, рендерится на сервере.
- **Переводы slug'ов** (`/en/about` vs `/o-nas`) — MAY. Технически поддерживается `rewrite` в
  TanStack Router. Риск: удваивает карту роутов и ломает `crawlLinks`-prerender. Дефолт канона —
  **общий slug, разный префикс** (проще, безопаснее); локализованные slug'и — опция под явный
  запрос заказчика.
- `og:locale` / `og:locale:alternate` — см. раздел метаданных.
- Дублирующийся контент между локалями: Google — `canonical` внутри локали + `hreflang` между
  локалями (canonical **не** должен указывать с `/en/` на `/`).

---

### 2.5. Производительность / Core Web Vitals

#### 2.5.1. Пороги и статус метрик (2026)

**[П]** https://web.dev/articles/vitals — три Core Web Vitals, пороги «good» **не менялись**:

| Метрика | good | перцентиль |
|---|---|---|
| **LCP** | ≤ **2.5 с** | 75-й, отдельно mobile/desktop |
| **INP** | ≤ **200 мс** | 75-й |
| **CLS** | ≤ **0.1** | 75-й |

Вспомогательные (не CWV): TTFB, FCP, TBT. INP заменил FID в 2024.
**[П]** https://developers.google.com/search/docs/appearance/page-experience (обновлено 2025-12-10):
*«There is no single signal»*, CWV входят в ранжирование, но хороший отчёт не гарантирует топ.

⚠️ **Проверка слуха:** SEO-блоги 2026 утверждают, что «18 марта 2026 Google в Search Central
блоге подтвердил INP как равноправный ranking-сигнал». **В архиве блога Search Central за 2026
такого поста нет** (мартовские посты — про Googlebot и про переезд IP-листов) **[П]**
https://developers.google.com/search/blog → считать это **непроверенным** и не опираться.

**Soft navigations (важно для SSR+клиентская навигация).** **[П]**
https://web.dev/articles/vitals-spa-faq (обновлено 2026-08-11):
исторически CWV меряются только на первичной («жёсткой») навигации; Chrome 151 добавил
`PerformanceSoftNavigation` и `InteractionContentfulPaint`, позволяющие мерить CLS/INP/FCP/LCP
на переходах SPA-роутера; **CrUX пока агрегирует только по origin/первому URL**, работа по
разбивке по SPA-роутам ведётся. Google явно не рекомендует менять архитектуру ради метрик:
*«You should only switch from an SPA to an MPA if you are not happy with your SPA stack…»*.
→ Для SSR-шаблона это значит: **первый заход** (то, что видит и бот, и новый пользователь) —
единственное, что сегодня попадает в CrUX; клиентские переходы «бесплатны» с точки зрения
отчётности, но не с точки зрения пользователя.

**`web-vitals`: актуальная версия — 6.2.2** **[П]** https://registry.npmjs.org/web-vitals/latest
(в SPA-шаблоне стоит 4.2.4 → мажорный апгрейд при переносе). Экспорты: `onLCP`, `onINP`, `onCLS`,
`onFCP`, `onTTFB` + сабмодуль `./attribution`.
→ В SSR **TTFB становится первоклассной метрикой** (в SPA за статикой он был почти константой) —
обязательно репортить.

#### 2.5.2. Streaming SSR и боты — главный подводный камень 2026

Это самый неочевидный риск всего шаблона.

**[П]** https://unhead.unjs.io/learn/research/streaming-head-performance (кросс-фреймворковое
исследование, 2026-03-05; тестировались Next.js 16, Nuxt 4, React Router 7, SvelteKit, Angular,
Astro, Solid Start, Qwik):
- **Социальные краулеры JS не исполняют**: X/Twitter, Facebook, Slack, LinkedIn читают **первый
  чанк** ради Open Graph и отключаются. Формулировка исследования: *«Patched heads = broken
  social cards»* — если `<head>` дополняется позже по стриму, превью ломается.
- **Googlebot**: двухволновая индексация, но есть ловушка — если в стримленном fallback'е
  оказался `<meta name="robots" content="noindex">`, Googlebot применит его **немедленно** и
  вторую волну может не делать.
- Next.js 16 сделал **bot-aware rendering** (`htmlLimitedBots`): детект бота по User-Agent →
  блокирующий рендер до резолва head; людям — стрим.
- Вывод исследования: *«Keep `<head>` data out of the streaming path entirely, or use bot-aware
  rendering»*.

**[П~]** https://github.com/remix-run/react-router/discussions/14726 (открыто 2026-01-14):
**в React 19.2 изменилось поведение стриминга для ботов** — раньше (19.1.x) при UA Googlebot
`onAllReady` отдавал HTML с уже вложенным резолвнутым Suspense-контентом; **в 19.2.x начальный
HTML содержит Suspense-fallback'и, а данные приезжают отдельными стримовыми чанками — в том числе
для ботов**. Связано с батчингом раскрытия Suspense-границ перед первой отрисовкой.
Обсуждаемые обходы: `progressiveChunkSize: Infinity` в `renderToPipeableStream`; рекомендация
React «дождаться всего контента для краулеров» **по сообщению автора треда в 19.2 больше не
работает**. Официальной позиции React-команды в найденном материале нет → **[?]**, требует spike.

**Что есть в TanStack:**
- `createRequestHandler(...)(defaultStreamHandler)` — стриминг по умолчанию;
  **`defaultRenderHandler` / `renderRouterToString`** — **не-стримовый** рендер
  **[П]** https://tanstack.com/router/latest/docs/framework/react/guide/ssr + **[П~]** (docs/API).
- В зависимостях TanStack Router есть **`isbot`** **[П~]** — то есть материал для bot-aware
  переключения уже под рукой.

**→ Канон шаблона (MUST):**
1. **Весь `<head>` резолвится до первого байта.** `title`, `description`, `canonical`, `hreflang`,
   `og:*`, JSON-LD **никогда** не зависят от данных внутри Suspense-границы. Практически: данные
   для `head()` берутся из `loader` роута (он отрабатывает до рендера), а не из `useSuspenseQuery`
   вложенного компонента.
2. **Основной контент индексируемой страницы — вне Suspense.** Suspense — только для явно
   второстепенных блоков (рекомендации, отзывы, «похожее»), которые не жалко потерять для бота.
3. **Bot-aware рендер** (SHOULD, а для контентного сайта — MUST): `isbot(UA)` → не-стримовый
   `renderRouterToString`/`defaultRenderHandler`; людям — `defaultStreamHandler`.
   ⚠️ Это **не** dynamic rendering в смысле Google (контент один и тот же, отличается только
   способ доставки байтов), поэтому под запрет из 2.1.1 не попадает — но зафиксировать это в доке
   надо явно, чтобы ревьюер не спутал.
4. **e2e-тест:** запрос с `User-Agent: Googlebot` должен вернуть HTML, в котором есть H1 и весь
   head **без** Suspense-плейсхолдеров.

#### 2.5.3. CSS (Tailwind v4)

- Tailwind v4 (`@tailwindcss/vite`) генерирует только используемые утилиты, без ручного purge;
  типовой бандл небольшой.
- **Render-blocking CSS — доминирующий вклад в LCP** на мобильных **[П~]** (Web Almanac 2025 по
  вторичному пересказу): медианный сайт грузит ~7 render-blocking ресурсов на 100+ КБ.
- **Инлайнить ли критический CSS при SSR без CDN?** Позиция канона: **нет, по умолчанию не
  инлайнить**. Причины: (а) инлайн раздувает каждый HTML-ответ и ест бюджет 2 МБ Googlebot
  (2.1.11); (б) внешний CSS кешируется между страницами, инлайн — нет; (в) у Tailwind v4 один
  небольшой файл, и обычный `<link rel="stylesheet">` в `<head>` — это уже почти оптимум.
  Инлайн критического CSS — **MAY**, точечно, если LCP не проходит и измерения показывают, что
  дело в CSS.
- Атрибут **`blocking="render"`** (`<link>`/`<script>` в `<head>`) — управляемое блокирование
  отрисовки, полезно против FOUC при скрипт-вставках **[П~]** MDN (обновление 2026-05).
  Для шаблона: MAY; штатный `<link rel="stylesheet">` и так блокирует.
- **FOUC темы при SSR** решается не CSS-инлайном, а серверным чтением cookie темы + `data-scheme`
  на `<html>` в первом байте (и `<meta name="color-scheme">`) — см. 2.2.4.

#### 2.5.4. Шрифты

**[П]** https://web.dev/articles/font-best-practices (last updated 2022-10-04 — старая, но это
по-прежнему канонический документ):
- **Только WOFF2** («compresses 30% better than WOFF»), остальные форматы не нужны.
- **Self-host** для приватности и предсказуемости (третья сторона = лишний connect + утечка
  IP посетителя).
- `font-display`: `optional` (100 мс блок, без swap) — минимальный CLS, лучший выбор для
  основного текста; `swap` — для брендовых заголовков; `block` — избегать.
- **Subsetting кириллицы через `unicode-range`** — MUST для ru/en-сайта: латиница и кириллица
  разными файлами, браузер качает только нужное. Инструменты: `pyftsubset` (fonttools),
  `subfont`, `glyphhanger`.
- ⚠️ **Preload обходит `unicode-range`** — то есть `<link rel=preload as=font>` на кириллический
  сабсет скачается и на англоязычной странице. → Preload'ить **максимум один** файл (тот, что
  реально нужен активной локали), формируя тег **на сервере из локали**, а не статикой.
  `crossorigin` обязателен.
- **CLS от подмены шрифта** — `size-adjust`, `ascent-override`, `descent-override`,
  `line-gap-override` на `@font-face` фолбэка. Для ru/en с одним variable-шрифтом это
  обязательный минимум, если `font-display` не `optional`.
- Variable font вместо 4–6 начертаний.

#### 2.5.5. Изображения

- **`<picture>`: AVIF → WebP → JPEG/PNG.** AVIF в 2026 поддержан всеми основными браузерами
  (> 95%) **[П~]**; WebP — универсально. На старых Android декодирование AVIF может быть
  медленнее → для LCP-героя измерять.
- **Google индексирует только `<img src>`** (CSS-фоны — нет) и требует **фолбэк `src`** при
  использовании `srcset`/`sizes`/`<picture>`; поддерживает BMP/GIF/JPEG/PNG/WebP/SVG/**AVIF**
  **[П]** (google-images doc).
- **CLS:** `width`/`height` (или `aspect-ratio`) на каждом `<img>` — MUST.
- **LCP-картинка:** `fetchpriority="high"`, **без** `loading="lazy"`, желательно `preload`;
  остальные — `loading="lazy"` + `decoding="async"`.
- **Оптимизация в Node без CDN:**
  - **Build-time (предпочтительно):** `vite-imagetools` **12.0.0** (на sharp) — директивы импорта,
    генерация форматов и `srcset` на сборке **[П~]** https://www.npmjs.com/package/vite-imagetools.
    Плюс: ноль работы в рантайме, картинки — обычные хешированные ассеты с `immutable`.
    Минус: не работает для пользовательского/CMS-контента.
  - **Runtime:** свой роут `/img/...` на `sharp` **0.35.4** с дисковым кешем и
    `Cache-Control: immutable` по контент-хешу. ⚠️ **musl**: для alpine нужен явный
    `--os=linux --libc=musl` либо `pnpm.supportedArchitectures` (`os`/`cpu`/`libc: musl`) —
    иначе lock-файл, собранный на glibc-машине, не притащит musl-бинарник **[П]**
    https://sharp.pixelplumbing.com/install/.

#### 2.5.6. Resource hints, Early Hints, Speculation Rules

- `preconnect` — только к реально критичным сторонним origin'ам (их у self-hosted-сайта почти
  нет); `modulepreload` для входного чанка; `preload` — скупо (шрифт активной локали, LCP-картинка).
- **103 Early Hints** **[П~]**: Chrome/Edge 103+ (preload+preconnect), Firefox 123+,
  **Safari 17+ только preconnect**; работает **только по HTTP/2/3**; в Node есть
  `response.writeEarlyHints()`.
  ⚠️ **Traefik OSS 103 не проксирует** (issue traefik/traefik#9213; поддержку добавляли в
  Traefik **Enterprise**) → **в текущем стеке stit Early Hints практически недоступны**.
  Уровень: **MAY**, отложить; если появится nginx-sidecar (nginx поддерживает 103) — пересмотреть.
- **Speculation Rules API** **[П~]**: Chrome/Edge 109+ (prerender с 105, prefetch с 110,
  `eagerness`/`where` с 121); **Safari 26.2 — есть, но выключено по умолчанию; Firefox не
  поддерживает**; MDN держит статус «Limited availability / Experimental».
  → **MAY**, прогрессивное улучшение: `<script type="speculationrules">` с `prefetch`
  и `eagerness: moderate` на внутренние ссылки. Не заменяет нормальный TTFB.
  ⚠️ CSP: `script-src` покрывает `<script type="speculationrules">` отдельной оговоркой
  (в отличие от `ld+json`) — если включён nonce/hash-режим, этот тег надо учесть.

#### 2.5.7. Бюджет JS и гидрация

- SSR + **полная гидрация** — базовая модель TanStack Start. Инструменты снижения работы на
  клиенте: **selective SSR** (`ssr: 'data-only'` / `false`) для неиндексируемых тяжёлых веток,
  дробление роутов (роут-левел code splitting в TanStack Router из коробки), React Compiler
  (уже в стеке) против лишних ререндеров → INP.
- **React Server Components** в TanStack Start заявлены (в overview упоминается «Server
  Components guide») **[П]**, но зрелость в связке с Vite 8/Rolldown в рамках этого потока
  **не проверялась** → вопрос к потоку 01/06.
- **Бюджеты.** SPA-шаблон уже имеет `size-limit` (main 35 КБ, react 65 КБ, router 30 КБ,
  query 12 КБ, initial total 150 КБ gzip). Для SSR предлагаю:
  - сохранить клиентские бюджеты (SSR не отменяет гидрацию — JS всё равно едет);
  - **добавить бюджет на размер SSR-HTML** (см. I-24) и на CSS;
  - добавить Lighthouse CI `budget.json` на реальной странице (скрипты/шрифты/картинки).

#### 2.5.8. Сторонние скрипты (Яндекс.Метрика, GA4)

- Официальных «лёгких режимов» подключения Метрики найти не удалось **[?]**; типовой сниппет
  вставляется асинхронно. Канон шаблона:
  - счётчики грузятся **после гидрации** (или по первому взаимодействию / `requestIdleCallback`),
    никогда не render-blocking и не в `<head>` синхронно;
  - обязательно измерять их вклад в **INP** и TBT (это главный источник деградации INP);
  - под CSP они потребуют либо nonce, либо `script-src` с их доменом — ещё один аргумент
    за осознанный выбор режима CSP (см. 2.8.1);
  - **`Partytown`** (вынос третьих сторон в web worker) — проект QwikDev, **всё ещё beta**
    **[П~]** https://partytown.qwik.dev/ → **MAY**, не дефолт; для Метрики известны проблемы
    совместимости у подобных прокси-решений (не проверялось).
- Google Analytics/Метрика напрямую SEO не влияют, но привязка Метрики к Вебмастеру даёт
  **обход по счётчику** (см. 2.6) — это реальный плюс для индексации в Яндексе.

#### 2.5.9. Кеширование и сжатие

**Кеш HTML.** TanStack Start даёт route-опцию `headers` **[П]**
https://tanstack.com/start/latest/docs/framework/react/guide/isr:
```tsx
headers: () => ({
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
})
```
Та же дока честно пишет про наш случай: **без CDN `s-maxage` и shared-директивы нерелевантны**,
остаются `max-age` в браузере и `stale-while-revalidate`; «ISR» как таковой не получается.

Рекомендованные заголовки:

| Ресурс | `Cache-Control` | Примечание |
|---|---|---|
| Публичная SSR-страница | `public, max-age=0, s-maxage=600, stale-while-revalidate=86400` | `s-maxage` «на вырост» (nginx-sidecar/CDN); `max-age=0` — чтобы браузер не показывал устаревшее |
| Приватная страница | `private, no-store` | + `X-Robots-Tag: noindex` |
| `/assets/*` (хешированные) | `public, max-age=31536000, immutable` | как в SPA-шаблоне |
| `/og/<hash>.png` | `public, max-age=31536000, immutable` | контент-адресация |
| `/og/<логический>.png` | `public, max-age=3600` + `ETag` | без `immutable` |
| `robots.txt` | `public, max-age=300` | Google и так кеширует до 24 ч |
| `sitemap.xml` | `public, max-age=3600` | |
| `/config.js`-аналог (если останется) | `no-store` | |

⚠️ **`Vary`**: не добавлять `Vary: User-Agent` (убивает кеш) и `Vary: Cookie` на публичных
страницах. При bot-aware рендере (2.5.2) ответ **зависит** от UA — значит либо такие ответы
не кешировать вовсе, либо разделять кеш явно; это прямое следствие развилки и должно быть
зафиксировано.
⚠️ **ETag/304**: TanStack Start Bun-адаптер имеет `ASSET_PRELOAD_ENABLE_ETAG` **[П]** (hosting
doc); для Node-выхода поведение по ETag на статике надо проверить в spike.

**Сжатие.** Traefik v3 `compress` поддерживает **gzip, br, zstd**; `encodings` задаёт приоритет,
`defaultEncoding` применяется, когда `Accept-Encoding` отсутствует или содержит `*` **[П]**
https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/.
⚠️ Google документирует поддержку **gzip / deflate / brotli** (zstd не упомянут) **[П]** →
`encodings: [br, gzip]` + **не задавать `defaultEncoding: zstd`**.
Статику имеет смысл предсжимать на сборке (`.br`/`.gz` рядом с ассетом) и отдавать готовое,
а не жать на каждый запрос.

---

### 2.6. Яндекс-специфика

Полная выкладка — в `research/_sub-yandex.md`. Сводка того, что влияет на шаблон:

| Тема | Факт | Где в шаблоне |
|---|---|---|
| JS-рендеринг | бета; официально «запретите, если есть SSR» **[П]** | чек-лист релиза |
| `Host` | отменена 12.03.2018 **[П~]** | не генерировать в robots.txt |
| `Crawl-delay` | не учитывается; вместо неё «Скорость обхода» в Вебмастере **[П~]** | не генерировать |
| `Clean-param` | поддержана; лимит правила 500 симв.; `utm_*`/`ysclid`/`yrclid` режутся сами **[П]** | генератор robots.txt: секция `Clean-param` из конфига |
| `<noindex>` | жив, скрывает фрагмент текста **[П]** | опциональный хелпер `shared/seo` |
| meta robots | только `noindex/nofollow/none/noarchive`; **разрешающая побеждает** **[П]** | хелпер не должен собирать смешанные значения |
| `X-Robots-Tag` | поддержан полностью **[П]** | общий заголовочный путь для noindex |
| canonical | HTML + `Link`-заголовок; **cross-domain НЕ поддержан**; цепочки игнорируются **[П]** | запрет cross-domain canonical в хелпере |
| hreflang | поддержан (источник 2013) **[П~]** | делаем, но не единственный сигнал |
| Региональность | задаётся в Вебмастере; `.ru/.su/.рф` — дефолтный сигнал **[П~]** | док `docs/stack/seo.md` + чек-лист запуска |
| Структурированные данные | JSON-LD/microdata/RDFa/OG — приоритета нет; Schema.org рекомендован. Типы: Organization/Address, Product/Offer/OfferCatalog, Recipe, Movie, SoftwareApplication, QAPage, ImageObject, VideoObject, BreadcrumbList, AggregateRating. **[П]** | общий JSON-LD-слой годится и для Google, и для Яндекса |
| Валидатор | **https://webmaster.yandex.ru/site/tools/microtest/** **[П]** | док + чек-лист релиза |
| IndexNow | поддержан: `https://yandex.com/indexnow`, GET (1 URL) / POST (JSON, до **10 000 URL**); ключ 8–128 симв. `[a-zA-Z0-9-]`, файл `<key>.txt` в корне; коды 200/202/400/403/422/429; можно слать 404/410/301 для сообщения об удалении **[П]** | server route `/[key].txt` + хук публикации |
| Turbo-страницы | **закрыты**: объявление 07.02.2025, отключение ~апрель 2025, 301 на оригиналы **[П]** | не закладывать, не упоминать |
| Обход по счётчику Метрики | ускоряет обнаружение URL; включается в Вебмастере **[П]** | чек-лист запуска |
| «Скорость сайта» | **официального аналога Core Web Vitals у Яндекса нет** (порогов не публикует) **[П~]** | ориентируемся на CWV Google |
| Верификация робота | rDNS → hostname на `yandex.ru`/`yandex.net`/`yandex.com` → forward DNS; агрегированные подсети — **https://yandex.ru/ips** (15 IPv4-CIDR + `2a02:6b8::/29`), AS13238/AS208722/AS212066; Яндекс предупреждает, что адреса часто меняются **[П]** | whitelist в CrowdSec |
| Верификация сайта | meta `yandex-verification` в `<head>` главной / HTML-файл в корне / DNS TXT **[П]** | meta из runtime config — самый дешёвый путь |
| Sitemap | 50 000 / 50 МБ, URL ≤ 2048 симв., XML+TXT, только свой домен, ответ 200; hreflang и gzip **не подтверждены** **[П]** | генератор не полагается на hreflang-в-sitemap для Яндекса |

---

### 2.7. Google-специфика

- **Mobile-first indexing завершён** (анонс 2023-10; окончательный переход остальных сайтов
  2024-07-05) — индексируется мобильная версия. **[П~]**
  https://developers.google.com/search/blog/2023/10/mobile-first-is-here
  → Мобильный HTML должен содержать **тот же** контент, те же структурированные данные и те же
  meta-robots, что десктопный. Для responsive-SSR это автоматически, но `ssr: false` на
  мобильной ветке ломает индексацию полностью.
- **Page experience: единого сигнала нет**, но CWV входят в ранжирование. **[П]**
  https://developers.google.com/search/docs/appearance/page-experience (last updated 2025-12-10):
  *«There is no single signal. Our core ranking systems look at a variety of signals that align
  with overall page experience.»* Самопроверка: CWV, HTTPS, мобильное отображение, отсутствие
  навязчивых интерстишлов, отличимость основного контента.
- **IndexNow Google не поддерживает** (сентябрь 2026) **[П~]**; **Indexing API** ограничен
  *«pages with either `JobPosting` or `BroadcastEvent` embedded in a `VideoObject`»*, дефолтная
  квота 200 **[П]** https://developers.google.com/search/apis/indexing-api/v3/quickstart.
  → Для Google остаётся: sitemap + `lastmod` + внутренняя перелинковка + Search Console.
- **URL Inspection API**: 2000 запросов/сутки и 600/мин **на property** **[П~]**
  https://developers.google.com/webmaster-tools/limits → годится для еженедельного мониторинга
  индексации ключевых URL, не для всего сайта.
- **Мета-теги, которые Google поддерживает** **[П]**
  https://developers.google.com/search/docs/crawling-indexing/special-tags: `description`,
  `robots`/`googlebot`, `google-site-verification`, `google: nositelinkssearchbox`/`nopagereadaloud`,
  `notranslate`, `rating`, `refresh`, `viewport`, charset; атрибут **`data-nosnippet`** на
  `div`/`span`/`section`. **`keywords` Google не использует** — в шаблон не добавлять.
- **Имя сайта в выдаче**: `WebSite` JSON-LD **на главной** (корень домена/поддомена), с `name`
  и `url`; вторично учитываются `og:site_name`, `<title>`, заголовки. **[П]**
  https://developers.google.com/search/docs/appearance/site-names
- **Изображения** **[П]** https://developers.google.com/search/docs/appearance/google-images:
  индексируются только `<img src>` (CSS-фоны — нет); `srcset`/`sizes`/`<picture>` можно, но
  **обязателен фолбэк `src`**; поддерживаются BMP/GIF/JPEG/PNG/WebP/SVG/**AVIF**; предпочтительное
  изображение — `primaryImageOfPage` или `og:image`; стабильные URL картинок улучшают кеширование
  на стороне Google.
- **Crawl budget** **[П]**: замедляют краул 5xx и 429 и рост latency; `noindex` **не экономит**
  краул-бюджет (Google всё равно запросит страницу), для экономии — `robots.txt disallow`;
  для удалённого — **404/410** («stronger signals than blocking»).

---

### 2.8. Безопасность vs SEO

#### 2.8.1. CSP и inline-скрипты гидрации

- TanStack Start: nonce задаётся через `router.options.ssr.nonce`; типовой рецепт — global
  request middleware генерирует nonce (`crypto.randomUUID()`/`randomBytes(16).toString('base64')`),
  кладёт в контекст, роутер читает его через `getGlobalStartContext()?.nonce`; фреймворк
  проставляет nonce своим inline `<script>`/`<style>` и отдаёт `csp-nonce` meta для клиента.
  **[П~]** https://www.vseventer.com/blog/configuring-content-security-policy-csp-in-tanstack-start
  (2025-10), https://github.com/TanStack/router/discussions/3028
- Issue #5511 «`router.options.ssr.nonce` does not apply to all inline scripts» (2025-10-17)
  **закрыт** через PR #5522, метка `needed-for-start-stable`. **[П~]**
- **Главное ограничение: nonce уникален на запрос → несовместим с кешированием HTML и
  с prerender'ом.** **[П~]** (тот же источник)
  → Развилка шаблона:
  - **Вариант A (дефолт для контентных сайтов):** CSP **без nonce**, `script-src 'self'`
    + хеши (`'sha256-…'`) для немногочисленных inline-скриптов, HTML кешируемый,
    prerender доступен.
  - **Вариант B (для приватных/персонализированных):** nonce + `Cache-Control: private, no-store`.
  - Выбор фиксируется в `docs/stack/seo.md` (или `security.md`) как решение проекта.
- `'strict-dynamic'` + nonce — путь, который встречается в рецептах; для SEO нейтрален.
- **JSON-LD:** `<script type="application/ld+json">` — это не исполняемый скрипт, но CSP
  `script-src` его всё равно покрывает → при nonce-режиме JSON-LD тоже нужен nonce.
  При hash-режиме — хеш меняется на каждое изменение данных ⇒ **динамический JSON-LD ломает
  hash-CSP**. Обходной путь: разрешить `script-src` для `type="application/ld+json"` нельзя
  избирательно → либо nonce, либо выносить JSON-LD в отдельный endpoint (плохо для SEO).
  **→ Это ключевой открытый вопрос шаблона (см. риски).**

#### 2.8.2. Заголовки на Traefik

**[П]** https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/
- `stsSeconds`, `stsIncludeSubdomains`, `stsPreload`, `forceSTSHeader`;
  `contentTypeNosniff`, `frameDeny`, `referrerPolicy`, `contentSecurityPolicy`,
  `permissionsPolicy`, `customRequestHeaders`/`customResponseHeaders` (пустая строка удаляет
  заголовок).
- В stit-инфре это уже есть как `secure-headers@file` — SSR-шаблон **не должен** дублировать
  security-заголовки в приложении, кроме тех, что зависят от запроса (CSP с nonce,
  `X-Robots-Tag` по env).
- HSTS — только по HTTPS; `preload` включать осознанно (необратимо).
- `Referrer-Policy: strict-origin-when-cross-origin` — безопасный дефолт, не ломает ни OG-скрейперы,
  ни аналитику.

#### 2.8.3. WAF / CrowdSec / rate-limit и краулеры

- **Верификация ботов — только forward-confirmed reverse DNS + опубликованные IP-листы**,
  никогда не по одному User-Agent (его подделывают).
  - Google: rDNS-паттерны `crawl-*.googlebot.com` / `geo-crawl-*.geo.googlebot.com` (обычные
    краулеры), `rate-limited-proxy-*.google.com` (спец-краулеры),
    `*.gae.googleusercontent.com` / `google-proxy-*.google.com` (user-triggered fetchers).
    **⚠️ В марте 2026 JSON-листы переехали** из `/search/apis/ipranges/` в
    **`/crawling/ipranges/`**, а `googlebot.json` **переименован в `common-crawlers.json`**;
    старые адреса перестали отдавать реальные данные **07.04.2026**. Актуальные URL **[П]**
    https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests:
    `https://developers.google.com/static/crawling/ipranges/common-crawlers.json`,
    `.../special-crawlers.json`, `.../user-triggered-fetchers.json`,
    `.../user-triggered-fetchers-google.json`, `.../user-triggered-agents.json`.
    → **Любой whitelist, скопированный из гайдов до 2026, сломан.** Проверить в `<org>/infra`.
  - Яндекс: rDNS на `yandex.ru`/`yandex.net`/`yandex.com` + forward-проверка; агрегированные
    подсети на `https://yandex.ru/ips`; Яндекс предупреждает, что они часто меняются. **[П]**
  - AI-боты: JSON-листы вендоров (см. таблицу 2.1.7).
- **CrowdSec**: готовая конфигурация `crowdsecurity/seo-bots-whitelist`
  (`cscli postoverflows install crowdsecurity/seo-bots-whitelist`) — whitelisting по rDNS-суффиксам,
  regex по rDNS и IP-листам; покрывает Google, Bing, DuckDuckGo, **Yandex**, Baidu, Yahoo, Qwant,
  Sogou + соцботы. **[П]** https://app.crowdsec.net/hub/author/crowdsecurity/configurations/seo-bots-whitelist
  → **MUST для `<org>/infra` при добавлении SEO-сайта.** В корп-CrowdSec уже есть сценарий
  `commercial-crawlers.yaml` — его надо сопоставить с whitelist'ом, чтобы не забанить Googlebot
  за «коммерческий краулинг».
- **Троттлинг**: только **429** (или 503 с `Retry-After`). Google дословно: *«Don't use 401/403 for
  rate limiting — they're ineffective. Use 429 instead.»* **[П]** При этом 429/5xx **снижают
  crawl capacity**, так что rate-limit middleware Traefik должен иметь **исключение** для
  проверенных ботов, иначе индексация деградирует.
- `Vary: User-Agent` — не использовать (mobile-first indexing + responsive делают его лишним,
  а кеширование он убивает).

#### 2.8.4. Staging

- Traefik `basicAuth` middleware на staging-роутере + `customResponseHeaders:
  X-Robots-Tag: "noindex, nofollow"` + robots.txt `Disallow: /` из приложения при
  `SEO_INDEXABLE=false`.
- Staging **никогда** не должен отдавать canonical/hreflang/sitemap с prod-доменом
  (иначе поисковик увидит дубликаты) — все абсолютные URL строятся из `PUBLIC_ORIGIN`.
- Отдельный поддомен, отдельный robots.txt (правила robots.txt действуют на
  host+protocol+port) **[П]**.

---

### 2.9. QA и мониторинг в шаблоне

#### 2.9.1. Что проверять автоматически

**A. Unit (Vitest) — `shared/seo`:** чистые функции, которые собирают мету/JSON-LD/sitemap.
- `buildMeta()` → массив `head.meta`: нет дублей `name`/`property`, длины title/description
  в пределах бюджета, description не пустой, абсолютные URL у `og:image`/`og:url`.
- `buildCanonical(origin, path)` → абсолютный URL, без query/fragment, без trailing slash,
  lowercase.
- `buildHreflang(locales, path)` → взаимный полный набор + self + `x-default`.
- `buildJsonLd()` → валидируется Zod-схемой на обязательные поля типа + `JSON.stringify`
  не роняет (циклы/`undefined`).
- `buildRobotsTxt(cfg)` → snapshot-тест на 2 среды (prod/staging).
- `buildSitemap(urls)` → лимиты (≤50 000 / ≤50 МБ), валидный XML, `lastmod` в W3C-формате
  или отсутствует.

**B. E2E (Playwright) — «сырой HTML без JS».** Ключевой приём: **не открывать страницу
браузером**, а дёрнуть `request.get(url)` — это и есть «что видит краулер». Черновик:

```ts
// e2e/seo.spec.ts — черновик
import { test, expect, request as pwRequest } from '@playwright/test'

const ORIGIN = process.env.E2E_ORIGIN ?? 'http://127.0.0.1:3000'

test.describe('SEO: сырой SSR-HTML', () => {
  test('главная: статус, title, description, canonical, hreflang, JSON-LD', async () => {
    const ctx = await pwRequest.newContext()
    const res = await ctx.get(`${ORIGIN}/`)
    expect(res.status()).toBe(200)
    const html = await res.text()

    expect(html).toMatch(/<title>[^<]{10,70}<\/title>/)
    expect(html).toMatch(/<meta name="description" content="[^"]{50,170}"/)
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/"`)
    expect(html).toContain('hreflang="x-default"')
    expect(html).toContain('<html lang="ru"')
    // JSON-LD парсится и содержит WebSite
    const blocks = [...html.matchAll(
      /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g,
    )].map((m) => JSON.parse(m[1]!))
    expect(blocks.some((b) => b['@type'] === 'WebSite')).toBe(true)
    // контент отрендерен на сервере, а не «пустая оболочка»
    expect(html).toMatch(/<h1[^>]*>/)
  })

  test('несуществующий URL отдаёт 404, а не 200', async () => {
    const ctx = await pwRequest.newContext()
    const res = await ctx.get(`${ORIGIN}/no-such-page-9f2a`, { maxRedirects: 0 })
    expect(res.status()).toBe(404)
  })

  test('нормализация URL: 308 на канонический вид', async () => {
    const ctx = await pwRequest.newContext()
    const res = await ctx.get(`${ORIGIN}/About/`, { maxRedirects: 0 })
    expect(res.status()).toBe(308)
    expect(res.headers()['location']).toBe('/about')
  })

  test('приватная страница: noindex + без кеша', async () => {
    const ctx = await pwRequest.newContext()
    const res = await ctx.get(`${ORIGIN}/profile`, { maxRedirects: 0 })
    expect(res.headers()['x-robots-tag'] ?? '').toContain('noindex')
    expect(res.headers()['cache-control'] ?? '').toContain('no-store')
  })

  test('robots.txt и sitemap.xml валидны и согласованы', async () => {
    const ctx = await pwRequest.newContext()
    const robots = await ctx.get(`${ORIGIN}/robots.txt`)
    expect(robots.status()).toBe(200)
    expect(robots.headers()['content-type']).toContain('text/plain')
    const robotsTxt = await robots.text()
    expect(robotsTxt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)

    const sm = await ctx.get(`${ORIGIN}/sitemap.xml`)
    expect(sm.status()).toBe(200)
    expect(sm.headers()['content-type']).toMatch(/xml/)
    const xml = await sm.text()
    expect(xml).toContain('<urlset')
    // все URL абсолютные и на своём origin
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      expect(m[1]!.startsWith(ORIGIN)).toBe(true)
    }
  })

  test('бот получает полный HTML без Suspense-плейсхолдеров', async () => {
    const ctx = await pwRequest.newContext({
      extraHTTPHeaders: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    })
    const html = await (await ctx.get(`${ORIGIN}/`)).text()
    expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/)
    expect(html).not.toContain('data-skeleton') // маркер fallback-состояния
    // бюджет размера: лимит Googlebot 2 МБ, наш потолок сильно ниже
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(300_000)
  })
})
```

Дополнительно **MUST** в e2e:
- «HTML без JS содержит основной контент»: `page.goto(url)` с `javaScriptEnabled: false`
  в контексте + проверка видимости H1/текста (это ловит `ssr: false`, случайно поставленный
  на индексируемый роут).
- «Нет `noindex` на prod»: сборка с `SEO_INDEXABLE=true` не должна содержать `noindex`
  ни в HTML, ни в `X-Robots-Tag` на публичных роутах.
- Все `<a href>` внутренние ссылки в SSR-HTML — не `href="#"` и не `javascript:`.

**C. Lighthouse CI** — отдельный CI-stage (не в `pnpm check`, чтобы локальный цикл не тормозил,
по аналогии с `test:e2e`). `@lhci/cli` **0.15.x** тянет Lighthouse **12.6.1**; Lighthouse 13
требует Node ≥22.19 и в LHCI ещё не поддержан **[П~]**
https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
Ассершены: `categories:performance ≥ 0.9`, `categories:seo = 1`, `categories:accessibility ≥ 0.95`,
плюс `budget.json` на байты (скрипты/шрифты/картинки) — дополняет уже имеющийся `size-limit`
(тот меряет бандл, LHCI — реальную страницу).

**D. RUM:** `web-vitals` уже в SPA-шаблоне; в SSR добавляется TTFB как первоклассная метрика
(в SPA она была почти бессмысленна). Детали — см. 2.5.

**E. Валидация структурированных данных** — см. 2.3.

#### 2.9.2. Мониторинг индексации (вне CI)

- **Google Search Console** — property на apex; отчёт «Индексирование страниц», «Sitemap»,
  Core Web Vitals (CrUX). URL Inspection API — 2000/сутки на property **[П~]**.
- **Яндекс.Вебмастер** — верификация `yandex-verification` meta из runtime config; разделы
  «Страницы в поиске», «Диагностика», «Скорость обхода», «Файлы Sitemap». **[П]**
- **IndexNow** — один ключ, рассылка Яндексу (+ Bing/Naver/Seznam); вызывается из хука
  публикации контента (когда у проекта есть CMS/бэкенд). Шаблон даёт `shared/seo/indexnow.ts`
  и server route `/<key>.txt`. Google — не поддерживает.
- **Синтетика**: еженедельный job, который дёргает `/sitemap.xml`, берёт N случайных URL,
  проверяет 200 + наличие canonical/title. Это ловит регрессии между релизами.

---

### 2.10. A11y ∩ SEO

Что даёт обеим сторонам (MUST, проверяется `vitest-axe` + `@axe-core/playwright`, уже есть
в SPA-шаблоне):

| Практика | SEO-эффект | A11y-эффект |
|---|---|---|
| Семантические лендмарки (`<header> <nav> <main> <aside> <footer>`), **ровно один `<main>`** | понятная структура документа для парсера | навигация по лендмаркам в скринридере |
| Один `<h1>` на страницу, иерархия h2→h3 | Google: *«from Google Search perspective, it doesn't matter if you're using them out of order»* **[П]** — т.е. для SEO это **не** ranking-фактор, но заголовки формируют понимание структуры | критично для скринридеров |
| `alt` у содержательных картинок, `alt=""` у декоративных | Google Images: *«short, but descriptive piece of text that explains the relationship between the image and your content»* **[П]** | обязательно |
| Описательный анкор вместо «здесь»/«подробнее» | Google явно рекомендует descriptive anchor text **[П]** | обязательно |
| `width`/`height` или `aspect-ratio` у картинок | CLS → Core Web Vitals → page experience | меньше «прыжков» при чтении |
| Видимый focus, клавиатурная доступность | косвенно (INP/поведенческие) | обязательно |
| Реальные `<a href>` вместо `onClick` на `<div>` | боты не кликают кнопки **[П]** | обязательно |
| `<html lang>` | языковой сигнал | правильное произношение в скринридере |
| Контраст, размеры тапа | page experience (мобильное отображение) | обязательно |

**Важная честная оговорка:** порядок заголовков и ARIA-лендмарки **не являются** прямыми
ranking-факторами Google — не продавать их как SEO. Реальный SEO-выигрыш здесь: корректный
`<h1>`/`alt`/анкоры влияют на понимание контента и на Google Images, остальное — качество
продукта.

---

## 3. Рекомендации для шаблона

### 3.1. Где что живёт

```
src/shared/seo/                     # новый сегмент sliceless-слоя shared
  index.ts                          # explicit re-exports
  config.ts                         # SeoConfig из runtime config (Zod)
  canonical.ts                      # buildCanonical / normalizePath
  meta.ts                           # buildMeta (title/description/robots/OG/Twitter)
  hreflang.ts                       # buildAlternates (+ x-default)
  json-ld.ts                        # organization/website/breadcrumbs/article/... + Zod
  robots.ts                         # buildRobotsTxt(cfg)
  sitemap.ts                        # buildSitemap / buildSitemapIndex
  indexnow.ts                       # submit(urls) — Яндекс/Bing
  *.test.ts                         # unit-тесты рядом (rule tests-pipeline)

src/pages/robots[.]txt.ts           # server route, Content-Type text/plain
src/pages/sitemap[.]xml.ts          # server route (или sitemap-index + под-карты)
src/pages/[key][.]txt.ts            # IndexNow key-file (значение из env)  — MAY
src/pages/__root.tsx                # <html lang>, HeadContent, дефолтные meta, WebSite JSON-LD
src/app/router/index.ts             # trailingSlash: 'never', defaultNotFoundComponent
src/app/middleware/seo.ts           # X-Robots-Tag по SEO_INDEXABLE, нормализация URL → 308
e2e/seo.spec.ts                     # сырой HTML, статусы, robots/sitemap
docs/stack/seo.md                   # НОВЫЙ kind артефакта стека (9-й)
.claude/rules/seo-canon.md          # path-scoped правило (src/pages/**, src/shared/seo/**)
lighthouserc.cjs + budget.json      # отдельный CI-stage
```

**Новый kind `docs/stack/seo.md`** (frontmatter `status: draft|stable`, секция `Generates`):
поля — `public-origin`, `default-locale`, `locales`, `indexable-envs`, `title-template`,
`og-image-strategy`, `json-ld-types`, `sitemap-strategy` (`builtin-prerender | dynamic-route |
index+shards`), `robots-policy` (в т.ч. AI-краулеры), `clean-param`, `search-console-verification`,
`yandex-verification`, `indexnow` (вкл/выкл), `csp-mode` (`nonce | hash`).
`/de-template` разворачивает из него: `robots.txt`-генератор, дефолты `shared/seo/config.ts`,
`vite.config` (`sitemap.host`), `.env.example`.

**Расширение FSD-карты в `<org>/strategy`.** Сейчас в `pages.md` колонки
`slug, name, description, screen, path, guard, widgets, features, entities, status` —
**SEO-полей нет**. Предложение (изменение канона живёт в `business-strategy-template`, здесь только
фиксируем требование): добавить в `pages.md` колонки
`indexable (yes|no)`, `rendering (ssr|data-only|csr|prerender)`, `title`, `description`,
`jsonld (тип или —)`, `changefreq/priority → нет, вместо них sitemap (yes|no)`.
Тогда `/scaffold page` сможет генерировать `head()` и запись в sitemap без догадок.

### 3.2. Требования MUST / SHOULD / MAY

Легенда «где»: **К** — код, **Т** — тест, **Д** — документация/артефакт стека, **С** — скилл,
**И** — инфра (`<org>/infra`, Traefik/CrowdSec).

#### Индексируемость

| # | Требование | Ур. | Где |
|---|---|---|---|
| I-1 | Каждый индексируемый роут отдаёт полный контент в первом HTML (`ssr: true`) | MUST | К, Т |
| I-2 | `ssr: false` / `'data-only'` разрешён только на роутах с `indexable: no`; в PR-ревью — обоснование | MUST | К, Д, С |
| I-3 | Нет `#`-роутинга, нет контента, доступного только по клику без URL | MUST | К, Т |
| I-4 | Несуществующий ресурс → **404**; удалённый навсегда → **410**; никаких «200 + Ничего не найдено» | MUST | К, Т |
| I-5 | Нормализация URL одним **308** (регистр, trailing slash, www/apex); ≤1 хоп | MUST | К, Т |
| I-6 | `trailingSlash: 'never'` в `createRouter` | MUST | К |
| I-7 | Self-canonical абсолютным URL из `PUBLIC_ORIGIN` на каждой индексируемой странице | MUST | К, Т |
| I-8 | Cross-domain canonical запрещён (Яндекс игнорирует) | MUST | К (инвариант хелпера) |
| I-9 | `robots.txt` — server route из runtime config; на staging `Disallow: /` | MUST | К, Т |
| I-10 | Строка `Sitemap:` в robots.txt указывает на абсолютный URL текущего origin | MUST | К, Т |
| I-11 | `sitemap.xml`: только 200-URL, только свой origin, ≤50 000/≤50 МБ, shard'ы через index при превышении | MUST | К, Т |
| I-12 | `lastmod` выводится **только** если он отражает реальное значимое изменение, иначе не выводится вовсе | MUST | К, Д |
| I-13 | `changefreq`/`priority` не выводить (Google игнорирует; шум) | SHOULD | К |
| I-14 | Приватные роуты: `X-Robots-Tag: noindex, nofollow` + `Cache-Control: private, no-store` | MUST | К, Т |
| I-15 | Staging: basic-auth (Traefik) + `X-Robots-Tag: noindex` + `Disallow: /` — три контура | MUST | К, И, Т |
| I-16 | Не закрывать в robots.txt `/assets/*` и эндпойнты лоадеров | MUST | К, Т |
| I-17 | Не смешивать разрешающие и запрещающие robots-директивы в одном значении (Яндекс выберет разрешающую) | MUST | К |
| I-18 | Пагинация: уникальный URL на страницу + self-canonical; «load more» дублируется реальными `<a href="?page=n">` | MUST | К, Т |
| I-19 | Фасеты/сортировки: не порождают индексируемые URL; в robots.txt `Disallow` по маске + `Clean-param` для Яндекса | SHOULD | К, Д |
| I-20 | `Clean-param` для проектных трекинг-параметров (кроме `utm_*`/`ysclid`/`yrclid` — их Яндекс режет сам) | SHOULD | К, Д |
| I-21 | Политика AI-краулеров — переключатель в конфиге; дефолт «разрешено всё», блок запрета обучающих ботов закомментирован | SHOULD | К, Д |
| I-22 | `llms.txt` | MAY | К |
| I-23 | Хелпер `<YandexNoIndex>` для скрытия фрагментов от Яндекса | MAY | К |
| I-24 | **Бюджет размера SSR-HTML**: ≤300 КБ несжатого на публичную страницу (жёстко), алерт на 150 КБ — из-за лимита Googlebot 2 МБ и того, что обрезка происходит молча | MUST | К, Т |
| I-25 | Порядок в документе: контент и JSON-LD — в начале, сериализованное состояние (`dehydrate`) — в конце `<body>` | SHOULD | К |
| I-26 | Не ставить `defaultEncoding: zstd` в Traefik `compress` (Google документирует gzip/deflate/br) | SHOULD | И |

#### Метаданные

| # | Требование | Ур. | Где |
|---|---|---|---|
| M-1 | `<title>` уникален для каждой страницы, собирается шаблоном `%s — %siteName` | MUST | К, Т |
| M-2 | `<meta name="description">` уникален и непустой на каждой индексируемой странице | MUST | К, Т |
| M-3 | Полный OG-набор (`og:type/title/description/url/image(+width/height/alt)/site_name/locale`) | MUST | К, Т |
| M-4 | `twitter:card` (+ `summary_large_image` при наличии изображения) | SHOULD | К |
| M-5 | `og:image` — **абсолютный** URL, стабильный, отдаётся с длинным `Cache-Control` | MUST | К, Т |
| M-6 | Генерация OG-картинок на сервере с дисковым кешем | SHOULD | К |
| M-7 | `<html lang>` из активной локали | MUST | К, Т |
| M-8 | Favicon-набор + web manifest + `theme-color` (light/dark) | SHOULD | К |
| M-9 | `google-site-verification` / `yandex-verification` — из runtime config, только если заданы | SHOULD | К, Д |
| M-10 | `keywords` не добавлять никогда | MUST | К, Д |

(Детализация — раздел 2.2.)

#### Структурированные данные

| # | Требование | Ур. | Где |
|---|---|---|---|
| S-1 | `Organization` + `WebSite` JSON-LD на главной (корень домена) | MUST | К, Т |
| S-2 | `BreadcrumbList` на всех вложенных страницах | SHOULD | К, Т |
| S-3 | JSON-LD типизирован и валидируется Zod-схемой в unit-тесте | MUST | К, Т |
| S-4 | JSON-LD описывает **только видимый на странице** контент | MUST | Д, С |
| S-5 | JSON-LD рендерится сервером, в `<head>` | MUST | К |
| S-6 | Ручная проверка Rich Results Test + Яндекс-валидатором перед релизом | MUST | Д (чек-лист) |

(Детализация — раздел 2.3.)

#### i18n

| # | Требование | Ур. | Где |
|---|---|---|---|
| L-1 | Локали через префикс пути; дефолтная — без префикса | MUST | К, Д |
| L-2 | Невалидный префикс локали → `notFound()` (404), не 500 и не редирект | MUST | К, Т |
| L-3 | Полный взаимный `hreflang` + self + `x-default` на каждой странице | MUST | К, Т |
| L-4 | Никаких авто-редиректов по `Accept-Language`/гео | MUST | К, Т |
| L-5 | `canonical` внутри локали (не кросс-локальный) | MUST | К, Т |
| L-6 | Локализованные slug'и | MAY | К |

#### Производительность

| # | Требование | Ур. | Где |
|---|---|---|---|
| P-1 | Весь `<head>` (title/description/canonical/hreflang/og/JSON-LD) резолвится **до первого байта**; данные для `head()` берутся из `loader` роута, не из Suspense-компонента | MUST | К, Т |
| P-2 | Основной контент индексируемой страницы — **вне Suspense**; Suspense только для второстепенных блоков | MUST | К, Т, С |
| P-3 | Bot-aware рендер: `isbot(UA)` → не-стримовый `renderRouterToString`; людям — `defaultStreamHandler` | SHOULD (MUST для контентного сайта) | К, Т |
| P-4 | e2e: запрос с `User-Agent: Googlebot` возвращает HTML без Suspense-плейсхолдеров, с H1 и полным head | MUST | Т |
| P-5 | Целевые CWV на p75 mobile: LCP ≤ 2.5 с, INP ≤ 200 мс, CLS ≤ 0.1 | MUST | Д, Т (LHCI) |
| P-6 | RUM через `web-vitals` 6.x, включая **TTFB** | SHOULD | К |
| P-7 | Шрифты: self-host, только WOFF2, subsetting кириллицы через `unicode-range`, `font-display: optional` для основного текста, метрики фолбэка (`size-adjust`/`ascent-override`) | MUST | К |
| P-8 | Preload максимум одного шрифта, формируется **на сервере из активной локали** (preload обходит `unicode-range`), с `crossorigin` | SHOULD | К |
| P-9 | Каждое `<img>` имеет `width`/`height` (или `aspect-ratio`) и осмысленный `alt`; LCP-картинка — `fetchpriority="high"` без `loading="lazy"`; остальные — `loading="lazy"` | MUST | К, Т |
| P-10 | `<picture>` AVIF → WebP → JPEG с обязательным фолбэк-`src` (Google индексирует `<img src>`) | SHOULD | К |
| P-11 | Оптимизация картинок: build-time `vite-imagetools`; runtime `sharp` с дисковым кешем только для пользовательского контента; в Docker — `pnpm.supportedArchitectures` с `libc: musl` | SHOULD | К, Д |
| P-12 | Критический CSS **не инлайнить** по умолчанию (бюджет 2 МБ + кеш между страницами); внешний `<link rel=stylesheet>` | SHOULD | К |
| P-13 | Тема (`data-scheme`) и `color-scheme` определяются **на сервере** из cookie — без FOUC и без `useEffect` | MUST | К, Т |
| P-14 | Счётчики (Метрика/GA) грузятся после гидрации или по взаимодействию, никогда render-blocking | MUST | К |
| P-15 | Заголовки кеширования по таблице 2.5.9; приватные — `private, no-store`; хешированные ассеты — `immutable` | MUST | К, И |
| P-16 | Не добавлять `Vary: User-Agent` / `Vary: Cookie` на публичных страницах; при bot-aware рендере такие ответы не кешировать shared-кешем | MUST | К, И |
| P-17 | Traefik `compress`: `encodings: [br, gzip]`, **без** `defaultEncoding: zstd` | SHOULD | И |
| P-18 | Предсжатие статики на сборке (`.br`/`.gz`) | MAY | К |
| P-19 | Speculation Rules (`prefetch`, `eagerness: moderate`) как прогрессивное улучшение | MAY | К |
| P-20 | 103 Early Hints | MAY (сейчас **заблокировано** — Traefik OSS их не проксирует) | И |
| P-21 | Partytown для третьих сторон | MAY (beta) | К |
| P-22 | `size-limit` расширен: клиентские бюджеты сохранены, добавлены бюджеты на SSR-HTML и CSS | SHOULD | К, Т |

#### Безопасность

| # | Требование | Ур. | Где |
|---|---|---|---|
| B-1 | Режим CSP (`nonce` или `hash`) зафиксирован в `docs/stack/seo.md`; связка «nonce ⇒ HTML не кешируется и не пререндерится» задокументирована | MUST | Д, К |
| B-2 | HSTS, `nosniff`, `frameDeny`, `Referrer-Policy` — на Traefik (`secure-headers@file`), не дублировать в приложении | MUST | И, Д |
| B-3 | CrowdSec: установить `crowdsecurity/seo-bots-whitelist`; сверить с корп-сценарием `commercial-crawlers.yaml` | MUST | И |
| B-4 | Rate-limit middleware имеет исключение для проверенных ботов; троттлинг — **429**, не 403 | MUST | И, Д |
| B-5 | Ни один бот не блокируется по одному User-Agent без rDNS-проверки | MUST | И |
| B-6 | Плановые работы — **503 + `Retry-After`**, а не 200-заглушка | SHOULD | К, И |

#### QA

| # | Требование | Ур. | Где |
|---|---|---|---|
| Q-1 | `e2e/seo.spec.ts` (сырой HTML, статусы, robots/sitemap, noindex) — часть `pnpm test:e2e` | MUST | Т |
| Q-2 | Unit-тесты `shared/seo/*` в `pnpm check` | MUST | Т |
| Q-3 | Тест «HTML без JS содержит H1 и текст» на каждом индексируемом reference-роуте | MUST | Т |
| Q-4 | Lighthouse CI с бюджетами — отдельный CI-stage | SHOULD | Т, Д |
| Q-5 | `size-limit` расширен на серверный бандл и на CSS | SHOULD | К |
| Q-6 | RUM через `web-vitals` (включая TTFB) | SHOULD | К |
| Q-7 | Еженедельная синтетика по sitemap | MAY | Д |

---

### 3.3. Черновики кода

> Черновики. API TanStack Start проверен по докам (URL в источниках), но **не запускался** —
> перед вшиванием в шаблон нужен spike (поток 06).

**`src/shared/seo/config.ts`** (runtime config, Zod — как в SPA-шаблоне):

```ts
import { z } from 'zod'

export const SeoConfigSchema = z.object({
  PUBLIC_ORIGIN: z.url(),            // https://example.com — без хвостового слеша
  SITE_NAME: z.string().min(1),
  DEFAULT_LOCALE: z.enum(['ru', 'en']).default('ru'),
  LOCALES: z.array(z.enum(['ru', 'en'])).default(['ru', 'en']),
  INDEXABLE: z.boolean().default(false),           // prod → true, staging → false
  TITLE_TEMPLATE: z.string().default('%s — %site%'),
  GOOGLE_SITE_VERIFICATION: z.string().default(''),
  YANDEX_VERIFICATION: z.string().default(''),
  INDEXNOW_KEY: z.string().default(''),
  AI_TRAINING: z.enum(['allow', 'deny']).default('allow'),
})
export type SeoConfig = z.infer<typeof SeoConfigSchema>
```

**`src/shared/seo/canonical.ts`**:

```ts
// Канонический URL всегда абсолютный: Google требует absolute, Яндекс игнорирует cross-domain.
export function buildCanonical(origin: string, pathname: string): string {
  const normalized = normalizePath(pathname)
  return `${origin}${normalized}`
}

export function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/)[0] ?? '/'
  const lower = withoutQuery.toLowerCase()
  if (lower === '/') return '/'
  return lower.replace(/\/+$/, '')
}
```

**`src/shared/seo/meta.ts`** (возвращает то, что ест `head()` TanStack Router):

```ts
type MetaInput = {
  title: string
  description: string
  path: string
  locale: 'ru' | 'en'
  image?: { url: string; width: number; height: number; alt: string }
  type?: 'website' | 'article'
  indexable?: boolean
}

export function buildMeta(cfg: SeoConfig, input: MetaInput) {
  const url = buildCanonical(cfg.PUBLIC_ORIGIN, input.path)
  const title = cfg.TITLE_TEMPLATE
    .replace('%s', input.title)
    .replace('%site%', cfg.SITE_NAME)
  const indexable = cfg.INDEXABLE && (input.indexable ?? true)

  return {
    meta: [
      { title },
      { name: 'description', content: input.description },
      // Разрешающие и запрещающие директивы не смешиваем: Яндекс выберет разрешающую.
      { name: 'robots', content: indexable ? 'index, follow' : 'noindex, nofollow' },
      { property: 'og:type', content: input.type ?? 'website' },
      { property: 'og:site_name', content: cfg.SITE_NAME },
      { property: 'og:locale', content: input.locale === 'ru' ? 'ru_RU' : 'en_US' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: input.description },
      { property: 'og:url', content: url },
      ...(input.image
        ? [
            { property: 'og:image', content: input.image.url },
            { property: 'og:image:width', content: String(input.image.width) },
            { property: 'og:image:height', content: String(input.image.height) },
            { property: 'og:image:alt', content: input.image.alt },
            { name: 'twitter:card', content: 'summary_large_image' },
          ]
        : [{ name: 'twitter:card', content: 'summary' }]),
    ],
    links: [
      { rel: 'canonical', href: url },
      ...buildAlternates(cfg, input.path),
    ],
  }
}
```

**`src/shared/seo/hreflang.ts`**:

```ts
// hreflang признаётся только при полной взаимности и наличии self-ссылки.
export function buildAlternates(cfg: SeoConfig, path: string) {
  const bare = stripLocalePrefix(path, cfg.LOCALES)
  const href = (loc: string) =>
    loc === cfg.DEFAULT_LOCALE
      ? `${cfg.PUBLIC_ORIGIN}${bare}`
      : `${cfg.PUBLIC_ORIGIN}/${loc}${bare}`

  return [
    ...cfg.LOCALES.map((loc) => ({
      rel: 'alternate' as const, hreflang: loc, href: href(loc),
    })),
    { rel: 'alternate' as const, hreflang: 'x-default', href: href(cfg.DEFAULT_LOCALE) },
  ]
}
```

**`src/pages/robots[.]txt.ts`** (server route; имя файла — экранирование точки по канону Start):

```ts
import { createFileRoute } from '@tanstack/react-router'
import { buildRobotsTxt, getSeoConfig } from '@/shared/seo'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () =>
        new Response(buildRobotsTxt(getSeoConfig()), {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            // robots.txt Google кеширует до 24 ч; свой кеш держим коротким.
            'Cache-Control': 'public, max-age=300',
          },
        }),
    },
  },
})
```

**`src/shared/seo/robots.ts`** (черновик генератора):

```ts
export function buildRobotsTxt(cfg: SeoConfig): string {
  if (!cfg.INDEXABLE) {
    return ['User-agent: *', 'Disallow: /', ''].join('\n')
  }
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /*?*sort=',
    'Disallow: /*?*filter=',
    '',
  ]
  if (cfg.AI_TRAINING === 'deny') {
    for (const bot of ['GPTBot', 'ClaudeBot', 'Google-Extended',
                       'Applebot-Extended', 'CCBot', 'Bytespider']) {
      lines.push(`User-agent: ${bot}`, 'Disallow: /', '')
    }
  }
  // Clean-param — директива Яндекса, межсекционная.
  lines.push('Clean-param: ref&from&openstat', '')
  lines.push(`Sitemap: ${cfg.PUBLIC_ORIGIN}/sitemap.xml`, '')
  return lines.join('\n')
}
```

**`src/app/middleware/seo.ts`** (нормализация + заголовки; учитывая issue #5407 —
использовать `setResponseHeader` в единственном числе либо править `result.response.headers`):

```ts
import { createMiddleware } from '@tanstack/react-start'
import { getSeoConfig, normalizePath } from '@/shared/seo'

export const seoMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cfg = getSeoConfig()
  const url = new URL(request.url)
  const normalized = normalizePath(url.pathname)

  // Одним хопом: регистр + хвостовой слеш. 308 сохраняет метод и передаёт сильный сигнал.
  if (normalized !== url.pathname) {
    return new Response(null, {
      status: 308,
      headers: { Location: `${normalized}${url.search}` },
    })
  }

  const result = await next()
  if (!cfg.INDEXABLE) {
    result.response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  return result
})
```

**Кеширование HTML (без CDN)** — через route-опцию `headers` (**[П]** ISR-гайд Start):

```ts
export const Route = createFileRoute('/blog/$slug')({
  headers: () => ({
    // Без CDN работают только max-age и SWR в браузере; s-maxage — на вырост.
    'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  }),
})
```

**`vite.config.ts`** (prerender + встроенный sitemap — для статичной части сайта):

```ts
tanstackStart({
  prerender: { enabled: true, crawlLinks: true, failOnError: true },
  sitemap: { enabled: true, host: process.env.PUBLIC_ORIGIN! },
})
```

⚠️ Есть открытый баг-трек «`prerender` errors without `sitemap` enabled» (issue #5419) **[П~]** —
включать обе опции вместе. И: `sitemap.host` — **build-time**, что конфликтует с принципом
«один образ на все среды». → Для stit-каноничного подхода **динамический server route
предпочтительнее** встроенной генерации; встроенную использовать только для чисто статических
лендингов, где домен известен на сборке.

### 3.4. Изменения в агентной обвязке (доки, правила, скиллы)

| Артефакт | Что добавляется |
|---|---|
| `CLAUDE.md` (ядро) | строка в «Карта: где что» → `SEO-канон — docs/stack/seo.md + rule seo-canon`; в «Делать всегда» → «индексируемый роут ⇒ `ssr: true` и полный `head()`»; в «Не делать никогда» → «`ssr: false` на индексируемом роуте», «`meta keywords`», «canonical на другой домен» |
| `.claude/rules/seo-canon.md` (**новое**, path-scoped: `src/pages/**`, `src/shared/seo/**`) | инварианты: абсолютный self-canonical; robots-директивы не смешивать; hreflang взаимный; JSON-LD только про видимое; статусы 404/410/308; `og:image` абсолютный; запрет `FAQPage`/`HowTo`/`SearchAction` «ради rich results» |
| `.claude/rules/tests-pipeline.md` | добавить раздел «SEO-тесты»: unit на `shared/seo`, e2e на сыром HTML; Lighthouse CI — отдельный stage |
| `.claude/rules/env-local.md` | новые runtime-поля: `PUBLIC_ORIGIN`, `SEO_INDEXABLE`, `SITE_NAME`, `*_VERIFICATION`, `INDEXNOW_KEY`, `AI_TRAINING`. Важно: `PUBLIC_ORIGIN` — **runtime**, не build-time (иначе один образ на все среды ломается) |
| `docs/stack/seo.md` (**новый 9-й kind**) | см. 3.1; frontmatter `status`, секция `Generates` |
| `docs/stack/README.md` | зарегистрировать новый kind |
| `/stack-deep-dive` | добавить волну вопросов по SEO: origin, локали, индексируемость сред, стратегия sitemap, политика AI-краулеров, режим CSP, OG-стратегия |
| `/scaffold` (kind `page`) | SEO-чеклист страницы (раздел 4) + генерация `head()`, записи в sitemap, заготовок тестов |
| `/de-template` | **обязательно**: вычистить демо-значения (`https://myapp.com`, демо-JSON-LD, демо-OG-картинку), подставить реальный `PUBLIC_ORIGIN`/`SITE_NAME`, пересобрать `robots.txt`-дефолты |
| `/release` | добавить SEO-чеклист релиза (раздел 5) как обязательный шаг перед handoff в `<org>/infra` |
| `<org>/strategy` (канон `_template/fsd/pages.md`) | новые колонки `indexable`, `rendering`, `title`, `description`, `jsonld`, `sitemap` — **изменение живёт в `business-strategy-template`**, здесь только требование |
| `<org>/infra` (`project-infra-template-compose`) | `compose/frontend.yml` для Node-SSR (не nginx-статика): healthcheck, `PUBLIC_ORIGIN`/`SEO_INDEXABLE` в env; CrowdSec `seo-bots-whitelist`; исключение ботов из rate-limit; basic-auth на staging-роутере |

---

## 4. SEO-чеклист страницы (для `/scaffold page`)

Скилл должен спросить/подставить и сгенерировать:

1. **`indexable`**: `yes|no`. Если `no` → `ssr` можно снизить, в `head()` попадает
   `robots: noindex, nofollow`, URL **не** попадает в sitemap.
2. **`rendering`**: `ssr` (дефолт для `indexable: yes`) / `data-only` / `csr` / `prerender`.
   Гейт: `indexable: yes` + `csr` — запрещённая комбинация.
3. **`title`** (≤ ~60 симв., уникальный) и **`description`** (~50–160 симв., уникальный).
4. **`canonical`**: авто из `PUBLIC_ORIGIN` + нормализованный path; ручное переопределение —
   только с комментарием-обоснованием.
5. **`hreflang`**: авто (все локали + self + `x-default`), если страница существует во всех
   локалях; если нет — явно указать подмножество.
6. **`og:image`**: статическая картинка / генерируемая (шаблон) / нет (наследуется дефолт сайта).
7. **`jsonld`**: тип из белого списка (`Article`, `Product`, `FAQPage`, `BreadcrumbList`,
   `LocalBusiness`, `Event`, `—`) + маппинг полей из loader-данных.
8. **`breadcrumbs`**: да/нет → `BreadcrumbList` + видимые хлебные крошки (Google требует
   соответствия разметки видимому контенту).
9. **`sitemap`**: включать ли URL; для динамических — источник списка (query/loader).
10. **404-путь**: что бросает `loader`, если сущность не найдена — `notFound()` (обязательно,
    не редирект на главную).
11. **Пагинация**: если список — уникальные `?page=n`, self-canonical, реальные `<a>`.
12. **Заголовок H1** — ровно один, текстом (не картинкой).
13. **Картинки**: `alt`, `width`/`height`, `loading`, `fetchpriority` для LCP-изображения.
13a. **Suspense**: какие блоки страницы разрешено стримить. Гейт: данные, питающие `head()`,
    и основной контент **не могут** быть за Suspense-границей на индексируемой странице.
13b. **Кеш**: `headers()` роута — публичная (`max-age=0, s-maxage=…, SWR`) или приватная
    (`private, no-store`).
14. **Приватность**: если `guard != public` → `noindex` + `Cache-Control: private, no-store`,
    URL не в sitemap.
15. **Сгенерированные тесты**: в `*.test.tsx` — проверка `head()`-вывода (title/description/
    canonical/robots); в `e2e/seo.spec.ts` — строка с новым URL.

Источник значений 1–2, 7, 9 — запись страницы в FSD-карте `<org>/strategy`
(`docs/projects/<slug>/fsd/<surface>/pages.md`), если канон карты будет расширен (см. 3.1).
Пока полей нет — `/scaffold page` спрашивает интерактивно и пишет ответ в комментарий-шапку роута.

---

## 5. SEO-чеклист релиза

**Перед сборкой образа**
1. `pnpm check` зелёный (включая unit-тесты `shared/seo`).
2. `pnpm test:e2e` зелёный (включая `e2e/seo.spec.ts`).
3. Lighthouse CI: performance ≥ 0.9, seo = 1, a11y ≥ 0.95, бюджеты не превышены.
4. Дифф `robots.txt` и `sitemap.xml` между прошлым и новым релизом просмотрен глазами.

**Сразу после деплоя (prod)**
5. `curl -sI https://<domain>/` → 200, нет `X-Robots-Tag: noindex`.
6. `curl -s https://<domain>/robots.txt` → ожидаемая политика, правильный `Sitemap:`,
   **нет** `Disallow: /`.
7. `curl -s https://<domain>/sitemap.xml | grep -c '<loc>'` → ожидаемое число, все URL на
   prod-домене и с https.
8. `curl -sI https://<domain>/no-such-page` → **404**.
9. `curl -sI http://<domain>/` и `https://www.<domain>/` и `https://<domain>/About/` →
   ровно один **308/301** на канонический вид.
10. Просмотр «view-source» главной и одной контентной страницы: `<title>`, `description`,
    `canonical`, `hreflang` (взаимный), `og:*`, JSON-LD, `<html lang>`, H1.
11. Rich Results Test (https://search.google.com/test/rich-results) — без ошибок.
12. Schema Markup Validator (https://validator.schema.org/) — без ошибок.
13. Яндекс — валидатор микроразметки https://webmaster.yandex.ru/site/tools/microtest/.
14. PageSpeed Insights по 2–3 ключевым URL (mobile) — CWV в «good».

**Инфраструктурные пункты (один раз на проект, потом — при изменениях)**
15. Traefik: HTTPS + HSTS, `secure-headers@file`, редирект http→https.
16. CrowdSec: `cscli postoverflows install crowdsecurity/seo-bots-whitelist`, проверить,
    что Googlebot/YandexBot не банятся (`cscli decisions list`).
17. Rate-limit: исключение для проверенных ботов; троттлинг отдаёт 429.
18. Staging-домен: basic-auth активен, `robots.txt` = `Disallow: /`, `X-Robots-Tag: noindex`.

**Поисковые системы (один раз на проект)**
19. Google Search Console: property подтверждён, sitemap подан, отчёт «Индексирование страниц»
    без критики.
20. Яндекс.Вебмастер: сайт подтверждён (`yandex-verification` meta), sitemap подан,
    **JS-рендеринг выключен**, региональность задана, привязка к Метрике/обход по счётчику.
21. IndexNow: ключ-файл доступен по `https://<domain>/<key>.txt`, тестовый submit вернул 200/202.
22. Проверка «спуфинг не проходит»: `curl -A "Googlebot" …` из обычной сети не получает
    привилегий (whitelist работает по rDNS, а не по UA).

---

## 6. Риски и открытые вопросы

| # | Риск / вопрос | Кто решает | Комментарий |
|---|---|---|---|
| R-1 | **CSP nonce ⊥ кеширование/prerender.** Нельзя одновременно иметь строгий nonce-CSP и кешируемый/пререндеренный HTML. | владелец | Развилка: контентные сайты → hash-CSP + кеш; приватные → nonce + `no-store`. Нужен явный выбор в `docs/stack/seo.md`. |
| R-2 | ~~Динамический JSON-LD ломает hash-CSP~~ — **снято**: `<script type="application/ld+json">` это data block, CSP `script-src` его не проверяет (HTML spec, шаг 13 vs шаг 21). | — | Остаётся только вопрос по **настоящим** inline-скриптам гидрации TanStack Start и по счётчикам. |
| R-2b | **React 19.2 изменил стриминг для ботов**: начальный HTML отдаёт Suspense-fallback'и даже краулерам, данные приезжают чанками (в 19.1.x `onAllReady` инлайнил резолвнутое). Рекомендация React «дождаться всего для краулеров», по сообщению в треде, в 19.2 **не работает**. | spike (поток 06) | Проверить на текущих версиях: (а) что реально видит `curl -A Googlebot`; (б) работает ли `progressiveChunkSize: Infinity`; (в) переключение на `renderRouterToString` по `isbot`. **Это блокирующий вопрос для любого сайта со Suspense на индексируемых страницах.** |
| R-2c | **Bot-aware рендер ⊥ shared-кеш HTML**: ответ зависит от User-Agent. | архитектор | Либо не кешировать HTML в shared-кеше, либо ключевать кеш по «бот/не бот». `Vary: User-Agent` ставить нельзя (убивает кеш целиком). |
| R-3 | **Статус-коды в TanStack Start SSR исторически глючили** (#1086, #4663, #5377, #5407, #5960). | spike (поток 06) | Проверить на текущей версии `@tanstack/react-start` (на 2026-09-09 — 1.168.51 **[П~]**): `notFound()` → 404, `redirect()` → 301/308, server route `new Response(..., {status})`. Если не работает — свой обёрточный server entry. |
| R-4 | **Встроенный `sitemap.host` — build-time**, конфликтует с «один образ на все среды». | архитектор | Дефолт канона — динамический server route; встроенный sitemap только для статичных лендингов. |
| R-5 | **hreflang у Яндекса подтверждён источником 2013 г.**, свежей документации нет. | — | Не полагаться на hreflang как на единственный сигнал для Яндекса; дублировать региональностью и структурой URL. |
| R-6 | **Яндекс инвертирует приоритет robots-директив** (разрешающая > запрещающая). | — | Инвариант хелпера: никогда не отдавать смешанное значение. Нужен unit-тест. |
| R-7 | **Кеширование HTML без CDN.** `s-maxage`/SWR в браузере работает слабо; единственный шаред-кеш — либо nginx перед Node, либо Traefik-плагин, либо in-process LRU в Node. | владелец/инфра | Требует решения в потоке про деплой: добавлять ли nginx-sidecar как shared-cache, или довольствоваться быстрым SSR. |
| R-8 | **OG-картинки: генерация в Node на alpine/musl** (sharp/resvg — нативные модули). | spike | См. 2.2; возможен переход на `node:24-slim` (glibc) ради нативных зависимостей — это меняет базовый образ относительно SPA-шаблона. |
| R-9 | **Расширение канона FSD-карты** (`pages.md` + SEO-колонки) живёт в `business-strategy-template`, а не здесь. | владелец | Без этого `/scaffold page` вынужден спрашивать интерактивно. Нужен согласованный PR в strategy-шаблон. |
| R-10 | **Политика AI-краулеров — бизнес-решение.** | владелец/заказчик | Шаблон даёт переключатель и документирует последствия (блокировка обучающих ботов не влияет на Google Search, но `OAI-SearchBot`/`Claude-SearchBot`/`PerplexityBot` — это видимость в AI-ответах). |
| R-11 | **`Crawl-delay`/`Host` не генерировать** — мёртвые директивы Яндекса; шум в robots.txt. | — | Проверяется snapshot-тестом. |
| R-12 | **Поток «без CDN» ограничивает Early Hints/edge-кеш** | инфра | См. 2.5. |
| R-13 | **`/de-template` должен вычищать SEO-заглушки** (демо-JSON-LD, демо-OG, демо-sitemap-URL). | скилл | Иначе форк уедет в прод с `https://myapp.com` в canonical. **Критично.** |
| R-14 | Некоторые Яндекс-факты подтверждены только вторичными источниками (отмена `Crawl-delay`, трактовка 5xx на robots.txt, отсутствие аналога CWV). | — | Перечислено в `_sub-yandex.md`, раздел «Ключевые пробелы». |

---

## 7. Источники

### Google Search Central
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering
- https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/crawling-indexing/http-network-errors
- https://developers.google.com/search/docs/crawling-indexing/url-structure
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps
- https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping
- https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation
- https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
- https://developers.google.com/search/docs/crawling-indexing/special-tags
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot
- https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
- **https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests** (новое расположение верификации и IP-листов, март 2026)
- **https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers** (лимиты байтов, HTTP/1.1+HTTP/2, gzip/deflate/br)
- https://developers.google.com/search/blog/2026/03/crawler-ip-ranges (переезд IP-листов)
- https://developers.google.com/search/blog/2026/03/crawler-blog-post («Inside Googlebot», 31.03.2026 — тело статьи фетчем не отдалось, факты сверены по нескольким независимым пересказам)
- https://developers.google.com/search/docs/appearance/page-experience
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/appearance/google-images
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/apis/indexing-api/v3/quickstart
- https://developers.google.com/webmaster-tools/limits
- https://developers.google.com/search/blog/2023/10/mobile-first-is-here
- https://developers.google.com/search/docs/appearance/title-link
- https://developers.google.com/search/docs/appearance/snippet
- https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- https://developers.google.com/search/blog/2024/10/sitelinks-search-box
- https://web.dev/articles/vitals
- https://web.dev/articles/color-scheme

### Стандарты / MDN / WHATWG
- https://ogp.me/
- https://html.spec.whatwg.org/multipage/scripting.html (prepare the script element: шаг 13 vs шаг 21 — JSON-LD не подпадает под CSP `script-src`)
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme
- https://developers.facebook.com/docs/sharing/webmasters/images
- https://core.telegram.org/constructor/webPage
- https://dev.max.ru/docs-api (подтверждает отсутствие документации по превью)
- https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs

### npm (версии сверены через registry.npmjs.org на 2026-09-15)
- satori 0.33.4 · @resvg/resvg-js 2.6.2 · @vercel/og 1.0.2 · @napi-rs/canvas 1.0.9 ·
  canvas 3.2.3 · sharp 0.35.4 · schema-dts 2.0.0 · structured-data-testing-tool 4.5.0 (заброшен,
  последний push репозитория 2023-07-31)

### Смежные отчёты этой сессии
- `research/_sub-yandex.md` — Яндекс-специфика (15 разделов, первоисточники)
- `research/_sub-meta.md` — метаданные и структурированные данные (детальная выкладка)
- `research/_sub-og.md` — генерация OG-картинок в Node/alpine, превью в мессенджерах

### Яндекс
Полный список — в `research/_sub-yandex.md`. Ключевые:
- https://yandex.ru/support/webmaster/ru/yandex-indexing/rendering
- https://yandex.ru/support/webmaster/ru/controlling-robot/robots-txt
- https://yandex.ru/support/webmaster/ru/robot-workings/clean-param
- https://yandex.ru/support/webmaster/ru/robot-workings/canonical
- https://yandex.ru/support/webmaster/ru/controlling-robot/meta-robots
- https://yandex.ru/support/webmaster/ru/robot-workings/vision
- https://yandex.ru/support/webmaster/ru/robot-workings/check-yandex-robots
- https://yandex.ru/support/webmaster/ru/controlling-robot/sitemap
- https://yandex.ru/support/webmaster/ru/indexing-options/index-now
- https://yandex.ru/support/webmaster/ru/indexnow/key
- https://yandex.ru/support/webmaster/ru/schema-org/what-is-schema-org
- https://yandex.ru/support/webmaster/ru/yandex-indexing/validator.html
- https://yandex.ru/ips
- https://webmaster.yandex.ru/site/tools/microtest/
- https://webmaster.yandex.ru/blog/yandex-stops-supporting-turbo-technology
- https://indexnow.org/documentation

### TanStack
- https://tanstack.com/start/latest/docs/framework/react/guide/seo
- https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
- https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
- https://tanstack.com/start/latest/docs/framework/react/guide/isr
- https://tanstack.com/start/latest/docs/framework/react/guide/middleware
- https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- https://tanstack.com/start/latest/docs/framework/react/guide/production-checklist
- https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management
- https://tanstack.com/router/latest/docs/framework/react/guide/not-found-errors
- https://tanstack.com/router/latest/docs/guide/internationalization-i18n
- https://tanstack.com/router/latest/docs/api/router/RouterOptionsType
- https://tanstack.com/router/latest/docs/framework/react/guide/ssr (`defaultStreamHandler`, `renderRouterToString`)
- https://github.com/TanStack/router/issues/5377 · #5407 · #5511 · #4663 · #1086 · #5419
- https://github.com/TanStack/router/discussions/3028

### Производительность
- https://web.dev/articles/vitals · https://web.dev/articles/vitals-spa-faq (обновлена 2026-08-11)
- https://web.dev/articles/font-best-practices
- https://registry.npmjs.org/web-vitals/latest → 6.2.2
- https://unhead.unjs.io/learn/research/streaming-head-performance (кросс-фреймворковое исследование стриминга и SEO, 2026-03-05)
- https://github.com/remix-run/react-router/discussions/14726 (изменение стриминга для ботов в React 19.2)
- https://developer.chrome.com/docs/web-platform/early-hints · https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/103
- https://github.com/traefik/traefik/issues/9213 (Traefik OSS и 103 Early Hints)
- https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API
- https://www.npmjs.com/package/vite-imagetools → 12.0.0 · https://sharp.pixelplumbing.com/install/ (musl)
- https://partytown.qwik.dev/ (beta)

### AI-краулеры
- https://developers.openai.com/api/docs/bots
- https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- https://docs.perplexity.ai/docs/resources/perplexity-crawlers

### Инфра и QA
- https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/
- https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/
- https://app.crowdsec.net/hub/author/crowdsecurity/configurations/seo-bots-whitelist
- https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
- https://www.vseventer.com/blog/configuring-content-security-policy-csp-in-tanstack-start
</content>
