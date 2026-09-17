# ssr-frontend-template — итоги ресёрча (сводный синтез)

Дата: 2026-09-16. Цель — решить, **как** сделать второй фронт-шаблон экосистемы stit —
`ssr-frontend-template`: шаблон **контент-first индексируемого сайта** (лендинги, блоги,
каталоги, доки, корпоративные сайты; Google + Яндекс), с зашитым каноном SEO, обязательным
наследием SPA-шаблона (агентная обвязка, FSD + Steiger, гейт `pnpm check`) и деплоем одним
Node-образом в registry за Traefik/CrowdSec без CDN. Это сводка потоков двух раундов;
подробности, листинги и источники — в отчётах потоков (карта в конце).

Критерии выбора стека — `round2/brief-v2.md` (веса 25/20/15/15/15/10: качество выдачи ·
SEO-инструментарий · контент-пайплайн · зрелость/риск · совместимость с наследием · self-host).
React не обязателен; реюз React-кода SPA — бонус, реюз обвязки — обязателен.

---

## 1. Решения (TL;DR)

1. **Фреймворк — Astro 7.3 + `@astrojs/node`** (`output: 'static'` с адаптером `standalone`, Vite 8.3).
   Матрица с весами brief-v2 (§2): Astro **437,5** из 500, Nuxt 355, Next 347,5, SvelteKit 322,5,
   Eleventy 305. Единственный кандидат, у которого ноль JS на контентной странице — дефолт (гидрация
   на компонент, а не на маршрут), контент лежит внутри FSD-слайса, `src/pages` совпадает со слоем
   без ремапов и автоимпортов, а Node-процесс сам отдаёт prerender с TTFB 0,85 мс. Поле HTTP Archive
   2026-08: 71 % origin'ов на Astro с хорошим CWV на мобильном против 50,6 % SvelteKit, 38,3 % Next
   App Router, 28,6 % Nuxt. Запасные: **Nuxt 4.5** (максимум SEO из коробки, Vue-проекты) и
   **Next 16.3** (письменный LTS, ISR с общим кешем, тяжёлый React-кабинет); SvelteKit — не запасной.
   Условия пересмотра — §5.3.
2. **Подтверждено четырьмя spike'ами по единой таблице (§3):** JS на контентной странице — Astro
   **0 / 0 / 0 КБ** по умолчанию, SvelteKit 0 только с `csr = false` на layout (пол гидрации 42 КБ),
   Nuxt 134–146 КБ (0 лишь с `noScripts`, без клиентской навигации), Next 138–143 КБ (+17 КБ
   RSC-префетчей на просмотр); TTFB prerender 0,85 мс (Astro) / 0,86 (SvelteKit) / 1,9 (Nuxt) /
   3,5 (Next); образы 316 / 173 / 212 / 233 МБ; все четыре сами отдают prerender (провал Nitro у
   Start не повторился). У всех origin печётся на билде (`site`, `$env` при prerender, site-config
   Nuxt, `metadataBase`) — решается штамповкой плейсхолдера при старте (Astro 32 файла за 0–10 мс,
   Next 152 за < 1 мс) либо рендером на запрос. `X-Robots-Tag` на prerendered — только Traefik
   (исключение — `proxy.ts` Next). Честный 404 у Astro/Nuxt/SvelteKit из коробки, у Next — рецепт из
   пяти правил.
3. **Инструменты гейта (§4):** границы FSD держит **ESLint 10 + `eslint-plugin-boundaries@7` с
   `import/resolver`** + `no-restricted-imports` по `@/<layer>/*/*` (на фикстурах 17 из 17); Steiger —
   структурные правила (нашёл 6 из 12: fail-open на целях `.astro/.svelte/.vue`, слеп глубже первого
   уровня `pages`, `insignificant-slice` off); Biome 2.5 с `html.experimentalFullSupportEnabled`
   линтит `.astro` (не форматирует); `astro check`; Vitest 5 (`getViteConfig`, Container API);
   Playwright 1.63; size-limit 14; негативные фикстуры гейта обязательны. Попутно найден дефект
   SPA-шаблона: `boundaries` без резолвера — тихий no-op на `@/`-импортах.
4. **Имя и роль.** Репозиторий шаблона — **`ssr-frontend-template`** (имя стоит в публичном
   roadmap; в прозе роль — «шаблон индексируемого сайта: static-first, SSR по необходимости»).
   Форк потребителя — **`<org>/site`**, сервис в инфре `SVC=site` → `SITE_TAG` →
   `compose/site.yml` на корневом `${DOMAIN}` (перебивает always-on `landing`); проект может
   иметь одновременно `<org>/frontend` (SPA на `app.${DOMAIN}`) и `<org>/site`.
   `landing-template` из roadmap — **пресет** этого шаблона (`preset: landing | content-site | docs`
   в `service.md`), не отдельный репозиторий: рантайм, гейт, FSD, Dockerfile, STOP-контракт
   одинаковы; различаются reference-набор, бюджеты, обязательные kinds.
5. **Отдельный репозиторий**, родство с SPA — контрактом обвязки, не общим кодом:
   `docs/reference/kinship.md` (identical / near-identical / divergent) + advisory `pnpm kin:diff`.
   Общая npm-библиотека — нет. Идентичное ядро: правила `forward-only`/`comments`, `/plan`,
   `settings.json`, commitlint, `.nvmrc`/`.npmrc`, `shared/lib/{cn,invariant}`, **токен-слой
   `app/styles/index.css`** (чистый Tailwind v4 CSS — переезжает к любому финалисту).
6. **Архитектура контент-first (framework-neutral):** контент по умолчанию в git
   (Markdown + Zod-коллекции), шов `ContentSource` (`fs | http`) для CMS/API; Markdown
   компилируется на билде, на запрос собирается только страница; четыре режима рендера
   `static | cached | dynamic | client`; **абсолютные URL — только в `<head>`, JSON-LD, фидах,
   sitemap; в теле — корневые относительные**; редиректы — данные (`content/redirects.yaml`,
   301/410 сервером, `meta refresh` запрещён); i18n — параллельные каталоги + `translationKey`,
   непереведённое — 404, hreflang только для существующих переводов.
7. **Развилка «prerender ⊥ runtime `SITE_URL`»** (один образ на все среды против абсолютных
   URL, запечённых на билде): для Astro дефолт — **C: prerender + плейсхолдер `https://__site_origin__`
   + штамповка в entrypoint** (32 файла за 0–10 мс, один e2e-тест «в ответе нет плейсхолдера», HTML не
   предсжимать); **D: рендер на запрос + `memoryCache` + `routeRules`** — опция для контента из
   CMS/API (инвалидация `cache.invalidate({ tags })`; обязательны single-flight и прогрев —
   `memoryCache` не дедуплицирует промахи: 200 параллельных → 141 рендер; `/_image` на запрос
   300–420 мс и RSS до 360 МБ без `routeRules`); **A: build-arg** — только одна среда, явной строкой
   в `rendering.md`. `robots.txt`/`sitemap.xml`/`rss.xml`/OG/`healthz` — всегда on-demand.
8. **РФ-специфика (поток 14a, замеры 2026-09-16 с RU-машины):** шрифт по умолчанию — Wix Madefor
   Text (настоящий курсив, кириллица 13,8 КБ) + Onest, Astro Fonts API с `subsets: ['cyrillic','latin']`;
   юридический минимум — 152-ФЗ (политика ПДн на сайте, согласие чекбоксом, уведомление РКН,
   хранение в РФ; трансграничная передача ужесточена 265-ФЗ от 26.07.2026), прямой нормы о
   cookie-баннере нет; доставка заявки — `FORM_DELIVERY` из ≥ 2 каналов + durable-спул на диске
   (Telegram ограничивается РКН с 10.02.2026, бесплатный SMTP Яндекса/Mail.ru закрыт с июня 2026);
   капча по умолчанию `none`, при необходимости SmartCaptcha (35,6 КБ), reCAPTCHA (357 КБ) — никогда;
   Метрика (95,8 КБ) только после согласия, отдельная строка бюджета третьих сторон ≤ 120 КБ; домены
   GA4/GTM с RU-машины не открываются. Ландшафт CMS: Directus 12 ушёл на MSCL (Core 3 места /
   25 коллекций, ключ ежегодно) — исключён; «редактор без git» — Decap CMS поверх Gitea (PKCE,
   0 контейнеров); headless — Payload 3.89 (MIT) или свой Go-бэкенд; SaaS-CMS отклонён для РФ.
9. **SEO-канон** (MUST-ядро, полностью — `02-seo-canon.md`): всё индексируемое — в первом HTML
   (Google рендерит JS второй волной, dynamic rendering deprecated; Яндекс держит JS-рендеринг в
   бете и просит выключать его при SSR); честные 404/410/308; один канонический хост,
   `trailingSlash: never`; абсолютный self-canonical из `SITE_URL`; `robots.txt`/`sitemap.xml` из
   runtime config; staging закрыт тремя контурами; i18n через префикс пути без авторедиректов,
   полный взаимный `hreflang` + `x-default`; JSON-LD `Organization`+`WebSite` на корне,
   `BreadcrumbList`, `Article`/`Product` по типу, **без** `FAQPage`/`HowTo`/`SearchAction`;
   документ ≤ 2 МБ (лимит Googlebot; бюджет шаблона ≤ 100 КБ, потолок 300 КБ); Яндекс ≠ Google
   (разрешающая директива побеждает, `Host`/`Crawl-delay` мертвы, `Clean-param` жив,
   cross-domain canonical не поддерживается).
10. **Рантайм и деплой** (полностью — `04-runtime-deploy.md`): один Node-образ `node:24-alpine`,
    только выход сборки, non-root, `HEALTHCHECK /healthz`; `compose/site.yml` с двумя роутерами
    (apex + `www` → 301), Traefik `compress` (`encodings: [br, zstd, gzip]`, без
    `defaultEncoding: zstd`), Traefik-side healthcheck + `--wait` в `make bump`; кеш без CDN =
    кеш HTML в процессе + `no-cache`+ETag на HTML + `immutable` на хешированных ассетах; keep-alive
    Node > idle-таймаута Traefik; CrowdSec `crowdsecurity/rdns` + `seo-bots-whitelist`, троттлинг
    ботов только 429. Дефекты infra — **отдельный PR до любого сайта**: CrowdSec не видит
    HTTP-трафик Traefik (access-log в stdout, `acquis.yaml` читает несуществующий файл);
    `sslRedirect` в `secure-headers` удалён в Traefik v3.
11. **Обвязка:** `docs/stack` — **13 kinds** (11 обязательных + 2 условных): `service`(+`preset`,
    `infra-svc`), `runtime`, **`content`**, `routing`, **`rendering`**, **`images`**, **`seo`**,
    `styling`(+шрифты), `api`(усл.), **`analytics`**(усл.), `observability`, `config`, `dependencies`;
    порядок волн `service → runtime → content → routing → rendering → images → seo → styling →
    api → analytics → observability → config → dependencies`. Правила: `render-safety`,
    `seo-invariants`, `content-invariants`, `cache-and-rendering`; переписанные `env-local`,
    `tests-pipeline`. Скиллы: +`/seo-audit`, +`/content`; `/scaffold` с пятью типами
    (`page`, `entity`/`collection`, `feature`=остров, `widget`=секция, `route`=server route);
    `/de-template` вычищает демо-контент и SEO-заглушки; `/release` — Node-образ, `SVC=site`.
12. **Cross-repo — 7 репозиториев** в фиксированном порядке (канон `corp-infra-template/docs/ecosystem.md`
    первым, витрина `stit-public` последней — освежающим PR); `go-backend-template` — условно.
13. **Реализация:** ресёрч закрыт потоками Opus; шаблон реализуется по плану §12 (фазы, гейты);
    исполнитель — Fable по этому синтезу и отчётам потоков (они написаны так, чтобы код писался
    без повторного ресёрча).

---

## 2. Ландшафт: матрица с новыми весами (поток 07, полностью — `round2/07-landscape-v2.md`)

Веса `brief-v2.md`: качество выдачи 25 · SEO-инструментарий 20 · контент-пайплайн 15 ·
зрелость и риск 15 · совместимость с наследием 15 · self-host одним Node-образом 10.
Версии сверены по npm 2026-09-16.

| кандидат | выдача ·25 | SEO ·20 | контент ·15 | зрелость ·15 | наследие ·15 | self-host ·10 | **Σ/500** |
|---|---|---|---|---|---|---|---|
| **Astro 7.3.2** | 5 | 4 | 5 | 3 | 4,5 | 4,5 | **437,5** |
| **Nuxt 4.5.2** | 3 | 5 | 4 | 3 | 2 | 4,5 | **355** |
| **Next.js 16.3.5** | 3 | 4,5 | 2,5 | 5 | 2 | 4 | **347,5** |
| SvelteKit 2.70.3 | 4 | 2 | 2 | 4 | 3,5 | 4 | 322,5 |
| Eleventy 3.1.6 | 5 | 3 | 4 | 2 | 1 | 1,5 | 305 |
| Hono 4.13 + JSX | 4,5 | 1 | 1 | 3,5 | 4 | 4 | 300 |
| TanStack Start 1.168 | 2,5 | 4 | 1 | 2 | 5 | 2,5 | 287,5 |
| Qwik 2.0.0-beta.43 | 3 | 3 | 3 | 1 | 4 | 3 | 285 |
| React Router 8.4.0 | 2 | 2 | 1 | 4 | 4 | 3,5 | 260 |
| SolidStart 2.0.5 | 3,5 | 1,5 | 1 | 2 | 4 | 2 | 242,5 |
| Fresh | — | — | — | — | — | — | выбывает (Deno-only) |

**Разрыв Astro → Nuxt = 82,5 балла (17 % шкалы)** — не пограничный: Astro берёт 50 баллов на
«качестве выдачи» (единственный с гидрацией **на компонент**, а не на маршрут; поле HTTP
Archive 2026-08: 71 % origin'ов с хорошим CWV при медиане JS 396 КБ против 28,6 % / 1053 КБ у
Nuxt), 15 — на контент-пайплайне (Content Layer + `astro/zod` = Zod 4 + loaders из CMS/API +
стабильные live collections; контент лежит где угодно — влезает в `entities/<name>/content/`)
и 37,5 — на наследии (`src/pages` = маршруты **совпадает** с FSD-слоем; `_`-префикс даёт
колокацию; `src/components`/`src/layouts` не обязательны; автоимпортов нет). Проигрывает
только SEO-инструментарию (−20: sitemap build-time и без SSR-роутов, нет hreflang-хелпера,
нет OG-генератора, robots руками). Nuxt и Next разделяют 7,5 балла — шум: Nuxt берёт
SEO-пакетом (`@nuxtjs/seo` 5: sitemap+robots+schema-org+og-image+link-checker,
`useLocaleHead`, runtime `NUXT_SITE_URL` для SSR-ответов), Next — зрелостью (единственная
письменная LTS-политика). SvelteKit — лучший «ноль JS» на маршрут (`csr = false` не эмитит
`start.js`) и лучший AI-тулинг (`llms-full.txt`, официальный MCP), но **ноль SEO-инструментария**
(`canonical`/`hreflang` — 0 вхождений в доках) и ноль контент-слоя.

**Главная новость раунда: дыра Astro закрыта.** В Astro 7.0 появился **стабильный серверный
кеш HTML**: `cache: { provider: memoryCache() }` + `routeRules` с `maxAge`/`swr`/`tags`,
императивный `Astro.cache.set/invalidate({ tags | path })`, заголовок `X-Astro-Cache:
HIT|MISS|STALE`, ключ без cookie/UA с авто-вырезанием `utm_*`/`fbclid`/`gclid` — ровно
требование §6.2 (D), **без беты** (в отличие от TanStack Start с `nitro@3-beta`). В dev
`cache.enabled === false` — проверять только prod-сборкой.

**Факты зрелости, меняющие картину (проверено 2026-09-16):**
- **Cloudflare приобрёл Astro** (16.01.2026): куплена компания, код остаётся MIT, governance
  и roadmap открытые, «deploy anywhere»; индикатор в нашу пользу — в 7.x CDN-провайдеры кеша
  экспериментальны и равноправны, дефолт — `memoryCache()` (self-host). Остаточный риск —
  среднесрочный дрейф приоритетов, не блокирующий.
- Astro: **2 мажора за 6 месяцев** (6.0 — 10.03, 7.0 — 22.06), поддержка «security fixes only
  for one previous major»; 7.0 сменил Markdown-процессор на Sätteri (Rust) — remark/rehype
  подключаются через `@astrojs/markdown-remark` явно; компилятор строгий к незакрытым тегам;
  `src/fetch.ts` зарезервирован; **`llms.txt` нет**.
- **Гейт переезжает на ESLint 10**: `eslint-plugin-astro` ≥ 2.0.0 требует `eslint >= 10`
  (последняя для 9 — 1.7.0).
- Nuxt 4.5.2 стоит на **стабильном `nitropack@2.13.4`** (не на beta Nitro 3), но **Nuxt 5
  «Scheduled» ~Q4 2026** с переездом на Nitro v3 / h3 v2 (ветка `main` уже `5.0.0-0`);
  в Nitro v2 нет `.invalidate()`; доки по голому `nitro.build` — уже v3.
- SvelteKit **3.0 в `next`** (`$lib` → `#lib`, `$env/*` и `$app/environment` к удалению);
  `kit.files.routes` — «undeprecated» в 2.54, но с `@deprecated`-тегом в типах; `$env/dynamic`
  при prerender запекается, `/_app/env.js` приезжает после HTML.
- Next 16.3: `cacheComponents` — top-level (PPR по умолчанию при включении), `'use cache'`,
  `revalidateTag(tag, profile)`; ISR на локальном диске без CDN (`x-nextjs-cache`); `proxy.ts`
  вместо middleware; `robots.ts` с полем `other` (⇒ `Clean-param`); **метрики размера JS убраны
  из `next build`**; Active LTS + Maintenance LTS 2 года.
- TanStack Start — по-прежнему RC, серверный кеш только через beta-Nitro, prerender не
  отдаётся Nitro-сервером; поле — 23,4 % good CWV (худшее в выгрузке) → 7-е место.
- SolidStart 2.0.5 (GA 04.08.2026): `experimental.islands` типизирован `false`; **прод-сервера в
  поставке нет** (default-export билда — H3-приложение), всё делегировано beta-Nitro; нет
  метаданных/sitemap/i18n/image/MDX. Qwik 2: beta в `latest`, **официальных доков на v2 нет**
  (qwik.dev документирует v1), баг over-preloading открыт. Eleventy 3.1.6: v4 — alpha,
  ребрендинг в Build Awesome (Pro-подписка), серверного слоя нет. Fresh — Deno-only.

**Мини-бенчмарк «пол JS»** (одинаковая статическая страница без единого обработчика, gzip):
Eleventy **0 Б** · SolidStart **15,3 КБ** · Qwik 2 **42,7 КБ** (38,6 из них — ядро через
`modulepreload`) · React Router 8 **106,9 КБ**. Разница HTML-first ↔ SPA-рантайм — два
порядка. Цифры Astro/Nuxt/SvelteKit/Next — в §3 по единой таблице spike'ов.

**Два ответа брифа.** (1) *Лучше Astro для контент-first без CDN нет никого*: SvelteKit
чище на маршрут, но гранулярность острова < гранулярности маршрута, и −115 баллов на SEO и
контенте; «настоящий ISR только у Next» неверно с Astro 7.0, а мультиинстанс с общим кешем в
нашей инфре невозможен (`container_name` ⇒ нет `replicas`); Eleventy — 0 JS, но весь серверный
слой пришлось бы писать отдельно. (2) *React-first (Next/Start) правильнее*, когда центр
тяжести уходит с документа на сессию: кабинет — основной сценарий; > 50 % маршрутов за
`guard ≠ public`; реюз кода SPA-шаблона имеет денежную величину (Start — 5/5 по наследию);
нужен ISR с общим кешем на нескольких инстансах (Next); требуется письменный LTS (Next).
Триггер для `rendering.md` форка: «доля индексируемых публичных маршрутов < 50 % или кабинет —
основной сценарий ⇒ форкать `spa-frontend-template`».

**Astro: что придётся дописать самим** (каждый пункт = будущий файл; полный список с адресами —
07 §5.1): A-1 `robots.txt` endpoint из runtime (`ROBOTS_POLICY`, `Clean-param`) · A-2
`sitemap.xml` endpoint поверх `getCollection()` (штатный `@astrojs/sitemap` — build-time, без
SSR-роутов) · A-3 RSS endpoint · A-4 `resolveOrigin()` из `SITE_URL` + ассерт Host · A-5
единый `<Seo>`-компонент (title-шаблон, canonical, OG, twitter, noindex) · A-6 hreflang поверх
`getAbsoluteLocaleUrlList()` · A-7 JSON-LD фабрики + Zod-тест · A-8 OG-генератор (satori +
resvg/sharp, дисковый кеш) · A-9 редиректы как данные · A-10 `/healthz` + graceful shutdown
(у `@astrojs/node` нет ни того, ни другого) · A-11 штамповка `__SITE_ORIGIN__` (только при
prerender) · A-12 форма с honeypot/time-trap без JS · A-13 preview/draft · A-14 вебхук
`/internal/revalidate` → `cache.invalidate({ tags })` · A-15 `X-Robots-Tag` middleware · A-16
прогрев кеша · A-17 `size-limit` + бюджет HTML · A-18 `content-invariants` + `check:content` ·
A-19 `<YandexNoIndex>` + `Clean-param` · A-20 обвязка компонентных тестов `.astro` (Container
API экспериментален — `.astro` покрывается Playwright'ом).

**Ловушки Astro 7** (07 §5.2): кеш выключен в dev; заголовок `X-Astro-Cache`; sitemap не
покрывает SSR-роуты; `server:defer` при пропсах > 2048 байт переключается на POST (не
кешируется); Sätteri вместо remark; строгий Rust-компилятор, `compressHTML: 'jsx'`;
Steiger не резолвит импорты **в** `.astro` и не видит inline-`<script>` (митигация — канон
«импорт только через `index.ts`» + `no-restricted-imports`); `sharp` в образе через
`pnpm.supportedArchitectures` с `libc: musl`; мажор каждые ~3,5 месяца.

---

## 3. Эмпирика: четыре spike по единой таблице (потоки 08–11)

Один и тот же эталонный сайт (`brief-v2.md`: 12 постов Markdown + Zod, пагинация, `/en/*`,
контакт-форма без JS, `/now`, `/old`→301, честные 404, `robots.txt`/`sitemap.xml`/`rss.xml`/
`healthz`, FSD-раскладка, полный гейт, Docker `node:24-alpine`) собран на четырёх
фреймворках и измерен одинаково (Playwright для JS/CSS по проводу, `curl -w` медиана 20 для
TTFB, `ps`/`docker stats` для RSS, 200 параллельных запросов на холодный ключ для кеша).
Все цифры — 2026-09-16, машина под нагрузкой параллельных агентов (абсолютные значения
шумные, соотношения надёжны).

### 3.1 Сводная таблица

| метрика | **Astro 7.3.2** (static + node standalone) | **Nuxt 4.5.2** (Nitro 2.13.4) | **SvelteKit 2.70.3** (adapter-node) | Next 16.3.5 (standalone) |
|---|---|---|---|---|
| `pnpm check` | **12 с**, зелёный | 28–31 с, зелёный | 42 с, зелёный | ≈ 25–30 с, зелёный (tsc 7,4 с, ESLint 8–10 с, Steiger 4,6 с, Biome 1 с, Vitest 0,4 с, e2e 3,3 с) |
| образ `node:24-alpine` | 316 МБ (выход не self-contained; с прунингом gnu-бинарников) | 212 МБ (`.output` self-contained, но `server/node_modules` 59 МБ) | **173 МБ** (self-contained, `node_modules` не нужен) | **233 МБ** (`standalone` 67 МБ, из них 59 МБ `node_modules` с libvips под обе libc; `pnpm.supportedArchitectures` −18 МБ не проверено) |
| RSS idle / под нагрузкой | 99 / 126 МБ (`ps`) | 95 / 167–184 МБ (`ps`); 39,5 / 112 МиБ (cgroup) | 97 / 114 МБ (`ps`); 44–48 МиБ (cgroup) | 107 / 162–176 МБ (200 параллельных ISR), 324 МБ после серии с `force-dynamic` `/sitemap.xml` (`/proc`) |
| HTML главной / поста (gzip) | **2,5 / 2,8 КБ** | 4,3 / 5,6 КБ | 2,2 / 2,7 КБ | 4,8 / 5,7 КБ (внутри — инлайн RSC-пейлоад 10–18 КБ raw) |
| **JS на контентных страницах** (`/`, пост, about) | **0 / 0 / 0** (по умолчанию, ничего не выключая) | 134 / 146 / 0 КБ (0 только с `noScripts` на маршрут, тогда без клиентской навигации) | **0 / 0 / 0** (`csr = false` на layout) | **143 / ≈140 / 138 КБ** — рантайм React + app-router, конфигом не снижается; в браузере 145,7 КБ на любой странице + 17,3 КБ RSC-префетчей `<Link>` на просмотр |
| JS на `/contact` (интерактив) | 93 КБ (React-остров; Preact/vanilla дали бы 3–15 КБ) | 102 КБ (полная гидрация маршрута) | 42 КБ («пол» = весь клиентский Kit) | 140 КБ (сам остров формы — 2,4 КБ gzip, остальное — общий рантайм) |
| гранулярность гидрации | **компонент** (`client:*`) | маршрут (`noScripts` всё-или-ничего; `.server.vue` не помогает) | маршрут (`csr`) | компонент (`'use client'`), но «пол» ≈ 138 КБ грузится всегда |
| TTFB главной / поста (медиана) | **0,85 / 0,92 мс** (prerender с диска) | 1,9 / 2,0 мс (prerender); 1,7–6 / 3,7 мс swr | 0,86 / 0,87 мс (prerender); 1,8–2,1 / 1,1–2,2 мс LRU-хит | 3,5 / 3,2 мс (prerender через rewrite локали; `/en` без rewrite 1,7 мс); `/now` 5,4 мс |
| prerender отдаёт сам процесс | ✅ (провал Nitro у Start не воспроизводится) | ✅ | ✅ | ✅ (`x-nextjs-cache: HIT`, `x-nextjs-prerender`) |
| кеш HTML в процессе | `memoryCache` + `routeRules` (Astro 7, стабильно); **без single-flight** (200 → 141 рендер); `cache.invalidate({tags\|path})` ✅ | `swr` (Nitro 2): **single-flight** (200 → 1), инвалидации API нет, `X-Cache` нет | **пишется руками** (~120 строк: LRU + SWR + single-flight + HMAC-ревалидация) | **ISR fs-кеш из коробки** (`revalidate`, `s-maxage`/swr, `x-nextjs-cache HIT\|MISS\|STALE`, `revalidatePath`/`revalidateTag`); коалесинг неполный (200 → 6 рендеров); **`revalidatePath` × `dynamicParams=false` = вечный 404** до рестарта; ISR пишет в `.next/server/app` → несовместим с `read_only` |
| runtime `SITE_URL` в prerendered HTML | ❌ (build-time `site`) → **C: штамповка** 32 файлов за 0–10 мс, работает | ❌ (и sitemap нельзя «разстатичить») → только **swr** (две env-переменные) | ❌ → **D** (без prerender; prerendered URL минуют `handle`) или C | ❌ (`metadataBase` печётся) → **C: штамповка** 152 файлов в `.next/server/app` за < 1 мс (плейсхолдер обязан быть валидным URL — `https://site-origin.invalid`); G — `revalidatePath` при старте перерисовывает статику с текущим env |
| `X-Robots-Tag` на prerendered (staging) | ❌ недостижим ничем — **только Traefik** | ❌ на статике | ❌ на статике | ✅ из `proxy.ts` — единственный из четырёх; `<meta robots>` в prerender остаётся `index` (Google берёт более строгую директиву) |
| `/about/` (нормализация) | 301 (адаптер; канон просит 308) | A: 200 дубль / B: 301 (свой middleware) | **308** (адаптер) | **308** (`trailingSlash: false`) |
| `/old` · 404 · `/xx` | 301 · 404 · 404 | 301 · 404 · 404 | 301 · 404 · 404 | 301 · 404 **только по рецепту из 5 правил** (`dynamicParams=false` + `globalNotFound` + локаль заголовком + без `loading.tsx` + фолбэк словаря), иначе 404 с пустым `<body>` · 404 |
| graceful shutdown / keep-alive | ❌/❌ в адаптере → обёртка 25 строк (`ASTRO_NODE_AUTOSTART=disabled`) | ✅ (`NITRO_SHUTDOWN_*`) / дефолт 5 с | ✅ (`SHUTDOWN_TIMEOUT`) / ✅ `KEEP_ALIVE_TIMEOUT` env | ⚠️ SIGTERM обрабатывается, но 24 из 40 запросов в полёте оборваны, а у `server.close()` нет таймаута (однажды процесс не вышел за 5 минут) — `docker stop -t 15…30` обязателен, свой дренаж только через `NEXT_MANUAL_SIG_HANDLE` / ✅ `KEEP_ALIVE_TIMEOUT=65000` |
| сжатие в процессе | нет | только предсжатая статика | предсжатая статика (`precompress`) | только gzip (`compress: true`); brotli не умеет |
| SEO из коробки | sitemap (build-time, без SSR-роутов), RSS, i18n-хелперы, redirects, `astro:assets`; **свой** `<Seo>`, hreflang, robots, sitemap, OG | **Nuxt SEO suite**: sitemap+i18n, robots (3 контура одной env), schema-org `@graph`, og-image (satori), `useLocaleHead`; 26/38 MUST ✅ | **ничего** — `<svelte:head>`, статусы; всё своё (~500 строк) | **лучший инструментарий**: Metadata API (`alternates.canonical/languages`, `metadataBase`, OG/Twitter, `robots`), `app/sitemap.ts` с hreflang, `app/robots.ts` (+`other` под `Clean-param`), `opengraph-image.tsx` (satori, alpine), `next/font`, `redirects()` с кодами; но `s-maxage=31536000` без `max-age` на статике (переопределять), `hrefLang` в регистре React |
| контент-слой | Content Layer + `astro/zod` (Zod 4), `glob({ base: 'src/entities/post/content' })`, HMR, live collections | Nuxt Content 3 + Zod 4, `cwd` в слайсе ✅, SQLite (`node:sqlite`), WASM-SQLite 1,1 МБ в бандле | mdsvex + `import.meta.glob` + gray-matter + Zod (~40 строк); barrel тянет контент в клиент | **нет**: `gray-matter` + `unified` + Zod руками, `outputFileTracingIncludes` обязателен для `.md` в standalone; `content-collections` 0.5 — внешняя 0.x-зависимость |
| FSD | `src/pages` = слой ✅, `_`-колокация ✅, без автоимпортов ✅; навязано 4 файла в `src/` (реэкспорты) | `srcDir`+`dir.*` ремап, `autoImport: false` + `components.dirs: []` обязательны, любой `.vue` в pages = маршрут, `src/components/OgImage/` навязан | `kit.files.*` **deprecated**, колокация свободна, `$lib`=shared | `src/pages` **зарезервирован** (любой файл валит сборку) → слой в `src/views` (Steiger его не видит, границы держит только ESLint `boundaries` 7) либо `pageExtensions` с удвоенными суффиксами и потерей `robots.ts`/`sitemap.ts`; `proxy.ts` вне слоёв; `app` = маршруты + FSD-корень (2 правила Steiger off) |
| гейт на формате компонентов | Biome линтит `.astro` (с флагом), **не форматирует**; ESLint 10 обязателен; Steiger видит frontmatter | Biome форматирует+линтит `.vue` (с флагом); ESLint 10 + `@nuxt/eslint`; `vue-tsc` 17–19 с | Biome форматирует+линтит `.svelte` (с флагом); ESLint 9 достаточно; `svelte-check` | `.tsx` родной: Biome / ESLint 9 (`eslint-config-next` flat нативно) / Vitest / Playwright ✅; Steiger слеп к `views`; `size-limit` — только свой (Next 16 не печатает размеры бандлов); **`next dev` сам дописывает управляемый блок в `CLAUDE.md`/`AGENTS.md`** и восстанавливает его после удаления |
| самописное для канона | ~10 вещей ≤ 2 ч каждая (обёртка сервера, штамповка, config, sitemap/robots/RSS, `<Seo>`, hreflang, форма PRG, single-flight/прогрев, прунинг образа) | ~200 строк (нормализация URL, RSS, healthz, OG-шаблон, sitemap-схема) | ~500 строк (кеш, SEO, sitemap, robots, RSS, config, OG) | 12 вещей (11 §10.4): тонкий `page.tsx` → `views`, size-limit по HTML, alias `server-only`, штамповка, `global-not-found` + локаль заголовком + запрет `loading.tsx`, режим git/CMS без смешения, контент-слой целиком, musl-arch, override `Cache-Control`, зачистка `x-middleware-rewrite` |
| оценка потока (самооценка по весам brief-v2) | ≈ 84/100 | ≈ 85/100 | ≈ 77/100 | самооценки нет; матрица 07 — 347,5 (выдача 3 · SEO 4,5 · контент 2,5 · зрелость 5 · наследие 2 · self-host 4), все оценки 07 подтверждены spike'ом (§22 отчёта 11) |

Самооценки spike'ов ставились разными агентами и не калиброваны между собой; сравнивать надо
строки таблицы, а не итоги. Подробные измерения и ловушки — ниже по фреймворкам.


### 3.2 Astro


| метрика | значение (A/C = `output: 'static'` + node standalone; D = `output: 'server'` + `memoryCache`) |
|---|---|
| `build` | 5,9 с холодный (3,9 с — 168 вариантов картинок) / 1,85 с тёплый; D — 1,9 с (картинки не генерятся) |
| выход сборки / образ | 4,2 МБ / **315,7 МБ** (выход не self-contained: `astro` тянет vite/rolldown/esbuild/lightningcss в runtime-deps; с прунингом gnu-бинарников 388 → 316 МБ) |
| HTML главной raw/gzip | 8037 / **2467 Б** |
| HTML поста raw/gzip | 8298 / **2804 Б** |
| JS главной / поста / about / blog / en (gzip) | **0 / 0 / 0 / 0 / 0** (Playwright: 0 script-ресурсов; единственный `<script>` — `ld+json`) |
| JS `/contact` (React-остров `client:idle`, gzip) | **93 224 Б** (react-dom 65,7 + остров/devalue 24,5 + react 3,0) |
| CSS (gzip) | 3418 Б (один файл) + ~2 КБ inline от `image.responsiveStyles` |
| шрифты | 67 КБ (cyrillic 18,7 + latin 48,3, `unicode-range`; `@fontsource` даёт `swap`, канон просит `optional`) |
| обложка | `<picture>` AVIF→WebP→JPEG, srcset 480/800/1200 + `sizes`, AVIF 800w **2,8 КБ**; в D — `/_image` на запрос: 300–420 мс без routeRule, 3 мс с `maxAge` |
| TTFB `/` медиана | **0,85 мс** (prerender с диска); D: 1,1–2,3 мс тёплый / 126 мс холодный |
| TTFB `/blog/<slug>` · `/now` · `/healthz` | 0,92 · 2,2 · 1,1 мс |
| RSS idle / 400 параллельных | 99 / 126 МБ (A/C); D 102 / 153 МБ; **D после 50 параллельных `/_image` — 360 МБ и не возвращается** |
| рендеров на 200 параллельных (холодный ключ, D, рендер 300 мс) | **141** (single-flight нет в `memoryCache`); при быстром рендере — 1 |
| `/old` · `/blog/net-takogo` · `/xx` · `/about/` | **301** (настоящий, адаптер выключает `meta refresh`) · 404 · 404 · **301** (не 308, зашито в адаптере) |
| prerender отдаёт сам процесс | **да**, байт-в-байт с диска, `ETag`/`Last-Modified` — провал Nitro (`06` §7.2) не воспроизводится |
| заголовки | `_astro/*` — `immutable` на GET (на HEAD теряется — баг `send`); HTML — `public, max-age=0` + weak ETag; сжатия нет вовсе (жмёт Traefik); `X-Astro-Cache` в D |
| Googlebot | полный HTML: h1, текст, `<picture>`, JSON-LD (`Article`+`BreadcrumbList`; `Organization`+`WebSite`), hreflang ru/en/x-default, OG |
| dev | старт ~3 с (демон `astro dev`), HMR контента ~1 с, новый `.md` = новый URL; демон умеет «залипать» (`Content config not loaded`) — `astro dev stop` + `rm -rf .astro` |
| graceful shutdown / keep-alive | **у адаптера нет** (SIGTERM за 30 мс рвёт запрос; `Keep-Alive: timeout=5`) — обёртка `docker/server.mjs` через `ASTRO_NODE_AUTOSTART=disabled` + `startServer()` даёт дренаж (`docker stop` 0,26 с) и `keepAliveTimeout=65` |
| гейт | `pnpm check` **exit 0 за 12 с**; Playwright 9/9; `astro check` 0 ошибок; ESLint 10 + `eslint-plugin-astro@3`; Biome линтит `.astro` с флагом, **но не форматирует**; Steiger видит frontmatter, ловит cross-slice/вверх/deep-import `.astro→.ts`, **слеп** к цели `.astro` и к `export … from`; Vitest 5 с `getViteConfig` + Container API |
| развилка A/C/D | **C** (плейсхолдер `https://__site_origin__` — голый `__SITE_ORIGIN__` Astro отвергает; штамповка 32 файлов, включая 6 `dist/server/chunks/*.mjs`, за 0–10 мс на старте; выдача идентична A; HTML не предсжимать). D работает (`cache.invalidate({tags|path})` ✅), но платит `/_image` и лавиной рендеров без single-flight. A ломает 4 MUST (I-7, I-11, I-15, M-3). **`ROBOTS_POLICY` на prerendered недостижим ничем** (ни middleware, ни `src/fetch.ts`, ни `staticHeaders`) — только Traefik `customResponseHeaders` |
| самописное (~10 вещей, каждая ≤ пары часов) | `docker/server.mjs` (25 строк), `entrypoint.sh` штамповка, `shared/config` (Zod по env), свой `sitemap.xml`/`robots.txt`/RSS (runtime origin; `@astrojs/sitemap` не подключать), `shared/seo/urls.ts` (`astro:i18n` привязан к build-time `site`), эндпоинт формы с PRG-303 (Actions на prerendered-странице без JS **молча не работают**), single-flight/прогрев для D, прунинг `node_modules` в Dockerfile, правила `.claude/rules` |
| оценка потока | выдача 24/25 · SEO 15/20 · контент 14/15 · зрелость 12/15 · наследие 12/15 · self-host 7/10 → **≈ 84/100** |

Критичные ловушки Astro (08 §7): (1) **`build.format: 'file'` + node-адаптер → 404 на `/blog`,
`/en`** (статик-хендлер видит каталог); только `'directory'`; в dev не воспроизводится;
(2) **Astro Action, реэкспортированный из `index.ts` слайса, убивает гидрацию острова**
(`defineAction() unexpectedly used on the client`) — server-only символы не в public API,
`src/actions/index.ts` импортирует `features/<slice>/api/action.ts` напрямую;
(3) `src/content.config.ts` должен импортировать коллекцию напрямую из модуля, не через
баррель (иначе dev «Content config not loaded»); (4) `sharp` обязан быть в `dependencies`;
(5) `session: false` (иначе fs-драйвер ломает `read_only`); (6) `[slug]` ↔ пагинация
коллизия в on-demand → пагинация на `/blog/page/<N>`; (7) server islands (`server:defer`) не
видны ботам (эндпоинт сам `noindex`) — только для персонализации; (8) `<ClientRouter />` =
+4,7 КБ gzip на каждую страницу — не включать; (9) `/index.html` отдаёт 200 (дубль,
canonical на `/`) — прикрыть в Traefik; (10) `experimentalDisableStreaming` доезжает до
манифеста, но curl'ом эффекта не видно — проверять иначе.

### 3.3 Nuxt


| метрика | значение (A = prerender; B = `swr: 600`) |
|---|---|
| `build` | 17–36 с (199 маршрутов prerender / 2 в swr); под нагрузкой до 74–83 с; `nuxt generate` 14 с |
| выход сборки / образ | `.output` 65–68 МБ (server `node_modules` 59 МБ: sharp 37, resvg 8,4) / **212 МБ**; в контейнере idle **39,5 МиБ** (cgroup), 112 МиБ после 200 параллельных |
| HTML главной raw/gzip | 13 209 / 4263 Б (по проводу 3,5 КБ br из prerender) |
| HTML поста raw/gzip | 18 144 / 5590 Б |
| HTML `/about` (`noScripts`) | 3916 / 1582 Б, **1174 Б по проводу**, **0 JS** |
| JS `/` · поста · `/contact` (по проводу) | **134–138 КБ** (18–21 файлов) · **146–150 КБ** · 102 КБ — без `noScripts` полная гидрация Vue+Nuxt+vue-i18n+unhead; `.server.vue`-острова экономят 3 КБ JS и добавляют 18 КБ JSON (хуже) |
| JS с `noScripts: true` на маршруте | **0** (весь маршрут без гидрации и клиентской навигации — «всё или ничего») |
| CSS (br) | 2,5 КБ (один `entry.css`) |
| шрифты | 65 КБ (latin + cyrillic сабсеты) |
| обложка | `<NuxtPicture>` AVIF→WebP→PNG, srcset 1w/768w; AVIF 768w **3,2 КБ**; IPX on-demand (`ipx@4.0.0-beta.1`) или `_ipx/` при prerender |
| TTFB `/` · поста · `/now` · `/healthz` | A: **1,87 · 1,95 · 7,4 · 2,2 мс**; B тёплый 1,7–6 · 3,7 · 4,6–20 · 3,1 мс; B холодный пост **10,7 мс** |
| RSS idle / 200 параллельных | 95 / 167–184 МБ (`ps`); +92 МБ после первой OG-картинки (satori+resvg) |
| рендеров на 200 параллельных (холодный ключ, B) | **1** (single-flight встроен в Nitro `swr`) |
| `/old` · `/blog/net-takogo` · `/xx/` · `/about/` | 301 · 404 · 301→404 · **A: 200 дубль** (статика раньше middleware) / **B: 301** (свой middleware; встроенной нормализации в Nuxt нет) |
| prerender отдаёт сам процесс | **да** (ETag + Last-Modified, тела идентичны) — провал Nitro у Start (`06` §7.2) не воспроизводится |
| заголовки | `/_nuxt/*` immutable + предсжатые `.br/.gz`; prerendered HTML — **без `Cache-Control`**; swr — `s-maxage=600, stale-while-revalidate` + weak ETag → 304; **`X-Cache` в Nitro 2.13.4 нет** (только в Nitro 3 — правка к `04` §2.7); динамика не сжимается |
| Googlebot | полный HTML: h1, canonical, JSON-LD `@graph` (`WebSite`+`Organization`+`WebPage`+`Article`+`BreadcrumbList`+`ImageObject`), 6 hreflang (`ru`, `ru-RU`, `en`, `en-US`, `x-default`), og:image; стриминг по умолчанию выключен, при включении bot-aware по `botRegex` |
| dev | Nitro готов за 7,6 с, первый 200 через 1,9 с; HMR контента/компонентов ~1 с; dev слушает только `[::1]` |
| graceful shutdown / keep-alive | shutdown встроен (`NITRO_SHUTDOWN_TIMEOUT` в **мс**, дожимает in-flight, `docker stop` exit 0); keep-alive — дефолт Node 5 с, env-ручки нет |
| гейт | `pnpm check` **28–31 с**, exit 0; e2e 8/8; `nuxt typecheck` 17–19 с; ESLint 10 + `@nuxt/eslint` + boundaries (только с `import/resolver`); Biome с флагом форматирует и линтит `.vue`; Steiger видит `<script setup>`; Vitest 5 + `@nuxt/test-utils` (`mountSuspended` несовместим с `autoImport: false` — только `mount`); `size-limit` только «весь граф» (315 КБ gzip) |
| развилка A/B | **B (`swr`) = вариант D канона без хаков**: `NUXT_PUBLIC_SITE_URL` + **`NUXT_PUBLIC_I18N_BASE_URL`** (две переменные!) меняют canonical/og/hreflang/robots/sitemap/RSS на рантайме; в prerender всё запечено, **sitemap нельзя «разстатичить»** (удаление файла → 500), `X-Robots-Tag` на статике не работает; API инвалидации в Nitro 2 нет (`useStorage('cache')` руками) |
| MUST-канон из коробки | 26 ✅ / 7 ⚠️ / 3 ❌ из 38 (нет нормализации URL I-5/I-6, staging 2 контура из 3 на статике) |
| самописное | ~200 строк (половина — тесты): нормализация URL (skip-лист `/__nuxt_island`, `/_nuxt`…), RSS, `/healthz`, `absoluteUrl()`, OG-шаблон в навязанном `src/components/OgImage/`, `defineSitemapSchema` + пагинация в sitemap руками, страничные бюджеты JS в e2e |
| оценка потока | выдача 20/25 · SEO 18/20 · контент 13/15 · зрелость 12/15 · наследие 13/15 · self-host 9/10 → **≈ 85/100** |

Критичные ловушки Nuxt (09 §7): (1) `image.dir` резолвится от `srcDir` — prerender IPX молча
даёт `IPX_FILE_NOT_FOUND` (фикс `image: { dir: '../public' }`); (2) **`i18n.baseUrl` перебивает
runtime site-config** (равный приоритет, пушится позже) — не задавать, использовать
`NUXT_PUBLIC_I18N_BASE_URL`; (3) **`better-sqlite3` не собирается на alpine** — `content.experimental.sqliteConnector: 'native'`
(node:sqlite), −17 МБ; (4) `nuxt-og-image` требует свой `src/components/OgImage/*.satori.vue`
(community-шаблоны запрещены в проде), тянет `playwright-core` 6,3 МБ при наличии Playwright в
devDeps (`ogImage.compatibility.*.browser = false`), `satori`/`resvg` нужны в `dependencies`;
(5) `@nuxtjs/sitemap` не видит коллекции без `defineSitemapSchema` в схеме; порядок модулей
(`@nuxtjs/seo` до `@nuxt/content`) значим; (6) любой `.vue` в `dir.pages` — маршрут;
`imports.autoImport: false` + `components.dirs: []` обязательны, иначе архитектурный гейт слеп;
(7) клиентский WASM-SQLite (1,1 МБ) собирается всегда; (8) `nitro.build` документирует Nitro 3,
не наш 2.13.4; (9) `server/routes/rss.xml.get.ts` ломает HEAD — без суффикса метода;
(10) **Nuxt 5 «Scheduled» ~Q4 2026 с Nitro 3 / h3 v2** — миграция серверного слоя впереди.

### 3.4 SvelteKit


| метрика | значение (A = prerender; D = SSR + LRU) |
|---|---|
| `build` | 5,6 с (A, тёплый) · 10,7 с чистая в контейнере (D) |
| выход сборки / образ | 5,2–5,6 МБ / **173 МБ** (`node_modules` в рантайме не нужен) |
| HTML главной raw/gzip | 7475 / 2232 Б (по проводу 1708 br при precompress) |
| HTML поста raw/gzip | 7277 / 2655 Б |
| JS главной / поста / about (gzip) | **0 / 0 / 0** (`csr = false`, ни одного `<script src>`, и в dev тоже) |
| JS `/contact` (остров, gzip) | **41 964 Б** — «пол» гидрации = весь клиентский Kit (Svelte 17,6 + роутер 13,8 + entry + paraglide), не остров |
| CSS (gzip) | 3819 Б (один файл) |
| шрифты | 2 файла, 67 КБ (cyrillic + latin по `unicode-range`) |
| обложка | `<picture>` AVIF→WebP→PNG, srcset 800/1600, AVIF 2,8/4,6 КБ (`@sveltejs/enhanced-img` через `import.meta.glob` с `query: { enhanced: true }`) |
| TTFB `/` медиана | A 0,86 мс · D 1,8–2,1 мс HIT / 56 мс первый MISS |
| TTFB `/blog/<slug>` · `/now` · `/healthz` | 0,87 · 2,3 · 1,1 мс (A); D HIT 1,1–2,2 мс |
| RSS idle / 200 параллельных | 97 / 114 МБ (`ps`); в контейнере 44–48 МиБ |
| рендеров на 200 параллельных (холодный ключ, D) | **1** (single-flight) |
| `/old` · `/blog/net-takogo` · `/xx/` · `/about/` | 301 · 404 (+noindex) · 404 · **308** |
| prerender отдаёт сам процесс | да (sirv), но **минуя `handle`**: нет `Cache-Control`, `X-Robots-Tag`, кеша, подмены origin |
| заголовки | `_app/immutable/*` — `immutable` + ETag + предсжатые `.br/.gz`; HTML — без `Cache-Control` (ставит наш хук); сжатия на лету нет |
| Googlebot/YandexBot | полный HTML, canonical, JSON-LD (`Article`+`BreadcrumbList`, `Organization`+`WebSite`) |
| dev | старт 3,9 с, HMR контента 335 мс, `--host` ок |
| graceful shutdown | SIGTERM → 52 мс; `KEEP_ALIVE_TIMEOUT`/`HEADERS_TIMEOUT`/`BODY_SIZE_LIMIT` — env адаптера |
| гейт | `pnpm check` **EXIT 0 за 42 с**; Playwright 8/8; ESLint 9.39.5 достаточно (`eslint-plugin-svelte@3`); Biome с флагом; Steiger видит `<script>`, ловит cross-layer и deep-import, `insignificant-slice` ложный → off |
| развилка A/C/D | **D** (только D закрывает канон: prerendered URL не проходят через `handle` → на staging A/C отдают `index, follow` + canonical на прод); C — штамповка 7–8 мс на старте + удаление `*.html.br/.gz`; A — только одна среда |
| самописное | ~500 строк: `shared/cache` (LRU+SWR+single-flight, 121) + хук, `/internal/revalidate` HMAC, sitemap с `xhtml:link`, robots, RSS, `shared/seo` (~170), OG через sharp на билде, runtime-config |
| оценка потока | **≈ 77/100** (выдача 24/25, SEO 10/20, контент 9/15, зрелость 12/15, наследие 13/15, self-host 9/10) |

Кросс-находки 10, важные для всех: (1) **`eslint-plugin-boundaries` молчит без
`settings['import/resolver'].typescript`** — алиас `@/…` считается внешним пакетом; в
текущем `spa-frontend-template/eslint.config.js` резолвера нет → правило там почти наверняка
не работает (чинить отдельной задачей); (2) **barrel + top-level вызовы** (`export const
Schema = z.object()`, `export const allPosts = build()`) не шейкаются и утаскивают zod /
gray-matter / все Markdown-тексты в клиентский граф (64,3 → 42,0 КБ после ленивых фабрик) —
правило «в `index.ts` слайса нет значений, полученных вызовом»; (3) `kit.files.*` — deprecated
(«use monorepos instead»), вся FSD-раскладка на нём; (4) SvelteKit CSRF: POST без `Origin` →
403, за Traefik нужен `ORIGIN`/`PROTOCOL_HEADER`; (5) paraglide по умолчанию отдаёт `/ru/*`
как дубль (200) — guard в `reroute`; (6) `gray-matter` разворачивает YAML-даты в `Date`.

### 3.5 Next.js

Контрольная точка React-first (`round2/11-spike-next.md`, код — `round2/spikes/spike-next/`):
всё из спецификации собралось и работает — `output: 'standalone'`, ISR с fs-кешем и
`revalidatePath`, `next/image` + `sharp` на alpine, `ImageResponse` (satori) на alpine, i18n
«дефолт без префикса» через `proxy.ts`, Server Action с прогрессивным улучшением, гейт
зелёный. Роль spike'а — показать **потолок React-first** и цену, относительно которой читаются
08–10.

| метрика | значение |
|---|---|
| `build` | 7,6 с вхолодную (43 страницы за 0,63 с) · 4,2 с с тёплым Turbopack-кешем |
| выход сборки / образ | `.next/standalone` 67 МБ (59 МБ `node_modules`: `next` 20 МБ, libvips под обе libc 37 МБ) / **233 МБ** |
| HTML главной / поста raw/gzip | 24 890 / 4 836 Б · 27 272 / 5 699 Б (инлайн RSC-пейлоад 10–18 КБ внутри) |
| JS `/` · `/about` · `/contact` (gzip, по ссылкам HTML) | **143,3 · 137,7 · 140,2 КБ**; в браузере 145,7 КБ на любой странице (префетч `<Link>`) + **17,3 КБ RSC-префетчей на просмотр** (11 запросов `?_rsc=`) |
| «ноль JS на странице без островов?» | **нет** — минимум рантайм React + app-router (≈ 138 КБ), конфигом не снижается |
| CSS / шрифты | 2,8 КБ gzip · 2 WOFF2 preload 67 КБ (`next/font`, `size-adjust`) |
| обложка | `next/image`: 8 кандидатов `srcset` через `/_next/image`, AVIF 4,4 / WebP 6,1 / PNG 6,2 КБ (w=828) по `Vary: Accept`, `<picture>` нет; fallback `src` — самый большой кандидат (3840) |
| TTFB медиана | `/` 3,5 мс (через rewrite локали) · пост 3,2 · `/en` 1,7 · `/now` 5,4 · `/sitemap.xml` 9,4 (парсит 12 MD на запрос) |
| RSS idle / нагрузка | 107 МБ / 162–176 МБ (200 параллельных ISR) / 324 МБ после серии с `force-dynamic` |
| 200 параллельных на холодный ISR | 6 MISS / 194 HIT, один ETag, 372 rps — коалесинг есть, но неполный |
| статусы | `/old` 301 · `/old-permanent` 308 · `/about/` **308** · `/ru/*` 301 наружу · `/xx` 404 · несуществующий пост — **404 только по рецепту** (иначе 404 с пустым `<body>`) |
| `Cache-Control` на HTML | статика `s-maxage=31536000` **без `max-age`** (канон P-15 — переопределять), ISR `s-maxage=N, stale-while-revalidate=…`, dynamic `private, no-store` |
| сжатие / keep-alive / SIGTERM | только gzip · `KEEP_ALIVE_TIMEOUT=65000` ✅ · дренаж неполный (24 из 40 в полёте оборваны), `server.close()` без таймаута и `closeAllConnections()` только в dev — однажды процесс не вышел за 5 минут; `docker stop -t 15…30` обязателен, свой дренаж — `NEXT_MANUAL_SIG_HANDLE` + `instrumentation.ts` |
| Googlebot без JS | полный HTML: h1, текст, canonical, `hrefLang`, JSON-LD (`@graph` Organization + WebSite; Article + BreadcrumbList) |
| гейт | typecheck 7,4 с · ESLint 9 + `eslint-config-next` flat · Biome (`css.parser.tailwindDirectives`) · Vitest 13 тестов (async RSC — вызов функции + `renderToStaticMarkup`) · Playwright 20/20 на standalone · size-limit «по странице» свой · Steiger слеп к `views` |
| развилка A/C/D | **C** — штамповка 152 файлов `.next/server/app` за < 1 мс (плейсхолдер `https://site-origin.invalid`; `__SITE_ORIGIN__` роняет `metadataBase`); G — `revalidatePath` при старте; `X-Robots-Tag` из `proxy.ts` доезжает и до prerender ✅ |
| самописное | 12 вещей (§10.4 отчёта): тонкий `page.tsx` → `views`, size-limit по HTML, alias `server-only`, штамповка, `global-not-found` + локаль заголовком + запрет `loading.tsx`, режим git/CMS, контент-слой целиком, musl-arch, override `Cache-Control`, зачистка `x-middleware-rewrite` |

Что подтверждено и что найдено:

1. **138 КБ gzip JS на странице без единого обработчика** — плата за RSC-модель; для
   контент-first без CDN это прямой счёт за трафик и минус к CWV (HTTP Archive 2026-08: Next App
   Router — 38,3 % origin'ов с хорошим CWV на мобильном при медиане 664 КБ JS).
2. **Честный 404 — рецепт из пяти правил**, и одно из них (`dynamicParams = false`)
   взаимоисключает вебхук-инвалидацию: `revalidatePath()` на таком маршруте даёт вечный 404
   (`NoFallbackError`) до рестарта контейнера. Режимы «git-контент» и «CMS-контент» выбираются
   заранее и не смешиваются.
3. **FSD стоит дорого**: `src/pages` зарезервирован Pages Router'ом — либо слой `views` (Steiger
   его не видит вовсе: кросс-слайсовый импорт внутри `views` не ловится), либо `pageExtensions`
   с `page.page.tsx`/`layout.page.tsx`/`route.route.ts` и потерей конвенций `robots.ts`/`sitemap.ts`.
4. **`cacheComponents` (PPR) — шаг назад** для контент-сайта: запрещает `revalidate`/
   `dynamicParams`/`dynamic`, ломает рецепт 404 и делает `robots.txt`/`sitemap.xml`/`rss.xml`
   статичными с origin билда.
5. **`read_only: true` несовместим с ISR** (пишет в `.next/server/app`, не в `.next/cache`);
   `x-middleware-rewrite` с внутренним хостом утекает клиенту; `metadataBase` варнит даже заданный.
6. **`next dev` правит агентную обвязку репозитория**: `generate-agent-files.js` при обнаружении
   AI-агента создаёт `AGENTS.md` + `CLAUDE.md` (`@AGENTS.md`) или делает upsert своего блока
   прямо в существующий `CLAUDE.md` и восстанавливает его после удаления — прямой конфликт с
   экосистемой, где `CLAUDE.md` — единственный источник правил. Митигация: закоммиченный свой
   `AGENTS.md` и правило «блок `nextjs-agent-rules` руками не править».
7. **Сильные стороны, лучшие в подборке**: единственный настоящий ISR без CDN из коробки; самый
   полный SEO-API (Metadata API, `sitemap.ts` с hreflang, `robots.ts`, `opengraph-image`,
   `next/font`); `next/image` на self-host; Active LTS до 2027, `llms.txt`; `.tsx` родной для
   всего гейта.

Вердикт потока: технически годен, архитектурно чужероден — не рекомендуется для профиля
«лендинги, блоги, каталоги, доки». Правильный выбор при > 50 % маршрутов за логином, ISR с общим
кешем на нескольких инстансах, требовании письменного LTS или при общей React-модели с
`<org>/frontend`. Все оценки матрицы 07 подтверждены (§22 отчёта).

---

## 4. Инструменты гейта × формат компонентов, FSD (поток 12, полностью — `round2/12-tooling-fsd.md`)

Всё проверено прогонами в `round2/spikes/tooling-lab/` (матрица 90 кейсов Steiger, фикстуры с
12 заложенными нарушениями, три раскладки маршрутов, Biome с флагом и без, Vitest 5 на трёх
форматах). Версии на 2026-09-16: `eslint` 10.10.0, `@biomejs/biome` 2.5.14, `vitest` 5.0.1,
`@playwright/test` 1.63.0, `size-limit` 14.0.0, `steiger` 0.6.0 + plugin 0.7.0, `typescript`
6.0.x (7.0.2 блокируется `typescript-eslint` `<6.1.0`).

| инструмент | `.ts/.tsx` | `.astro` | `.svelte` | `.vue` |
|---|---|---|---|---|
| Steiger — извлечение импортов | ✅ | ⚠️ только frontmatter | ✅ | ✅ |
| Steiger — импорт **в** `.astro/.svelte/.vue` | ❌ (`ts.resolveModuleName` → `null`, **fail-open**) | ❌ | ❌ | ❌ |
| Steiger — файлы глубже `src/pages/*` (`blog/`, `en/`, `[slug]/`) | ❌ не индексируются | ❌ | ❌ | ❌ |
| Steiger — структурные правила (17 из 20) | ✅ | ✅ | ✅ | ✅ |
| ESLint `boundaries/dependencies` + `no-restricted-imports` | ✅ | ✅ (+ клиентские `<script>` как `*.astro/*.ts`) | ✅ | ✅ |
| Biome без флага | ✅ | 🔴 12 ложных `noUnused*` | 🔴 | 🔴 |
| Biome с `html.experimentalFullSupportEnabled` | ✅ | ✅ script + шаблон + `<style>` + a11y | ✅ | ✅ |
| a11y-линт | jsx-a11y | `astro/jsx-a11y/*` (10 правил) | `svelte/valid-compile` (8) | `vuejs-accessibility` (6) |
| Vitest 5 компонентный тест | ✅ | ✅ Container API (env `node`) | ✅ `@testing-library/svelte` + `svelteTesting()` | ✅ `@vue/test-utils` |
| typecheck | `tsc` | `astro check` | `svelte-check` | `vue-tsc` |

**Разделение ответственности.** Направление слоёв и cross-slice — **ESLint
`eslint-plugin-boundaries@7`** (основной) + Steiger `forbidden-imports` (второй контур, только
`.ts`-цели); deep-import — **`no-restricted-imports`** (по форме спецификатора, расширение
цели безразлично; паттерн SPA `@/*/*/*/*` не ловит `@/entities/post/model` — заменить на
`@/entities/*/*` и т.д.); public API/сегменты/имена — **Steiger** (единственный, кто умеет;
0,8–1 с). На фикстурах Steiger нашёл 6 из 12, ESLint — 17 из 17. `insignificant-slice`
выключается (референсы из вложенных маршрутов невидимы; инвариант pages-first остаётся на
`/fsd-audit` в strategy). Public API слайса — всегда `index.ts` с explicit re-export компонента
(`index.astro`/`index.svelte` принимаются, но слайс выпадает из графа). `dependency-cruiser`
не поддерживает `.astro` — для Astro бесполезен; `knip` — вне гейта.

**Biome 2.5.14** с `html.experimentalFullSupportEnabled: true` обязателен (без него 12 ложных
срабатываний, с ним 0 + линт шаблона и клиентских `<script>`); формат идемпотентен; единственный
конфликт (`<img/>`) снимается `html.formatter.selfCloseVoidElements: "always"`; Prettier не
нужен; фиксировать точную версию Biome. **ESLint 10** обязателен для `eslint-plugin-astro@3`;
`@eslint/js@10` уже стоит в SPA при `eslint@9` (peer нарушен); `eslint-plugin-jsx-a11y@6.10.2`
работает под 10 с unmet peer (замена — `jsx-a11y-x`); **ловушка**: без установленного jsx-a11y
конфиг Astro молча становится пустым — нужна негативная фикстура гейта. Typed-lint
(`projectService`) — только на `**/*.{ts,mts,cts}`; компоненты проверяет нативный чекер.

**Vitest 5**: `getViteConfig` из `astro/config` + два проекта (`astro`/`node` для Container API,
`dom`/`happy-dom` для `.ts`); `vitest-axe` заброшен (2022) — свой хелпер поверх `axe-core@4.13`
с выключенным правилом `region`; `vitest-browser-astro` несовместим с Astro 7. Миграция 4→5 для
SPA — отдельная задача (`clearMocks` true, `basic`-репортёр удалён, `vi.mock` только top-level,
артефакты в `.vitest/`). `astro check`: ре-экспорт `z` из `astro:content` помечен deprecated —
схемы через прямой `import { z } from 'zod'`.

**FSD-раскладка (Astro, вариант A — `srcDir: './src'`, рекомендуется):** `src/pages` — настоящий
слой (совпадает с требованием Astro), навязанные `src/{content.config.ts,middleware.ts,actions/,env.d.ts}`
— в `ignores` Steiger; колокация секций — `src/pages/_components/`; вариант B (`srcDir: src/app`)
отвергнут — теряется слой `pages` и все проверки маршрутов. `pnpm check` остаётся `typecheck →
lint → format:check → test → steiger → build → size` (`typecheck` = `astro check`; `lint` =
`biome check . && eslint .`; `format:check` = `biome format .`); центр тяжести архитектурной
проверки переезжает из `steiger` в `lint` — записать в `CLAUDE.md`. ESLint — единственный дорогой
шаг (21 с холодный, ~1 с с `--cache`), в pre-commit `--cache`. `/scaffold`: расширение файлов —
параметр; `entity` получает сегмент `content/`; `pnpm gen` исчезает; post-flight — `steiger` +
`lint` + `typecheck`. Из SPA-стека теряют смысл TanStack Router/Query/Form, Zustand, Lingui, MSW
как режим (остаётся только для внешних API); Zod становится схемой контента; токен-слой,
Sentry (только при DSN), web-vitals (опционально) остаются.

---

## 5. Финалист

### 5.1 Решение

**`ssr-frontend-template` строится на Astro 7** (`astro@7.3.2`, `@astrojs/node@11.1.5`,
`mode: 'standalone'`, Vite 8.3). Матрица 07 (437,5 против 355 у Nuxt) и три spike'а сходятся:
Astro — единственный кандидат, у которого **ноль JS на контентной странице — дефолт, а не
режим** (гидрация на компонент, а не на маршрут), контент физически лежит внутри FSD-слайса,
`src/pages` совпадает со слоем `pages` без ремапов и автоимпортов, а Node-процесс сам отдаёт
prerender с TTFB 0,85 мс и `immutable`-ассетами без CDN и без nginx. Поле HTTP Archive
(71 % origin'ов с хорошим CWV против 28,6 % у Nuxt) подтверждает, что это дефолтная траектория
проектов на нём — а шаблон форкают и ведут сами.

Конфигурация шаблона (проверено spike'ом 08, готово к переносу):

| решение | значение | почему |
|---|---|---|
| режим | `output: 'static'` + `prerender = false` на `/now`, форме, `robots.txt`, `sitemap.xml`, `rss.xml`, `healthz`, `/internal/*` | статика отдаётся процессом за 0,85 мс; on-demand — только там, где нужен рантайм |
| `build.format` | **`'directory'`** | `'file'` + node-адаптер = 404 на `/blog`, `/en` (в dev не воспроизводится) |
| абсолютные URL | **вариант C**: `site: 'https://__site_origin__'` + штамповка в `docker/entrypoint.sh` (32 файла, 0–10 мс) + e2e «в ответе нет `__site_origin__`»; HTML не предсжимать | у Astro статика — не мёртвый вес; D платит `/_image` на запрос (300–420 мс, RSS 360 МБ) и лавиной рендеров без single-flight |
| D (`output: 'server'` + `memoryCache` + `routeRules`) | **опция для проектов с CMS/API** (вебхук `cache.invalidate({ tags })`), с обязательным single-flight/прогревом и `routeRules['/_image']` | инвалидация без релиза нужна только при внешнем источнике контента |
| staging-noindex | `robots.txt` из приложения (`ROBOTS_POLICY`) + **Traefik `basicAuth` + `customResponseHeaders: X-Robots-Tag`** | на prerendered `X-Robots-Tag` недостижим ни middleware, ни `src/fetch.ts`, ни `staticHeaders` |
| сервер | `docker/server.mjs` (`ASTRO_NODE_AUTOSTART=disabled` + `startServer()`): graceful shutdown, `keepAliveTimeout=65`, `headersTimeout` | адаптер не даёт ни того, ни другого; без обёртки `make bump` рвёт запросы |
| образ | 3 стадии, `--prod` + прунинг gnu-бинарников (388 → 316 МБ), `sharp` в `dependencies`, `session: false`, `USER node`, HEALTHCHECK `/healthz` | выход Astro не self-contained |
| острова | **по умолчанию без фреймворка** (`<script>` в `.astro`) или Preact/Solid для состояния; React — только при реюзе компонентов SPA (форма на React = 93 КБ gzip против 3–15) | «интерактив точечный» |
| формы | эндпоинт `src/pages/api/<form>.ts` с PRG 303 + honeypot + time-trap; Astro Actions — только как JS-путь | Action на prerendered-странице без JS молча не работает; Action в `index.ts` слайса убивает гидрацию |
| SEO-слой | свой `shared/seo` (`<Seo>`, `urls.ts` с runtime origin, JSON-LD + Zod), свои `sitemap.xml.ts`/`robots.txt.ts`/`rss.xml.ts`; `@astrojs/sitemap` не подключать | встроенное привязано к build-time `site` и не покрывает SSR-роуты |
| контент | Content Layer, `glob({ base: 'src/entities/<name>/content' })`, схема `astro/zod`/`zod@4` в `entities/<name>/model/schema.ts`, `content.config.ts` импортирует коллекцию напрямую из модуля | контент внутри слайса; баррель ломает dev |
| i18n | встроенный `i18n` (`prefixDefaultLocale: false`) + физический `src/pages/en/`; свой hreflang-хелпер | несуществующий перевод = честный 404 без кода |
| гейт | `astro check` · Biome 2.5 (`html.experimentalFullSupportEnabled`, `.astro` не форматируется) · **ESLint 10** + `eslint-plugin-astro@3` + `boundaries@7` с `import/resolver` + `no-restricted-imports` по `@/<layer>/*/*` · Steiger (структурные правила, `insignificant-slice: off`) · Vitest 5 (`getViteConfig`, Container API для `.astro`) · Playwright 1.63 · size-limit 14 | §4 |
| версии | точные (`astro@7.3.2`, `@astrojs/node@11.1.5`), апгрейд мажора — осознанно через `npx @astrojs/upgrade` + `pnpm check`; шаблон на N, форки не дальше N−1 | мажор каждые ~3,5 мес, поддержка «security-only на один предыдущий» |

### 5.2 Почему не Nuxt (и когда всё-таки Nuxt)

Nuxt 4.5 в spike показал себя **самым полным** по SEO-инструментарию (26 из 38 MUST из
коробки, `useLocaleHead`, robots в три контура одной env, schema-org, og-image) и самым
готовым по рантайму (Nitro 2.13.4 stable, `swr` со встроенным single-flight, graceful shutdown,
образ 212 МБ, 39 МиБ в контейнере). Против него — четыре вещи, каждая из которых для
**шаблона** весит больше, чем удобство модулей:

1. **Нет partial hydration.** Контентная страница либо тянет 134–150 КБ JS, либо
   `noScripts` выключает гидрацию и клиентскую навигацию на весь маршрут; `.server.vue`
   делает хуже (−3 КБ JS, +18 КБ JSON). Профиль «интерактив точечный» этим не описывается.
2. **FSD против течения фреймворка.** `srcDir`/`dir.*` ремап, обязательные
   `imports.autoImport: false` + `components.dirs: []` (иначе архитектурный гейт слеп),
   любой `.vue` в `pages` — маршрут (колокации нет), навязанный `src/components/OgImage/`,
   `mountSuspended` несовместим с отключёнными автоимпортами.
3. **Стыки модулей.** Три самых дорогих бага spike'а (`image.dir` от `srcDir`, `i18n.baseUrl`
   молча перебивает runtime site-config, og-image тянет `playwright-core`) — все на стыках и
   не диагностируются по сообщению; `ipx` в проде — beta; доки `nitro.build` — про другой Nitro.
4. **Nuxt 5 «Scheduled» ~Q4 2026** с переездом на Nitro 3 / h3 v2 — запланированная миграция
   серверного слоя шаблона в первый же год жизни.

**Nuxt — первый запасной вариант**: если владелец решит, что «максимум SEO из коробки и
минимум собственного кода» важнее «нуля JS по умолчанию», — или если проект-потребитель
живёт на Vue. Тогда дефолт — `swr` + `noScripts` на весь индексируемый контур, две
env-переменные origin, `sqliteConnector: 'native'`, `image.dir: '../public'`, OG-шаблон свой.

**Второй запасной — Next 16.3** при требовании письменного LTS (Active LTS до 2027), настоящего
ISR с общим кешем на нескольких инстансах или тяжёлого React-кабинета; цена (spike 11) — 138 КБ
gzip JS на странице без интерактива (+17 КБ RSC-префетчей на просмотр), коллизия `app/` с FSD
(слой `pages` в `src/views` — Steiger слеп, границы только ESLint), честный 404 по рецепту из
пяти правил, взаимоисключающие `revalidatePath` × `dynamicParams=false`, `read_only` несовместим
с ISR, RSC-модель, Turbopack вместо Vite, ноль контент-слоя (`content-collections` 0.x), и
`next dev`, дописывающий управляемый блок в `CLAUDE.md`/`AGENTS.md` (нужен свой закоммиченный
`AGENTS.md`).

**SvelteKit — не запасной**, но урок: самый чистый «ноль JS» на маршрут, эталонный
`adapter-node` (`KEEP_ALIVE_TIMEOUT`, `SHUTDOWN_TIMEOUT`, 308, предсжатие), формы без JS by
design и лучший AI-тулинг (`llms-full.txt`, официальный MCP). Отвергнут из-за пустого
SEO/контент-слоя (~500 строк своего), deprecated `kit.files.*` под всей FSD-раскладкой, 42 КБ
«пола» гидрации и `$env/*`, обещанного к удалению в 3.0.

### 5.3 Условия пересмотра

| # | триггер | что делать |
|---|---|---|
| R-1 | `memoryCache()` перестаёт быть дефолтным провайдером или route caching уходит в CDN-only контур (Astro 8.x) | Nuxt 4/5 или SvelteKit + свой кеш |
| R-2 | Astro меняет лицензию/закрывает governance после Cloudflare | немедленный пересмотр (код MIT остаётся) |
| R-3 | > 2 мажоров Astro за 6 мес с ломающими правками контент-слоя | зафиксировать мажор в шаблоне, переходить раз в 2 мажора |
| R-4 | профиль форка — «приложение» (кабинет — основной сценарий, < 50 % публичных маршрутов) | форкать `spa-frontend-template` |
| R-5 | инфра уходит к нескольким инстансам с общим кешем | Next 16 (`cacheHandler`) или Redis-провайдер кеша под Astro |
| R-6 | требование письменного LTS (тендер/комплаенс) | Next 16 |

### 5.4 Что придётся написать самим (сводный список для плана §12)

Из 07 §5.1 и 08 §12: A-1 `robots.txt.ts` · A-2 `sitemap.xml.ts` (+шарды) · A-3 `rss.xml.ts` ·
A-4 `shared/seo/urls.ts` (runtime origin) · A-5 `<Seo>` · A-6 hreflang · A-7 JSON-LD + Zod ·
A-8 OG (статическая обложка по умолчанию; satori+resvg — опция) · A-9 редиректы как данные ·
A-10 `docker/server.mjs` + `/healthz` · A-11 `entrypoint.sh` штамповка · A-12 форма PRG +
honeypot/time-trap · A-13 preview/draft · A-14 `/internal/revalidate` (для D) · A-15
`X-Robots-Tag` middleware (on-demand) + Traefik-правило · A-16 прогрев/single-flight (для D) ·
A-17 `size-limit` + бюджет HTML + e2e-бюджет JS · A-18 `content-invariants` + `check:content` ·
A-19 `<YandexNoIndex>` + `Clean-param` · A-20 обвязка тестов `.astro` (Container API) ·
плюс правила `.claude/rules` (`build.format`, server-only не в `index.ts`, server islands не для
индексируемого, HTML не предсжимать, «в `index.ts` слайса нет top-level вызовов»).

---

## 6. Архитектура контент-first сайта (полностью — `round2/14-content-architecture.md`)

### 6.1 Источник контента

| вариант | кто редактирует | инфра-цена | публикация = | когда |
|---|---|---|---|---|
| **git-контент** (дефолт): Markdown/MDX + Zod-коллекции | разработчик / редактор через PR | 0 контейнеров | новый образ (`make bump`) | лендинг, корпсайт, доки, блог 1–20 публикаций/мес |
| git + **Decap CMS 3.16 поверх Gitea** (backend `gitea`, PKCE в браузере, без OAuth-прокси; Gitea ≥ 1.20, в `corp-infra-template` — 1.26.1; git-lfs не поддержан) | маркетолог в вебе | 0 контейнеров | коммит → релиз | редактор не умеет git; Keystatic (только GitHub App / Cloud) и Tina (+внешняя БД) не подходят |
| headless CMS self-host: **Payload 3.89** (MIT; ставится только внутрь Next.js, официального образа нет — свой Dockerfile) или Strapi 5.54 (MIT CE; единственный живой Astro-loader) — **Directus 12 исключён** (MSCL-1.0: без ключа Core = 3 места / 25 коллекций / 5 Flows, ключ OIG продлевается ежегодно и отдельный на каждого клиента) | редактор в админке | +1–2 контейнера, +Postgres, +бэкап, +роут | запись → инвалидация | ежедневные новости, каталог, роли/модерация |
| свой Go-бэкенд экосистемы как контент-API | своя админка | 0 (бэкенд уже есть) | запись → инвалидация | контент = доменная сущность продукта |
| SaaS-CMS (Sanity/Contentful) | облако | внешняя зависимость | вебхук | **отклонён по умолчанию для РФ-заказчика**: трансграничная передача ПДн (ст. 12 152-ФЗ, ужесточена 265-ФЗ от 26.07.2026), оплата из РФ, доступность API при блокировках |

Готовый Astro-loader есть только у Strapi; у Payload — заброшенный `astro-payload-loader` 0.1.0,
у Directus — ни одного: выбор CMS не должен упираться в loader — свои ~30 строк поверх
`ContentSource.http` надёжнее и дают Zod-валидацию ответа.

Шов закладывается сразу: `shared/content` с интерфейсом `ContentSource` (`list/get/all`) и двумя
реализациями — `fsSource` (индекс, собранный на билде) и `httpSource` (CMS/бэкенд, ответ
валидируется той же Zod-схемой); переключатель `CONTENT_SOURCE=fs|http`. **Инвариант, которого
не было в SPA: «редактор без git ⇒ маршруты его коллекций не могут быть `static`»** —
блокирующая cross-kind проверка `stack-deep-dive` (`content.md § Кто редактирует` ⇒ режим в
`rendering.md`). Preview/draft — HMAC-токен с TTL, редирект на путь **из найденного документа**,
cookie, `noindex` + `private, no-store`, баннер выхода; `draft: true` не попадает в прод-индекс,
sitemap и RSS.

### 6.2 Режимы рендера и развилка абсолютных URL

| режим | что значит | страницы | `Cache-Control` | индексируется |
|---|---|---|---|---|
| `static` | HTML вычислен заранее и живёт до релиза | лендинг, `/about`, юридическое, посты | `no-cache` + ETag | да |
| `cached` | рендер на запрос + кеш процесса (TTL + SWR) | списки, теги, каталог из API, главная | `no-cache` + ETag | да |
| `dynamic` | на каждый запрос, кеш запрещён | `/now`, поиск, preview, персональное | `private, no-store` | обычно нет |
| `client` | каркас + данные на клиенте | кабинет, приватные калькуляторы | `private, no-store` | **никогда** |

Инварианты: `indexable: yes` ⇒ режим ∈ {`static`,`cached`,`dynamic`} и весь контент в первом
HTML; `guard ≠ public` ⇒ `client`/`dynamic` + `noindex` + `private, no-store` + нет в sitemap;
`client` + `indexable: yes` — запрещено (гейт `/scaffold`).

**Развилка «prerender ⊥ runtime `SITE_URL`».** У всех фреймворков канонический хост — build-time
(`site` Astro, `$env/dynamic` при prerender SvelteKit «bakes in build time values», Nuxt site
config подменяется только для SSR-ответов, `metadataBase` Next). Решение: абсолютные URL нужны
только в `<head>`, JSON-LD, фидах и sitemap — в теле ссылки корневые относительные (проверяется
регуляркой в e2e); для финалиста (§5.1, §10 п. 4) дефолт — **C** (prerender + плейсхолдер `https://__site_origin__`,
штамповка при старте контейнера: 32 файла за 0–10 мс по spike 08; HTML тогда не предсжимать,
e2e-тест на остаток плейсхолдера), **D** (рендер на запрос + кеш в процессе, `SITE_URL` из env
на каждом рендере, single-flight + прогрев горячих URL, `X-Cache: HIT|STALE|MISS|BYPASS`) — для
контента из CMS/API и страниц, которым prerender не подходит, **A** (build-arg) — одна среда,
явная строка в `rendering.md`. Инвалидация —
четыре механизма: релиз · TTL+SWR · вебхук `POST /internal/revalidate` (HMAC, 202) · ручной
`POST /internal/cache/flush`; ключ кеша — метод+путь+локаль, без cookie/UA/неизвестных query.

### 6.3 Пайплайн контента

Markdown компилируется **на билде** (`content-index.json` + скомпилированные тела + ассеты по
хешу + индекс поиска по локали), ошибка Zod-схемы = красная сборка; на запрос — только сборка
страницы. Изображения: контент в git — build-time (AVIF/WebP × ширины `400/800/1200/1600`,
контент-хеш, `immutable`); извне — runtime `/img/*` с allowlist хостов и ширин + дисковый кеш;
`<picture>` с обязательным `<img src>`-фолбэком, `width`/`height`, LCP-картинка
`fetchpriority="high"` без `lazy`; OG — картинка из контента, иначе генерация `/og/<key>.png`
(satori + `@resvg/resvg-js`, musl-пребилды, кириллический TTF в образе), иначе дефолт.
Шрифты: self-host WOFF2, variable, сабсеты `latin`/`cyrillic` по `unicode-range`, `font-display`
`optional` для текста / `swap` для заголовков, preload ≤ 1 файла активной локали с
`crossorigin`, метрики фолбэка. Семейство по умолчанию выбирается **сначала по наличию
настоящего курсива** (у «кириллица-первых» Manrope / Golos Text / Onest / Geologica его нет —
браузер рисует синтетический наклон): текст — **Wix Madefor Text Variable** (кириллица 13,8 КБ,
`wght 400–800`, italic есть), акциденция — Onest (15,5 КБ) или Golos Text; одним семейством —
Rubik / Source Sans 3; никогда — Roboto Flex (132 КБ `standard`) и статический PT Sans (два файла
≈ 57 КБ). Astro Fonts API стабилен (`fontProviders.fontsource()`, файлы в `_astro/fonts`), но три
дефолта обязаны быть переопределены: `subsets` (`["latin"]` → `["cyrillic","latin"]`), `weights`
(`[400]` → `["400 800"]`), `styles` (не просить `italic` у семейств без курсива).
Поиск: статический индекс по локали (дефолт), `/search` —
`noindex, follow`, вне sitemap, работает без JS в деградации; движок с русской морфологией.
Формы: нативный POST + PRG 303 на `/contacts/spasibo` (`noindex`), остров только улучшает;
антиспам-лестница honeypot → time-trap → origin-check → rate-limit → капча по шву
`CAPTCHA_PROVIDER` (дефолт `none`; если капча нужна — Яндекс SmartCaptcha: 35,6 КБ по проводу,
10 000 проверок/мес бесплатно, невидимый режим, `CAPTCHA_FAIL_MODE=open` явно и в лог; Turnstile
28 КБ, но зарубежный сервис = трансграничка; hCaptcha 102 КБ и reCAPTCHA 357 КБ — не брать; капча
грузится только на странице формы и по фокусу, отдельной строкой `size-limit`). Доставка —
`FORM_DELIVERY` как **список каналов** (`smtp,telegram` или `backend`), успех = хотя бы один;
заявка **сначала пишется в durable-спул на диске** (named volume, файл = ULID, ретраи с
backoff, для 429 Telegram — пауза `retry_after`), 303 отдаётся после записи в спул, алерт «в спуле
N > 0 дольше 15 мин», ретенция `LEADS_SPOOL_TTL_DAYS`. Telegram — не единственный канал:
`api.telegram.org` с сервера доступен, но РКН с 10.02.2026 поэтапно ограничивает мессенджер и
получатель может заявку не увидеть; SMTP у Яндекса (с 29.06.2026) и Mail.ru (с 12.06.2026) только
платный (Яндекс 360 / Mail Space, 300 писем/сутки по SMTP, SPF+DKIM+DMARC обязательны). Чекбокс
согласия на ПДн (`consent: z.literal(true)` и на сервере; одна цель — одна галка; с заявкой
сохраняются `consent_version` и `consented_at`) + `/legal/privacy` в reference-наборе.
Аналитика: Метрика (`tag.js` — **95,8 КБ** по проводу, три потолка JS страницы) после согласия и
после idle/первого взаимодействия, `defer: true` + ручной `hit`, отдельная строка бюджета «третьи
стороны»; GA4 — только по явному `ANALYTICS=metrika|ga4|both|none`: `googletagmanager.com` и
`google-analytics.com` с RU-машины не открываются (TLS рвётся после ClientHello; одна точка
замера — перепроверить с VPS заказчика); self-host — Umami 3.3 (+1 контейнер к Postgres проекта),
Plausible CE тянет ClickHouse и на одном VPS с сайтом не нужен; ноль-скриптовая альтернатива —
статистика из access-log Traefik.

### 6.4 i18n, фиды, sitemap, редиректы, 404/410, staging

Параллельные каталоги `content/<locale>/…` + `translationKey`; префикс пути, дефолт без
префикса; непереведённое — 404, не дубль; hreflang из фактического набора переводов; никаких
авторедиректов; UI-строки — отдельный слой. RSS — на локаль, динамический, анонсы + ссылка,
`atom:link rel=self`, `guid isPermaLink`. Sitemap — индекс + шарды по типу/локали из
контент-индекса и таблицы `rendering.md`; `lastmod` только честный (из `updatedDate`; git-дату в
рантайме взять нельзя — `.git` не в образе), `changefreq`/`priority` не выводить. Редиректы —
`content/redirects.yaml` (`from/to/status 301|308|410`), применяются сервером до роутинга одним
хопом, гейт на циклы/цепочки/дубли; в Traefik остаются только www→apex и http→https. Soft-404
запрещён; ошибка данных — 500 `noindex` без кеша; плановые работы — 503 + `Retry-After`;
троттлинг — 429. Staging — три контура: `ROBOTS_POLICY=noindex` в приложении (источник истины,
тест), Traefik `basicAuth`, Traefik `customResponseHeaders: X-Robots-Tag`; обратный гейт «на проде
нет `noindex`».

### 6.5 Бюджеты и a11y

| что | цель | потолок |
|---|---|---|
| HTML (несжатый) | ≤ 100 КБ | 300 КБ (алерт 150) |
| CSS (gzip) | ≤ 15 КБ | 25 КБ |
| JS на контентной странице (gzip) | **0 КБ** | 30 КБ (островки) |
| JS третьих сторон (счётчик, капча) | **0 КБ** до согласия | 120 КБ по проводу, после согласия |
| шрифты на первую отрисовку | ≤ 60 КБ | 100 КБ |
| LCP-картинка (AVIF) | ≤ 150 КБ | 250 КБ |
| страница целиком (transfer) | ≤ 400 КБ | 800 КБ |
| TTFB p75 кеш-хит / SSR-miss | ≤ 50 мс / ≤ 200 мс | 200 / 400 мс |
| CWV p75 mobile | LCP ≤ 2.5 с · INP ≤ 200 мс · CLS ≤ 0.1 | — |
| Lighthouse CI (mobile) | perf ≥ 0.95 · seo = 1 · a11y ≥ 0.95 | отдельный stage |

Медиана веба 2025 (Web Almanac): HTML 33 КБ, JS 646 КБ, страница 2.2 МБ — шаблон обязан быть в
5–10 раз легче за счёт отсутствия JS-фреймворка на контентных страницах. A11y: axe на островах в
`pnpm check`, axe на 3–5 страницах в двух темах в e2e, LHCI a11y ≥ 0.95; инварианты правилом
(один `<h1>`, лендмарки, `<a href>`/`<button>`, `alt`, `label`, `prefers-reduced-motion`,
контент без JS). Инструменты: `axe-core` 4.13 + `@axe-core/playwright` 4.13 — основа;
`vitest-axe` без стабильного релиза с 2022 (`1.0.0-pre.5` тянет `@vitest/pretty-format@3` при
Vitest 5) — в гейте свой матчер ~20 строк поверх `axe-core` (или `jest-axe` 11); `@lhci/cli` 0.15.1
несёт Lighthouse 12.6.1 при актуальном 13.4.1 — LHCI остаётся отдельным stage с пином Node,
бюджеты в `budget.json`, который читает и standalone-`lighthouse@13`.

### 6.6 Reference-слайсы

`pages`: `index` (static, WebSite+Organization, LCP-картинка, 0 JS) · `about` (LocalBusiness,
BreadcrumbList) · `blog/index` (cached, пагинация `?page=` self-canonical, фасет `?tag=` noindex) ·
`blog/$slug` (Article, OG, крошки, lastmod, `<picture>`, честный 404) · `catalog/index`+`$slug`
(из API: серверная фильтрация `<a href="?…">`, Product/Offer, runtime `/img/*`) · `contacts` +
`contacts/spasibo` (PRG, noindex) · `legal/privacy` · `search` (noindex) · `now` (dynamic) ·
`account` (client + guard, выключен `ENABLE_ACCOUNT=false`) · 404/500. Server routes:
`robots.txt`, `sitemap.xml`+шарды, `rss.xml`, `og/[key].png`, `img/*`, `api/contact`,
`api/preview[,/exit]`, `internal/revalidate`, `healthz`. `widgets`: site-header, site-footer,
breadcrumbs (видимые + JSON-LD из одного массива), post-card, cookie-banner. `features`:
contact-form, catalog-filter, site-search, theme (cookie, без FOUC). `entities`: article,
product, company. `shared`: seo, content, images, ui, i18n, config, lib, observability.
Инварианты архитектуры C-1…C-26 — `14-content-architecture.md` §4.5.

### 6.7 Юридический минимум РФ (152-ФЗ, состояние на 2026-09-16)

Инженерная сводка, не юридическая консультация (полностью — 14 §2.7.3; формулировки на сайте
заказчика визирует юрист). Четыре обязанности оператора: **опубликовать политику обработки ПДн**
(ст. 18.1 ч. 2 → `pages/legal/privacy`, `static`, ссылка в футере и рядом с каждой формой);
**получить согласие** — «конкретное, предметное, информированное, сознательное и однозначное»
(ст. 9 ч. 1 → непредустановленный чекбокс, одна цель — одна галка); **уведомить РКН** до начала
обработки (ст. 22 в ред. 266-ФЗ — обязанность заказчика, в чек-лист `/release`); **хранить ПДн
граждан РФ в БД на территории РФ** (ст. 18 ч. 5 → заявки на том же VPS, зарубежные форм-сервисы
запрещены). Любой внешний сервис вне РФ, получающий IP/cookie/контакты (SaaS-CMS, GA4,
Turnstile/reCAPTCHA, зарубежный SMTP), — трансграничная передача по ст. 12 с отдельным
уведомлением РКН; критерии перечня «адекватных» стран ужесточены 265-ФЗ от 26.07.2026. Прямой
нормы о cookie-баннере нет — согласие на аналитические cookie выводится из ст. 6/9; технические
cookie (сессия, тема, локаль) согласия не требуют и не смешиваются с аналитикой в одной галке.
Штрафы КоАП 13.11 (420-ФЗ, с 30.05.2025): нет политики — до 60 тыс. ₽ (ЮЛ), обработка без
согласия — 300–700 тыс. ₽, неуведомление РКН — 100–300 тыс. ₽, нарушение локализации — 1–6 млн ₽.
`/de-template` обязан упасть, если в политике остались плейсхолдеры оператора (C-24).

---

## 7. SEO-канон (выжимка MUST; полностью — `02-seo-canon.md`, приложения `_sub-*`)

**Индексируемость.** Всё индексируемое — в первом HTML; `client`-режим только у
`indexable: no`; нет `#`-роутинга и контента «по клику без URL»; 404/410 честные; нормализация
URL одним **308** (регистр, хвостовой слеш, www/apex); абсолютный self-canonical из `SITE_URL`;
cross-domain canonical запрещён; `robots.txt`/`sitemap.xml` — server routes из runtime config,
`Sitemap:` абсолютный; `lastmod` только честный; приватное — `X-Robots-Tag: noindex, nofollow` +
`private, no-store`; не закрывать в robots ассеты; документ ≤ 2 МБ несжатых (Googlebot режет
молча, обрезок индексируется «как полный файл», порядок в `<head>` важен); не смешивать
разрешающие и запрещающие директивы (Яндекс выберет разрешающую); пагинация — свой URL +
self-canonical, «load more» дублируется `<a href="?page=n">`; фасеты — `Disallow` + `Clean-param`.

**Метаданные.** Уникальные `<title>` (`%s — %site`) и `description` (лимитов длины у Google
нет; бюджет линтера 25–65 / 70–170); полный OG с абсолютным `og:image` 1200×630 +
`width/height/alt` (заголовок запекать в картинку — X менял поведение подписи); `twitter:card`;
`<html lang>`; `color-scheme` + `theme-color` light/dark; favicon-набор (`favicon.ico` 32,
`icon.svg` с dark-режимом внутри, `apple-touch-icon` 180, manifest 192/512+maskable);
`google-site-verification`/`yandex-verification` из runtime; `keywords` — никогда.

**JSON-LD.** `Organization` + `WebSite` на корне (имя сайта в выдаче), `BreadcrumbList` глубже
первого уровня, `Article`/`Product`/`LocalBusiness`/`Event`/`VideoObject` по типу (для Яндекса
видео без разметки не индексируется); только видимое; `schema-dts` 2.0 + Zod-тест; `FAQPage`
(rich results сняты 07.05.2026)/`HowTo`/`SearchAction` — не генерировать; JSON-LD — data block,
CSP `script-src` его не проверяет, nonce не нужен; ручная проверка Rich Results Test +
`webmaster.yandex.ru/site/tools/microtest/` перед релизом.

**i18n.** Префикс пути, дефолт без префикса; невалидный префикс → 404; полный взаимный
`hreflang` + self + `x-default`; canonical внутри локали; никаких авторедиректов по
`Accept-Language`/гео (Googlebot ходит из США); для Яндекса hreflang — слабый сигнал
(первоисточник 2013), региональность — в Вебмастере.

**Стриминг и боты.** Соц-краулеры читают первый чанк и отключаются; Googlebot применяет `noindex`
из стримленного fallback'а немедленно; React 19.2 отдаёт ботам Suspense-fallback'и. Канон: весь
`<head>` и основной контент — до первого байта; стриминг для ботов выключить (у Astro Node —
`experimentalDisableStreaming`); e2e с `User-Agent: Googlebot` — HTML без плейсхолдеров.

**Производительность.** Пороги CWV не менялись (LCP 2.5 с / INP 200 мс / CLS 0.1, p75; «VSI»,
«ER», «INP-сигнал 18.03.2026» — выдумка SEO-блогов); CrUX меряет только первый заход;
критический CSS не инлайнить (Tailwind v4 < 10 КБ, один `<link>` с `immutable`); тема из cookie
+ `data-scheme` в первом байте; счётчики после согласия/idle; Early Hints — MAY (Traefik
проксирует 103, выигрыш при быстром шелле мал); Speculation Rules `prefetch` — MAY (Chromium);
`web-vitals` 6.x с TTFB, `Server-Timing`.

**Яндекс.** JS-рендеринг — бета, при SSR выключить; `Host`/`Crawl-delay` не генерировать;
`Clean-param` из конфига; `<noindex>` жив (MAY); IndexNow (`yandex.com/indexnow`, ключ-файл
в корне, до 10 000 URL/запрос; Google — нет); Turbo закрыт (04.2025); обход по счётчику
Метрики; аналога CWV нет; верификация робота — rDNS на `yandex.ru|net|com` + forward, подсети
`yandex.ru/ips`.

**Безопасность vs SEO.** HSTS/nosniff/frameDeny/referrer — на Traefik (`secure-headers@file`);
CSP — из приложения; в v1 строгий nonce-CSP не включать (нонс несовместим с кешем/prerender;
`Content-Security-Policy-Report-Only` + hash-режим — фиксируется в `seo.md`); CrowdSec —
`seo-bots-whitelist` по rDNS, никогда бан по одному UA; `Vary: User-Agent`/`Vary: Cookie` не
ставить; JSON-листы IP Google переехали в `developers.google.com/static/crawling/ipranges/`
(`common-crawlers.json`), старые адреса мертвы с 07.04.2026.

**QA.** Unit — `shared/seo/*`; e2e `seo.spec.ts` через `request` без JS (статусы, мета,
canonical, hreflang, JSON-LD, robots/sitemap согласованы, «HTML без JS содержит h1», «нет noindex
на prod», размер HTML); Lighthouse CI — отдельный stage; RUM; Search Console (URL Inspection API
2000/сутки) + Вебмастер + IndexNow. Чеклисты страницы (`/scaffold page`) и релиза —
`02-seo-canon.md` §4–5.

---

## 8. Рантайм и деплой (полностью — `04-runtime-deploy.md`; «что внутри образа» — по финалисту)

**Образ (Astro, spike 08 §3).** Три стадии `node:24-alpine`: `build` (corepack pnpm 10,
`--mount=type=cache` на store, `--mount=type=secret,id=npmrc`; `ARG SITE_URL=https://__site_origin__`
для варианта C), `prod-deps` (`pnpm install --frozen-lockfile --prod` + прунинг build-машинерии,
которую `astro` тянет в `dependencies`: gnu-бинарники rolldown / sharp-libvips / lightningcss /
`@astrojs/compiler`, `@types/node`, `caniuse-lite`, `prismjs`) и `runtime`: `COPY node_modules`
(выход Astro **не self-contained** — `entry.mjs` импортит `astro`/`zod`/фреймворк островов,
`/_image` — `sharp`), `COPY dist`, `package.json`, `docker/{entrypoint.sh,server.mjs}`; `USER node`,
`ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000`, `HEALTHCHECK wget -qO- http://127.0.0.1:3000/healthz`,
`ENTRYPOINT ["/app/docker/entrypoint.sh"]` (штамповка `https://__site_origin__` → `SITE_URL` в
`*.html|*.xml|*.txt|*.mjs` внутри `dist/` — 32 файла, из них 6 в `dist/server/chunks`, за 0–10 мс),
`CMD ["node", "./docker/server.mjs"]` (обёртка: `ASTRO_NODE_AUTOSTART=disabled` + `startServer()`
из `dist/server/entry.mjs`; `keepAliveTimeout` 65 с > idle-таймаута Traefik, дренаж SIGTERM с
`closeIdleConnections()` и потолком 15 с — `docker stop` за 0,26 с, запрос в полёте доезжает).
Размер — **315,7 МБ** (388 без прунинга; `dist` 4,2 МБ), `docker build` с тёплым кешем 13 с.
Нативные модули (`sharp`, `@resvg/resvg-js`) — musl-пребилды, ставить внутри целевого образа
(`pnpm.supportedArchitectures` с `libc: musl`), Alpine ≥ 3.20.

**`compose/site.yml`** (черновик — 04 §3.4): `image: ${REGISTRY_HOST:-git.stit.tech}/${PROJECT_NAME}/site:${SITE_TAG}`,
`profiles: [site]`, `init: true`, `read_only: true` + `tmpfs` (кеши картинок/OG — tmpfs с
лимитом или volume), `stop_grace_period` ≥ таймаута graceful shutdown, `mem_limit: 512m`,
`cpus: 1.0`, `NODE_OPTIONS=--max-old-space-size=384`, сети `proxy` + `backend-net` (без
`depends_on: backend`); роутер `site` на `Host(\`${DOMAIN}\`)` с `crowdsec@file,rate-limit@file,
secure-headers@file,compress@file`, роутер `site-www` с `www-to-apex@file` (301); Traefik-side
healthcheck `/healthz`. `replicas` несовместимы с `container_name` — масштабирование вертикальное.

**Env-контракт** (полная таблица — 04 §3.5): `PORT`/`HOST`/`NODE_ENV`/`NODE_OPTIONS` (нет в HTML),
`ENV`, **`SITE_URL`** (обязателен; canonical/OG/sitemap/robots), `API_BASE_URL` (серверные фетчи,
`http://backend:8080` — **в HTML не попадает, тест**), `PUBLIC_API_BASE_URL`, `API_MODE`,
`ROBOTS_POLICY` (`index|noindex`), `SENTRY_DSN`/`SENTRY_ENVIRONMENT`/`RELEASE`, `LOG_LEVEL`,
`CACHE_*`, `CONTENT_SOURCE`/`CONTENT_API_URL`/`PREVIEW_SECRET`/`REVALIDATE_SECRET`,
`IMG_ALLOWED_HOSTS`/`IMG_CACHE_DIR`/`OG_CACHE_DIR`, `CAPTCHA_PROVIDER`/`FORM_DELIVERY`+секреты
доставки, `GOOGLE_SITE_VERIFICATION`/`YANDEX_VERIFICATION`/`INDEXNOW_KEY`/`AI_TRAINING`/`METRIKA_ID`.
Колонка «попадает в HTML? да/нет» в `config.md` — новый инвариант.

**Кеш без CDN.** `/assets/**` (хешированные) — `public, max-age=31536000, immutable`, предсжатые
на билде; HTML — `no-cache` + ETag (304), кеш в процессе (LRU, TTL+SWR); персонализированное —
`private, no-store` (Chrome разрешает bfcache при `no-store`, но не другие браузеры); `robots.txt`
`max-age=300–3600`, `sitemap.xml` `max-age=3600`; OG по хешу — `immutable`. `isr` (CDN
Vercel/Netlify) — запрещён. Драйвер кеша — память процесса (релиз = новый контейнер =
инвалидация); `fs`/`redis` — только при дорогом рендере или > 1 реплики.

**Traefik.** `compress` (`encodings: [br, zstd, gzip]`, `minResponseBodyBytes: 1024`,
`excludedContentTypes` для картинок/woff2), `www-to-apex` (`redirectRegex`, `${1}` переживает
envsubst), `staging-noindex`, `staging-auth` (`usersFile`), `retry`; убрать `sslRedirect`;
`accessLog.filePath` + `X-Request-Id: keep` + снять фильтр `400-599`; (опц.) HTTP/3,
`serversTransport.forwardingTimeouts.idleConnTimeout` под keep-alive.

**CrowdSec.** Починить acquisition (файл через общий volume **или** docker-источник) вместе с
`POSTOVERFLOWS: "crowdsecurity/rdns crowdsecurity/seo-bots-whitelist"` + локальная страховка по
rDNS Google/Yandex/Bing; корп-сценарий `commercial-crawlers.yaml` не копировать в проект как
есть (AI-краулеры — продуктовое решение).

**Процесс, health, логи.** Один Node-процесс на контейнер; `/healthz` — liveness без
зависимостей, `/readyz` не нужен; JSON-логи в stdout без PII (`method,path,route,status,dur_ms,
cache,rid,ua_is_bot`), `X-Request-Id` принимаем/генерируем; Sentry server-side; метрик Prometheus
нет — smoke drop-in `scripts/tools/smoke.d/90-site.sh` в cockpit инфры.

**Release/rollout.** `/release`: `docker buildx build -f docker/Dockerfile --secret
id=npmrc,src=$HOME/.npmrc -t $REGISTRY/$ORG/site:vX.Y.Z --push .` (у SPA-версии `-f`/`--secret`
пропущены — починить и там); INFRA-HANDOFF с непустым `ENV:`; `make bump` получает `--wait
--wait-timeout 90`; retirement `landing.yml` при первом развороте на корень; rollback — тот же
верб со старым тегом; окно 1–5 с при force-recreate — принятый компромисс одного VPS.

---

## 9. Шаблон и его место в экосистеме (полностью — `round2/13-template-v2.md`, `05-template-design.md`)

### 9.1 Имя, роль, пресеты, форк

Репозиторий — `ssr-frontend-template`; в README/ecosystem/витрине роль описывается как «шаблон
индексируемого сайта: static-first, SSR по необходимости; приложение за логином —
`spa-frontend-template`». Пресет `preset: landing | content-site | docs` в `service.md`
управляет prune reference-набора, бюджетами и обязательностью kinds; критерий выделения пресета
в отдельный репозиторий — другой Dockerfile/адаптер, другой состав `pnpm check`, другая
FSD-раскладка или > 2 обязательных kinds, другой STOP-контракт. `landing-template` из roadmap —
пресет `landing` + режим `/content --from-strategy`. Побочно: профиль `landing` в
`project-infra-template-compose` (always-on заглушка) стоит переименовать в `placeholder`.
Форк `<org>/site`, scope `@<org>/site`, образ `git.stit.tech/<org>/site:vX.Y.Z`, `SVC=site`,
sibling-дерево `~/git/<org>/{strategy,infra,backend,frontend,site,<bot>}`, `surface.type: web`.

### 9.2 Родство с SPA (kinship v2)

Идентично (расхождение = ошибка): `forward-only`/`comments`, `/plan`, `/smartdev` (с точностью
до имени), `settings.json`, commitlint, `.nvmrc`/`.npmrc`, LICENSE/SECURITY, `shared/lib/{cn,invariant}`,
токен-слой `app/styles/index.css`. По форме: `CLAUDE.md`, доки, шесть скиллов, четыре правила,
конфиги гейта. Умирает: `index.html` + `/config.js` + nginx-entrypoint, MSW в Service Worker,
`routeTree.gen.ts`, React Compiler, вендорные бюджеты, zustand-persist темы (тема — cookie).
React-наработки переезжают только при React-островах — бонус, не критерий. Сверка —
`docs/reference/kinship.md` + `pnpm kin:diff` (advisory, вне гейта); Gitea «Use this template»
схлопывает историю — потребителю merge апстрима недоступен в принципе.

### 9.3 `docs/stack`: 13 kinds

| kind | статус | что |
|---|---|---|
| `service` | обяз. | + `infra-svc: site`, + `preset` |
| `runtime` | обяз. | Node-процесс: адаптер, порт, graceful shutdown, `/healthz`, память, keep-alive |
| `content` | **обяз., новый** | источник (git/cms/api/hybrid), коллекции + схемы, локали контента, draft/preview, инвалидация, поиск; **секция «кто редактирует»** → блокирующий инвариант |
| `routing` | обяз. | URL-карта: маршруты и их происхождение, локали, слеши, редиректы, 404/410 |
| `rendering` | **обяз., новый** | режим на маршрут, кеш и инвалидация, статусы, **абсолютные URL / один образ**, streaming, интерактивность (гидрация на фичу) |
| `images` | **обяз., новый** | пайплайны build/runtime, форматы/ширины, хранение оригиналов (репо ≤ ~50 МБ / MinIO), allowlist, OG-генерация, бюджеты |
| `seo` | **обяз., новый** | идентичность, OG, JSON-LD, локали/hreflang, robots (AI-боты, `Clean-param`), sitemap-шарды, фиды, верификации/IndexNow/Метрика |
| `styling` | обяз. | токен-слой, темы, **шрифты** |
| `api` | **условный** | внешние источники + приём форм (антиспам, доставка); заводится при данных извне или формах |
| `analytics` | **условный** | счётчики, пиксели, согласие; для `landing` обязателен |
| `observability` | обяз. | серверная сторона + RUM с TTFB |
| `config` | обяз., **в конце** | роллап env + колонка «в HTML?» |
| `dependencies` | обяз. | + бюджеты по пресету |

Гейт `/de-template` = все обязательные + заведённые условные `stable` + нет `**blocker**` +
cross-kind инварианты (каждая page карты — в `rendering.md`; `indexable` не противоречит
`guard`; env новых kinds доехали в `config.md`; редактор без git ⇒ не `static`). Черновики форм
`content`/`rendering`/`seo`/`images` — `14-content-architecture.md` §4.

### 9.4 Правила, скиллы, FSD-карта

Правила: `render-safety` (сборка · запрос · остров: секреты не в клиентском бандле, request-only
API не в prerender, модульное состояние не в on-demand роутах, hydration mismatch, черновики не в
сборке), `seo-invariants`, `content-invariants` (обязательный frontmatter, бюджеты
title/description, один h1 не в теле, alt, slug/редиректы, даты, разрешимость ссылок),
`cache-and-rendering`; переписанные `env-local` (`process.env` + явный whitelist, `SITE_URL`
runtime), `tests-pipeline` (контентные гейты), `fsd-architecture` (server routes, `shared/seo|content|images`),
`shared-ui` (токены — единственный источник; scoped-CSS только для layout).
Скиллы: `/smartdev` (шаблонность по `@stit/ssr-frontend-template`, SEO-гейт, `kin:diff`),
`/init-service` (гейт «все обязательные stable», SEO-сводка перед этапом 3), `/stack-deep-dive`
(13 волн, cross-kind проверки), `/de-template` (env-контракт Node, robots/sitemap из `seo.md`,
prune контента/демо-OG/демо-`SITE_URL`/модуля кабинета), `/scaffold` (`page`/`collection`/
`feature`/`widget`/`route`), `/release` (Node-образ, `SVC=site`, SEO-чеклист), **`/seo-audit`**
(тонкий поверх playwright-проекта `seo`), **`/content`** (запись по канону, `--from-strategy` для
лендинга, `pnpm check:content`).
FSD-карта в `<org>/strategy`: нового source-типа не нужно (сущность-контент = `source` на
data-item); минимальный канон-PR — колонки `indexable`/`freshness` в `pages.md`, потребитель
`<org>/site`, две проверки `/fsd-audit`, два вопроса `/fsd-deep-dive`, формулировка
«фронтовые поверхности» вместо «SPA-поверхности»; шаблон обязан работать и без PR (вывод
`indexable` из `guard` + исключения в `rendering.md`). Drift: канон `screens/README.md` в
strategy построен на манифесте `@stit/ui` — чинить отдельно.

### 9.5 Cross-repo (порядок обязателен)

1. `corp-infra-template/docs/ecosystem.md` — 7 шаблонов, `<org>/site ← ssr-frontend-template`,
   стрелку `@stit/ui` удалить, Skill index (`/seo-audit`, `/content`), `SITE_TAG`, абзац про
   поисковых/AI-краулеров в `crowdsec-whitelist.md`.
2. `business-strategy-template` (опц.) — канон-PR §9.4.
3. `project-infra-template-compose` — `compose/site.yml`; CrowdSec acquisition + postoverflows;
   `middlewares.yml.tpl` (`sslRedirect` убрать; `compress`, `www-to-apex`, `retry`, `staging-*`);
   `traefik.yml.tpl`; `.env.example` секция `site`; `Makefile bump --wait`; `deploy.sh
   ROLE_FILES[edge]`; `preflight-dns.sh` + `www`; `smoke.d/90-site.sh`; правила
   `traefik-routing`/`compose-and-services`; `docs/project/README.md § Generates`; `add-service`;
   `de-template` (prune `landing` → `placeholder`).
4. `go-backend-template` (только при кабинете с прямым доступом к `api.${DOMAIN}`) —
   `COOKIE_SAMESITE=Lax` для access-cookie, CORS; при BFF-прокси — не нужно.
5. `spa-frontend-template` — `docs/reference/ecosystem.md` (7 шаблонов, сосед `site/`, убрать
   `@stit/ui`, «когда SPA, когда сайт»), README-строка, бэкпорт `infra-svc` в
   `docs/stack/_templates/service.md`, починить `/release` (`-f docker/Dockerfile`, `--secret`).
6. Sweep «6 → 7» + удаление `@stit/ui`: `telegram-bot-template`, `go-backend-template`,
   `project-infra-template-compose`, `business-strategy-template`.
7. `stit-public` — освежающий PR (`ssr-frontend-template` → «Готово», `landing-template` →
   пресет, `project-docs-template` → `business-strategy-template`, `telegram-bot-template`,
   Vault/OTLP, `@stit/ui`).

---

## 10. Открытые вопросы владельцу (с рекомендациями)

| # | вопрос | рекомендация / статус |
|---|---|---|
| 1 | **Финалист** | **Astro 7** (§5.1); запасные — Nuxt 4.5 (SEO-пакет, Vue), Next 16 (LTS/ISR/React-кабинет) |
| 2 | Имя шаблона | **решено: `ssr-frontend-template`**; в прозе — «шаблон индексируемого сайта: static-first, SSR по необходимости» |
| 3 | `landing-template` из roadmap | пресет `landing` этого шаблона (одинаковые рантайм/гейт/FSD/Dockerfile), строку витрины перевести в пресет |
| 4 | Дефолт развилки абсолютных URL | **C** (prerender + штамповка `https://__site_origin__` при старте) для git-контента; **D** (server + `memoryCache` + single-flight/прогрев) — опция для CMS/API; **A** — только «одна среда», явной строкой в `rendering.md` |
| 5 | Язык островов | **без фреймворка по умолчанию** (`<script>` в `.astro`), Preact/Solid для состояния; React — только ради реюза конкретных компонентов SPA (форма на React = 93 КБ gzip) |
| 6 | Форматирование `.astro` | Biome не форматирует `.astro` (линтит — да). Жить без автоформата `.astro` (рекомендация) или вернуть Prettier + `prettier-plugin-astro` только на `*.astro` |
| 7 | **ESLint 9 → 10** | в SSR-шаблоне обязателен (`eslint-plugin-astro@3`); поднять и в SPA (там `@eslint/js@10` при `eslint@9` — peer уже нарушен) отдельной задачей |
| 8 | **Дефект SPA-шаблона**: `eslint-plugin-boundaries` без `settings['import/resolver'].typescript` — тихий no-op на `@/`-импортах (найдено потоками 09, 10, 12) | проверить и починить в `spa-frontend-template` отдельной задачей; в SSR-шаблоне резолвер сразу |
| 9 | Источник контента по умолчанию | git (Markdown + Zod-коллекции); «редактор без git» — **Decap CMS поверх Gitea** (PKCE, 0 контейнеров); headless — **Payload 3.89** (MIT, но только внутри Next.js + свой образ) или свой Go-бэкенд; **Directus 12 исключён** (MSCL-1.0: Core 3 места / 25 коллекций, ключ OIG продлевать ежегодно, отдельный на клиента); SaaS-CMS отклонён для РФ (трансграничка ст. 12 152-ФЗ, оплата, доступность) |
| 10 | Публикация = релиз при git-контенте | принять; инвариант «редактор без git ⇒ маршруты его коллекций не `static`» — блокирующий в `stack-deep-dive` |
| 11 | OG-картинки | статическая обложка/дефолт в базе; генератор satori+resvg (musl-пребилды) — опция (`+90 МБ` RSS при первой генерации у Nuxt-варианта — мерить и у Astro; `@resvg/resvg-js` 2.6.2 без релизов с 03.2024 — ещё довод держать генератор опцией) |
| 12 | Политика AI-краулеров | `AI_TRAINING=allow\|deny`, дефолт allow |
| 13 | Капча / доставка формы / аналитика | `CAPTCHA_PROVIDER=none` (лестница honeypot → time-trap → origin → rate-limit); если капча нужна — SmartCaptcha (35,6 КБ, 10 000/мес бесплатно, `CAPTCHA_FAIL_MODE=open` явно), Turnstile — только с осознанной трансграничкой, reCAPTCHA (357 КБ) — никогда. `FORM_DELIVERY` — список из **≥ 2 каналов** (`smtp,telegram` или `backend`) + durable-спул на volume + алерт «спул непуст > 15 мин»; Telegram не единственный канал (ограничения РКН с 10.02.2026), SMTP только платный (Яндекс 360 / Mail Space, 300/сутки, SPF+DKIM+DMARC). Метрика (95,8 КБ) после согласия и idle, строка бюджета третьих сторон ≤ 120 КБ; GA4 — `ANALYTICS=metrika\|ga4\|both\|none` с записью «в РФ может не собирать» (GTM/GA-домены с RU-машины не открываются; перепроверить с VPS) |
| 14 | Кабинет | `account` выключен по умолчанию; при включении — BFF-прокси `/api/*` + `SameSite=Lax` на бэкенде (`03` §2.4) |
| 15 | Локализованные slug'и | MAY; дефолт — общий slug + префикс `/en/` |
| 16 | Канон-PR в strategy (`indexable`/`freshness`) | ускорение; шаблон не зависит |
| 17 | CSP | v1 без строгого nonce; `Report-Only` + hash-режим, фиксируется в `seo.md` |
| 18 | Staging | Traefik `basicAuth` **и** `customResponseHeaders: X-Robots-Tag` (на prerendered из приложения недостижимо) + `ROBOTS_POLICY=noindex` для on-demand/robots.txt |
| 19 | Дефекты infra (CrowdSec acquisition, `sslRedirect`) | **первый отдельный PR** до любого сайта |
| 20 | Бюджеты §6.5 и e2e-бюджет «0 script-ресурсов на индексируемых страницах» | принять как гейт |
| 21 | `mem_limit` сайта | 512 МБ для C; для D с `/_image`/OG-генерацией — 768 МБ |
| 22 | Версионная политика Astro | точные версии, шаблон на мажоре N, форки не дальше N−1, апгрейд через `npx @astrojs/upgrade` + `pnpm check` |
| 23 | Негативные фикстуры гейта (`.gate-fixtures/`, «линтер обязан упасть») | принять — единственная защита от молчаливых деградаций (Steiger fail-open, пустой a11y-конфиг) |
| 24 | Шрифт по умолчанию | **Wix Madefor Text Variable** (текст: курсив есть, 13,8 КБ) + Onest или Golos Text (акциденция), суммарно 29–35 КБ; одним семейством — Rubik; решается вместе с токен-слоем; провайдер `fontsource` (версия в lock), `local` — для брендовых |
| 25 | A11y-матчер в `pnpm check` | свой матчер ~20 строк поверх `axe-core` 4.13 (или `jest-axe` 11); `vitest-axe` не брать; LHCI — отдельный stage (внутри Lighthouse 12.6.1), бюджеты в `budget.json` |
| 26 | Cookie-баннер | остров с двумя категориями («технические» всегда, «аналитика» по согласию); включение — решение владельца сайта (R-6); счётчики физически не грузятся до согласия |
| 27 | Юридический чек-лист заказчика | политика ПДн (плейсхолдеры оператора — блокер `/de-template`), уведомление РКН, `consent_version` в заявке, хранение в РФ, каналы доставки проверены с VPS; текст визирует юрист; позиция РКН по cookie — первоисточник не найден |

---

## 11. Главные риски

1. **Новизна Astro 7** (`routeRules`/`cache`/`src/fetch.ts` — три месяца от релиза) и мажор
   каждые ~3,5 мес с поддержкой «security-only на один предыдущий» — политика апгрейдов пишется
   заранее; точные версии.
2. **Cloudflare** — код MIT и governance открыт, но приоритеты могут дрейфовать к Workers;
   индикатор — остаётся ли `memoryCache()` дефолтным провайдером (R-1); ни одной
   Cloudflare-зависимости в шаблоне.
3. **`memoryCache` без single-flight** и `/_image` на запрос — в варианте D под всплеском
   трафика лавина рендеров и RSS до 360 МБ; дефолт C + прогрев/single-flight в `src/fetch.ts`
   для D.
4. **`X-Robots-Tag` на prerendered недостижим в приложении** — staging обязан закрываться
   на Traefik; забытая middleware = проиндексированный staging.
5. **Штамповка плейсхолдера**: забытый `__site_origin__` уедет в выдачу — e2e-тест
   обязателен; HTML нельзя предсжимать.
6. **Steiger fail-open** (нерезолвимый импорт = «нарушения нет»), слеп к целям
   `.astro` и глубже первого уровня `pages` — границы держит ESLint `boundaries` (с резолвером!)
   + `no-restricted-imports`; негативные фикстуры в гейте.
7. **ESLint 10 / Biome experimental** — расхождение гейтов SPA и SSR; фиксировать версии
   Biome точно.
8. **Server-only код в public API слайса** (`defineAction`, `astro:content`, `node:*`)
   убивает гидрацию/сборку; barrel + top-level вызовы тянут zod/контент в клиент — правила
   `.claude/rules` + `no-restricted-imports` override только для навязанных entry.
9. **Образ 316 МБ** (выход Astro не self-contained) — прунинг обязателен; при росте —
   `node:24-slim` не поможет (те же deps).
10. **Публикация = релиз** при git-контенте; ежедневные новости — сразу CMS/API + D.
11. **Дефекты infra** (CrowdSec acquisition, `sslRedirect`) — до первого сайта.
12. **Соц-краулеры и стриминг** — `experimentalDisableStreaming` доезжает до манифеста, но
    эффект curl'ом не виден; при `output: 'static'` стриминга и так нет; для D — проверить
    первый чанк отдельно.
13. **Nuxt 5 / SvelteKit 3** — не наш риск при Astro, но фиксируется для запасных.
14. **Лицензия Directus 12 (MSCL-1.0)** — схема «поставил заказчику и ушёл» ломается о ежегодное
    продление ключа OIG и лимиты Core (3 места / 25 коллекций); в дефолтах шаблона Directus нет,
    у существующих заказчиков — строка в `content.md` с датой истечения ключа.
15. **Доставка заявок**: Telegram ограничивается РКН поэтапно с 10.02.2026, бесплатный SMTP у
    Яндекса/Mail.ru закрыт с июня 2026 — одноканальная доставка теряет лиды; спул на диске +
    ≥ 2 канала + алерт; `api.telegram.org` и GA-домены проверять с VPS заказчика, не с машины
    разработчика.
16. **Третьи стороны против бюджета**: Метрика 95,8 КБ + SmartCaptcha 35,6 КБ = 131 КБ > потолка
    120 КБ — на одной странице только по явному решению; GA4 в РФ может не собирать данные вовсе.
17. **Стагнирующие пакеты гейта**: `vitest-axe` (нет релиза с 2022), `@lhci/cli` (Lighthouse
    12.6.1 внутри), `@resvg/resvg-js` (2.6.2 от 03.2024) — свой матчер, отдельный stage, генератор
    OG опцией.

---

## 12. План реализации `ssr-frontend-template` (Astro 7)

Исполнитель — Fable по этому синтезу и отчётам 07/08/12/14 (написаны как спецификации:
листинги конфигов, точные версии, ловушки). Порядок фаз — по зависимостям; каждая
заканчивается гейтом.

| фаза | содержание | гейт |
|---|---|---|
| **0. Решения и инфра** | ответы §10; отдельный PR в `project-infra-template-compose`: CrowdSec acquisition + `rdns`/`seo-bots-whitelist`, убрать `sslRedirect`, `compress` (`[br, zstd, gzip]`), `www-to-apex`, `retry`, `staging-noindex` (`X-Robots-Tag`), `staging-auth`, `accessLog.filePath` + `X-Request-Id`, `Makefile bump --wait`; (опц.) починить `boundaries`-резолвер и `@eslint/js` в SPA | ответы зафиксированы; PR смержен |
| **1. Фундамент репо** | fork SPA → `ssr-frontend-template`; перенос идентичного ядра обвязки и токен-слоя; `astro.config.ts` (§5.1), `tsconfig` (`astro/tsconfigs/strictest` + флаги SPA), `src/{app,pages,widgets,features,entities,shared}` + навязанные реэкспорты (`content.config.ts`, `middleware.ts`, `fetch.ts`, `actions/`); `shared/config` (Zod по `process.env`, `SITE_URL` обязателен); `app/layouts/document.astro`; `docker/{Dockerfile,entrypoint.sh,server.mjs}`; `/healthz`; JSON-логгер; гейт: `astro check`, Biome (флаг), ESLint 10 (`astro`, `boundaries@7` + resolver, `no-restricted-imports` по слоям, override для навязанных entry), Steiger (§4 конфиг), Vitest 5 (`getViteConfig`, два проекта), Playwright (webServer на prod-сборке, `/healthz`), size-limit 14 (JS островов, CSS, HTML главной/поста), lefthook 2, commitlint 21; `.gate-fixtures/` с негативными фикстурами; `docs/reference/kinship.md` + `pnpm kin:diff` | `pnpm check` зелёный на smoke; образ отвечает 200/404/301 через Traefik; `curl -A Googlebot` даёт полный HTML; `docker stop` < 1 с с дренажем; `grep __site_origin__ dist` = 0 после штамповки |
| **2. Контент-слой** | `entities/<name>/{content/{ru,en},model/schema.ts,api/queries.ts,ui}`; `glob({ base })`; `translationKey`; `draft`; `content/redirects.yaml` + загрузчик (301/410 одним хопом, гейт на циклы); `check:content` (Zod по всем `.md`, бюджеты title/description, один h1 не в теле, alt, разрешимость ссылок); `check:links` по `dist`; preview (HMAC-токен, cookie, `noindex`, `no-store`) | `pnpm check:content`, `check:links` зелёные |
| **3. Рендер и кеш** | режимы на маршрут (`prerender` per route; таблица `rendering.md`); вариант C (штамповка) как дефолт; D за флагом: `cache: memoryCache()` + `routeRules` + single-flight в `src/fetch.ts` + прогрев горячих URL + `/internal/revalidate` (HMAC) + `/internal/cache/flush`; `X-Robots-Tag` middleware для on-demand; нормализация — что даёт адаптер (301 на слеш) + Traefik для `/index.html` | 200 параллельных на холодный ключ (D) = 1 рендер; TTFB prerender ≤ 2 мс; staging: `robots.txt` = `Disallow: /` |
| **4. SEO-слой** | `shared/seo/{urls,seo-head.astro,json-ld(+Zod),hreflang,robots,sitemap,rss,indexnow,yandex-noindex}`; `pages/{robots.txt,sitemap.xml(+шарды),rss.xml}.ts`; JSON-LD `Organization`+`WebSite` на корне, `BreadcrumbList`, `Article`; OG: обложка контента/дефолт, генератор — опция; `e2e/seo.spec.ts` (статусы, мета, canonical, hreflang, JSON-LD, robots↔sitemap, «HTML без JS содержит h1», «0 script-ресурсов на индексируемых», «нет абсолютных URL своего origin в `<body>`», «нет `__site_origin__`», «нет noindex на prod», размер HTML); `scripts/seo-check.mjs` для гейта; Lighthouse CI отдельным stage | `pnpm seo:check` в `pnpm check`; `seo.spec.ts` зелёный на prod-профиле |
| **5. Reference-слайсы** | набор §6.6 по пресетам `content-site`/`landing` (`index`, `about`, `blog/*`, `catalog/*` из `httpSource`+mock, `contacts`+`spasibo`, `legal/privacy`, `search`, `now`, `account` выключен, 404/500); формы (эндпоинт PRG + honeypot + time-trap + origin-check; `FORM_DELIVERY` как список каналов + durable-спул на volume `/var/spool/leads` с ретраями, `retry_after` и алертом; `CaptchaVerifier` по `CAPTCHA_PROVIDER` с явным `CAPTCHA_FAIL_MODE`; e2e «канал недоступен → 303 и файл в спуле», «тело заявки не в логах»); картинки build-time (`astro:assets`) + runtime `/img/*` с allowlist; шрифты (Astro `fonts`: Wix Madefor Text + Onest, `subsets: ['cyrillic','latin']`, `weights: ['400 800']`, `optional`/`swap`, метрики фолбэка); тема из cookie; острова — vanilla/Preact; аналитика после согласия (cookie-баннер с категориями «технические»/«аналитика», e2e-строка бюджета третьих сторон); `legal/privacy` с плейсхолдерами оператора | каждый режим и SEO-приём ровно раз; prune-лист; бюджеты §6.5 |
| **6. Обвязка** | `docs/stack` 13 kinds + `_templates` (`content`, `rendering`, `images`, `seo` — черновики 14 §4; остальные — переписать под Node/Astro); правила (`render-safety`, `seo-invariants`, `content-invariants`, `cache-and-rendering`, переписанные `env-local`/`tests-pipeline`/`fsd-architecture`/`shared-ui`, выдержки Astro-API в `astro-*.md` — `llms.txt` у Astro нет); скиллы (`smartdev`, `plan`, `init-service`, `stack-deep-dive` 13 волн + cross-kind, `de-template` (env-контракт, prune контента/демо-OG/демо-`SITE_URL`/кабинета, блокер на плейсхолдеры оператора в политике ПДн), `scaffold` (`page`/`collection`/`feature`/`widget`/`route`, `.astro`-шаблоны, `index.ts` с explicit re-export), `release` (Node-образ, `SVC=site`, `-f docker/Dockerfile --secret`, SEO-чеклист + юридический чек-лист: политика, уведомление РКН, каналы доставки проверены с VPS), **`seo-audit`**, **`content`**); `docs/reference/{architecture,ecosystem,deployment,observability,seo,kinship}.md`, `getting-started.md`, `CLAUDE.md` («границы держит `pnpm lint`, не Steiger»), README | `/init-service` → `/de-template` проходят на тест-форке; `/scaffold page` даёт зелёный гейт |
| **7. Инфра и экосистема** | `compose/site.yml` (§8) и список §9.5; канон `corp-infra-template/docs/ecosystem.md`; sweep «6 → 7» + `@stit/ui`; (опц.) strategy-PR; `stit-public` освежающим PR | первый сайт задеплоен `make bump SVC=site`, `/seo-audit` чист, Search Console/Вебмастер подтверждены, JS-рендеринг в Вебмастере выключен |

Оценка объёма: фазы 1–4 — ядро (по отчётам 08/12 это ~2–3 тыс. строк кода + конфиги),
фазы 5–6 — самая большая часть по тексту (13 kinds, 8 скиллов, правила, доки), фаза 7 —
cross-repo. Всё пишется по forward-only: без «было/стало».

---

## Приложение: карта отчётов (`docs/research/ssr/`)

| файл | поток | что внутри |
|---|---|---|
| `01-frameworks.md` | раунд 1 | матрица со старыми весами, разбор TanStack Start |
| `02-seo-canon.md` (+ `_sub-yandex`, `_sub-meta`, `_sub-og`, `_sub-perf`) | раунд 1 | канон SEO MUST/SHOULD/MAY с источниками, Яндекс vs Google, чеклисты |
| `03-stack-transfer.md` | раунд 1 | перенос SPA-стека в Start (auth/cookie-анализ, серверный mock — остаются в силе как разбор) |
| `04-runtime-deploy.md` | раунд 1 | Dockerfile, `compose/site.yml`, env-контракт, Traefik/CrowdSec, дефекты infra |
| `05-template-design.md` | раунд 1 | репо-стратегия, kinship, kinds/скиллы (пересобрано в 13) |
| `06-spike.md` | раунд 1 | эмпирика TanStack Start (контрольная точка) |
| `round2/brief.md`, `brief-v2.md` | раунд 2 | факты об экосистеме, критерии и спецификация spike |
| `round2/07-landscape-v2.md` | раунд 2 | матрица с новыми весами, топ-3 |
| `round2/08…11-spike-*.md` + `round2/spikes/*` | раунд 2 | эталонные сайты Astro/Nuxt/SvelteKit/Next, единая таблица измерений |
| `round2/12-tooling-fsd.md` + `round2/spikes/tooling-lab` | раунд 2 | инструменты гейта × форматы, FSD-маппинг, конфиги |
| `round2/13-template-v2.md` | раунд 2 | дизайн шаблона под не-React |
| `round2/14-content-architecture.md` (собран из 14 + 14a) | раунд 2 | референс-архитектура контент-сайта: источники и CMS-лицензии, режимы рендера, картинки/шрифты/поиск/формы/аналитика, право РФ, бюджеты, a11y, версии, черновики kinds, инварианты C-1…C-26 |
| `round2/14a-content-gaps.md` | раунд 2 | сырой выход потока 14a (секции, вставленные в 14; замеры с RU-машины 2026-09-16) |
