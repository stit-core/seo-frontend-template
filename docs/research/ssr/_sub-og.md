# OG-изображения и превью-метаданные для React SSR на Node 24 (alpine/musl), без CDN

Дата исследования: 2026-09-15. Все версии — с npm registry на эту дату.

---

## 1. Библиотеки генерации OG-картинок в Node

### Сравнительная таблица

| Библиотека | Версия (npm, сен-2026) | Лицензия | Нативные бинарники? | musl/alpine (node:24-alpine) | Кириллица / шрифты | Скорость |
|---|---|---|---|---|---|---|
| `satori` | 0.33.4 | MPL-2.0 | нет (чистый JS + WASM: harfbuzzjs, yoga-layout) | должен работать без проблем — нет платформенных бинарников | нужен явно переданный TTF/OTF/WOFF с кириллическими глифами; system-фонтов нет, WOFF2 **не поддерживается** | быстрый layout (JS), сам не растеризует |
| `@resvg/resvg-js` | 2.6.2 (стабильная; 2.7.0-alpha.2 в тэге `next`) | MPL-2.0 | да, napi-rs, есть пребилды `-linux-x64-musl`/`-linux-arm64-musl` | да, из коробки | рендерит любые встроенные в SVG/переданные шрифты (пример в репо — Source Han Serif для CJK) | по бенчмарку репозитория: 12 ops/s против 9 ops/s у sharp и 6 ops/s у svg2img на одинаковой задаче resize |
| `@vercel/og` | 1.0.2 | MPL-2.0 | зависит: тянет `satori@0.33.3` + `@resvg/resvg-wasm@2.4.1` (WASM, не нативный) + опционально `sharp@0.35.3` | WASM-резолвер не зависит от libc вообще — портируется без проблем, но медленнее нативного resvg-js (не измерялось отдельно) | то же, что у satori | ниже нативного resvg-js из-за WASM (предположение по общей практике WASM vs native, отдельно не бенчмаркалось) |
| `@napi-rs/canvas` | 1.0.9 | MIT | да, napi-rs, есть `-linux-x64-musl`/`-linux-arm64-musl` | да, ставится в `node:20-alpine` без доп. системных пакетов (по комьюнити-источнику); для Node 24 напрямую не подтверждено, но N-API стабилен по ABI — предположение | канвас-API (`GlobalFonts.registerFromPath`), кириллица — вопрос переданного шрифта, alpine без шрифтов по умолчанию | нативный Skia, ожидаемо быстрый (не бенчмаркалось в рамках этого исследования) |
| `canvas` (node-canvas, Automattic) | 3.2.3 | MIT | да, но **пребилдов под musl нет** | не поддерживается «из коробки»: npm пытается собрать из исходников, нужны `apk add build-base cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev …` — заметно утяжеляет образ | зависит от переданного шрифта | не оценивалось — сборка на musl вообще проблемна |
| `playwright` (headless Chromium) | — | — | бинарник Chromium, привязан к glibc | **официально не поддерживается на musl/Alpine** — vendor прямым текстом: "Alpine Linux ... are not supported by Playwright" | шрифты нужно ставить руками в образ (`fonts-noto` и т.п.), Alpine без шрифтов вообще | самый тяжёлый вариант (полный браузер), но отдельно не измерялось |
| `puppeteer` (headless Chromium) | — | — | то же самое | официальной поддержки Alpine нет; работает через `apk add chromium` + `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` + `--no-sandbox`, хрупко | то же самое | тяжёлый |
| `sharp` | 0.35.4 | Apache-2.0 | да (libvips), но есть официальные musl-пребилды | да, но **требует явного указания платформы** при кросс-установке: `npm install --cpu=x64 --os=linux --libc=musl sharp`; для pnpm — `pnpm.supportedArchitectures` в `package.json` (`os`/`cpu`/`libc: musl`), иначе лок-файл, собранный на glibc-машине, не притащит musl-бинарник в alpine-образ (частый баг, см. issues ниже) | не релевантно — это растеризатор/процессор изображений, не HTML/CSS-layout-движок | — |

**Важное уточнение по `sharp`**: он не заменяет satori — у него нет layout-движка (flexbox/CSS), он может только растрировать готовый SVG или пост-обрабатывать PNG (сжатие, конвертация в JPEG-фолбэк, композиция с фоновой фотографией). В пайплайне генерации OG-картинки это либо альтернативный растеризатор SVG→PNG вместо resvg (у `@resvg/resvg-js`/`@vercel/og` он и так есть опциональной зависимостью), либо шаг постобработки.

**`engines` / Node-версия**: `sharp@0.35.4` требует Node-API v9-совместимый рантайм, т.е. `>=20.9.0` — формально Node 24 подпадает, отдельного упоминания «Node 24» в engines нет (проверено, npm registry). У `@resvg/resvg-js` в README матрица поддержки явно перечисляет Node 12–22 и не содержит отдельной строки про 24 (проверено, GitHub thx/resvg-js) — поскольку это native N-API аддон, ABI обычно стабилен между мажорными версиями Node, поэтому по факту должен работать и на 24, но это предположение, требующее smoke-теста в CI на `node:24-alpine`, а не подтверждённый вендором факт.

### Рекомендация

**`satori` (layout HTML/CSS→SVG) + `@resvg/resvg-js` (растеризация SVG→PNG), напрямую, без `@vercel/og`.**

Обоснование:
- `satori` не тянет нативных зависимостей вообще — не может сломаться на musl в принципе.
- `@resvg/resvg-js` даёт официальный пребилд под `linux-*-musl`, то есть не требует ни компиляции, ни системных пакетов в alpine-образе, и по собственному бенчмарку репозитория быстрее, чем растеризация через `sharp`.
- `@vercel/og` — тонкая обёртка вокруг тех же satori+resvg, заточенная под Next.js Edge/Route Handlers (класс `ImageResponse`); её WASM-вариант resvg честно более портируем (никакой зависимости от libc), но это плата производительностью без выгоды для проекта, который и так не на Next.js и не деплоится через Vercel — использовать её эффективно означает тянуть Next-специфичные допущения ради API, который тут не нужен.
- `@napi-rs/canvas` — жизнеспособный запасной вариант (тоже есть musl-пребилды, MIT), но это императивный canvas-API (ручной перенос текста, измерение ширины строк), а не декларативный CSS-layout — для карточки с динамическим текстом переменной длины это заметно больше кода, чем JSX+flexbox в satori.
- `canvas` и headless Chromium (`playwright`/`puppeteer`) на связке node:24-alpine прямо противоречат выбору базового образа: `canvas` не имеет musl-пребилдов и требует тяжёлой сборки из исходников, а Playwright официально документирует Alpine как неподдерживаемую платформу. Оба варианта имеет смысл рассматривать только при смене базового образа на Debian/Ubuntu-slim — не вписываются в текущий стек.

### Черновик кода (satori + resvg-js, кириллический шрифт)

```ts
// pnpm add satori @resvg/resvg-js
// шрифт — TTF/OTF/WOFF с кириллическими глифами (например, статический Inter из Google Fonts),
// НЕ woff2 — satori его не читает.
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFile } from 'node:fs/promises'

const interRegular = await readFile('./assets/fonts/Inter-Regular.ttf')
const interBold = await readFile('./assets/fonts/Inter-Bold.ttf')

export async function renderOgImage(title: string, subtitle: string): Promise<Buffer> {
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '1200px',
          height: '630px',
          padding: '80px',
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'Inter',
        },
        children: [
          { type: 'div', props: { style: { fontSize: 64, fontWeight: 700 }, children: title } },
          {
            type: 'div',
            props: { style: { fontSize: 32, marginTop: 24, color: '#94a3b8' }, children: subtitle },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
      ],
    },
  )

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
  return resvg.render().asPng()
}
```

Источники: [satori npm](https://www.npmjs.com/package/satori?activeTab=readme), [registry.npmjs.org/satori](https://registry.npmjs.org/satori/latest), [vercel/satori GitHub](https://github.com/vercel/satori), [satori woff2 discussion #157](https://github.com/vercel/satori/discussions/157), [@resvg/resvg-js npm](https://www.npmjs.com/package/@resvg/resvg-js), [thx/resvg-js GitHub](https://github.com/thx/resvg-js), [@resvg/resvg-js-linux-x64-musl](https://www.npmjs.com/package/@resvg/resvg-js-linux-x64-musl), [registry.npmjs.org/@vercel/og](https://registry.npmjs.org/@vercel/og/latest), [@vercel/og Node runtime discussion](https://github.com/vercel/next.js/discussions/60003), [Next.js Edge Runtime deprecated](https://nextjs.org/docs/messages/edge-runtime-deprecated), [@napi-rs/canvas npm](https://www.npmjs.com/package/@napi-rs/canvas), [node-canvas-prebuilt musl issue #77](https://github.com/node-gfx/node-canvas-prebuilt/issues/77), [Automattic/canvas troubleshoot issue #1511](https://github.com/Automattic/canvas/issues/1511) *(в реальности issue открыт в репозитории Automattic/node-canvas — так указан в поисковой выдаче)*, [sharp install docs](https://sharp.pixelplumbing.com/install/), [registry.npmjs.org/sharp](https://registry.npmjs.org/sharp/latest), [lovell/sharp pnpm issue #4054](https://github.com/lovell/sharp/issues/4054), [nuxt/image issue #1253](https://github.com/nuxt/image/issues/1253), [Playwright Docker docs](https://playwright.dev/docs/docker), [Playwright Alpine issue #2826](https://github.com/microsoft/playwright/issues/2826).

---

## 2. Кеширование OG-картинок без CDN

Раз CDN нет, кеш-слоёв реалистично два: HTTP-заголовки (для браузеров/ботов и опционального nginx `proxy_cache` перед приложением) и серверный кеш сгенерированного PNG (чтобы не пересчитывать satori+resvg на каждый запрос).

**Ключ кеша**: детерминированный хеш от всех входов, влияющих на пиксели — заголовок/подзаголовок карточки + версия шаблона (меняешь дизайн — меняется версия — старые URL остаются валидными, но по новым запросам генерится новая картинка). `sha256(title + subtitle + templateVersion).slice(0, N)`.

**Два паттерна URL**:
- **Иммутабельный URL с хешем в пути** (`/og/{hash}.png`) — раз контент неотделим от хеша, можно смело отдавать `Cache-Control: public, max-age=31536000, immutable`: браузер/бот никогда не перепроверяет такой URL, пока не истечёт год. Это стандартный паттерн для фингерпринтованных статических ассетов (JS/CSS-бандлы), перенесённый на генерируемые PNG.
- **"Логический" стабильный URL** (`/blog/my-post/og.png`), где контент может смениться без смены пути — `immutable` здесь небезопасен. Нужен короткий `max-age` + `stale-while-revalidate` и `ETag`, равный тому же контент-хешу: тогда повторный запрос с неизменным контентом получает `304 Not Modified`, а не полный передокачивание, даже если URL не менялся.

**Серверный кеш (двухуровневый)**:
- in-memory LRU — самый быстрый, но живёт в рамках одного процесса и обнуляется при рестарте/между репликами;
- дисковый кеш-каталог — переживает рестарт контейнера, дёшев (PNG обычно 50–150 КБ), это практичный ответ на «без CDN и без Redis» для одного инстанса за nginx. При нескольких репликах за балансировщиком — либо общий volume, либо просто мириться с пересчётом на каждой реплике (дёшево при скорости satori+resvg из п. 1).

Заголовки вида `s-maxage=…, stale-while-revalidate=…`, которые встречаются в доках `@vercel/og`/Vercel-экосистемы, ориентированы на shared/edge-кеш (CDN) — раз CDN нет, `s-maxage` не имеет эффекта (его понимает только промежуточный shared-кеш, а не браузер), поэтому для этого стека достаточно `Cache-Control: public, max-age=…` + `ETag`, а роль «shared-кеша» при желании берёт на себя `proxy_cache` в уже используемом в шаблоне nginx (см. `docs/reference/deployment.md` в репозитории).

Источники: [Simon Hearne — Caching Header Best Practices](https://simonhearne.com/2022/caching-header-best-practices/), [DCHost — Cache-Control immutable / ETag / fingerprinting guide](https://www.dchost.com/blog/en/stop-fighting-your-cache-the-friendly-guide-to-cache-control-immutable-etag-vs-last%E2%80%91modified-and-asset-fingerprinting/), [Accreditly — practical guide to HTTP caching headers](https://accreditly.io/articles/the-practical-guide-to-http-caching-headers-cache-control-etag-and-304s).

Оговорка: это агрегированные общие best-practices по HTTP-кешированию (не специфичные для OG-картинок доки) — специализированного официального гайда именно «как кешировать OG-изображения без CDN» найти не удалось, вывод — собственная синтез-рекомендация на основе общих принципов кеширования иммутабельных сгенерированных ассетов.

---

## 3. Требования потребителей к og:image

### OGP.me (официальный протокол)

Единственное обязательное свойство — `og:image` (URL). Опциональные структурные под-свойства: `og:image:url` (дубликат `og:image`), `og:image:secure_url`, `og:image:type` (MIME), `og:image:width`, `og:image:height`, `og:image:alt` (спецификация рекомендует задавать `og:image:alt`, если задан `og:image`). **Сам протокол не задаёт требований к размеру/формату** — пример на странице (400×300) чисто иллюстративный.

Проверено: [ogp.me](https://ogp.me/) (2026-09-15).

### Facebook / Meta

Официальная страница даёт конкретные числа:
- рекомендуемый размер — **от 1200×630 px** (для чёткости на high-DPI экранах);
- минимум — **200×200 px**;
- для показа большого превью без обрезки в ленте — держать соотношение сторон близко к **1.91:1**; упомянут и меньший порог 600×315 px для показа «большого» превью без обрезки;
- максимальный вес файла — **8 МБ**.

Проверено: [developers.facebook.com/docs/sharing/webmasters/images](https://developers.facebook.com/docs/sharing/webmasters/images) (2026-09-15).

Инструмент сброса кеша — Facebook Sharing Debugger, `https://developers.facebook.com/tools/debug/` — общеизвестный URL, отдельно в этой сессии не фетчился (не проверялось напрямую, полагаюсь на общеизвестность).

### X / Twitter

**Официальную страницу `developer.x.com` получить не удалось** — сервер вернул `HTTP 402 Payment Required` (похоже, доки X теперь за пэйволом/требуют авторизации для автоматического фетча). Ниже — консенсус нескольких вторичных источников 2026 года (агрегировано через поиск, **не первоисточник**):

- `summary_large_image`: рекомендуемые **1200×628 px** (≈1.91:1); минимум **300×157 px**; максимум **4096×4096 px**; максимальный вес файла — **5 МБ**; форматы — JPG, PNG, WEBP (GIF — для анимированных, отдельная логика);
- `summary` (маленькая квадратная карточка) существует как альтернативный `twitter:card`, но точные числа по нему в рамках этого поиска не собирались (не входило в фокус узкой темы).

Пометка: цифры по X/Twitter — **предположение на основе вторичных источников**, не подтверждено официальной документацией напрямую (см. ошибку 402 выше). Перед реализацией стоит перепроверить вручную (например, через залогиненный браузер) на `developer.x.com`.

Источники (вторичные, не первоисточник): [soona.co Twitter Image Specs 2026](https://soona.co/image-resizer/twitter-spec-guide), [opengraphplus.com Twitter Card Image Size Guide](https://opengraphplus.com/consumers/twitter/images).

### Telegram

Официальной документации от Telegram по требованиям к `og:image` (пиксели/вес) **найти не удалось** — у Telegram нет публичного developer-документа про парсинг превью сайтов (Bot API документирует ботов, а не краулер превью-ссылок). Все найденные сведения — из вторичных SEO/practical-источников:

- Telegram читает стандартные `og:title`/`og:description`/`og:image`;
- превью кешируется агрессивно и не обновляется само по себе;
- сброс кеша — через бота **`@WebpageBot`**: открыть его в Telegram, отправить `/start`, затем прислать URL страницы, которую нужно обновить;
- сброс кеша влияет только на **новые** пересылки ссылки — уже отправленные сообщения свои старые превью не обновляют никогда;
- если страница когда-либо отдавала `<meta name="robots" content="noindex">` во время обхода ботом Telegram, это тоже кешируется, и одного удаления `noindex` недостаточно — нужно принудительно прогнать `@WebpageBot` заново.

Источники (вторичные, честно не официальные): [opengraphplus.com — Telegram caching](https://opengraphplus.com/consumers/telegram/caching), [opengraphplus.com — Telegram stale preview](https://opengraphplus.com/consumers/telegram/issues/stale-preview), [membertel.com — force refresh Telegram preview](https://membertel.com/blog/telegram-link-preview-update/).

### ВКонтакте

Официального аналога Facebook Sharing Debugger (веб-формы «вставь ссылку — проверь превью») у VK, судя по проведённому поиску, **нет**. Найденный официальный механизм — API-метод:

- **`pages.clearCache`**, документация метода: `https://dev.vk.com/ru/method/pages.clearCache` — **фетч этого URL не удался** технически (`dev.vk.com` не отдался инструменту в этой сессии), поэтому первоисточник не прочитан напрямую; описание метода и порядок действий взяты из вторичных русскоязычных источников:
  - нужно создать сообщество/приложение VK и получить сервисный `access_token` (Community → «Работа с API» → «Ключи доступа»);
  - вызвать метод с параметрами `url` (адрес для сброса кеша) + `access_token` (+ версия API);
  - успешный ответ — `1`.
- Стандартные теги — обычный OG-набор (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`); часто упоминаемая рекомендация по размеру картинки — **1200×630**, но это из вторичных SEO-гайдов, не из официальной спецификации VK; при отсутствии/несоответствии `og:image` VK, по тем же источникам, может подставить другую картинку со страницы (лого, первое изображение).

Пометка: это единственный «инструмент отладки» под VK, который удалось обнаружить — и это API-вызов с токеном, а не публичная веб-форма. Отдельной страницы вида «Отладка страниц» (как у Facebook) для VK найти не удалось.

Источники (вторичные — первоисточник dev.vk.com не открылся): [arutyunov.me — сброс кеша VK/FB/Telegram](https://arutyunov.me/blog/services/kak-sbrosit-kesh-vk-fb-i-telegram-dlya-opengraph-izobrazhenij/), [vekrosta.ru — очистка кэша OG](https://vekrosta.ru/help/view/188/), [seolt.ru — Open Graph на сайте](https://seolt.ru/blog/open-graph-na-sajte-vsjo-chto-nuzhno-znat).

### Max (российский мессенджер)

**Официальной документации по обработке og:image / превью ссылок для мессенджера Max не найдено.** Проверено напрямую: `https://dev.max.ru/docs-api` (WebFetch, 2026-09-15) — это исключительно документация Bot API (отправка сообщений, вложения, кнопки, webhook-подписки); ни слова про Open Graph, парсинг метатегов чужих сайтов или требования к превью-изображениям там нет. Косвенное свидетельство того, что клиент Max вообще как-то генерирует превью ссылок — упомянутый в поиске параметр Bot API, которым **можно отключить** автогенерацию превью при отправке ссылки ботом (то есть какой-то механизм есть), но что именно он читает (OG-теги? свой краулер? какие лимиты по весу/размеру картинки?) — не документировано публично нигде, что удалось найти.

Вывод по этому пункту делаю максимально честно: **если проект целится в превью Max — эти требования сейчас нужно выяснять эмпирически (тестовой отправкой ссылки) либо напрямую у команды Max, публичной спецификации нет.**

Источники: [dev.max.ru/docs-api](https://dev.max.ru/docs-api) (проверено — подтверждает отсутствие темы), общий контекст мессенджера — [vc.ru про MAX 2026](https://vc.ru/marketing/2793225-kak-sozdat-slinku-na-max) (не про og:image, общая справка).

---

## 4. Минимальный канон head-метаданных 2026

### Favicon-набор

Источник: **evilmartians «How to Favicon in 2026: Three files that fit most needs»** — URL сохранил исторический слаг `…-2021-six-files…`, но статья регулярно обновляется редакторскими пометками (в поисковой выдаче фигурируют и версия 2025, и 2026) — проверено фетчем 2026-09-15: [evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs).

Актуальный минимальный набор по статье:

| файл | назначение |
|---|---|
| `favicon.ico` (32×32) | легаси-фолбэк — часть краулеров/старых браузеров всё ещё стучится на `/favicon.ico` напрямую |
| `icon.svg` | основная масштабируемая иконка; внутри SVG можно использовать `@media (prefers-color-scheme: dark)` в собственном `<style>`, чтобы переключать светлый/тёмный вариант без JS и без второго файла |
| `apple-touch-icon.png` (180×180) | иконка для iOS «на экран домой» / Safari |
| `icon-192.png`, `icon-512.png` (+ маскируемый 512-вариант с `purpose: "maskable"`) | подключаются через `manifest.webmanifest`, нужны для Android/PWA-инсталляции |
| `manifest.webmanifest` | JSON, ссылается на 192/512-иконки |

HTML:
```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
```

Статья фокусируется только на иконках — `theme-color`/`color-scheme` в ней не рассматриваются.

### `theme-color` + `media="(prefers-color-scheme: …)"`

```html
<meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
```

Назначение — подкраска браузерного UI (адресная строка мобильного Chrome, сплэш-экран PWA и т.п.) под активную цветовую схему ОС.

**Важная находка 2026 года**: по вторичному источнику, **iOS 26 Safari перестал поддерживать `theme-color`** — вместо чтения меты Safari якобы ориентируется на фактический фон `<body>`/`<html>` или требует воркэраунда с фиксированным элементом. Это утверждение **не подтверждено первоисточником** (официальными WebKit release notes) в рамках этой сессии — помечаю как требующее ручной проверки на реальном iOS 26 перед тем, как полагаться на `theme-color` как единственный механизм подкраски UI.

Источник (вторичный): [thatdevpro.com — HTML meta theme-color: iOS 26 Safari Fix](https://www.thatdevpro.com/reference/html-meta-theme-color/); справочные страницы MDN существуют, но точные таблицы поддержки по браузерам через доступный в этой сессии поиск не вытянулись построчно (см. ниже) — [MDN meta theme-color](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color), [caniuse meta-theme-color](https://caniuse.com/meta-theme-color).

### `<meta name="color-scheme">`

```html
<meta name="color-scheme" content="light dark">
```

Сообщает браузеру, какие цветовые схемы поддерживает сама страница, чтобы он мог сразу (до применения CSS) отрендерить нативные элементы формы/скроллбары в подходящей схеме — рекомендуется использовать в паре с CSS-свойством `color-scheme` и `@media (prefers-color-scheme)`.

MDN: [developer.mozilla.org/.../meta/name/color-scheme](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme) — заголовок страницы подтверждён через поиск, детальное содержимое отдельным фетчем в этой сессии не вытягивалось (лёгкая, не полная проверка).

`prefers-color-scheme` (CSS media feature) имеет широкую поддержку современных браузеров — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme), [caniuse](https://caniuse.com/prefers-color-scheme) — точные версии браузеров через доступные в сессии инструменты не вытянуты построчно, только факт существования и общая формулировка «широкая поддержка».

---

## 5. `schema-dts` и валидация структурированных данных в CI

### schema-dts

- Актуальная версия на npm: **2.0.0**, лицензия **Apache-2.0**. Проверено: [registry.npmjs.org/schema-dts](https://registry.npmjs.org/schema-dts/latest) (2026-09-15).
- Репозиторий `google/schema-dts` выглядит активным на момент проверки: 556 коммитов, 4 открытых PR, 10 открытых issues (проверено фетчем GitHub 2026-09-15). В README прямым текстом: *«This is not an officially supported Google product»* — то есть проект живёт под эгидой Google-аккаунта, но без гарантий SLA; явной пометки об архивации/деприкейте на странице репозитория нет.
- Компаньон-инструмент **`schema-dts-gen`** (тоже npm) генерирует TS-типы из snapshot онтологии schema.org (`npx schema-dts-gen --ontology=https://schema.org/version/latest/schemaorg-all-https.nt`) — им же обновляют сам `schema-dts`; можно гонять самостоятельно, если нужны типы под кастомную/более свежую онтологию.

Источники: [registry.npmjs.org/schema-dts](https://registry.npmjs.org/schema-dts/latest), [github.com/google/schema-dts](https://github.com/google/schema-dts).

### Альтернативы schema-dts

- **Ручные TS-типы/интерфейсы** — ноль зависимостей, полный контроль, но ручное сопровождение при дрейфе онтологии schema.org.
- **Zod-схемы для JSON-LD** — не прямая замена: `schema-dts` даёт только compile-time проверку формы без рантайм-стоимости, а Zod валидирует в рантайме. Они дополняют друг друга (можно вручную описать Zod-схему под конкретные emit-формы JSON-LD и валидировать объект перед сериализацией), но это двойное сопровождение формы (тип + схема). Готового «генератора Zod-схем из schema.org» в рамках этого поиска найти не удалось — это не доказательство отсутствия (поиск не был исчерпывающим по этому конкретному под-вопросу), помечаю как неподтверждённое отсутствие, а не подтверждённый факт.

### CI-валидаторы структурированных данных (не браузерные)

Оба реалистичных кандидата на «CLI/Node-валидатор для CI» оказались мертвы:

- **`structured-data-testing-tool`** (npm) — последняя публикация, по данным поиска, около 6 лет назад (~2020) — не поддерживается.
- **`web-auto-extractor`** (зависимость предыдущего инструмента, извлечение микроданных/JSON-LD/RDFa из HTML) — последняя публикация около 8 лет назад (~2018) — не поддерживается.
- Активно поддерживаемого CLI/Node-эквивалента Google Rich Results Test в рамках этого поиска не найдено.

**Честный вывод**: в CI реалистично проверяется только (а) типовая корректность JSON-LD-объекта относительно типов `schema-dts` (компилируется — форма правильная) и (б) собственный Zod/JSON-Schema, вручную описывающий именно то, что проект эмитит (юнит-тест на сериализацию). Проверка «попадёт ли это в rich results» реальной автоматизации в CI в 2026 году, судя по этому исследованию, не имеет — она остаётся ручной операцией через `Google Rich Results Test` (`search.google.com/test/rich-results`) и/или отчёты Search Console; отдельно эти два URL/сервиса в рамках сессии не перепроверялись (общеизвестные, не фетчились).

Источники: [npmjs structured-data-testing-tool v3.2.0](https://www.npmjs.com/package/structured-data-testing-tool/v/3.2.0), [npmjs web-auto-extractor](https://www.npmjs.com/package/web-auto-extractor?activeTab=dependents).

---

## Список всех URL, использованных в исследовании

1. https://registry.npmjs.org/satori/latest
2. https://www.npmjs.com/package/satori?activeTab=readme
3. https://github.com/vercel/satori
4. https://github.com/vercel/satori/discussions/157 (WOFF2)
5. https://registry.npmjs.org/@resvg/resvg-js/latest
6. https://github.com/thx/resvg-js
7. https://www.npmjs.com/package/@resvg/resvg-js-linux-x64-musl
8. https://registry.npmjs.org/@vercel/og/latest
9. https://github.com/vercel/next.js/discussions/60003
10. https://nextjs.org/docs/messages/edge-runtime-deprecated
11. https://registry.npmjs.org/@napi-rs/canvas/latest
12. https://github.com/node-gfx/node-canvas-prebuilt/issues/77
13. https://registry.npmjs.org/canvas/latest
14. https://sharp.pixelplumbing.com/install/
15. https://registry.npmjs.org/sharp/latest
16. https://github.com/lovell/sharp/issues/4054
17. https://github.com/nuxt/image/issues/1253
18. https://playwright.dev/docs/docker
19. https://github.com/microsoft/playwright/issues/2826
20. https://ogp.me/
21. https://developers.facebook.com/docs/sharing/webmasters/images
22. https://opengraphplus.com/consumers/telegram/caching
23. https://opengraphplus.com/consumers/telegram/issues/stale-preview
24. https://membertel.com/blog/telegram-link-preview-update/
25. https://arutyunov.me/blog/services/kak-sbrosit-kesh-vk-fb-i-telegram-dlya-opengraph-izobrazhenij/
26. https://vekrosta.ru/help/view/188/
27. https://dev.max.ru/docs-api
28. https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs
29. https://www.thatdevpro.com/reference/html-meta-theme-color/
30. https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color
31. https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme
32. https://caniuse.com/meta-theme-color
33. https://registry.npmjs.org/schema-dts/latest
34. https://github.com/google/schema-dts
35. https://www.npmjs.com/package/structured-data-testing-tool/v/3.2.0
36. https://www.npmjs.com/package/web-auto-extractor?activeTab=dependents

Не удалось получить напрямую (зафиксировано честно, выводы по этим пунктам — из вторичных источников):
- `https://developer.x.com/...` — HTTP 402 Payment Required.
- `https://dev.vk.com/ru/method/pages.clearCache` — фетч не выполнен инструментом.
- `https://www.npmjs.com/package/schema-dts` — HTTP 403 (использован registry.npmjs.org вместо этого, что покрыло версию/лицензию).
