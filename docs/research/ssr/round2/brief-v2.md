# Бриф второго раунда: грамотный стек для контент-first индексируемых сайтов

Дата: 2026-09-15. Язык отчётов — русский (идентификаторы, пакеты, команды — как есть).
Базовый бриф первого раунда (факты об экосистеме stit и SPA-шаблоне) — `scratchpad/brief.md`,
прочитать его **первым**. Этот файл — поверх него.

## Что изменилось после первого раунда

Первый раунд (отчёты `scratchpad/research/00…06`) исходил из критерия «максимальный реюз
SPA-шаблона» (вес 30/100) и рекомендовал TanStack Start. Владелец переориентировал задачу:

> Не обязательно быть максимально похожим на SPA. Взять оттуда наработки — да, но стек собрать
> максимально **грамотно**, а не исходя из того, что есть. Нужен грамотный стек, а не похожий.

Ответы владельца на уточняющие вопросы (2026-09-15):

| вопрос | ответ |
|---|---|
| UI-слой | **React не обязателен.** Открыт к не-React (Astro с островами любого фреймворка или без, SvelteKit, SolidStart, Nuxt/Vue, Qwik…), если это объективно лучше для индексируемых сайтов |
| Профиль сайтов | **Контент-first**: лендинги, блоги, каталоги, доки, корпоративные сайты; интерактив точечный (формы, фильтры, калькуляторы); кабинет за логином — опционален, не главный сценарий |
| Хостинг | **Как в экосистеме**: один Node-образ в registry `git.stit.tech`, docker-compose + Traefik v3 + CrowdSec на VPS, один VPS на среду, **без CDN** |
| Обязательное наследие SPA | (1) **агентная обвязка**: `CLAUDE.md`, `.claude/rules`, скиллы `/smartdev` `/plan` `/init-service` `/stack-deep-dive` `/de-template` `/scaffold` `/release`, `docs/stack` (kinds с `Generates`), planning-first, forward-only; (2) **FSD + Steiger** (слои `app/pages/widgets/features/entities/shared`, архитектурный линтер); (3) **гейт и инструменты**: Biome + ESLint + Vitest + Playwright + size-limit, `pnpm check`, lefthook, TS strict (React Compiler — только если React) |

Следствие: реюз React-кода SPA (формы на TanStack Form, entities-queries) — приятный бонус,
а не критерий. Реюз **обвязки** (скиллы/доки/гейт/FSD) — обязателен.

## Новые критерии оценки (веса из 100)

| критерий | вес | что именно |
|---|---|---|
| Качество выдачи для контентного сайта | 25 | HTML-first, ноль/минимум JS по умолчанию (острова / partial hydration / resumability / RSC), CWV из коробки, streaming не во вред ботам, размер документа |
| SEO-инструментарий из коробки | 20 | head/metadata API, sitemap, robots, canonical, trailing slash, редиректы со статусами, честные 404/410, i18n-роутинг с hreflang, structured data, OG-image, RSS, image optimization (AVIF/WebP, размеры), fonts |
| Контент-пайплайн | 15 | content collections / content layer (Markdown/MDX с типизацией Zod), loaders из CMS/API, preview, гибрид static+server per route, on-demand revalidation/ISR **без CDN** (серверный кеш) |
| Зрелость и риск | 15 | GA/семвер, каденс мажоров, LTS, размер экосистемы, качество доков (в т.ч. для AI-агентов: llms.txt, стабильные API), найм |
| Совместимость с обязательным наследием | 15 | FSD-раскладка (`src/pages` + свободные слои) без борьбы с конвенциями фреймворка; Steiger/Biome/ESLint/Vitest/Playwright/size-limit реально работают с форматом компонентов (`.astro`/`.svelte`/`.vue`/`.tsx`); TS strict |
| Self-host одним Node-образом без CDN | 10 | адаптер Node, размер образа, RSS, статику отдаёт сам процесс, prerender реально отдаётся, healthcheck, graceful shutdown, кеш HTML в процессе |

Lock-in и стоимость поддержки — учитывать в «зрелости».

## Кандидаты (проверить актуальные версии/статусы на 2026-09-15 через web, не из памяти)

Astro (текущий major; острова React/Svelte/Solid/Preact или без; `output: 'static' | 'server'` +
per-route `prerender`; `@astrojs/node`; content layer; `astro:assets`; встроенный i18n; actions;
server islands; sessions) · **Nuxt** (Vue; Nitro; route rules `prerender/swr/isr`; Nuxt Content;
Nuxt Image; Nuxt SEO — sitemap/robots/schema-org/og-image/link-checker; `@nuxtjs/i18n`) ·
**SvelteKit 2** (`adapter-node`; per-route `prerender`; form actions; hooks; `enhanced-img`;
paraglide; mdsvex) · **SolidStart** · **Qwik City** (resumability) · **Next.js 16** (RSC,
Metadata API, `sitemap.ts`/`robots.ts`, `next/image` self-host, ISR с fs-кешем, PPR,
`output: 'standalone'`) · **React Router 8** framework mode · **TanStack Start** (уже
изучен, см. `01-frameworks.md`) · **Eleventy** (SSG-baseline, как ориентир «сколько весит
честный HTML») · при желании — Fresh/Deno, Hono + JSX SSR (минимализм).

Для каждого — не только «есть фича/нет», а как именно и насколько зрело.

## Общая спецификация эталонного spike (одинаковая для всех фреймворков — ради честного сравнения)

Каталог: `scratchpad/spike-<framework>/`. Ничего вне scratchpad не трогать. Порты 3200–3299
(по одному на spike, не 5173/3100/3101). Не тратить > ~25 минут на один тупик — фиксировать и идти дальше.

**Контент-сайт «stit demo»**, ru по умолчанию без префикса, en под `/en/`:

| маршрут | что | режим |
|---|---|---|
| `/` | hero + 3 последних поста + CTA | prerender |
| `/blog` (+ `/blog/2`… или `?page=`) | список 12 постов, пагинация по 5, self-canonical на каждой странице | prerender |
| `/blog/<slug>` | Markdown-пост с обложкой (responsive AVIF/WebP), breadcrumbs, `Article` JSON-LD, `lastmod` | prerender |
| `/about` | статичная страница | prerender |
| `/contact` | форма (имя, email, сообщение) — интерактивный остров/компонент + серверный обработчик POST (honeypot), ответ «спасибо» | prerender + server endpoint |
| `/now` | страница, рендерящаяся на каждый запрос (время сервера), `Cache-Control: no-cache` — демонстрация on-demand | server |
| `/en/…` | зеркала `/`, `/blog`, `/about` на английском | prerender |
| `/old` | → 301 на `/` | конфиг/код |
| `/xx/…` и `/blog/net-takogo` | честный 404 с разметкой | — |
| `/robots.txt`, `/sitemap.xml`, `/healthz` | server endpoints (или встроенные, если они умеют runtime `SITE_URL`) | — |

Контент: 12 постов в Markdown с frontmatter (`title`, `description`, `pubDate`, `updatedDate`,
`cover`, `tags`), схема типизирована (Zod или встроенная); обложки — сгенерированные PNG 1600×900
(ImageMagick/`sharp`/canvas — что доступно; можно однотонные с текстом). Шрифт — self-host WOFF2
(`@fontsource-variable/*` или любой локальный), `font-display: swap`/`optional`.

**SEO в head каждой страницы**: title, description, absolute canonical из `SITE_URL` (env
рантайма, не билд-константа!), hreflang ru/en/x-default, OG (title/description/type/url/image),
`<html lang>`, для приватного/служебного — `noindex`. Trailing slash — `never` (проверить код
редиректа). Staging-режим: env `ROBOTS_POLICY=noindex` → `X-Robots-Tag` + `Disallow: /`.

**FSD-раскладка** (обязательное наследие): `src/{app,pages,widgets,features,entities,shared}`;
`pages` — маршруты фреймворка (если фреймворк требует другой каталог — настроить, если нельзя —
зафиксировать как минус); контент постов — в `entities/post/content/*.md` (или ближайшее
допустимое место), форма — `features/contact-form`, секции — `widgets/*`, seo-хелперы —
`shared/seo`. Прогнать **Steiger** (`steiger src`) и записать, видит ли он импорты в
компонентах фреймворка; прогнать **Biome** (`biome check`) и ESLint с плагином фреймворка;
один Vitest-тест схемы контента + один тест компонента (если фреймворк поддерживает);
Playwright smoke (2 теста: главная без JS содержит h1 и canonical; 404 — код 404);
`size-limit` на клиентские ассеты; TS strict (`tsc --noEmit` / `astro check` / `svelte-check` / `nuxi typecheck`).

**Сборка и запуск**: production-сборка + запуск как Node-процесс (adapter-node / node-server /
standalone), `PORT=32xx`, `SITE_URL=http://localhost:32xx`. Dockerfile по образцу
`04-runtime-deploy.md` §3.1 (node:24-alpine, только выход сборки, `USER node`, HEALTHCHECK);
если `docker` доступен — собрать и записать размер образа, иначе — размер каталога сборки.

**Измерения (таблица, одинаковая для всех)**:

| метрика | как |
|---|---|
| время `build` | `time` |
| размер выхода сборки | `du -sh` |
| размер Docker-образа | `docker images` или оценка |
| HTML главной / поста (байт, gzip) | `curl --compressed` + `wc -c`, `gzip -9c \| wc -c` |
| JS, реально загружаемый главной / постом / контактами (gzip) | Playwright: суммировать `response.body().length` по `script`-ресурсам; отдельно — «ноль JS на странице без островов?» |
| CSS (gzip) | то же |
| изображения: форматы и `srcset` у обложки, размер AVIF/WebP | из HTML + `curl -I` |
| TTFB медиана 20 запросов: `/`, `/blog/<slug>`, `/now`, `/healthz` | `curl -w '%{time_starttransfer}'` |
| RSS процесса idle и после 200 параллельных запросов | `ps -o rss` |
| статусы: `/old` (301?), `/blog/net-takogo` (404?), `/xx/` (404?), `/about/` (код нормализации слеша) | `curl -o /dev/null -w '%{http_code}'` |
| prerender-страницы отдаются самим Node-процессом? (`/`, `/about`) | сравнить тела двух запросов `/now` vs `/about` — статичный ли |
| заголовки: `Cache-Control` на HTML и `/assets`, ETag, сжатие | `curl -I` |
| контент до гидрации для `User-Agent: Googlebot` | `curl -A Googlebot` — есть h1 и текст поста |
| hreflang/canonical/OG/JSON-LD присутствуют в сыром HTML | `curl -s \| grep -a` |
| dev-опыт | время старта dev, HMR для контента, `--host` |
| совместимость с наследием | Steiger / Biome / ESLint / Vitest / Playwright / size-limit — что реально работает с форматом компонентов, что нет |

**Отчёт spike**: `scratchpad/research/<NN>-spike-<framework>.md` — TL;DR, версии (`pnpm ls
--depth 0`), итоговые конфиги (листинги), дерево `src/` и выхода, **единая таблица измерений
выше**, таблица проверок ✅/❌/⏭, подводные камни (с URL на доки/issue), вердикт «насколько
грамотно это для контент-first сайта в нашей экосистеме» (и что пришлось бы выдумывать самим).

## Что из первого раунда остаётся в силе (читать, не переделывать)

- `02-seo-canon.md` — канон технического SEO (Google + Яндекс) — framework-agnostic; spike'и
  проверяют, насколько фреймворк закрывает MUST-требования из коробки.
- `04-runtime-deploy.md` — деплой одним Node-образом за Traefik/CrowdSec без CDN; дефекты
  infra; env-контракт. Меняется только «что внутри образа».
- `05-template-design.md` — репо-стратегия (отдельный репо), kinds `rendering`/`seo`, скиллы,
  reference-слайсы, cross-repo; потребует правок под не-React стек (отдельный поток).
- `06-spike.md` — эталон формата spike-отчёта и эмпирика по TanStack Start (для сравнения).

## Формат отчёта потока (не-spike)

Как в `brief.md`: TL;DR → Findings с URL и пометками «проверено <дата>» / «предположение» →
Рекомендации → Риски/вопросы владельцу → Источники. Подробно, не экономь.
