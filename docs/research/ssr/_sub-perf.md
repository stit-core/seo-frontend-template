# Перформанс и Core Web Vitals для `ssr-frontend-template` — ресёрч на 2026-09-15

Контекст: React 19.x SSR (TanStack Start на Vite 8/Rolldown), Tailwind v4,
Node 24 в Docker за Traefik v3 (+CrowdSec), **без CDN**, один образ, сайты ru/en,
важны Google и Яндекс.

Легенда пометок:
- **[проверено]** — подтверждено первоисточником, URL + дата документа/публикации.
- **[вторичный]** — источник не первичный (вендорский блог, каниюз, комьюнити).
- **[предположение]** — мой вывод/синтез, первоисточника нет.
- **[опровергнуто]** — встречалось в выдаче, но первоисточник не подтверждает.

---

## 0. Сводка версий пакетов (npm registry, проверено 2026-09-15)

| пакет | версия | заметки |
|---|---|---|
| `react` / `react-dom` | **19.3.0** | registry.npmjs.org/react/latest |
| `vite` | **8.3.0** | engines `^20.19.0 \|\| >=22.12.0`; deps: rolldown `~1.2.6`, lightningcss `^1.33.0`, postcss |
| `@tanstack/react-start` | **1.168.54** | engines node `>=22.12.0`; peer react `>=18\|\|>=19`, vite `>=7.0.0` (optional), `@rsbuild/core ^2` (optional); тянет `@tanstack/react-start-rsc@0.1.53` |
| `@vitejs/plugin-rsc` | **0.5.34** | «React Server Components (RSC) support for Vite» |
| `tailwindcss` | **4.3.3** | |
| `@tailwindcss/vite` | **4.3.3** | peer vite `^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8`; deps `@tailwindcss/oxide` |
| `web-vitals` | **6.2.2** | опубликован 2026-09-14; zero deps; exports `./attribution` |
| `sharp` | **0.35.4** | engines `>=20.9.0`; optionalDeps включают `@img/sharp-linuxmusl-x64`, `@img/sharp-linuxmusl-arm64` |
| `vite-imagetools` | **12.0.1** | peer `vite >=8.0.0`; engines node `>=22.0.0`; dep `sharp ^0.35.3` |
| `@unpic/react` | **1.0.2** | dep `@unpic/core ^1.0.3` |
| `vite-plugin-compression2` | **2.5.3** | gzip/brotli/deflate/zstd |
| `beasties` | **0.5.4** | «Inline critical CSS and lazy-load the rest», repo `danielroe/beasties` |
| `size-limit` | **13.1.1** | |
| `satori` | **0.33.4** | engines `>=16` (для OG-картинок) |
| `@builder.io/partytown` | **0.10.3** | **DEPRECATED**: «Use @qwik.dev/partytown instead» |
| `@qwik.dev/partytown` | **0.14.4** | живой; проект в статусе beta |

Node.js (nodejs.org/en/about/previous-releases, проверено 2026-09-15):
- **v26.8.2 — Current** (first release 2026-05-05), войдёт в LTS ~конец окт. 2026
- **v24.21.0 «Krypton» — LTS** (first release 2025-05-06) ← актуальная база образа
- v22.23.2 — LTS (Jod)

Vite 8.0 вышел **2026-03-12**, Rolldown стал единственным бандлером, Oxc заменил
esbuild как минификатор/трансформер, lightningcss теперь обязательная зависимость
(лучшая минификация CSS из коробки). Сборка быстрее в 10–30×, install-размер
+~15 MB. [проверено] https://vite.dev/blog/announcing-vite8

---

## 1. Пороговые значения CWV на 2026, ranking-фактор, новые метрики

### 1.1 Пороги (первоисточники)

| метрика | good | needs improvement | poor | источник |
|---|---|---|---|---|
| **LCP** | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s | web.dev/articles/lcp, обновлено **2025-09-04** |
| **INP** | ≤ 200 ms | 200–500 ms | > 500 ms | web.dev/articles/inp, обновлено **2025-09-02** |
| **CLS** | ≤ 0.1 | 0.1–0.25 | > 0.25 | web.dev/articles/cls, обновлено **2023-04-12** |

[проверено]
- https://web.dev/articles/lcp
- https://web.dev/articles/inp
- https://web.dev/articles/cls
- https://web.dev/articles/vitals (обновлено **2024-10-31**): «a good threshold to
  measure is the **75th percentile** of page loads, segmented across mobile and
  desktop devices».
- https://web.dev/articles/defining-core-web-vitals-thresholds — как выводились пороги.

**Перцентиль**: 75-й, отдельно для mobile и desktop.
**Окно**: скользящие **28 дней** (CrUX и Search Console; «Both field data sources
represent trailing 28-day periods»). [проверено]
https://developers.google.com/search/docs/appearance/core-web-vitals (обновлено **2025-12-10**)

Детали вычисления (важно для шаблона):
- **INP** — не максимум: «we ignore one highest interaction for every 50
  interactions» (фактически ~98-й перцентиль взаимодействий страницы). Считаются
  только **click / tap / keypress**; «hovering, zooming, or scrolling … are not
  observed for the purposes of INP». [проверено] web.dev/articles/inp
- **CLS** — максимальное «session window»: сдвиги с паузой < 1 s между ними,
  максимум 5 s на окно; score = impact fraction × distance fraction; сдвиги в
  пределах 500 ms после пользовательского ввода помечаются `hadRecentInput` и не
  учитываются. [проверено] web.dev/articles/cls
- **LCP-кандидаты**: `<img>`, `<image>` в `<svg>`, `<video>`, элементы с
  background-image `url()`, блочные элементы с текстовыми узлами. LCP включает в
  себя TTFB, редиректы, unload предыдущей страницы. [проверено] web.dev/articles/lcp

### 1.2 Ranking-фактор в Google

Официальная формулировка (обновлено **2025-12-10**):
- «There is no single signal. Our core ranking systems look at a variety of
  signals that align with overall page experience.»
- «**Core Web Vitals are used by our ranking systems.**»
- «Beyond Core Web Vitals, other page experience aspects don't directly help your
  website rank higher in search results. However, they can make your website more
  satisfying to use…» (HTTPS, mobile-friendly, ad load, интерстишелы, иерархия контента)
- «Google Search always seeks to show the most relevant content, even if the page
  experience is sub-par.»

[проверено] https://developers.google.com/search/docs/appearance/page-experience
и https://developers.google.com/search/docs/appearance/core-web-vitals

**Вывод**: ranking-фактором остаются ровно три CWV — LCP, INP, CLS. Остальное
(HTTPS и пр.) — не прямой ранжирующий сигнал.

### 1.3 Новые метрики — что реально появилось, а что миф

**[опровергнуто]** В выдаче активно циркулируют SEO-блоги (nitropack.io,
ideafueled.com, digitalapplied.com, magnet.co, uxify.com) с утверждениями про:
- «Visual Stability Index (VSI) — CLS's smarter sibling»,
- «Engagement Reliability (ER) — Google's 2025 addition»,
- «INP moved from supplementary to equal ranking signal, Search Central blog
  post March 18, 2026».

Ни одно из этих утверждений **не подтверждается** первоисточниками:
- https://web.dev/articles/vitals перечисляет только LCP/INP/CLS, без раздела
  «pending/candidate metrics»;
- CrUX release notes за 2025–2026 не содержат ни VSI, ни ER;
- в Search Central Blog нет поста от 18 марта 2026 про INP.
Считать это AI-сгенерированным SEO-шумом; **в шаблон не закладывать**.

**Что реально изменилось (проверено):**

1. **Soft Navigations API — Chrome 151 (август 2026), включён по умолчанию,
   не за флагом и не в origin trial.** Два новых типа PerformanceEntry:
   - `soft-navigation` (`PerformanceSoftNavigation`: `navigationId`,
     `interactionId`, `startTime`, `paintTime`, `presentationTime`, URL в `name`)
   - `interaction-contentful-paint` (`InteractionContentfulPaint`, свойство
     `largestContentfulPaint`)

   Позволяет мерить CWV отдельно для SPA-переходов. **В CrUX пока НЕ входит**:
   «Chrome has not yet published timeframes of integrating these into the Chrome
   User Experience Report (CrUX)»; «We are working on allowing CrUX to include
   data by SPA route».
   [проверено]
   - https://developer.chrome.com/docs/web-platform/soft-navigations (обновлено **2026-09-02**)
   - https://web.dev/articles/vitals-spa-faq (обновлено **2026-08-11**)
   - https://developer.mozilla.org/en-US/docs/Web/API/PerformanceSoftNavigation

2. **INP: исключены `pointerup`, использованные для скролла** (например, скролл
   пальцем на мобильном). Итог: INP у многих сайтов улучшился, но **покрытие INP
   в CrUX упало** — у части сайтов «optional INP metric is no longer available in
   CrUX». Финальный роллаут прошёл в 2026. [проверено, вторичная цитата из CrUX
   release notes] https://developer.chrome.com/docs/crux/release-notes

3. **LCP и INP стали Baseline Newly available 2025-12-12** — с выходом Safari 26.2
   все три движка поддерживают LCP API и Event Timing API. **CLS по-прежнему
   только Chromium** (нет в Firefox/Safari), «has been proposed for Interop 2026».
   [проверено] https://web.dev/blog/lcp-and-inp-are-now-baseline-newly-available
   (опубликовано **2025-12-17**)

4. **LoAF (Long Animation Frames)** — зашипился с Chrome 123, это основной
   инструмент атрибуции INP (`blockingDuration`, скрипты кадра). **Не Baseline**
   (только Chromium). `scheduler.yield()` — тоже **не Baseline**.
   [проверено]
   - https://developer.chrome.com/docs/web-platform/long-animation-frames
   - https://developer.chrome.com/blog/loaf-has-shipped
   - https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming

5. **Кандидат новой метрики отзывчивости**: в CrUX есть поле
   `experimental.responsiveness` — «candidate for a new responsiveness metric».
   [вторичный — из сниппета выдачи по developer.chrome.com/docs/crux; прямой
   страницы с описанием поля не открыл]

6. **Состояние веба (CrUX, август 2026, опубликовано 2026-09-08)**: 18 294 881
   origin, **пройденный CWV — 55.6 %** (−0.2 п.п. м/м). Отмечается «continued INP
   regression … concerning without definitive cause». [проверено]
   https://developer.chrome.com/docs/crux/release-notes

### 1.4 Яндекс

- Официальная справка «Как сделать сайт быстрее» **не упоминает CWV вообще**.
  Рекомендации общие: уменьшить число HTTP-запросов, устранить блокирующие
  отрисовку ресурсы, минификация CSS/JS/HTML, CDN, «Настройте кэширование и
  Gzip-сжатие», сжатие и отложенная загрузка изображений, меньше редиректов.
  Формулировка: «Скорость загрузки страниц сайта это один из важных показателей
  его качества». Прямого утверждения о влиянии на ранжирование нет.
  [проверено] https://yandex.ru/support/webmaster/ru/yandex-indexing/page-speed.html
- В Вебмастере есть достижение **«Скорость сайта»** (Качество сайта → Достижения
  и статистика + блок в Сводке). Индекс считается по обезличенным данным Яндекс
  Браузера при переходах из мобильного поиска, обновляется не реже раза в месяц,
  считается только при достаточном трафике. [вторичный — из сниппетов
  webmaster.yandex.ru/blog/novoe-dostizhenie-skorost-sayta и
  yandex.ru/support/webmaster/...]
- Отчёт «Время загрузки страниц» в Яндекс Метрике:
  https://yandex.ru/support/metrica/ru/reports/timing.html

**Практический вывод для шаблона**: оптимизируем под CWV Google; для Яндекса это
автоматически покрывает его требования (у него нет отдельного набора метрик), а
специфика Яндекса — в индексации JS (см. §3.3), а не в перф-метриках.

---

## 2. Библиотека `web-vitals` и RUM в SSR

### 2.1 Версия и изменения [проверено]

`web-vitals@6.2.2`, опубликована **2026-09-14** (registry.npmjs.org/web-vitals/latest).
CHANGELOG: https://raw.githubusercontent.com/GoogleChrome/web-vitals/main/CHANGELOG.md

- **v5.0.0 (2025-05-07)** — breaking: удалён `onFID()`; политика поддержки
  браузеров переведена на «Baseline Widely available»; реорганизованы классы
  селекторов в attribution (снижение кардинальности). Фичи: расширенная
  INP-атрибуция данными **LoAF** (longest script duration, бакеты), кастомные
  таргеты в attribution-сборке, множественные `onINP()` с разными опциями,
  visibility-state entries, капы на `nextPaintTime`.
- **v6.0.0 (2026-07-21)** — **поддержка soft navigations**; breaking: удалены
  лишние модули под `verbatimModuleSyntax`, дефолт `includeProcessedEventEntries`
  переключён на `false`; добавлены source maps; `requestIdleCallback` ограничен 1 s;
  репорт мелких INP-взаимодействий через bfcache.
- **v6.1.0 (2026-08-05)** — Resource Timing buffer для LCP-атрибуции
  (`AttributionReportOpts.resourceBufferSize`, дефолт 50 — помогает привязать
  media-LCP к URL).
- **v6.1.1 (2026-08-15)** — счётчик navigation interactions скоупится по
  `InteractionManager`.
- **v6.2.0 (2026-08-24)** — фикс ложных CLS=0 после восстановления из bfcache;
  guard'ы по `supportedEntryTypes`.
- **v6.2.1 (2026-08-26)** — фикс отрицательного `inputDelay` в INP-атрибуции.
- **v6.2.2 (2026-09-14)** — кап на pending LoAF-записи (утечка памяти).

Размер: «~3K, brotli'd»; attribution-сборка +~1.5 KB.
Поддержка: `onCLS()` — только Chromium; `onFCP`/`onINP`/`onLCP`/`onTTFB` —
Chromium, Firefox, Safari. Soft navs — Chromium 151+ (`{reportSoftNavs: true}`).
[проверено] https://raw.githubusercontent.com/GoogleChrome/web-vitals/main/README.md

### 2.2 Канонический паттерн отправки [проверено, README]

```js
import {onCLS, onINP, onLCP} from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({name: metric.name, value: metric.value, id: metric.id, page_location: navigationURL});
  navigator.sendBeacon('/analytics', body);
}
onCLS(sendToAnalytics); onINP(sendToAnalytics); onLCP(sendToAnalytics);
```

Рекомендуется **батчить**: копить очередь и сливать на
`visibilitychange` → `document.visibilityState === 'hidden'` (не на `unload`).
bfcache обрабатывается библиотекой автоматически (новые `id` после restore).

### 2.3 Как собирать RUM в SSR-приложении [предположение / синтез]

Первоисточника «web-vitals для SSR» нет, но из механики следует:

1. **Только клиентский энтрипоинт.** `web-vitals` использует
   `PerformanceObserver` — импортировать её из SSR-графа нельзя. В TanStack Start
   — из `client.tsx` / `src/client.tsx`, либо динамическим `import()` после
   гидрации, чтобы не раздувать critical-path бандл (3 KB не критично, но
   attribution-сборка +1.5 KB и её лучше грузить лениво/условно).
2. **Не грузить attribution-сборку всем.** Паттерн: базовая сборка всегда,
   attribution — только для сэмпла (например, 5–10 % сессий) или только когда
   метрика вышла за «good».
3. **TTFB — главная серверная метрика SSR.** `onTTFB()` даёт клиентскую сторону;
   серверную разбивку отдавать заголовком `Server-Timing` (render, data, db) —
   web-vitals кладёт `navigationEntry.serverTiming` в TTFB-атрибуцию.
4. **LCP-элемент обязан быть в shell** (вне Suspense), иначе LCP = время
   дострела потока.
5. **`reportSoftNavs: true`** включать осознанно: это меняет то, как меряется
   первичная загрузка, и в CrUX это всё равно пока не попадает. Для
   MPA-ориентированного SSR-сайта (ru/en контентный) — не нужно; для
   app-поверхностей с клиентской навигацией — полезно в собственном RUM.
6. **Свой эндпоинт `/rum`** на том же origin (CDN нет) — `sendBeacon` с
   `Content-Type: text/plain` или `application/json`; разгружать в очередь,
   отвечать 204. Не забыть исключить его из CrowdSec rate-limit'ов / не
   логировать как обычный запрос.

---

## 3. Streaming SSR и поисковые боты

### 3.1 Что говорит React [проверено]

https://react.dev/reference/react-dom/server/renderToPipeableStream

- `onShellReady` — шелл (всё вне Suspense) отрендерен, можно начинать стримить.
- `onAllReady` — **весь** контент готов. Дословно из доков:
  > «You can use this instead of `onShellReady` **for crawlers and static generation.**»
  > «However, when a crawler visits your page, or if you're generating the pages
  > at the build time, you might want to let all of the content load first and then
  > produce the final HTML output instead of revealing it progressively.»

  Пример из доков — именно ветвление по `isCrawler`:
  ```js
  const {pipe} = renderToPipeableStream(<App />, {
    onShellReady() { if (!isCrawler) pipe(response) },
    onAllReady()   { if (isCrawler)  pipe(response) },
  })
  ```
- Статус-код: после начала стрима поменять нельзя. `onShellError` → 500 +
  фолбэк-HTML; ошибки вне шелла ловятся `onError`.

**React 19.2** (react.dev/blog/2025/10/01/react-19-2): добавлены
`prerender` / `resume` / `resumeAndPrerender` / `resumeAndPrerenderToNodeStream`
— **partial pre-rendering**: пререндерим статическую часть, потом «дорезаем».
Плюс: «Starting in 19.2, React will batch reveals of server-rendered Suspense
boundaries for a short time, to allow more content to be revealed together» —
меньше визуального дребезга ⇒ меньше CLS. [проверено, вторичная цитата из
react.dev/blog/2025/10/01/react-19-2]

### 3.2 Googlebot: как он реально видит поток [проверено]

Ключевой первоисточник — **«Подробно о Googlebot: сканирование страниц,
получение данных и обработка байтов», Search Central Blog, 31 марта 2026**:
https://developers.google.com/search/blog/2026/03/crawler-blog-post

Факты (дословно/близко к тексту):
- «В настоящее время Googlebot скачивает **до 2 МБ для каждого URL** (кроме
  PDF-файлов). Это означает, что робот сканирует только первые 2 МБ ресурса,
  **включая HTTP-заголовок**.» Для PDF — 64 МБ. Для прочих краулеров без явного
  лимита — 15 МБ.
- **Частичная загрузка**: если HTML > 2 МБ, страница не отклоняется — скачивание
  просто обрывается. «Скачанная часть (первые 2 МБ) передается нашим системам
  индексирования и сервису отрисовки веб-страниц (WRS) **как полный файл**.»
- «Любые байты, которые находятся после порога в 2 МБ, полностью игнорируются.»
- Подресурсы (JS/CSS/XHR) грузятся отдельно, **у каждого свой лимит 2 МБ**, в
  размер родителя не входят. Изображения и видео при рендере **не запрашиваются**.
- «WRS обрабатывает JavaScript и выполняет клиентский код так же, как современный
  браузер». **WRS работает без отслеживания состояния** — «очищает локальное
  хранилище и данные сеанса между запросами».
- Рекомендации Google: выносить объёмные CSS/JS во внешние файлы; **«Порядок
  имеет значение»** — метатеги, `<title>`, `<link>`, canonical и основные
  структурированные данные класть **в верхнюю часть** HTML.

Из JS-SEO basics (обновлено **2026-03-04**),
https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics:
- «All pages with a `200` HTTP status code are sent to the rendering queue»;
  «The page may stay on this queue for a few seconds, but it can take longer than that».
- «**server-side or pre-rendering is still a great idea** because it makes your
  website faster for users and crawlers, and **not all bots can run JavaScript**».

**Официального заявления Google конкретно про React Suspense / out-of-order
streaming нет** — я такого документа не нашёл. [честно: первоисточник отсутствует]

### 3.3 Яндекс: критично [проверено]

https://yandex.ru/support/webmaster/ru/yandex-indexing/rendering
(англ.: https://yandex.com/support/webmaster/en/yandex-indexing/rendering)

- Раздел Вебмастера **Индексирование → Рендеринг JavaScript страниц (β)**.
- «По умолчанию включена опция **На усмотрение робота Яндекса**» — робот сам
  решает, выполнять ли JS.
- **«Запретите рендеринг, если на сайте реализован SSR (Server-Side Rendering)
  или пререндеринг.»**
- Для сайтов с отложенной загрузкой контента — объект `window.YandexRotorSettings`
  (`WaiterEnabled`, `IsLoaded`, `IsError`, `FailOnTimeout`, `NoJsRedirectsToMain`),
  должен быть обработан **до `DOMContentLoaded`**.

**Вывод по Яндексу**: если у нас SSR, Яндекс явно просит **отключить** JS-рендеринг.
Значит, всё, что появляется только после выполнения JS (в т.ч. React-овские
out-of-order куски, которые переставляются inline-скриптами), для Яндекса может
не существовать. Это сильный аргумент за `onAllReady` для ботов либо за то,
чтобы SEO-критичный контент вообще не заворачивать в Suspense.

### 3.4 Вендорские данные [вторичный]

https://vercel.com/kb/guide/does-streaming-affect-seo (опубликовано 2025-11-03,
обновлено 2026-06-11):
- «Streamed content does **not adversely affect SEO** and yes, **streamed content
  can be indexed**» — в подтверждение приводится Next.js-демо, индексируемое Google.
- Caveat 1: стрим **всегда возвращает 200**, даже если внутри потока произошла
  ошибка → для проблемных страниц использовать `<meta name="robots">`.
- Caveat 2: заголовки ответа нельзя менять после начала стрима.

### 3.5 Механика React-стрима и что из этого следует [предположение, механика проверяема]

React при out-of-order streaming дописывает «дострелившие» куски **в конец
документа** (в скрытые контейнеры/`<template>`) и inline-скриптами (`$RC`)
переставляет их на место fallback'а. Следствия:

| риск | степень | что делать |
|---|---|---|
| Документ > 2 МБ → хвост потока обрезан Googlebot'ом, контент пропадает молча | средний для контентных страниц с большими списками | держать HTML-документ жёстко < 2 МБ (бюджет: **< 500 KB несжатого HTML**), большие списки — пагинация; не инлайнить base64-картинки |
| Яндекс с запрещённым рендерингом видит только shell + fallback'ы | **высокий** | SEO-контент — в shell; либо `onAllReady` для бота |
| Ошибка внутри Suspense → 200 + частичный HTML | средний | `onError` → логировать, при критичном ветвлении отдавать `<meta name="robots" content="noindex">` в поток заранее нельзя (head уже ушёл) ⇒ либо `onAllReady` для ботов, либо статус решать до стрима |
| Позиция `<title>`/canonical/JSON-LD | низкий, но дёшево исправить | всё это — в самое начало `<head>`, до любых больших inline-блоков |

**Рекомендация для шаблона**:
1. Определять бота через `isbot` (**5.2.2**, ~20.6M загрузок/нед., последний
   релиз ≈ начало сентября 2026 [вторичный: npmjs.com/package/isbot — прямой
   запрос к registry вернул 403]) по `User-Agent`.
2. Бот → `onAllReady` (полный HTML, без плейсхолдеров). Человек → `onShellReady`
   (стрим).
3. Держать **LCP-элемент и весь SEO-значимый контент вне Suspense** — тогда
   ветка «бот» нужна только как страховка.
4. Публичные контентные страницы: рассмотреть `prerender` /
   `resumeAndPrerenderToNodeStream` (React 19.2) + кеш HTML — тогда бот всегда
   получает полный статический HTML, а пользователю отдаётся то же из кеша.

### 3.6 `<template>`-based hydration

Отдельного официального документа React про «`<template>`-based hydration» и
ботов я **не нашёл**. То, что React использует `<template>` как транспорт для
поздних чанков — деталь реализации, не задокументированная как публичный
контракт. [честно: не подтверждено первоисточником]

---

## 4. Критический CSS с Tailwind v4

### 4.1 Как Tailwind v4 выдаёт CSS [проверено]

- `@tailwindcss/vite@4.3.3` (peer vite `^5.2 || ^6 || ^7 || ^8`) работает через
  **module graph** Vite: «Tailwind relies on the module graph, which is amazing
  because it knows exactly what files you're actually using, making it maximally
  performant with no false positives or negatives».
- «most Tailwind projects ship **less than 10kB of CSS** to the client».
  [проверено] https://tailwindcss.com/blog/tailwindcss-v4
- Детект классов: **plain-text скан**, не парсинг кода. Игнорируются `.gitignore`,
  `node_modules`, бинарники, CSS-файлы, лок-файлы. Директивы `@source`,
  `@source not`, `@source inline(...)`, `source(none)`.
  **Динамические имена классов не находятся**: `` `bg-${color}-600` `` не работает —
  нужен статический словарь вариантов. Это одинаково важно и для SSR, и для CSR.
  [проверено] https://tailwindcss.com/docs/detecting-classes-in-source-files

### 4.2 Нужен ли critical CSS inline при SSR без CDN

Официальная позиция web.dev (страница обновлена **2019-05-29**, но это всё ещё
действующая статья):
> «This guide describes an **advanced performance technique** that can improve
> performance, but **can also lead to bugs if not implemented properly**.»
> «**Most sites should be able to achieve all of our recommended performance
> targets without implementing this technique.**»

Минусы, перечисленные там же: инлайн больших объёмов CSS задерживает передачу
HTML; инлайн лишает браузер возможности закешировать CSS для следующих страниц;
рекомендация держать above-the-fold < 14 KB сжатого. Инструменты, упомянутые
в статье: Critical, CriticalCSS, Penthouse.
[проверено] https://web.dev/articles/extract-critical-css

**Вывод для нашего кейса** [предположение, но обоснованное]:
- Tailwind v4 в типичном проекте даёт **~10–30 KB CSS** (≈5–10 KB brotli) — это
  **один** render-blocking запрос на том же origin (без CDN — без лишнего
  DNS/TLS/RTT). Это дешевле, чем инлайн: CSS кешируется на год с хешем в имени
  и переиспользуется на всех страницах.
- **Critical CSS extraction в шаблон НЕ закладывать.** Порог, за которым стоит
  вернуться к вопросу: CSS-бандл > ~50 KB несжатого ИЛИ LCP-подчасть «render
  delay» устойчиво > 200 ms из-за CSS.
- Если всё же понадобится — `beasties@0.5.4` (`danielroe/beasties`, «Inline
  critical CSS and lazy-load the rest») — живой преемник critters. [проверено,
  npm]

### 4.3 FOUC

- **Prod**: Vite эмитит CSS отдельным файлом, SSR-рендерер должен положить
  `<link rel="stylesheet">` в `<head>` шелла. FOUC нет.
- **Dev**: Vite инжектит CSS через JS → FOUC в dev-режиме. Это известная проблема
  TanStack Start / CSS Modules; лечится на уровне фреймворка, не приложения.
  [вторичный: обсуждения TanStack/router issues #2589, #3023]
- **Тема light/dark** — главный источник «мигания» при SSR: сервер не знает
  системную тему. Решение — inline-скрипт до гидрации, выставляющий
  `data-scheme`/класс на `<html>` из cookie/localStorage. В TanStack Start —
  компонент `ScriptOnce`. [вторичный: leonardomontini.dev / playfulprogramming]
  Совместимо с подходом текущего SPA-шаблона (`data-scheme` + `features/theme`).

### 4.4 `blocking="render"` и `<link rel="expect">`

[проверено] MDN:
- `blocking="render"` работает только на `<script>`, `<link>`, `<style>` **в `<head>`**.
  Если `<link>` добавлен скриптом — `blocking` надо выставлять явно.
- `<link rel="expect" href="#element-id" blocking="render">` — блокирует первую
  отрисовку, пока в DOM не появится элемент с этим id.
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link
- Поддержка `rel=expect`: **72.69 %** global. Chrome/Edge **124+**, Opera 110+,
  Samsung 27+. **Safari — нет (до 27.1), Firefox — нет (до 158)**.
  [проверено] https://caniuse.com/mdn-html_elements_link_rel_expect

**Как применить в streaming SSR** [предположение]:
`<link rel="expect" href="#app-main" blocking="render">` в `<head>` не даст
Chrome отрисовать «полупустой» шелл до появления главного контейнера — это
убирает лишний промежуточный кадр и связанные с ним CLS/LCP-артефакты
(paint holding). Progressive enhancement: в Safari/Firefox просто игнорируется.
Осторожно: если `#app-main` никогда не появится (ошибка рендера), Chrome
покажет пустую страницу до `DOMContentLoaded` — нужен таймаут/фолбэк.

### 4.5 Влияние CSS на LCP

`<link rel=stylesheet>` в `<head>` — render-blocking по умолчанию (MDN Glossary:
Render blocking). Для LCP это **не проблема**, если CSS: (а) один, (б) на том же
origin, (в) маленький, (г) с `Cache-Control: immutable`. Опасно: несколько
CSS-файлов, CSS с третьих доменов, `@import` внутри CSS (последовательные RTT).
[проверено] https://web.dev/articles/critical-rendering-path/render-blocking-css,
https://developer.chrome.com/docs/performance/insights/render-blocking

---

## 5. Шрифты

### 5.1 Self-host vs Google Fonts

[проверено] https://web.dev/learn/performance/optimize-web-fonts (обновлено **2023-11-01**):
- «**In most cases, self-hosting web fonts is faster than downloading them from a
  cross-origin.**»
- Если всё же третья сторона: обязательный `preconnect` к **двум** доменам:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ```
- Формат: **только WOFF2** — «WOFF2 enjoys wide browser support and the best
  compression—up to 30% better than WOFF».

**Для нашего кейса (без CDN, ru/en, приватность)**: однозначно **self-host**.
Аргументы: нет второго origin (нет DNS+TLS+RTT), нет утечки IP пользователя
третьей стороне, нет зависимости от внешней доступности (важно для RU-сегмента).
Юридический контекст (GDPR/152-ФЗ) — за рамками технических первоисточников,
помечаю как **[предположение]**, но self-host этот вопрос снимает целиком.

### 5.2 `font-display`

[проверено] web.dev/learn/performance/optimize-web-fonts и
https://web.dev/articles/font-best-practices:
- `swap` — «most widely used», текст виден сразу фолбэком, риск layout shift.
- `fallback` — «compromise between block and swap»: очень короткий block-период,
  потом фолбэк. «works well on fast networks where the web font downloads quickly».
- `optional` — веб-шрифт используется, только если пришёл за **100 ms**, иначе
  фолбэк на всю загрузку страницы. Не даёт визуальных сдвигов.

**Рекомендация для LCP-текста** [предположение / синтез]:
- Текст — частый LCP-кандидат. При `block`/`optional` LCP-текст может отрисоваться
  фолбэком (или задержаться на block-период) — обе крайности плохи.
- Оптимум: **`font-display: swap` + fallback-`@font-face` с metric overrides** —
  текст виден мгновенно (хороший LCP), а подмена шрифта не двигает layout
  (хороший CLS). Это лучший из документированных компромиссов.
- `optional` рассматривать только если CLS важнее «правильного» шрифта на первом
  визите (на повторных из кеша шрифт применится).

### 5.3 `preload`

[проверено] web.dev/articles/font-best-practices:
- «Although preload is highly effective at making fonts discoverable early, **it
  comes at the cost of taking away browser resources**; inlining font declarations
  may be a more effective approach.»
- «When preloading fonts, you need to include the `crossorigin` attribute **even if
  hosting font files yourself**» (шрифты всегда запрашиваются в CORS-режиме).

Практика: `<link rel="preload" as="font" type="font/woff2" href="/fonts/x.woff2" crossorigin>`
— **максимум 1–2 файла**, реально нужных для первого экрана (обычно основной
вес body + при необходимости заголовочный). Остальное — без preload.

### 5.4 Fallback-метрики против CLS

[проверено] https://developer.chrome.com/blog/font-fallbacks (опубликовано **2023-02-10**):
- Дескрипторы `size-adjust`, `ascent-override`, `descent-override`,
  `line-gap-override` в `@font-face` позволяют сделать фолбэк-шрифт
  геометрически идентичным веб-шрифту ⇒ сдвига при swap нет.
- Пример из статьи:
  ```css
  @font-face {
    font-family: "fallback for poppins";
    src: local("Arial");
    size-adjust: 60.85099821%;
    ascent-override: 164.3358416%;
    descent-override: 57.51754455%;
    line-gap-override: 16.43358416%;
  }
  ```
- Инструменты: **Fontaine** (`@nuxtjs/fontaine`), **Capsize**, `@next/font`,
  датасет метрик Google Fonts.
  См. также https://developer.chrome.com/blog/framework-tools-font-fallback
  и https://web.dev/css-size-adjust/

**Для нашего шаблона** [предположение]: `fontaine` — фреймворк-агностичный
Vite/unplugin-инструмент, ставится рядом с `@tailwindcss/vite`; либо генерировать
overrides один раз скриптом на `capsize`/`fontkit` и коммитить статический CSS
(предпочтительнее: меньше магии в билде, воспроизводимо, forward-only).
Фолбэк для кириллицы: `Arial` / `Helvetica` (в macOS) / `Roboto` (Android) —
все содержат кириллицу; для системного стека можно взять
`-apple-system, "Segoe UI", Roboto, Arial`.

### 5.5 Сабсеттинг кириллицы

[проверено] web.dev/learn/performance/optimize-web-fonts:
«If your page serves content in only one language … you can reduce the size of
your web fonts through subsetting.» Google Fonts умеет `&text=` и `subset=`.

Для self-host:
- **`unicode-range`** — разбить шрифт на latin / latin-ext / cyrillic /
  cyrillic-ext и объявить несколько `@font-face` с одинаковым `font-family`.
  Браузер скачает только нужные диапазоны. Для ru/en-сайта это экономит
  ~40–60 % веса на англоязычных страницах.
  Канонические диапазоны Google Fonts [вторичный, из CSS Google Fonts]:
  - latin: `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`
  - cyrillic: `U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116`
  - cyrillic-ext: `U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F`
- **Инструменты**:
  - `fonttools` / `pyftsubset` (Python) — эталон, `--flavor=woff2 --layout-features=... --unicodes=...`
  - **`@fontsource-variable/*` / `@fontsource/*`** — готовые pre-subsetted WOFF2,
    уже разрезанные по unicode-range, с корректным `@font-face` CSS
    [вторичный: npm/fontsource docs] — самый дешёвый путь для шаблона
  - `subfont`, `font-ranger` — автоматический сабсеттинг по реальному контенту
    (опасно для динамического контента)
- **Variable fonts**: «For variable fonts, only the WOFF2 format is needed, as
  browsers that don't support WOFF2 also don't support variable fonts»
  [вторичный]. Один variable-файл обычно легче 3–4 статических начертаний.

**Рекомендация**: `@fontsource-variable/<family>` + импорт **только** нужных
subset-CSS (`/cyrillic.css`, `/latin.css`), самохост, `font-display: swap`,
preload одного основного woff2, + статические metric-override фолбэки.

---

## 6. Изображения

### 6.1 Разметка [проверено]

https://web.dev/articles/optimize-lcp, https://web.dev/articles/top-cwv,
https://web.dev/articles/fetch-priority, https://web.dev/articles/browser-level-image-lazy-loading

- **LCP-картинка**: `fetchpriority="high"`, **без** `loading="lazy"`, обычный
  `src`/`srcset` (не `data-src` — «Do not use non-standard attributes like
  `data-src` that require JavaScript in order to render, as that will always be
  slower»).
- **Остальные**: `loading="lazy"` только для того, что вне первого экрана —
  «When you lazy load images below the fold, you reduce competition for bandwidth»
  ⇒ LCP-картинка грузится быстрее.
- **CLS**: всегда `width`/`height` атрибуты (браузер выведет `aspect-ratio`), или
  CSS `aspect-ratio`; для неизвестных размеров — `min-height`.
- **`srcset` + `sizes`**: «If you're using the width descriptor, you **must** also
  use the `sizes` attribute». `src` остаётся обязательным фолбэком.
- **Preload responsive**: `<link rel=preload as=image imagesrcset= imagesizes= fetchpriority=high>`;
  «Preloaded images … should include the `fetchpriority="high"` attribute as
  otherwise the preload will get the default priority for the `as` attribute».
- **`<picture>` + AVIF**: «Preloading the newest format (AVIF in this case) acts as
  a progressive enhancement».

### 6.2 AVIF vs WebP в 2026 [проверено]

https://caniuse.com/avif — **AVIF: 95.36 % global**. Chrome 85+, Edge 121+,
Firefox 93+, Safari desktop 16.4+ (16.1–16.3 partial), Safari iOS 16.0+,
Samsung Internet 14+.

**Вывод**: AVIF можно отдавать как основной формат в `<picture>` с WebP-фолбэком
(WebP ~97 %+) и JPEG как последний резерв. Порядок: AVIF → WebP → JPEG/PNG.
Оговорка [предположение]: AVIF-энкодинг дороже по CPU (важно для on-the-fly),
и на очень маленьких изображениях/иконках выигрыш минимален — для них SVG/PNG.

### 6.3 Оптимизация без CDN, в Node/Docker

#### sharp [проверено]

- `sharp@0.35.4` (2026-08-26), engines `>=20.9.0` (Node-API v9).
- Prebuilt-бинарники **включая musl**: `@img/sharp-linuxmusl-x64`,
  `@img/sharp-linuxmusl-arm64` — есть в `optionalDependencies`.
  Требование платформы: «Linux ARM64 (glibc >= 2.28, **musl >= 1.2.5**)»
  (musl 1.2.5 ⇒ Alpine 3.20+; на node:24-alpine это выполняется).
  https://sharp.pixelplumbing.com/install/
- Кросс-платформенная установка (npm 10+):
  `npm install --cpu=x64 --os=linux --libc=musl sharp`
- **Ловушка**: бинарники glibc (`linux-x64`) не работают в musl-окружении —
  классическая ошибка «'linux-x64' binaries cannot be used on the 'linuxmusl-x64'
  platform». Возникает, когда `node_modules` ставится вне целевого образа или
  копируется с хоста. [вторичный: lovell/sharp issues #3900, #4054]
- **pnpm**: нужно явно разрешить целевую архитектуру. В `.npmrc`:
  ```
  supported-architectures[os]=linux
  supported-architectures[cpu]=x64
  supported-architectures[libc]=musl
  ```
  [предположение — по аналогии с документированным флагом npm; проверить на месте]
- Node 24 + глобально установленный libvips → sharp пытается собираться из
  исходников; фикс `SHARP_IGNORE_GLOBAL_LIBVIPS=1`.
  [вторичный: lovell/sharp issue #4498]
- **Производительность/память** (https://sharp.pixelplumbing.com/performance/,
  [проверено]): «The default number of threads used to concurrently process each
  image is the same as the number of CPU cores, **except when using glibc-based
  Linux without jemalloc or without `MALLOC_ARENA_MAX`, where the default is 1**».
  Рекомендация: `MALLOC_ARENA_MAX=2` или `4` до старта Node.
  То есть на **glibc** нужно либо jemalloc, либо `MALLOC_ARENA_MAX`; на musl
  этого ограничения в доке нет. (Старый фольклор «musl allocator медленный для
  sharp» в актуальных доках **не подтверждается** — помечаю как непроверенное.)

#### Варианты, сравнение

| подход | плюсы | минусы | вердикт для нас |
|---|---|---|---|
| **build-time, `vite-imagetools@12.0.1`** (peer vite >=8, node >=22, под капотом sharp) | нулевой рантайм-CPU; хеши в именах ⇒ `immutable` на год; AVIF+WebP+srcset генерятся директивами импорта; всё внутри одного образа | только для изображений, известных на билде; растёт время сборки и размер образа | **основной путь** |
| **runtime `sharp` + дисковый кеш** (`/img?src=…&w=…&f=avif`) | работает для user-uploads и CMS-картинок; кеш на volume | CPU на cold path; риск DoS по произвольным параметрам; нужен volume (ломает «stateless одна картинка») | **только для пользовательского контента**, с allowlist размеров + подписью URL |
| `unplugin-imagemin` | — | не проверял актуальность/поддержку Vite 8 | не рекомендую без проверки |
| **`@unpic/react@1.0.2`** | отличный API responsive-картинок | «uses your existing **image CDN**»; для локальных картинок нужен Next Image Optimizer или Netlify Image CDN [вторичный: unpic.pics/img/react/] | **не подходит** — у нас нет CDN |
| внешний `imgproxy`/`thumbor` контейнер | правильная изоляция CPU | нарушает «деплой одним образом» | нет |

#### Рекомендация для `node:24-alpine`

1. `vite-imagetools` для всей статики проекта; экспорт `?w=400;800;1200&format=avif;webp&as=picture`.
2. `sharp` держать **только** в рантайме для загружаемых пользователем файлов,
   с фиксированным набором пресетов (`w ∈ {320,640,960,1280,1920}`, `f ∈ {avif,webp}`),
   HMAC-подписью URL и дисковым кешем (`/var/cache/img`, LRU-чистка).
3. В Dockerfile ставить зависимости **внутри** того же alpine-образа
   (multi-stage: `deps` на `node:24-alpine`), не копировать `node_modules` с хоста.
4. Не забыть `apk add --no-cache libc6-compat`? — **не нужно** для prebuilt
   musl-бинарников sharp; нужно только если тянутся glibc-бинарники.
   [предположение — проверить в CI]
5. **Альтернатива**: `node:24-slim` (Debian, glibc) + `ENV MALLOC_ARENA_MAX=2`.
   Образ больше (~+60 MB), зато меньше сюрпризов с нативными модулями и есть
   документированный тюнинг аллокатора. Если sharp используется в рантайме
   интенсивно — **slim предпочтительнее alpine**.

---

## 7. Resource hints, Speculation Rules, 103 Early Hints

### 7.1 Классические подсказки

| хинт | актуальность 2026 | применение у нас |
|---|---|---|
| `preconnect` | актуален; дорогой (DNS+TCP+TLS), не более 2–4 штук | **почти не нужен** — без CDN всё на своём origin. Только если останутся аналитика/внешние виджеты |
| `dns-prefetch` | актуален как дешёвый фолбэк к preconnect | для доменов Метрики/GA, если они не preconnect'ятся |
| `preload` | актуален; «taking away browser resources» — экономно | LCP-картинка (`as=image` + `fetchpriority=high`), 1–2 шрифта (`as=font crossorigin`) |
| `modulepreload` | актуален; Vite генерит автоматически для чанков энтри | ничего не делать руками |
| `prefetch` | актуален для следующих маршрутов | TanStack Router умеет `preload="intent"` — предпочесть его ручным `<link rel=prefetch>` |

[проверено] https://web.dev/learn/performance/prefetching-prerendering-precaching,
https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Speculative_loading

### 7.2 Speculation Rules API [проверено]

- MDN: статус **«Limited availability»**, «not Baseline because it does not work
  in some of the most widely-used browsers». Реально — **только Chromium**
  (Chrome/Edge). Safari/Firefox — нет.
  https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API
- Правила задаются `<script type="speculationrules">` или заголовком
  `Speculation-Rules`. Ключи: `prefetch`, `prerender`, селекторы `where` с
  `href_matches` / `selector_matches` / `and` / `not`, `eagerness`,
  `requires: ["anonymous-client-ip-when-cross-origin"]`, `referrer_policy`.
- Ограничения: prerender — same-origin по умолчанию; cross-origin same-site
  требует заголовка `Supports-Loading-Mode: credentialed-prerender`;
  кросс-сайтовый prerender невозможен; prefetch кросс-сайт — без кук.
  Prerender **не блокируется** настройками `Cache-Control` (в отличие от
  легаси `<link rel=prerender>`).
- **`prerender_until_script`** — origin trial с **Chrome 144**, опубликовано
  **2026-01-23**: «a new, middle ground, between prefetch and prerender» —
  грузит документ и сабресурсы, но **не исполняет `<script>`** до реальной
  навигации. Ещё не зашипилось.
  https://developer.chrome.com/blog/prerender-until-script-origin-trial
- Также: https://developer.chrome.com/blog/search-speculation-rules — Google
  Search сам использует speculation rules для своих выдач.

**Рекомендация**: заложить опциональный `<script type="speculationrules">` с
`prefetch` + `eagerness: "moderate"` для внутренних ссылок (исключая `/logout`,
формы, приватные разделы) — дёшево, деградирует молча. `prerender` — только для
явно «горячих» переходов, потому что prerender исполняет JS на скрытой странице
(двойные аналитика-хиты → см. Page Lifecycle / `document.prerendering`).

### 7.3 103 Early Hints [проверено]

https://developer.chrome.com/docs/web-platform/early-hints (обновлено **2026-07-10**):
- Chrome 103+, Edge 103+.
- Разрешены **только** `preconnect` и `preload`:
  - `preconnect`: Chrome/Edge 103+, **Firefox 120+, Safari 17+**
  - `preload`: Chrome/Edge 103+, **Firefox 123+, Safari — НЕТ**
- «Only available for **navigation requests** (that is, the main resource for the
  top level document).»
- «recommended to only be sent over **HTTP/2 or HTTP/3** connections» — большинство
  браузеров принимают 103 только там.
- «Early Hints followed by a **cross-origin redirect** on the final response will
  result in browsers dropping the resources.»
- Ресурсы из Early Hints кладутся в HTTP-кеш ⇒ **должны быть кешируемыми**, иначе
  двойная загрузка.

**Node**: `response.writeEarlyHints(hints[, callback])`, добавлено в **v18.11.0**,
есть и в `http`, и в `http2`. [проверено] https://nodejs.org/api/http.html
```js
res.writeEarlyHints({ link: [
  '</assets/app-abc123.css>; rel=preload; as=style',
  '</fonts/inter-cyrillic.woff2>; rel=preload; as=font; crossorigin',
]})
```

**Traefik**: issue `traefik/traefik#9213` («103 Early Hint») **закрыт** PR
`#9786` («Add HTTP 103 early hints unit test», milestone 2.9) — добавлен
non-regression unit-тест «for the support of 103 early hints responses by the
reverse proxy». То есть **Traefik проксирует 103** (поддержка пришла из Go 1.20
`httputil.ReverseProxy`). [проверено, просмотрел issue и PR на github.com]

**Вердикт для шаблона** [предположение]:
- Со **streaming SSR** выигрыш от Early Hints **невелик**: шелл с `<link>` в
  `<head>` и так уходит браузеру почти сразу. Early Hints выигрывают там, где
  TTFB большой и до первого байта HTML далеко.
- Заложить как **опциональный тумблер** (env-флаг), а не дефолт. Проверить в
  своей инсталляции: (а) не съедает ли 103 middleware `compress`/CrowdSec,
  (б) уходит ли к браузеру по HTTP/2.
- Приоритет работ: сначала «шелл уходит за <100 ms», потом Early Hints.

---

## 8. Бюджет JS и гидрация

### 8.1 Что реально доступно в 2026 для React 19 + Vite

| технология | статус | источник |
|---|---|---|
| **Full hydration** (`hydrateRoot`) | стабильно | react.dev |
| **Selective hydration** (Suspense) | стабильно с React 18 | react.dev/reference/react/Suspense |
| **Partial pre-rendering** (`prerender` → `resume` / `resumeAndPrerender`) | React **19.2**, стабильное API | https://react.dev/blog/2025/10/01/react-19-2, https://react.dev/reference/react-dom/static/resumeAndPrerender |
| **RSC в Vite** — `@vitejs/plugin-rsc` | **0.5.34**, pre-1.0 | npm |
| **RSC в TanStack Start** | **экспериментально**: «Server Components are experimental! The API may see refinements», «will remain so into early v1» | https://tanstack.com/start/latest/docs/framework/react/guide/server-components |
| **TanStack Start сам** | **Release Candidate**, «feature-complete with a stable API … before the v1 release». Построен на TanStack Router + Vite (или Rsbuild). Nitro в текущей доке **не упоминается** | https://tanstack.com/start/latest/docs/framework/react/overview |
| **Islands / partial hydration** в React | нет первоклассной поддержки; Astro-подобный подход требует другого фреймворка | [предположение] |

Включение RSC в TanStack Start: установить `@vitejs/plugin-rsc`, в конфиге
плагина Start — `rsc: { enabled: true }`; требования React 19+, Vite 7+/Rsbuild 2+.
Ограничения из доки: «The server cannot inspect slot content. `React.Children.map()`
and `cloneElement()` won't work on `props.children`»; аргументы render-props
должны быть сериализуемыми. [проверено]

**Рекомендация для шаблона** [предположение]:
- **v1 шаблона — без RSC.** SSR + streaming + selective hydration. RSC пометить
  как «кандидат на v2, когда в TanStack Start снимут ярлык experimental и
  `@vitejs/plugin-rsc` дойдёт до 1.0».
- Заложить архитектурную возможность: держать «серверные» данные в loader'ах
  маршрутов (TanStack Router), а не в компонентах — тогда переход на RSC не
  потребует переписывания дерева.

### 8.2 Бюджеты

Официальные ориентиры web.dev [проверено]:
- https://web.dev/articles/your-first-performance-budget — для Slow 3G / Moto G4:
  **< 170 KB** сжатых critical-path ресурсов всего, из них **JS ≤ 100 KB**.
  Для Slow 4G / Moto G4 — **JS ≤ 200 KB**.
- https://web.dev/use-lighthouse-for-performance-budgets — общий ориентир
  **125 KB JS** на страницу; Lighthouse performance score budget ≥ 85.

**Реалистичная оценка для React 19 SSR** [предположение, оценка по типовым
размерам — проверить `size-limit`'ом на месте]:

| слой | ~gzip | ~brotli |
|---|---|---|
| react + react-dom (client) | ~45 KB | ~40 KB |
| @tanstack/react-router + start client | ~30 KB | ~26 KB |
| @tanstack/react-query | ~13 KB | ~11 KB |
| приложение (shared/ui, entities, роут-чанк) | ~25 KB | ~21 KB |
| **initial JS итого** | **~110 KB** | **~95 KB** |
| CSS (Tailwind v4) | ~6 KB | ~5 KB |
| HTML шелла | ~8 KB | ~5 KB |

Честный вывод: **бюджет web.dev «100 KB JS на Slow 3G» при полной гидрации
React-дерева практически целиком съедается фреймворком.** Поэтому:
- Бюджет `size-limit` для шаблона предлагаю: **initial JS ≤ 120 KB gzip /
  ≤ 100 KB brotli**, **CSS ≤ 15 KB brotli**, **HTML документа ≤ 100 KB
  несжатого** (жёсткий потолок — 2 МБ от Googlebot, но 100 KB держит нас далеко
  от края).
- Отдельный бюджет на **route-чанк**: ≤ 30 KB gzip.
- `size-limit@13.1.1` уже используется в SPA-шаблоне — переиспользовать конфиг,
  добавив `--why` и разделение entry / route.

### 8.3 Как минимизировать TBT/INP при полной гидрации

[проверено] https://web.dev/articles/top-cwv (обновлено 2024-10-31) — приоритеты
для INP (это метрика №1 по важности в их списке):
1. **Разбивать длинные задачи** — `scheduler.yield()` (не Baseline, нужен
   полифилл/фолбэк на `setTimeout(0)`).
2. **Убирать лишний JS** — code splitting, удаление неиспользуемого, предпочитать
   нативные платформенные возможности.
3. **Оптимизировать rendering work** — избегать forced layout, держать DOM
   небольшим, использовать CSS containment.

Дополнительно, специфично для SSR [предположение]:
- **Гидрация — это одна большая задача.** Selective hydration через Suspense
  разбивает её; React гидрирует приоритетно ту границу, с которой
  провзаимодействовал пользователь.
- Обернуть в `<Suspense>` **тяжёлые интерактивные блоки ниже первого экрана**
  (комментарии, рекомендации, карты) — даже если данные уже есть: это и
  разбивает гидрацию, и не мешает SEO, если контент всё равно отдаётся в потоке.
- `React.lazy` + `<Suspense>` для всего, что не видно на первом экране.
- **React Compiler** (уже в SPA-шаблоне) снимает часть ручных мемоизаций, но не
  уменьшает стоимость самой гидрации.
- Мерить **LoAF** через `web-vitals/attribution` — там сразу видно, гидрация ли
  это или сторонний скрипт.
- Отложить всё некритичное на `requestIdleCallback` / после `load`.

---

## 9. Third-party: Яндекс.Метрика и GA4

### 9.1 Общие правила [проверено]

https://web.dev/articles/efficiently-load-third-party-javascript,
https://web.dev/articles/third-party-javascript, https://web.dev/articles/tag-best-practices
- «Always use `async` or `defer` for third-party scripts, unless the script is
  necessary for the critical rendering path.»
- «Third-party script execution can delay response to user interactions and
  degrades the Interaction to Next Paint (INP)»; TBT — лабораторный прокси INP.
- Тег-менеджер (GTM) снижает число сетевых вызовов, но добавляет свой рантайм;
  доступ к нему надо ограничивать.

### 9.2 Google Analytics 4 [проверено]

Официальный снипет `gtag.js` использует **`async`**:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
```
и ставится в `<head>`.
https://developers.google.com/analytics/devguides/collection/ga4/tag-options,
https://support.google.com/tagmanager/answer/17231523

### 9.3 Яндекс.Метрика [проверено]

https://yandex.com/support/metrica/en/code/counter-initialize
- «The library can be loaded **asynchronously (recommended)** or synchronously,
  but its functionality remains the same.» В стандартном снипете — `k.async=1`.
- Параметр инициализации **`defer`** (дефолт `false`) — это **не** про загрузку
  скрипта, а про «whether to disable automatically sending data during tag
  initialization» (отключить автоотправку хита при инициализации; потом хит
  шлётся вручную `ym(id,'hit',url)`).
- Официально описана возможность **отложить загрузку сниппета до согласия
  пользователя**: «You can defer loading the code snippet for the Yandex Metrica
  tag on site pages. If the user agrees to have information transmitted, the tag
  code loads normally.»
  https://yandex.com/support/metrica/en/general/notification.html
- Отдельного «лёгкого режима» Метрики в документации **не нашёл**.
  [честно: первоисточника нет]

«Лёгкий» набор опций Метрики, снижающий вес/нагрузку [предположение]:
отключить `webvisor`, `clickmap`, `trackHash`, `accurateTrackBounce` — вебвизор
самый дорогой по main-thread и по трафику.

### 9.4 Partytown [проверено]

- `@builder.io/partytown@0.10.3` — **deprecated**, npm-сообщение: «Use
  `@qwik.dev/partytown` instead».
- `@qwik.dev/partytown@0.14.4` — живой (публикуется через GitHub Actions OIDC,
  Node 24 в CI). Проект официально **в beta**: «Partytown is still in beta and
  not guaranteed to work in every scenario». https://partytown.qwik.dev/

**Вердикт** [предположение]: **в дефолт шаблона Partytown не класть.** Причины:
(1) beta, (2) требует reverse-proxy-эндпоинта для сторонних скриптов (у нас без
CDN это ещё и наш собственный Node под нагрузкой), (3) синхронный доступ к DOM
из воркера — хрупкая механика, ломается на обновлениях Метрики/GA. Оставить как
документированный «эскейп-хатч», если RUM покажет, что аналитика реально жжёт
main thread.

### 9.5 Рекомендуемая схема подключения аналитики [предположение]

1. Скрипты аналитики **не** в SSR-HTML `<head>`, а инжектируются после гидрации.
2. Триггер загрузки: `requestIdleCallback(cb, {timeout: 3000})` **или** первое
   пользовательское взаимодействие (`pointerdown`/`keydown`/`scroll`, once),
   что наступит раньше — так они не конкурируют с LCP и не портят INP первого
   взаимодействия.
3. Метрика: `defer: true` при инициализации + ручной `hit` — чтобы отложенная
   загрузка не потеряла просмотр.
4. `dns-prefetch` (не `preconnect`) на `mc.yandex.ru` и `www.googletagmanager.com`
   — дешевле, а соединение всё равно понадобится позже.
5. SPA-переходы TanStack Router → ручные `hit`/`page_view` (иначе аналитика
   считает только первую страницу).
6. Если стоит consent-баннер — грузить только после согласия (у Метрики это
   официально поддержанный сценарий).

---

## 10. Кеширование

### 10.1 Канон [проверено]

https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching и
https://web.dev/articles/http-cache

- **Хешированные ассеты**: `Cache-Control: public, max-age=31536000, immutable`
  (+ `ETag`/`Last-Modified`). `immutable` убирает revalidation при reload.
- **HTML**: `Cache-Control: no-cache` (+ `private`, если персонализировано) с
  `ETag`/`Last-Modified` → условные запросы, 304 вместо перекачки.
- MDN дословно: «Now that HTTP/1.1-conformant servers are widely deployed, there's
  no reason to ever use that `max-age=0` and `must-revalidate` combination — you
  should instead just use `no-cache`.»
- `private` vs `public`: `public` нужен только чтобы разрешить shared-кешам
  кешировать ответ с `Authorization`; иначе достаточно `max-age`.
- **`Vary`**: `Vary: Accept-Encoding` — ок и обязателен при контент-негошиэйшне
  по кодировке; `Vary: Accept-Language` — допустимо; **`Vary: User-Agent` —
  плохо** («drastically reduces the chance that the cache will be reused»);
  вместо **`Vary: Cookie`** использовать `Cache-Control: private`.
- `stale-while-revalidate`: Chrome 75+, Firefox 68+ (в браузерном кеше);
  неподдерживающие браузеры просто игнорируют директиву и используют `max-age`.
  https://web.dev/articles/stale-while-revalidate
- `stale-if-error`: «the cache can reuse a stale response when an upstream server
  generates an error». Поддержка в **браузерных** кешах ограничена — точных
  данных не нашёл. [честно: не подтверждено] В shared-кешах (Souin/nginx) —
  поддерживается.
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control

### 10.2 bfcache и `no-store` — важно для SSR [проверено]

https://developer.chrome.com/docs/web-platform/bfcache-ccns
- Chrome с **марта–апреля 2025** (100 % роллаут) **разрешает bfcache для страниц
  с `Cache-Control: no-store`**, когда это безопасно.
- Эвикция происходит при изменении cookies / методов авторизации, а также если
  страница делает fetch/XHR, ответ которого сам содержит `Cache-control: no-store`.
- «only for Chrome» — другие браузеры по-прежнему блокируют bfcache при `no-store`.

⇒ bfcache — это «мгновенная» назад/вперёд навигация, а значит отличные LCP/CLS.
`no-store` ставить **только** там, где реально секретно. Для обычной приватной
страницы достаточно `private, no-cache`.

### 10.3 Кто кеширует без CDN

| слой | что умеет | вердикт |
|---|---|---|
| **Браузер** | всё вышеописанное | основной кеш |
| **Traefik v3 сам** | **НЕ кеширует HTTP-ответы.** HTTP-cache middleware есть только в Traefik Enterprise / Hub | нельзя рассчитывать |
| **Souin** (`plugins.traefik.io/plugins/.../souin`) | RFC-7234-совместимый кеш как Traefik-плагин: `Vary`, request coalescing, `stale-while-revalidate`, `Cache-Status`, YKey, Targeted HTTP Cache Control; поддерживает драфты http-cache-groups / http-invalidation | рабочий вариант, но ставится через `experimental.plugins` (Yaegi) — **риск для прод-стабильности**; [вторичный: docs.souin.io, plugins.traefik.io] |
| **nginx перед Node** (в том же образе или sidecar) | `proxy_cache`, `proxy_cache_use_stale`, `brotli_static`/`gzip_static` | зрелый, но ломает «один образ = один процесс» |
| **In-process LRU в Node** | кеш отрендеренного HTML по ключу (path + lang + вариант) | **самый простой и предсказуемый** для «одного образа» |

**Рекомендация** [предположение]: LRU-кеш отрендеренного HTML внутри Node
(`lru-cache`, ключ = `method:host:path:lang:variant`, TTL 30–120 s, +
`stale-while-revalidate` семантика вручную) + корректные заголовки для браузера.
Souin — опция «если понадобится общий кеш между репликами», с явной пометкой
про experimental-плагины Traefik.

### 10.4 Конкретные заголовки

| ресурс | заголовки | обоснование |
|---|---|---|
| **HTML публичной страницы** | `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=600, stale-if-error=86400`<br>`ETag: "<hash>"`<br>`Vary: Accept-Encoding` | браузер всегда ревалидирует (свежесть контента), shared-кеш (если появится) держит 60 s и отдаёт stale при 5xx. Если shared-кеша точно нет — проще: `Cache-Control: no-cache` + ETag |
| **HTML приватной страницы** | `Cache-Control: private, no-cache`<br>`ETag: "<hash>"`<br>`Vary: Accept-Encoding` | **не** `Vary: Cookie` (MDN); `no-store` — только для по-настоящему секретного (иначе теряем bfcache в не-Chrome) |
| **`/assets/*` с хешем в имени** | `Cache-Control: public, max-age=31536000, immutable`<br>`Vary: Accept-Encoding` | канон MDN/web.dev |
| **Шрифты `/fonts/*.woff2`** (тоже с хешем) | то же + `Access-Control-Allow-Origin` не нужен (same-origin), но запрос идёт в CORS-режиме ⇒ `crossorigin` в preload | |
| **`robots.txt`** | `Cache-Control: public, max-age=3600` | меняется редко, но должен быстро подхватываться |
| **`sitemap.xml`** | `Cache-Control: public, max-age=600, stale-while-revalidate=3600` + `Last-Modified` | генерится динамически |
| **OG-картинки, статические** | `public, max-age=31536000, immutable` (хеш в URL) | |
| **OG-картинки, генерируемые (satori/resvg)** | `public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000` + `ETag` от хеша входных данных; **лучше — хеш входа в URL** и тогда `immutable` | соцсети-краулеры (Telegram, VK, Twitter) кешируют агрессивно; менять URL при смене контента |
| **`/rum`, `/api/*`** | `Cache-Control: no-store` | |

Общее: **никогда** `Vary: Cookie` и `Vary: User-Agent` на HTML.
Для ru/en — **разные URL** (`/ru/...`, `/en/...` или поддомены), а не
`Vary: Accept-Language`: иначе кеш-хиты рушатся и в браузере, и в любом
shared-кеше. [предположение, но следует прямо из логики `Vary` в MDN]

---

## 11. Компрессия

### 11.1 Состояние форматов [проверено]

- **brotli (`br`)**: все современные браузеры с конца 2017. https://caniuse.com/brotli
- **zstd**: **85.17 %** global. Chrome/Edge **123+** (в 118–122 был выключен),
  Firefox **126+**, **Safari desktop — нет** (26.0+ partial), Safari iOS — full с
  **26.3**. https://caniuse.com/zstd
- `Content-Encoding` поддерживает также `dcb`/`dcz` (shared dictionary
  compression) — https://developer.chrome.com/blog/shared-dictionary-compression;
  для шаблона пока экзотика. [предположение: не закладывать]

**Вывод**: `br` — основной; `zstd` — приятный бонус (быстрее декомпрессия), но
не покрывает Safari desktop; `gzip` — обязательный фолбэк.

### 11.2 Уровни сжатия [вторичный, Cloudflare]

https://blog.cloudflare.com/results-experimenting-brotli/,
https://blog.cloudflare.com/this-is-brotli-from-origin/
- Для **динамического** контента — brotli **quality 4** (Cloudflare с 2017 года
  использует максимум br-4 для всех сжимаемых ассетов): «Compression level 4
  offers the balance between bytes saved and compression time».
- br-5 ускоряет медленные соединения на файлах > 64 KB.
- br-4 в среднем чуть быстрее gzip-8 при сопоставимом ratio.
- Для **статики** — сжимать на билде на **q11**, там время не важно.

### 11.3 Где сжимать

**Вариант A (рекомендуемый)** [предположение, из проверенных фактов ниже]:
- **Хешированная статика** — предсжать на билде:
  `vite-plugin-compression2@2.5.3`, `algorithms: ['gzip', 'brotliCompress', 'zstd']`
  (`zstd` требует Node ≥ 22.15 / ≥ 23.8 — на Node 24 ок), brotli
  `BROTLI_PARAM_QUALITY: 11`, gzip `level: 9`. [проверено, npm + README]
- **Отдавать предсжатое из Node**: `@fastify/static` с `preCompressed: true`
  (сначала `.br`, потом `.gz`, потом оригинал; **сам добавляет
  `Vary: Accept-Encoding`**, в том числе когда отдаёт несжатый фолбэк) или
  `sirv` (ищет `.br`/`.gz` рядом с файлом). [вторичный: npm/@fastify/static,
  sirv docs]
  ⚠️ Замечание по безопасности из доки `@fastify/static`: `allowedPath`
  вычисляется **до** выбора предсжатого варианта — запрос `/file.txt` может
  отдать `/file.txt.br`, даже если прямые запросы к `.br` запрещены.
- **Динамический HTML** — отдать на сжатие **Traefik**: middleware `compress`
  не трогает ответы, у которых уже есть `Content-Encoding` ⇒ предсжатая статика
  проходит насквозь, а HTML сжимается на лету. [проверено, см. ниже]

**Вариант B**: сжимать всё в Node (`@fastify/compress` / `compression`).
Минус: CPU SSR-процесса + нужно вручную flush'ить поток при streaming SSR
(`Z_SYNC_FLUSH` на каждый чанк), иначе стрим «залипает» в компрессоре.

### 11.4 Traefik v3 `compress` — детали [проверено]

https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/
- `encodings` — дефолт **`gzip, br, zstd`**; **порядок = приоритет**. (В v3.3.5
  дефолт изменили так, чтобы предпочитался gzip.) ⇒ чтобы предпочитать brotli,
  надо явно `encodings: ["br", "zstd", "gzip"]`.
- `minResponseBodyBytes` — дефолт **1024**.
- `excludedContentTypes` / `includedContentTypes` — взаимоисключающие,
  сравнение case-insensitive.
- `defaultEncoding` — применяется, если в запросе нет `Accept-Encoding` или там `*`.
- Сжатие происходит, только если: подходящий `Accept-Encoding`, **у ответа ещё
  нет `Content-Encoding`**, content-type прошёл фильтры, тело больше
  `minResponseBodyBytes`.
- `application/grpc` не сжимается никогда.

**Streaming / chunked** — критично для SSR:
- Исторически (v3.3) была регрессия: сжатие ломало SSE (`traefik#11509`).
- Починено PR `traefik#11583`: «**When data is sent to the client on flush, the
  `minResponseBodyBytes` configuration is ignored and the data is compressed.**
  This is particularly the case when data is streamed to the client when using
  `Transfer-encoding: chunked` response.» То есть Traefik **корректно
  прокидывает flush'и** и не буферизует поток.
- Это поведение **не попало в онлайн-документацию** — открыт doc-issue
  `traefik#12673` (Traefik 3.6, статус Open на момент проверки).
  [проверено, просмотрел issue на github.com]

⇒ Для React `renderToPipeableStream` → Node `res` → Traefik `compress` стриминг
должен работать. **Но это надо проверить в своей инсталляции** (написать
smoke-тест: засечь время до первого байта и до первого видимого чанка через
Traefik и в обход).

### 11.5 Итоговая конфигурация

```yaml
# Traefik dynamic config
http:
  middlewares:
    compress-web:
      compress:
        encodings: ["br", "zstd", "gzip"]   # приоритет brotli
        minResponseBodyBytes: 1024
        excludedContentTypes:
          - image/avif
          - image/webp
          - image/jpeg
          - image/png
          - font/woff2
          - application/wasm
```
(Уже сжатые форматы сжимать бессмысленно; woff2 — это уже brotli внутри.)

Node:
- статика: предсжатые `.br`/`.gz`/`.zst` + `Vary: Accept-Encoding` +
  `Cache-Control: public, max-age=31536000, immutable`
- HTML: без `Content-Encoding` (пусть Traefik сожмёт) — либо самому brotli q4 с
  per-chunk flush, если Traefik-путь окажется проблемным

---

## 12. Сводные рекомендации для шаблона (чек-лист)

### Обязательное в v1
1. SSR-шелл содержит: `<title>`, meta, canonical, hreflang (ru/en), JSON-LD —
   **в самом начале `<head>`** (требование Googlebot про порядок байтов).
2. LCP-элемент и весь SEO-контент — **вне Suspense**.
3. Детект бота (`isbot`) → `renderToPipeableStream` c `onAllReady`; человек →
   `onShellReady`. В Яндекс.Вебмастере — **«Запретить рендеринг»** (так велит
   их же дока при SSR).
4. Один Tailwind-CSS файл с хешем, `<link>` в `<head>`; **никакого critical CSS**.
5. Self-host WOFF2 (variable, subset cyrillic+latin через `unicode-range`),
   `font-display: swap`, fallback `@font-face` с `size-adjust`/`*-override`,
   preload ровно одного основного файла с `crossorigin`.
6. Картинки: build-time через `vite-imagetools` (AVIF+WebP+srcset), LCP-картинка
   с `fetchpriority="high"` и без `lazy`, всегда `width`/`height`.
7. Заголовки кеша по таблице §10.4; `Vary: Accept-Encoding`; никогда `Vary: Cookie`.
8. Предсжатие статики на билде (`vite-plugin-compression2`), Traefik `compress`
   с `encodings: ["br","zstd","gzip"]` для HTML.
9. RUM на `web-vitals@6`: базовая сборка всем, attribution — сэмплом; батч +
   `sendBeacon` на `visibilitychange:hidden`; `Server-Timing` для серверной
   разбивки TTFB.
10. `size-limit` бюджеты: initial JS ≤ 120 KB gzip, CSS ≤ 15 KB br,
    HTML-документ ≤ 100 KB несжатого (жёсткий потолок Googlebot — 2 МБ).
11. Аналитика (Метрика/GA4) — `async`, инжект после idle/первого взаимодействия,
    у Метрики `defer:true` + ручной `hit`; на SPA-переходах — ручные хиты.
12. Тема — inline-скрипт до гидрации (`data-scheme` на `<html>`), иначе FOUC/CLS.

### Опционально / за флагом
- `<link rel="expect" blocking="render">` для paint holding (Chromium-only).
- Speculation Rules `prefetch` (`eagerness: moderate`) для внутренних ссылок.
- 103 Early Hints (`res.writeEarlyHints`) — только после замера и проверки, что
  Traefik/CrowdSec их не съедают.
- LRU-кеш отрендеренного HTML в Node; Souin как Traefik-плагин — только если
  нужен общий кеш между репликами (experimental-плагины = риск).
- Partytown — не в дефолт.

### Не делать
- RSC в v1 (экспериментально и в Start, и в `@vitejs/plugin-rsc`).
- Critical CSS extraction (Tailwind v4 и так ~10 KB).
- `@unpic/react` (рассчитан на image CDN).
- Полагаться на «новые Core Web Vitals 2026» из SEO-блогов — их не существует.
- `Vary: Accept-Language` вместо разных URL для ru/en.

---

## 13. Список URL (первоисточники)

**Core Web Vitals / метрики**
- https://web.dev/articles/vitals (2024-10-31)
- https://web.dev/articles/lcp (2025-09-04)
- https://web.dev/articles/inp (2025-09-02)
- https://web.dev/articles/cls (2023-04-12)
- https://web.dev/articles/defining-core-web-vitals-thresholds
- https://web.dev/articles/top-cwv (2024-10-31)
- https://web.dev/articles/optimize-lcp
- https://web.dev/blog/lcp-and-inp-are-now-baseline-newly-available (2025-12-17)
- https://web.dev/articles/vitals-spa-faq (2026-08-11)
- https://developer.chrome.com/docs/web-platform/soft-navigations (2026-09-02)
- https://developer.chrome.com/docs/crux/release-notes
- https://developer.chrome.com/docs/web-platform/long-animation-frames
- https://developer.chrome.com/blog/loaf-has-shipped
- https://developer.chrome.com/blog/use-scheduler-yield
- https://developer.mozilla.org/en-US/docs/Web/API/PerformanceSoftNavigation
- https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming

**Google Search / индексация**
- https://developers.google.com/search/docs/appearance/core-web-vitals (2025-12-10)
- https://developers.google.com/search/docs/appearance/page-experience (2025-12-10)
- https://developers.google.com/search/blog/2026/03/crawler-blog-post (2026-03-31)
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics (2026-03-04)

**Яндекс**
- https://yandex.ru/support/webmaster/ru/yandex-indexing/rendering
- https://yandex.ru/support/webmaster/ru/yandex-indexing/page-speed.html
- https://yandex.com/support/metrica/en/code/counter-initialize
- https://yandex.com/support/metrica/en/general/notification.html
- https://yandex.ru/support/metrica/ru/reports/timing.html

**React / фреймворк**
- https://react.dev/reference/react-dom/server/renderToPipeableStream
- https://react.dev/blog/2025/10/01/react-19-2
- https://react.dev/reference/react-dom/static/resumeAndPrerender
- https://react.dev/reference/react-dom/static/prerenderToNodeStream
- https://tanstack.com/start/latest/docs/framework/react/overview
- https://tanstack.com/start/latest/docs/framework/react/guide/server-components
- https://vite.dev/blog/announcing-vite8

**CSS / шрифты**
- https://tailwindcss.com/blog/tailwindcss-v4
- https://tailwindcss.com/docs/detecting-classes-in-source-files
- https://tailwindcss.com/docs/installation/using-vite
- https://web.dev/articles/extract-critical-css
- https://web.dev/articles/critical-rendering-path/render-blocking-css
- https://developer.chrome.com/docs/performance/insights/render-blocking
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link
- https://developer.mozilla.org/en-US/docs/Glossary/Render_blocking
- https://caniuse.com/mdn-html_elements_link_rel_expect
- https://web.dev/learn/performance/optimize-web-fonts (2023-11-01)
- https://web.dev/articles/font-best-practices
- https://developer.chrome.com/blog/font-fallbacks (2023-02-10)
- https://developer.chrome.com/blog/framework-tools-font-fallback

**Изображения**
- https://web.dev/articles/fetch-priority
- https://web.dev/articles/browser-level-image-lazy-loading
- https://web.dev/articles/preload-responsive-images
- https://web.dev/learn/design/responsive-images
- https://developer.mozilla.org/en-US/blog/fix-image-lcp/
- https://caniuse.com/avif
- https://sharp.pixelplumbing.com/install/
- https://sharp.pixelplumbing.com/performance/

**Resource hints / Early Hints**
- https://developer.chrome.com/docs/web-platform/early-hints (2026-07-10)
- https://nodejs.org/api/http.html (`response.writeEarlyHints`, v18.11.0)
- https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API
- https://developer.chrome.com/docs/web-platform/prerender-pages
- https://developer.chrome.com/blog/speculation-rules-improvements
- https://developer.chrome.com/blog/prerender-until-script-origin-trial (2026-01-23)
- https://web.dev/learn/performance/prefetching-prerendering-precaching
- https://github.com/traefik/traefik/issues/9213 (закрыт) / pull/9786

**Кеширование / компрессия**
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
- https://web.dev/articles/http-cache
- https://web.dev/articles/stale-while-revalidate
- https://developer.chrome.com/docs/web-platform/bfcache-ccns
- https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/
- https://github.com/traefik/traefik/issues/12673 (doc-issue про flush/SSE)
- https://caniuse.com/zstd , https://caniuse.com/brotli
- https://developer.chrome.com/blog/shared-dictionary-compression
- https://blog.cloudflare.com/results-experimenting-brotli/ (вторичный)
- https://plugins.traefik.io/plugins/6294728cffc0cd18356a97c2/souin (вторичный)

**Third-party**
- https://web.dev/articles/efficiently-load-third-party-javascript
- https://web.dev/articles/third-party-javascript
- https://web.dev/articles/tag-best-practices
- https://developers.google.com/analytics/devguides/collection/ga4/tag-options
- https://partytown.qwik.dev/

**Бюджеты**
- https://web.dev/articles/your-first-performance-budget
- https://web.dev/use-lighthouse-for-performance-budgets
- https://web.dev/performance-budgets-101/

**npm (версии, проверено 2026-09-15)**
- https://registry.npmjs.org/web-vitals/latest → 6.2.2
- https://raw.githubusercontent.com/GoogleChrome/web-vitals/main/CHANGELOG.md
- https://raw.githubusercontent.com/GoogleChrome/web-vitals/main/README.md
- https://registry.npmjs.org/sharp/latest → 0.35.4
- https://registry.npmjs.org/vite/latest → 8.3.0
- https://registry.npmjs.org/react/latest → 19.3.0
- https://registry.npmjs.org/@tanstack/react-start/latest → 1.168.54
- https://registry.npmjs.org/@vitejs/plugin-rsc/latest → 0.5.34
- https://registry.npmjs.org/tailwindcss/latest → 4.3.3
- https://registry.npmjs.org/@tailwindcss/vite/latest → 4.3.3
- https://registry.npmjs.org/vite-imagetools/latest → 12.0.1
- https://registry.npmjs.org/@unpic/react/latest → 1.0.2
- https://registry.npmjs.org/vite-plugin-compression2/latest → 2.5.3
- https://registry.npmjs.org/beasties/latest → 0.5.4
- https://registry.npmjs.org/size-limit/latest → 13.1.1
- https://registry.npmjs.org/satori/latest → 0.33.4
- https://registry.npmjs.org/@builder.io/partytown/latest → 0.10.3 (deprecated)
- https://registry.npmjs.org/@qwik.dev/partytown/latest → 0.14.4
- https://nodejs.org/en/about/previous-releases → v24.21.0 LTS, v26.8.2 Current

---

## 14. Что не удалось подтвердить

1. **Версия `isbot`** — `registry.npmjs.org/isbot/latest` вернул 403; по
   npmjs.com/package/isbot последняя **5.2.2** [вторичный]. Перепроверить.
2. **`stale-if-error` в браузерных кешах** — MDN описывает директиву, но точные
   данные о поддержке браузерами не нашёл. В shared-кешах работает.
3. **CrUX `experimental.responsiveness`** — встретилось только в сниппете выдачи
   по developer.chrome.com; отдельную страницу с описанием поля не открыл.
4. **Официальных заявлений Google про React Suspense / out-of-order streaming и
   индексацию — нет.** Есть только общее «streaming ок» от Vercel (вендор) и
   косвенные факты (2 МБ лимит, WRS исполняет JS).
5. **`<template>`-based hydration React** — публичной документации, описывающей
   это как контракт, нет.
6. **Проходят ли 103 Early Hints через Traefik `compress`/CrowdSec** — не
   проверено, только факт, что reverse-proxy сам по себе 103 поддерживает.
7. **pnpm `supportedArchitectures` для sharp/musl** — по аналогии с npm-флагами;
   на практике проверить в CI.
8. **Нужен ли `libc6-compat` в alpine для sharp** — по докам не нужен (есть
   prebuilt musl), но проверить.
9. **«Visual Stability Index», «Engagement Reliability», «INP стал равным
   ranking-сигналом 18.03.2026»** — первоисточников нет; считаю выдумкой
   SEO-блогов.
10. **Официальный «лёгкий режим» Яндекс.Метрики** — в документации не нашёл.
