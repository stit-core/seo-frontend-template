# BUILD-BRIEF — `ssr-frontend-template` v1 (Astro 7)

Единственная спецификация для агентов сборки. Каждая фаза — отдельный запуск агента с
отчётом; следующая фаза — только после зелёного гейта и приёмки главной сессией (§8).
Пути в документе — абсолютные. Репозиторий: `/home/mm/git/stit-core/ssr-frontend-template`
(remote `git@git.stit.tech:stit-core/ssr-frontend-template.git`, ветка `main`).

## 0. Принципы владельца (дословно) и правила репозитория

**Цель владельца: красивый, удобный, приятный шаблон без замудрённостей, сделанный грамотно —
по правилам, стандартам и трендам.** Это главный критерий при любом выборе между «мощно» и
«просто»: если фича не обязательна для контент-сайта в поиске — она опция или её нет.

Правила для всех агентов:

- **Не исследовать заново.** Ресёрч закрыт; отчёты (§3) написаны как спецификации — точные
  версии, листинги конфигов, ловушки с URL. Реализовывать по ним. Расхождение с реальностью
  (пакет не ставится, API изменился) — фиксировать в отчёте, выбирать ближайшее грамотное
  решение, не переписывать спецификацию.
- **Версии пакетов — точные** (§4.6). В день запуска проверить `pnpm view <pkg> version`;
  если latest старше указанной в пределах патча/минора и совместим — брать latest, писать в
  отчёт. Мажоры без спецификации не брать.
- **Каждая зависимость и каждая опция обоснованы одной строкой в отчёте фазы.**
  Экспериментальные API Astro — только те, что названы в этом brief.
- **Стиль репо**: forward-only (текст описывает только текущее состояние, без «было/стало»,
  без changelog'ов и переходных пометок); комментарии — только WHY, кратко, по-русски;
  Conventional Commits (`feat|fix|refactor|docs|test|chore|meta|perf|style`, subject ≤ 72).
- **Git**: агент **не коммитит** и **не пушит**; никаких `--no-verify`, `git reset --hard`,
  `git checkout -- .`, `git clean`. Рабочее дерево принимает главная сессия.
- **Границы**: работать только внутри `/home/mm/git/stit-core/ssr-frontend-template`.
  Соседние репо `/home/mm/git/stit-core/*` — read-only (для сверки). Временные файлы — в
  scratchpad, путь передаётся в промпте. `docs/research/**` не редактировать (кроме
  случаев, явно названных в промпте).
- **Гейт**: перед claim «готово» — `pnpm check` зелёный локально + `pnpm test:e2e` зелёный
  (для фаз ≥ 1) — вывод команд в отчёт.
- **Комментарии/доки в коде** — на русском. Идентификаторы, коммиты, имена файлов — латиница.

## 1. Решения владельца (сводка; полностью — `docs/research/ssr/DECISIONS.md`)

| # | решение |
|---|---|
| 1 | Шрифты: системный стек `system-ui`; веб-шрифта нет; Astro Fonts API не подключается (опция описана в `styling.md`) |
| 2 | Абсолютные URL: **вариант C** — `site: 'https://__site_origin__'` на сборке + штамповка `SITE_URL` в `docker/entrypoint.sh` (`*.html|*.xml|*.txt|*.mjs` в `dist/`), e2e «плейсхолдера нет в ответе», HTML не предсжимается |
| 3 | Рендер: **только static** (prerender) + on-demand для `robots.txt`, `sitemap.xml`, `rss.xml`, `healthz`, `now`, `api/*`; вариант D (`memoryCache`/`routeRules`/single-flight/`/internal/*`) — рецепт в `rendering.md`, кода нет |
| 4 | Пресетов нет: один reference-набор контент-сайта; лендинг = prune через `/de-template` |
| 5 | i18n: ru (дефолт, без префикса) + en (`/en/`); физический `src/pages/en/**`; непереведённое — 404 |
| 6 | Форма: без JS (PRG 303 → `/contacts/spasibo`), honeypot + time-trap + origin-check; **один канал** `FORM_DELIVERY=backend|smtp` с ретраями; спул и ≥ 2 канала — SHOULD в доке |
| 7 | `CAPTCHA_PROVIDER=none` (шов `CaptchaVerifier`); `ANALYTICS=metrika|none`, Метрика после idle; cookie-баннер — опция, выключен |
| 8 | OG: статическая обложка поста или `/og-default.png` 1200×630; генератора нет |
| 9 | Кабинета/auth **нет и не планируется**: только статика; приложение — `spa-frontend-template` (триггер R-4 в доке) |
| 10 | `.astro` форматирует Prettier + `prettier-plugin-astro` (только `*.astro`); Biome линтит `.astro` (флаг `html.experimentalFullSupportEnabled`), его форматтер для `*.astro` выключен override'ом; `format:check` гоняет оба |
| 11 | `docs/stack` — **12 kinds**: `service, runtime, content, routing, rendering, seo, styling, observability, config, dependencies` + условные `api`, `analytics`; kind `images` не заводится (пайплайн картинок — секция `content.md`) |
| 12 | Негативные фикстуры гейта `.gate-fixtures/` + шаг `check:gate` внутри `pnpm check` — обязательны |
| 13–15 | Репо создан и засеян деревом `spa-frontend-template@0516b94`; коммитит/пушит главная сессия после приёмки фазы |
| 16 | Infra-PR — после фаз 1–4, отдельным агентом в репо infra (фаза 7) |
| — | Острова без фреймворка (vanilla `<script>`); `@astrojs/react`, `@astrojs/sitemap` не подключаются; `@astrojs/rss` допустим; on-demand HTML в reference-наборе — только `now`; поиска и каталога в v1 нет; Sentry server-side только при `SENTRY_DSN`; клиентского RUM нет; тема — cookie/`localStorage` + `data-scheme`, без FOUC |

## 2. Что уже решено ресёрчем и не обсуждается

Astro 7.3 + `@astrojs/node` (`output: 'static'`, `mode: 'standalone'`), Vite 8; имя
`ssr-frontend-template` (в прозе — «шаблон индексируемого сайта: static-first, SSR по
необходимости»); форк потребителя `<org>/site`, `SVC=site`, `SITE_TAG`, `compose/site.yml`;
отдельный репозиторий, родство с SPA — контрактом обвязки (`docs/reference/kinship.md`),
общей npm-библиотеки нет, `@stit/ui` не используется; наследие: агентная обвязка
(`CLAUDE.md`, rules, скиллы, `docs/stack` с `Generates`, planning-first, forward-only),
FSD + Steiger (границы держит ESLint `boundaries@7` с резолвером + `no-restricted-imports`;
Steiger — структура), гейт `pnpm check`; один Node-образ `node:24-alpine` за Traefik/CrowdSec
без CDN; контент в git (Markdown + Zod-коллекции внутри `entities/<name>/content/`);
SEO-канон MUST (`02-seo-canon.md` §3.2).

## 3. Карта источников (что читать в какой фазе)

Каталог: `/home/mm/git/stit-core/ssr-frontend-template/docs/research/ssr/`.

| файл | разделы | фазы |
|---|---|---|
| `00-synthesis.md` | §1 TL;DR, §5.1 конфигурация, §5.4 «что писать самим», §6 архитектура, §6.5 бюджеты, §6.6 reference-слайсы, §7 SEO-MUST, §8 деплой, §9 обвязка, §11 риски, §12 план | все |
| `round2/08-spike-astro.md` + исходники `round2/spikes/spike-astro/` | §3 конфиги (astro/steiger/biome/eslint/vitest/size-limit/Dockerfile/entrypoint/server.mjs/seo-head/fetch/middleware/форма), §4 дерево, §5 развилка C, §7 ловушки 7.1–7.17, §9 навязанные пути, §10 i18n, §12 рекомендации | 1–5 |
| `round2/12-tooling-fsd.md` + `round2/spikes/tooling-lab/` | §3.8 разделение ответственности, §4 Biome, §5 ESLint 10 (5.5 `no-restricted-imports`, 5.6 boundaries v7), §6 Vitest 5 (6.1 Container API, 6.4 axe-хелпер), §7 Playwright/size-limit/lefthook/commitlint, **§9 готовые конфиги**, §10 FSD-раскладка, §11 состав `pnpm check`, §12 риски | 1 |
| `04-runtime-deploy.md` | §2.8–2.10 процесс/health/логи/безопасность, §3.1 Dockerfile-нотации, §3.4 `compose/site.yml`, §3.5 env-контракт, §3.6–3.9 Traefik/CrowdSec/release/infra | 1, 7 |
| `round2/14-content-architecture.md` | §2.1 источник контента, §2.2 режимы, §2.3 картинки, §2.6 формы, §2.7 аналитика и право РФ, §2.8 мета как данные, §2.9 i18n, §2.10 фиды/sitemap/редиректы/404, §2.11 бюджеты, §2.12 a11y, §2.14 reference-слайсы, §3.2 дерево, **§4 черновики kinds `content`/`rendering`/`seo`**, **§4.5 инварианты C-1…C-26** | 2–6 |
| `02-seo-canon.md` (+ `_sub-*.md`) | §3.1 где что живёт, **§3.2 MUST/SHOULD/MAY** (I-/M-/S-/L-/P-/B-/Q-), §3.3 черновики (адаптировать с TanStack на Astro), §4 чек-лист страницы, §5 чек-лист релиза | 4, 5, 6 |
| `round2/13-template-v2.md` | §2.2 kinship, §2.3 kinds, §2.4 FSD-карта strategy, §3 таблицы | 1 (kinship), 6 |
| `05-template-design.md` | форма kinship/kinds/скиллов (пересобрано в 13) | 6 |
| `round2/07-landscape-v2.md` | только если нужно «почему Astro» | — |

SPA-шаблон (источник обвязки, read-only): `/home/mm/git/stit-core/spa-frontend-template`
(`CLAUDE.md`, `.claude/**`, `docs/**`, `biome.json`, `eslint.config.js`, `steiger.config.ts`,
`lefthook.yml`, `.commitlintrc.cjs`, `src/app/styles/index.css`, `src/shared/lib/**`).
В этом репо его копия лежит в seed-коммите `04a7b01` — то, что нужно переписать, переписывается
на месте; то, что умирает, удаляется.

## 4. Целевая картина v1

### 4.1 Дерево репозитория

```
ssr-frontend-template/
├── CLAUDE.md                          ядро + роутер (форма — как в SPA)
├── README.md
├── astro.config.ts                    §4.2
├── tsconfig.json                      astro/tsconfigs/strictest + флаги SPA
├── biome.json · eslint.config.js · steiger.config.ts · .prettierrc.json · .prettierignore
├── vitest.config.ts · .size-limit.cjs · lefthook.yml · .commitlintrc.cjs
├── package.json · pnpm-lock.yaml · .npmrc · .nvmrc · .env.example · .dockerignore
├── .gate-fixtures/                    негативные фикстуры гейта (§4.5)
├── docker/{Dockerfile,entrypoint.sh,server.mjs}
├── e2e/{playwright.config.ts,smoke.spec.ts,seo.spec.ts,forms.spec.ts,a11y.spec.ts}
├── scripts/{check-gate.mjs,kin-diff.mjs,check-content.mjs,check-links.mjs,seo-check.mjs}
├── public/{favicon.ico,icon.svg,apple-touch-icon.png,manifest.webmanifest,og-default.png}
├── content/redirects.yaml             редиректы как данные (фаза 2)
├── src/
│   ├── content.config.ts              навязано Astro: импорт коллекции НАПРЯМУЮ из модуля
│   ├── middleware.ts                  навязано Astro: реэкспорт из app/middleware
│   ├── env.d.ts                       навязано Astro (если нужен)
│   ├── app/
│   │   ├── layouts/document.astro     <html lang> · <head> со slot · токен-CSS · лендмарки
│   │   ├── middleware/index.ts        X-Request-Id · JSON-лог · X-Robots-Tag (on-demand)
│   │   └── styles/index.css           токен-слой SPA (идентичное ядро) + системная тема
│   ├── pages/                         = слой pages FSD = роутинг Astro
│   │   ├── index.astro · about.astro · now.astro · 404.astro · 500.astro
│   │   ├── blog/{index.astro,[slug].astro,page/[page].astro,tag/[tag].astro}
│   │   ├── contacts/{index.astro,spasibo.astro} · legal/privacy.astro
│   │   ├── en/{index.astro,about.astro,blog/…,contacts/…}
│   │   ├── healthz.ts · robots.txt.ts · sitemap.xml.ts · rss.xml.ts · en/rss.xml.ts
│   │   └── api/contact.ts
│   ├── widgets/{site-header,site-footer,breadcrumbs,post-list}/{index.ts,ui/*.astro}
│   ├── features/{contact-form,theme}/…
│   ├── entities/post/{index.ts,content/{ru,en}/*.md,model/schema.ts,model/collection.ts,api/queries.ts,ui/post-card.astro}
│   ├── entities/company/…             данные организации → Organization/LocalBusiness, футер, контакты
│   └── shared/{config,seo,i18n,lib,ui,observability}/…
├── docs/
│   ├── README.md · getting-started.md · contributing.md
│   ├── reference/{architecture,ecosystem,deployment,observability,seo,kinship}.md
│   └── stack/{README.md,_templates/<12 kinds>.md}
└── .claude/{settings.json,plans/roadmap.md,rules/*.md,skills/*/SKILL.md}
```

Контент лежит **внутри слайса** (`src/entities/post/content/{ru,en}/`), а не в корневом
`content/` — так проверено spike'ом 08 (`glob({ base })`, HMR, обложки рядом). В корневом
`content/` — только `redirects.yaml` (данные, не код).

### 4.2 `astro.config.ts` (норматив)

```ts
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// Вариант C: на сборке — плейсхолдер (валидный URL, голый __SITE_ORIGIN__ Astro отвергает),
// при старте контейнера entrypoint штампует реальный SITE_URL. Локальная сборка без env
// тоже собирается с плейсхолдером; рантайм отказывается стартовать с ним.
const PLACEHOLDER = 'https://__site_origin__'
process.env.SITE_URL ??= PLACEHOLDER

export default defineConfig({
  site: process.env.SITE_URL,
  output: 'static',
  adapter: node({ mode: 'standalone', experimentalDisableStreaming: true }),
  trailingSlash: 'never',
  // 'file' + node-адаптер = 404 на /blog и /en (статик-хендлер видит каталог); только 'directory'.
  build: { format: 'directory' },
  i18n: { defaultLocale: 'ru', locales: ['ru', 'en'], routing: { prefixDefaultLocale: false } },
  image: { responsiveStyles: true, layout: 'constrained' },
  // fs-драйвер сессий адаптера пишет в cacheDir и ломает read-only контейнер.
  session: false,
  // Без островов — ни байта JS; prefetch и <ClientRouter/> не включать.
  prefetch: false,
  vite: { plugins: [tailwindcss()] },
})
```

Не задавать: `cache`, `routeRules` (D — только документация), `redirects` (редиректы — данные
фазы 2, обслуживает middleware), интеграции `@astrojs/react`/`@astrojs/sitemap`.

### 4.3 Env-контракт (`docs/stack/config.md` держит колонку «в HTML?»)

| имя | назначение | дефолт | в HTML | фаза |
|---|---|---|---|---|
| `PORT` / `HOST` / `NODE_ENV` / `NODE_OPTIONS` | процесс | `3000` / `0.0.0.0` / `production` / `--max-old-space-size=384` | нет | 1 |
| `SITE_URL` | канонический origin без хвостового слеша; **обязателен** в рантайме, плейсхолдер отвергается | — | да (штамповка) | 1 |
| `ROBOTS_POLICY` | `index \| noindex` → `robots.txt` + `X-Robots-Tag` на on-demand | `index` | да | 1/4 |
| `RELEASE` | версия для логов/Sentry | `unknown` | нет | 1 |
| `LOG_LEVEL` | `debug\|info\|warn\|error` | `info` | нет | 1 |
| `KEEP_ALIVE_TIMEOUT_MS` / `SHUTDOWN_TIMEOUT_MS` | обёртка сервера | `65000` / `15000` | нет | 1 |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | server-side Sentry только при DSN | `''` / `production` | нет | 5 |
| `FORM_DELIVERY` | `backend \| smtp` | `smtp` | нет | 5 |
| `FORM_BACKEND_URL` · `SMTP_URL` · `FORM_TO` · `FORM_FROM` | доставка | — | нет (секреты) | 5 |
| `FORM_TIME_TRAP_SECRET` | подпись метки времени формы | — | нет | 5 |
| `CAPTCHA_PROVIDER` / `CAPTCHA_SITE_KEY` / `CAPTCHA_SECRET` / `CAPTCHA_FAIL_MODE` | шов капчи | `none` / — / — / `open` | site-key да | 5 |
| `ANALYTICS` / `METRIKA_ID` | `metrika \| none` | `none` | да | 5 |
| `GOOGLE_SITE_VERIFICATION` / `YANDEX_VERIFICATION` / `INDEXNOW_KEY` / `AI_TRAINING` | SEO | `''` / `''` / `''` / `allow` | да (кроме ключа IndexNow — файл) | 4 |

Чтение — `src/shared/config/index.ts`: Zod по `process.env`, одна функция `getRuntimeConfig()`;
на prerender попадают значения сборки (плейсхолдер), на on-demand — живой `process.env`.
Публичный whitelist — явный список; ничего из `process.env` не сериализуется в HTML целиком.

### 4.4 Гейт `pnpm check` и скрипты

```
typecheck    → astro check
lint         → biome check . && eslint .
format:check → biome format . && prettier --check "src/**/*.astro"
test         → vitest run   (проекты astro/node + dom/happy-dom, 12 §9.8)
steiger      → steiger src
check:gate   → node scripts/check-gate.mjs   (негативные фикстуры обязаны валить eslint/steiger/biome)
build        → astro build
size         → size-limit   (JS островов, CSS, HTML главной/поста)
check        → typecheck → lint → format:check → test → steiger → check:gate → build → size
```
Фаза 2 добавляет `check:content` и `check:links`, фаза 4 — `seo:check`; все три — в `check`.
`test:e2e` — Playwright на **prod-сборке** через `docker/server.mjs`, `webServer.url` = `/healthz`,
порт 3201 (не dev); штамповка применяется тем же `docker/entrypoint.sh` (каталог `dist`
параметризован через `DIST_DIR`), чтобы e2e видел то же, что контейнер.
`kin:diff` — advisory, вне `check`. `dev` → `astro dev` (порт 4321 по умолчанию Astro).
`start` → `node ./docker/server.mjs`. `pnpm gen`, `gen:msw`, `analyze` — исчезают.

Центр тяжести архитектурной проверки — `pnpm lint` (ESLint `boundaries` + `no-restricted-imports`),
не Steiger (fail-open на `.astro`-целях и глубже первого уровня `pages`). Записать в `CLAUDE.md`.

### 4.5 `.gate-fixtures/` — негативные фикстуры

Отдельный мини-проект (свой `tsconfig.json`, extends корневого; своё `src/`), в котором заложены
нарушения, и `scripts/check-gate.mjs`, который прогоняет на нём **корневые** конфиги ESLint,
Steiger и Biome и падает, если **любое** из ожидаемых нарушений не найдено (сверка по id правил).
Минимальный набор: cross-slice (`widgets/a → widgets/b`), импорт вверх (`entities → widgets`),
deep-import в `.astro`-цель (`@/entities/post/ui/post-card.astro`), импорт из клиентского
`<script>` в `.astro` с нарушением границ, `<img>` без `alt` (должен поймать `astro/jsx-a11y/alt-text`
— защита от пустого a11y-конфига), реэкспорт server-only символа (`astro:content`/`astro:actions`)
из `index.ts` слайса (ловится правилом `no-restricted-imports`/`no-restricted-syntax` override —
формулировку выбрать при реализации, зафиксировать в правиле `fsd-architecture`).

### 4.6 Версии (точные; сверка `pnpm view` в день запуска)

Runtime `dependencies`: `astro@7.3.x` (7.3.3 на 2026-09-16), `@astrojs/node@11.1.5`,
`@astrojs/rss@4.0.19` (фаза 4), `sharp@0.35.4` (обязан быть в `dependencies` — 08 §7.7),
`zod@4.6.5`. Фаза 5: `nodemailer@10.x` (только при `FORM_DELIVERY=smtp`), `@sentry/node@10.x`.
`devDependencies`: `@astrojs/check@0.9.10`, `typescript@6.0.x` (не 7: `typescript-eslint` требует `<6.1`),
`typescript-eslint@8.70.x`, `eslint@10.10.x`, `@eslint/js@10.0.x`, `eslint-plugin-astro@3.2.x`,
`astro-eslint-parser@3.1.x`, `eslint-plugin-jsx-a11y@6.10.2` (при проблемах peer — `eslint-plugin-jsx-a11y-x@0.2.x`),
`eslint-plugin-boundaries@7.2.x`, `eslint-import-resolver-typescript@4.4.x`, `globals@17.x`,
`@biomejs/biome@2.5.14` (**без каретки**), `prettier@3.x`, `prettier-plugin-astro@1.0.x`,
`steiger@0.6.0`, `@feature-sliced/steiger-plugin@0.7.0`, `vitest@5.0.x`, `@vitest/coverage-v8@5.0.x`,
`happy-dom@20.x`, `axe-core@4.13.x`, `@playwright/test@1.63.x`, `@axe-core/playwright@4.13.x`,
`size-limit@14.0.x`, `@size-limit/file@14.0.x`, `lefthook@2.1.x`, `@commitlint/cli@21.x`,
`@commitlint/config-conventional@21.x`, `tailwindcss@4.3.x`, `@tailwindcss/vite@4.3.x`.
`pnpm.onlyBuiltDependencies`: `sharp`, `esbuild`, `@biomejs/biome`, `lefthook`.
Не ставить: `@astrojs/react`, `react*`, `@astrojs/sitemap`, `msw`, `@tanstack/*`, `zustand`,
`@lingui/*`, `vitest-axe`, `@fontsource*`, `satori`, `@resvg/*`.

### 4.7 Бюджеты (синтез §6.5; проверяются size-limit + e2e)

HTML главной/поста ≤ 20/25 КБ gzip в `size-limit` (несжатый ≤ 100 КБ, потолок 300 КБ в e2e);
CSS ≤ 15 КБ gzip (цель — как в spike: ~3–5 КБ); JS на индексируемых страницах — **0 внешних
script-ресурсов** (e2e), островов суммарно ≤ 30 КБ gzip; страница целиком ≤ 400 КБ; TTFB prerender
локально ≤ 2 мс.

## 5. Фазы

Каждая фаза: **вход** (что уже есть), **содержание** (файлы), **правила** (`.claude/rules`,
которые эта фаза пишет — их инварианты появляются именно здесь), **гейт**, **не делать**.

### Фаза 1 — фундамент репозитория

Вход: seed-дерево SPA-шаблона (коммит `04a7b01`), `docs/research/**`.

Содержание:
1. **Прунинг SPA-рантайма**: удалить `index.html`, `public/config.js`, `public/mockServiceWorker.js`,
   `tsr.config.json`, `vite.config.ts`, `vitest.setup.ts`, `docker/nginx*`, `src/app/{main.tsx,root.tsx,init.ts,providers/,router/}`,
   `src/pages/*.tsx`, `src/{entities,features,widgets}/*` (все reference-слайсы SPA),
   `src/shared/{api,i18n,ui/page-header,observability}` (переписываются), React/TanStack/MSW/Lingui/zustand
   и их eslint/vitest-обвязку из `package.json`. Оставить и перенести как **идентичное ядро**
   (kinship): `.claude/rules/{forward-only,comments}.md`, `.claude/settings.json`, `.claude/plans/roadmap.md`,
   `.claude/skills/plan/`, `.commitlintrc.cjs`, `.nvmrc`, `.npmrc`, `LICENSE`, `SECURITY.md`,
   `src/shared/lib/{cn,invariant}.ts` (+ тесты), `src/app/styles/index.css` (токен-слой; добавить
   системную тему через `color-scheme`/`prefers-color-scheme` без JS и переопределение `data-scheme`).
2. **`package.json`**: `name: @stit/ssr-frontend-template`, скрипты §4.4, версии §4.6, `engines.node >=24`,
   `packageManager: pnpm@10.0.0`, `onlyBuiltDependencies`.
3. **Конфиги**: `astro.config.ts` (§4.2), `tsconfig.json` (`astro/tsconfigs/strictest` + флаги SPA:
   `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`,
   `paths @/*`, `include` с `.astro/types.d.ts`, `e2e`, `scripts`), `biome.json` (12 §9.5, без `.vue/.svelte`,
   + override `**/*.astro` → `formatter.enabled: false`), `.prettierrc.json` + `.prettierignore` (только `*.astro`),
   `eslint.config.js` (**12 §9.2 дословно** + override `no-restricted-imports: off` для навязанных entry
   `src/{content.config.ts,middleware.ts,actions/**}` + typed-lint только на `**/*.{ts,mts,cts}` + конфиг
   для `*.test.ts` без testing-library), `steiger.config.ts` (12 §9.1: ignores навязанных путей, `src/pages/**`
   без слайсовых правил, `insignificant-slice: off`), `vitest.config.ts` (12 §9.8, `getViteConfig`, два проекта),
   `.size-limit.cjs` (12 §9.7), `lefthook.yml` (12 §9.6 без `.svelte/.vue`, + `prettier --write` для staged `*.astro`),
   `e2e/playwright.config.ts` (12 §7.1: prod-сборка, `/healthz`, порт 3201, `SITE_URL=http://127.0.0.1:3201`).
4. **`src/`**: навязанные реэкспорты `content.config.ts` (пока пустой `collections = {}` или без файла,
   если Astro не требует), `middleware.ts` → `app/middleware`; `app/layouts/document.astro` (`<html lang>`,
   `<head>` со `<slot name="head">`, `<meta charset/viewport>`, `color-scheme`, favicon-набор, лендмарки
   `header/main/footer`, skip-link); `app/middleware/index.ts` (принимает/генерирует `X-Request-Id`,
   JSON-лог одной строкой `ts,lvl,method,path,status,dur_ms,rid` без PII, `X-Robots-Tag: noindex, nofollow`
   при `ROBOTS_POLICY=noindex` — действует только на on-demand, это записать в комментарий);
   `shared/config/index.ts` (§4.3: `SITE_URL` `z.url()`, отказ от плейсхолдера в рантайме — в `docker/server.mjs`
   fail-fast); `shared/lib` (+ `testing/a11y.ts` — матчер `expectNoA11yViolations` поверх `axe-core`,
   12 §6.4); `shared/ui/` — пустой каркас с `index.ts`; `widgets/site-header`, `widgets/site-footer`
   (минимальные, на токенах); `pages/index.astro`, `pages/en/index.astro`, `pages/404.astro`, `pages/healthz.ts`
   (`prerender = false`, `200 ok`, `Cache-Control: no-store`, без версии). Главная — короткий, честный текст
   о шаблоне (не lorem ipsum), один `<h1>`, 0 JS.
5. **Docker**: `docker/Dockerfile` (08 §3: три стадии, `--mount=type=cache` store + `--mount=type=secret,id=npmrc`
   как в SPA, `ARG SITE_URL=https://__site_origin__`, прунинг gnu-бинарников/`@types/node`/`caniuse-lite`/`prismjs`
   в `prod-deps`, `USER node`, `HEALTHCHECK wget /healthz`, `ENTRYPOINT entrypoint.sh`, `CMD node ./docker/server.mjs`),
   `docker/entrypoint.sh` (08 §3, `DIST_DIR` параметризован, `SITE_URL` обязателен), `docker/server.mjs`
   (08 §3: `ASTRO_NODE_AUTOSTART=disabled` + `startServer()`, keep-alive 65 с, дренаж SIGTERM с
   `closeIdleConnections`, потолок 15 с; + fail-fast, если `SITE_URL` пуст или равен плейсхолдеру),
   `.dockerignore` (`node_modules dist .astro .git e2e playwright-report test-results *.log .vitest`).
6. **Тесты**: unit — `shared/config` (дефолты, отказ плейсхолдера), `shared/lib` (перенос), Container API
   тест для `site-header.astro` + a11y-матчер; e2e `smoke.spec.ts` — `/` 200 с `<h1>` и 0 script-ресурсов,
   `/en` 200 `lang="en"`, `/xx` 404, `/healthz` 200, `/en/` → 301 на `/en` (нормализация слеша),
   «в ответе `/` нет `__site_origin__`», axe на `/` и `/404`.
7. **`.gate-fixtures/` + `scripts/check-gate.mjs`** (§4.5).
8. **`docs/reference/kinship.md`** (identical / near-identical / divergent — по 13 §2.2 и §3.2) +
   `scripts/kin-diff.mjs` (`pnpm kin:diff`, сверяет identical-файлы с `../spa-frontend-template`, advisory).
9. **Правила** (переписать под Astro, path-scoped, коротко): `fsd-architecture.md` (слои, `src/pages` = роутинг,
   навязанные entry как реэкспорты, public API = `index.ts` с explicit re-export `.astro`, server-only
   символы (`astro:content`, `astro:actions`, `node:*`) не в `index.ts`, «в `index.ts` нет top-level вызовов»,
   `shared/{seo,content,ui,lib,config,i18n}`, «границы держит `pnpm lint`»), `env-local.md` (`process.env` +
   явный whitelist, `SITE_URL` runtime, плейсхолдер и штамповка, секреты не в HTML), `tests-pipeline.md`
   (Vitest 5 два проекта, Container API, axe-хелпер, Playwright на prod-сборке, что в `check`, что отдельно),
   `shared-ui.md` (токены — единственный источник; scoped `<style>` только для layout; `.astro`-компоненты).
   `comments.md`, `forward-only.md` — без изменений.
10. **`CLAUDE.md`** — переписать минимально и честно под текущее состояние (стек, команды, карта,
    инварианты, границы, «границы держит `pnpm lint`»), `README.md` — краткий честный README нового шаблона
    (стек, быстрый старт, команды, структура; без обещаний про фазы). Скиллы `.claude/skills/*` (кроме `plan`)
    в этой фазе не трогать; `docs/stack/**`, `docs/reference/{architecture,observability,ecosystem}.md`,
    `docs/getting-started.md`, `docs/contributing.md` — не трогать (фаза 6); `docs/reference/deployment.md`
    переписывается сейчас (Node-образ, entrypoint, server.mjs, env-контракт §4.3).
11. **`.claude/plans/roadmap.md`** — не трогать (ведёт главная сессия).

Гейт фазы 1: `pnpm check` зелёный; `pnpm test:e2e` зелёный; `docker build -f docker/Dockerfile
--secret id=npmrc,src=$HOME/.npmrc -t ssr-template-local .` собирается; контейнер с `SITE_URL=https://demo.example`
отдаёт `/` 200 (полный HTML, `curl -A Googlebot` тоже), `/xx` 404, `/healthz` 200, `/en` 200;
`grep -r __site_origin__ /app/dist` внутри контейнера пуст; `docker stop` < 1 с при отсутствии запросов и
дренаж запроса в полёте; контейнер без `SITE_URL` не стартует; размер образа ≈ 300–320 МБ (в отчёт);
`pnpm check:gate` реально падает, если фикстуру «починить»; `pnpm kin:diff` печатает сверку.

Не делать в фазе 1: контент-коллекции, SEO-компоненты, формы, редиректы, D-кеш, `docs/stack`, скиллы.

### Фаза 2 — контент-слой

Вход: фаза 1 принята. Источники: 08 §3/§9 (Content Layer в слайсе, прямой импорт коллекции),
14 §2.1–2.2.6, §2.9, §2.10.3–2.10.4, §4.1, §4.5 (C-1…C-5, C-11…C-14).

Содержание: `entities/post/{model/schema.ts (Zod через прямой import { z } from 'zod'), model/collection.ts
(glob({ base: 'src/entities/post/content' })), content/{ru,en}/*.md (6–8 ru, 2–3 en, честные тексты о
контент-сайтах/SEO, обложки в content/covers), api/queries.ts (listPosts/getPost/byTag/paginate,
фильтр draft вне preview), ui/post-card.astro, index.ts}`; `src/content.config.ts` импортирует коллекцию
напрямую; поля frontmatter: `title, description, pubDate, updatedDate?, cover?, coverAlt?, tags[], draft, translationKey, lang`;
`content/redirects.yaml` (14 §2.10.3) + загрузчик в `app/middleware` (301/308/410 одним хопом, до роутинга;
Map при старте); `scripts/check-content.mjs` (`pnpm check:content`: все `.md` проходят схему, бюджеты
title 25–65 / description 70–170, ровно один h1 не в теле, `alt` у картинок, `translationKey` уникален в
локали, внутренние ссылки разрешимы); `scripts/check-links.mjs` (`pnpm check:links` по `dist/client`:
все внутренние `href`/`src` существуют); оба — в `pnpm check`; страницы `blog/index.astro`,
`blog/[slug].astro` (честный 404 на неизвестный slug), `blog/page/[page].astro` (пагинация на `/blog/page/N`,
08 §7.9), `blog/tag/[tag].astro`, `en/blog/…`; `widgets/post-list`. Правило `content-invariants.md`.

Гейт: `pnpm check` (с `check:content`, `check:links`) и `test:e2e` зелёные; `/blog/net-takogo` 404;
`/old` (из `redirects.yaml`) 301, удалённый — 410; `draft: true` не в списках; e2e «непереведённый
пост под `/en/` — 404».

### Фаза 3 — рендер

Вход: фаза 2. Источники: 08 §5 (C), §7.4, §7.13; 14 §2.2, §4.2; синтез §6.2.

Содержание: явные `export const prerender = false` только на служебных роутах (`healthz`, `now`,
`api/*`, позже `robots/sitemap/rss`); `pages/now.astro` (dynamic: `Cache-Control: private, no-store`,
`noindex`, время сервера); `Cache-Control` на on-demand HTML (`no-cache`) и `X-Robots-Tag` — в middleware;
нормализация: что даёт адаптер (301 на слеш) + правило для Traefik `/index.html` — в `deployment.md`;
e2e: «`__site_origin__` отсутствует во всех страницах» (обход списка маршрутов), «в `<body>` нет
абсолютных URL своего origin», TTFB prerender ≤ 2 мс локально (медиана 20 запросов);
`docs/reference/rendering.md` — **рецепт D** (что включить, `cache`/`routeRules`, single-flight, прогрев,
`/internal/revalidate`, `mem_limit` 768) без кода. Правило `render-safety.md` (сборка · запрос · остров:
секреты не в клиентском бандле, request-only API (`Astro.request`, cookies) не в prerender-маршрутах,
модульное состояние не в on-demand роутах, server islands не для индексируемого, HTML не предсжимать).

Гейт: `pnpm check` + e2e зелёные; staging-режим (`ROBOTS_POLICY=noindex`) даёт `X-Robots-Tag` на
`/now`, `/healthz`; в отчёте — таблица маршрутов с режимом (основа `rendering.md`).

### Фаза 4 — SEO-слой

Вход: фаза 3. Источники: 02 §3.1–3.3 (адаптировать черновики к Astro), §4–5; 08 §3 (`seo-head.astro`,
`urls.ts`), §10; 14 §2.8, §2.10.1–2.10.2, §2.10.6, §4.3; синтез §7.

Содержание: `shared/seo/{index.ts,urls.ts (absoluteUrl, alternates, normalizePath — runtime origin),
seo-head.astro (title-шаблон, description, canonical, robots, OG полный, twitter:card, hreflang, RSS
autodiscovery, verification-теги из env), json-ld.ts (+ json-ld.astro; фабрики organization/webSite/
breadcrumbList/article; Zod-схемы; без FAQPage/HowTo/SearchAction), robots.ts, sitemap.ts, rss.ts,
*.test.ts}`; `shared/config/site.ts` (идентичность шаблона: имя, description, локали, `sameAs` —
демо-значения, которые `/de-template` заменяет); `pages/{robots.txt,sitemap.xml,rss.xml}.ts`,
`pages/en/rss.xml.ts` (on-demand, runtime `SITE_URL`, `ROBOTS_POLICY`, `AI_TRAINING`, `Clean-param`,
`lastmod` только из `updatedDate`, шарды по типу/локали при необходимости); `widgets/breadcrumbs`
(видимые + JSON-LD из одного массива); `e2e/seo.spec.ts` (02 §2.9.1/Q-1: статусы, мета, canonical
абсолютный, hreflang взаимный + x-default, JSON-LD валиден, robots ↔ sitemap согласованы, HTML без JS
содержит h1, 0 script-ресурсов на индексируемых, нет абсолютных URL своего origin в `<body>`, нет
`__site_origin__`, нет `noindex` в prod-режиме, размер HTML); `scripts/seo-check.mjs` (`pnpm seo:check`
по `dist/client`: у каждой страницы title/description/canonical/lang/один h1) — в `pnpm check`.
Правило `seo-invariants.md`.

Гейт: `pnpm check` (+ `seo:check`) и `test:e2e` (включая `seo.spec.ts` на prod-профиле) зелёные;
`ROBOTS_POLICY=noindex` ⇒ `robots.txt` = `Disallow: /`; в проде — `Sitemap:` абсолютный.

### Фаза 5 — reference-слайсы и «красиво»

Вход: фаза 4. Источники: синтез §6.6 в объёме решений; 14 §2.3 (картинки), §2.6 (форма), §2.7.3
(юридический минимум), §2.12 (a11y); 08 §3 (форма PRG/эндпоинт).

Содержание: `pages/about.astro` (+ en; `LocalBusiness`/`Organization` из `entities/company`,
breadcrumbs), `pages/contacts/index.astro` + `spasibo.astro` (+ en; `noindex` на spasibo),
`features/contact-form` (`ui/contact-form.astro` — нативная форма, `model/schema.ts` Zod с
`consent: z.literal(true)`, `api/handler.ts` server-only: origin-check → honeypot → time-trap (подписанная
метка, `FORM_TIME_TRAP_SECRET`) → валидация → доставка `FORM_DELIVERY=smtp|backend` с 3 ретраями и
backoff → 303; тело заявки не логируется), `pages/api/contact.ts` (`prerender=false`, form-urlencoded,
303 на успех, 200 + форма с ошибками иначе), шов `shared/antispam/captcha.ts` (`CaptchaVerifier`,
реализация только `none`); `pages/legal/privacy.astro` (политика ПДн с явными плейсхолдерами
оператора `{{OPERATOR_NAME}}` и т.п.); `pages/500.astro`; `features/theme` — единственный остров:
переключатель light/dark (vanilla `<script>`; выбор в `localStorage` + cookie `scheme`; инлайн-скрипт
≤ 300 Б в `<head>` применяет `data-scheme` до первой отрисовки; без выбора — системная тема из CSS);
картинки — `astro:assets` `<Picture>` AVIF/WebP/JPEG, `width/height`, LCP с `fetchpriority="high"`;
`ANALYTICS=metrika` — загрузка `tag.js` после `requestIdleCallback` только при `METRIKA_ID`
(по умолчанию `none`, e2e «0 сторонних скриптов»); `e2e/{forms,a11y}.spec.ts` (форма без JS → 303,
honeypot → 204/303 без доставки, time-trap, axe на `/`, посте, `/contacts`, `/404` в двух темах).
**Визуальный уровень**: типографика на системном стеке, вертикальный ритм, контраст в обеих темах,
мобильный вьюпорт, состояния фокуса; ничего «шаблонно-серого»; перед вёрсткой — загрузить skill
`frontend-design:frontend-design`. Всё на токен-слое `app/styles/index.css` (новые семантические
токены заводятся там).

Гейт: `pnpm check` + все e2e зелёные; бюджеты §4.7; каждый режим и SEO-приём — ровно один раз;
в отчёте — prune-лист reference-набора для `/de-template`.

### Фаза 6 — обвязка

Вход: фаза 5. Источники: 13 §2.3, §3; 14 §2.13, §4 (черновики kinds), §4.5; синтез §9; 02 §3.4, §4, §5;
SPA-шаблон `.claude/skills/**`, `docs/**` (форма).

Содержание: `docs/stack/README.md` + `_templates/{service,runtime,content,routing,rendering,seo,styling,
observability,config,dependencies,api,analytics}.md` (12 kinds, `api`/`analytics` условные; `service`
получает `infra-svc: site`; `content` — секция «картинки» и «кто редактирует» с блокирующим инвариантом;
`config` — колонка «в HTML?»; порядок волн из DECISIONS #11; у каждого — `Generates`); скиллы:
`smartdev`, `plan` (как есть), `init-service`, `stack-deep-dive` (12 волн + cross-kind проверки),
`de-template` (env-контракт Node, prune reference-набора по списку фазы 5, замена демо-`site.ts`/OG/
`SITE_URL`, **падает при плейсхолдерах оператора в политике ПДн**), `scaffold` (`page`/`collection`/
`feature`/`widget`/`route`, `.astro`-шаблоны, `index.ts` с explicit re-export, post-flight `steiger` +
`lint` + `typecheck`), `release` (Node-образ, `SVC=site`, `-f docker/Dockerfile --secret`, SEO-чек-лист 02 §5
и юридический чек-лист), **`seo-audit`** (тонкий: прод-сборка + `seo.spec.ts` + `seo:check` + чтение
отчёта), **`content`** (новая запись по канону, `check:content`); `docs/reference/{architecture,ecosystem,
observability,seo}.md` (переписать), `docs/README.md`, `docs/getting-started.md`, `docs/contributing.md`,
финальные `CLAUDE.md` и `README.md`; сверка правил `.claude/rules/*` (все восемь) с кодом.

Гейт: `pnpm check` + e2e зелёные; главная сессия прогоняет `/init-service` → `/de-template` на
тест-форке и `/scaffold page` — гейт зелёный; все `_templates` `stable`-способны, `Generates` непусты.

### Фаза 7 — инфра и экосистема (cross-repo, отдельные сессии по порядку синтеза §9.5)

1. `corp-infra-template/docs/ecosystem.md`; 2. (опц.) `business-strategy-template` канон-PR (`indexable`/`freshness`);
3. `project-infra-template-compose`: `compose/site.yml` (04 §3.4 без Nitro-переменных, `SHUTDOWN_TIMEOUT_MS`),
дефекты infra (CrowdSec acquisition + `rdns`/`seo-bots-whitelist`, убрать `sslRedirect`, `compress`,
`www-to-apex`, `retry`, `staging-noindex`, `staging-auth`, `accessLog.filePath` + `X-Request-Id`,
`Makefile bump --wait`, `ROLE_FILES[edge]`, `preflight-dns` + `www`, `smoke.d/90-site.sh`, правила, доки,
`add-service`, `de-template`); 4. `go-backend-template` — не требуется (кабинета нет); 5. `spa-frontend-template`
(ecosystem.md, README-строка, `infra-svc`, `/release` fix); 6. sweep «6 → 7» + `@stit/ui`; 7. `stit-public`.
Гейт: первый сайт задеплоен `make bump SVC=site`, `/seo-audit` чист.

## 6. Инварианты, которые обязаны попасть в правила `.claude/rules`

- `build.format` только `'directory'`; `output: 'static'`; `session: false`; `prefetch: false`; без `<ClientRouter/>`.
- Server-only символы не в `index.ts` слайса; `content.config.ts` импортирует коллекцию напрямую из модуля.
- В `index.ts` слайса нет значений, полученных вызовом (barrel + top-level вызов тянет zod/контент в клиент).
- Абсолютные URL — только в `<head>`, JSON-LD, фидах, sitemap; в теле — корневые относительные (C-6).
- `SITE_URL` — runtime; плейсхолдер штампуется при старте; HTML не предсжимается (C-7).
- Server islands (`server:defer`) — не для индексируемого контента.
- `X-Robots-Tag` на prerendered недостижим из приложения — staging закрывает Traefik (три контура).
- Редиректы — данные (`redirects.yaml`), 301/308/410 одним хопом, `meta refresh` запрещён (C-11, C-12).
- hreflang — только для существующих переводов, взаимно; непереведённое — 404 (C-13, C-14).
- 0 КБ JS на контентной странице; каждый остров — строка в `size-limit`; третьи стороны — после согласия/idle (C-15, C-17, C-26).
- Форма без JS (PRG), лестница honeypot → time-trap → origin → rate-limit; согласие `z.literal(true)` и на сервере; тело заявки не логируется (C-18, C-19).
- Картинки: `width/height`, `alt`, `<picture>` с фолбэком `src`, LCP без `lazy` (C-20).
- Границы FSD держит `pnpm lint` (ESLint), Steiger — структура; негативные фикстуры в `check:gate`.

## 7. Формат отчёта фазы

Отчёт пишется в scratchpad (`<scratchpad>/phase-N-report.md`) и возвращается финальным сообщением:

1. **Сделано** — список файлов по группам (создано / изменено / удалено), в 1 строке — зачем.
2. **Зависимости** — таблица `пакет · версия · зачем (одна строка)`; отклонения версий от §4.6.
3. **Проверено** — команды и хвост вывода: `pnpm check`, `pnpm test:e2e`, docker build/run + curl, размер образа.
4. **Отклонения от спецификации** — что и почему (с ссылкой на раздел brief/отчёта).
5. **Осталось / риски** — что не вошло, что проверить главной сессии.
6. **Данные для следующих фаз** — например, таблица маршрутов и режимов, prune-лист.

## 8. Приёмка главной сессией (что будет проверяться после каждой фазы)

`pnpm check` и `pnpm test:e2e` локально; образ (`docker build -f docker/Dockerfile --secret id=npmrc,src=$HOME/.npmrc`),
запуск с `SITE_URL`/`ROBOTS_POLICY`, `curl` по маршрутам (`-A Googlebot` тоже), `grep __site_origin__` в
контейнере, `docker stop` с дренажем, размер образа; бюджеты §4.7; `/code-review` на диффе + ручной проход
по FSD-границам и правилам §6; фикстуры реально валят гейт; визуальная проверка в браузере (light/dark,
мобильный вьюпорт, формы, 404); после приёмки — коммит + push и обновление `.claude/plans/roadmap.md`.
