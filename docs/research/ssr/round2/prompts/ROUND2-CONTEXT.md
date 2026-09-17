# Контекст перезапуска второго раунда (2026-09-16, 22:00 МСК)

Этот файл — для всех агентов потоков 07–12 и 14a. Прочитать после `brief.md` и `brief-v2.md`.

## Решения владельца, принятые после брифов (обязательны)

1. **Имя шаблона — `ssr-frontend-template`** (владелец подтвердил 2026-09-16; предложение
   `site-template` из `13-template-v2.md` отклонено). Форк потребителя — `<org>/site`,
   `SVC=site`, `SITE_TAG`, `compose/site.yml` — без изменений.
2. Ресёрч завершают агенты Opus; сам шаблон затем реализует другая модель по итоговому синтезу.
   Значит отчёты должны быть **достаточными, чтобы по ним писать код без повторного ресёрча**:
   точные версии, точные имена опций, листинги конфигов, ловушки с URL.
3. Профиль, веса критериев, спецификация spike и таблица измерений — только из `brief-v2.md`.

## Правила совместной работы (несколько агентов одновременно)

- Каждый агент пишет **только** в свой каталог scratchpad (`spike-<fw>/`, `tooling-lab/`) и в
  `research/<NN>-*.md`. Чужие каталоги не трогать.
- Порты: astro 3201 · nuxt 3202 · sveltekit 3203 · next 3204. Другие порты 3205–3299 — свободны
  для вспомогательных экспериментов, занимай явно и освобождай.
- Останавливать только **свои** процессы (по PID/порту). `pkill node`, `killall node` — запрещены.
- Ничего не менять под `/home/mm/git/stit-core/` — только читать.
- Машина: Node v24.9.0, pnpm 10.0.0, Docker 29.8, 20 CPU, RAM ~15 ГБ (доступно ~4–5 ГБ +
  swap) — сборки могут быть медленными, это не ошибка. `ImageMagick` нет, `sharp` есть.
- В спайках `node_modules` не сохранялись: первый шаг — `pnpm install --frozen-lockfile`
  (если лок несовместим — `pnpm install` и зафиксировать, что изменилось).

## Что уже сделано (прерванный прогон 2026-09-15) — продолжать, не начинать заново

| поток | состояние | каталог |
|---|---|---|
| 08 astro | проект собран, prod-сервер поднимался на 3201, батарея измерений начата, отчёт не записан | `spike-astro/` |
| 09 nuxt | проект собирается (`nuxt build`), отчёт не записан | `spike-nuxt/` (+ `.data/content/contents.sqlite`) |
| 10 sveltekit | дошёл до слоя маршрутов (нет `blog/[slug]`, `contact`, `now`, `/en/*`, `healthz`, `robots.txt`, `sitemap.xml`, `rss`) | `spike-sveltekit/` |
| 11 next | собирается, standalone-сервер запускался на 3204, отлаживал `src/proxy.ts` (локаль без префикса) | `spike-next/` (FSD-слой pages лежит в `src/views/`, тонкие `page.tsx` в `src/app/[lang]/`) |
| 12 tooling | поставлены ESLint-плагины (astro/vue/svelte), фикстуры, flat-config с boundaries; отчёт не записан | `tooling-lab/` (+ `astro-fsd/` вариант `srcDir: src/app`, `astro-variant-a/` колокация в pages, `biome-*`, `a11y-probe/`) |
| 07 landscape | собраны данные npm/HTTP Archive/Web Almanac; дочерние агенты упали | данные в `v2/` |
| 14 content-arch | отчёт записан, но без TL;DR, §2.1.5, §2.7.3–2.7.4, §2.12.1, §2.15; секции 2.3–2.7 и 2.13.3 лежат отдельно в `v2/sec-2-3-to-2-7.md`, `v2/sec-2-13-3.md` | `research/14-content-architecture.md` |

## Факты, найденные упавшими агентами (из транскриптов; **перепроверить**, не цитировать как проверенные)

### Инструменты (поток 12)
- `@feature-sliced/steiger-plugin@0.7.0` содержит tree-sitter WASM-парсеры `astro`/`svelte`/`vue`/`tsx`
  (`dist/parsers`) и извлекает импорты из frontmatter `.astro`, `<script>` `.svelte`, `<script setup>` `.vue`.
- Экстрактор бросает исключение на неизвестном расширении, но на call-site стоит безопасный `continue`.
- Резолвер (`@feature-sliced/filesystem`) использует `ts.resolveModuleName` → для целей
  `.svelte`/`.vue`/`.astro` возвращает `null` (импорт **в** файл фреймворка не резолвится).
  Реальный прогон CLI на фикстурах: «Steiger caught format-aware imports», но часть пропущена — причина не записана.
- Структурные правила работают на `.svelte`; `index.svelte` принимается как public API; пробел с `.mts`/`.cts`.
- Biome 2.5.13: `.astro` frontmatter — из коробки; матрица поддержки Vue/Svelte/Astro — «partial (🟡)»;
  флаг `html.experimentalFullSupportEnabled: true` убрал 6 ложных срабатываний и дал почти полную поддержку
  (script, template, `<style>`), форматирование с флагом тоже работает.
- ESLint latest — **10.10.0**; `eslint-plugin-astro@3.1.0` требует `eslint >=10`; в лаборатории ESLint 9.39.5
  с плагинами тоже ставился. В SPA-шаблоне ESLint 9.39.5 — мажорный апгрейд гейта надо оценить.
- Playwright latest 1.63.0. Vitest 5.0.x вышел (в spike'ах astro/nuxt стоит `^5.0.1`, в sveltekit 4.1.11).
  Существует `vitest-browser-astro`; `@vitest/browser-*` разделён на пакеты.

### Ландшафт (поток 07)
- **Cloudflare приобрёл Astro** — «подтверждено пресс-релизом» (найти первоисточник, дату, что обещано про
  open-source/governance; это ключевой факт для критерия «зрелость и риск»).
- SolidStart **2.0.0 GA 2026-08-04**: без Vinxi и без Nitro в deps (h3 v2 + srvx); `routeDir` настраивается;
  `experimental.islands` жёстко `false`; опции prerender в конфиге нет — SSG через Nitro v3 prerender по докам;
  docs.solidjs.com отдаёт llms.txt и сырые `.md`; MDX-плагины Solid устарели (эпоха Vinxi); официальных
  MDX/image-пакетов в репо SolidStart нет.
- Qwik 2 — всё ещё beta (`2.0.0-beta.43`); Qwik Router бандлит MDX/frontmatter/imagetools/static-адаптер;
  `routesDir` настраивается; sitemap генерируется в SSG; qwikloader 5.2 KB raw / 2.4 KB gzip;
  «пол» JS = qwikloader 2.3 KB + preloader 2.0 KB gzip; был найден пост про governance Qwik (проверить).
- Eleventy v4 переехал в `11ty/buildawesome` (MIT), появилось TypeScript-дерево зависимостей;
  Eleventy Serverless закрыт (404).
- Fresh — Deno-only (JSR `node: false`), доки на usefresh.dev, latest 2.3.3 (2026-04-28) → выбывает.
- Web Almanac 2025: главы JavaScript нет (последняя — 2024); page-weight = сжатые transfer-байты.
- HTTP Archive CWV/tech report за 2026-08-01 выгружен в `v2/ha_table.txt` (колонки: доля origin'ов с
  хорошим CWV mobile/desktop, LCP/INP/CLS, медианный JS и total KB, Lighthouse perf, adoption).
  Astro 71 % CWV mob / JS 396 KB; SvelteKit 50.6 % / 457; Nuxt 28.6 % / 1053; Next App Router 38.3 % / 664;
  Qwik 62.5 % / 2823 (!); SolidStart 66.7 % (9 origins); Eleventy 84.5 % / 164; TanStack Start 23.4 % / 404.
- Next.js 16 отдаёт «действительно минифицированный» prod-код — измеренный JS выглядел высоким, проверялось.
- Локальный контролируемый бенчмарк «одинаковая статическая страница в каждом фреймворке» был начат (5 собраны),
  не завершён; каталоги не сохранились.

### Контент-архитектура (поток 14)
- Найдена **смена лицензии Directus v12** (детали не записаны — проверить условия, влияние на self-host).
- Яндекс.Метрика: официальная страница «альтернативный домен» для tag.js; размер tag.js измерялся curl'ом.
- Telegram: «критическая находка по доступности в России» (проверить статус блокировок/ограничений 2026 и
  что это значит для доставки заявок через Bot API).
- SMTP: лид про «ограничения бесплатного SMTP-доступа с июня 2026» — проверить по первоисточникам.
- 152-ФЗ: поправка — **266-ФЗ** (а не 233-ФЗ); упоминание 265-ФЗ от 26.07.2026 (ст. 12) — проверить на
  publication.pravo.gov.ru; штрафы — 420-ФЗ, КоАП ст. 13.11 (суммы сверить по первоисточнику).

## Состояние SPA-шаблона (для сверки, read-only)

`/home/mm/git/stit-core/spa-frontend-template` — версии и структура описаны в `brief.md`.
Конфиги гейта: `steiger.config.ts`, `eslint.config.js`, `biome.json`, `vitest.config.ts`,
`.size-limit.cjs`, `lefthook.yml`, `package.json#scripts`.
