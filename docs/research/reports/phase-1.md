# Отчёт фазы 1 — фундамент `ssr-frontend-template` (доводка и приёмка)

Репо: `/home/mm/git/stit-core/ssr-frontend-template`, ветка `main`, HEAD `67049ec`; всё дерево
фазы 1 — незакоммиченные изменения (27 modified · 68 deleted · 35 untracked путей). Ничего не
коммитилось, не пушилось; `.claude/plans/roadmap.md`, `docs/research/**`, `.claude/skills/**`
не редактировались. Артефакты проверки — в `<scratchpad>/phase-1/` (`pnpm-check.log`,
`accept-run.log`, `accept-run-2.log`, `docker-build*.log`, `drain-test.mjs`, `accept-run.sh`,
`css-selectors.{before,after}.txt`, `index.accept.googlebot.html`).

**Итог: гейт фазы 1 пройден.** `pnpm check` и `pnpm test:e2e` зелёные, образ собран
(300 МБ), все контейнерные проверки brief §5 «Гейт фазы 1» и §8 выполнены, негативная
фикстура реально валит `check:gate`, `kin:diff` печатает сверку (корзина «идентично»
совпадает).

## 1. Сделано

### 1.1 Дерево фазы 1 (по `git status`, сверено с brief §5 п. 1–11)

**Удалено (прунинг SPA-рантайма, п. 1):** `index.html`, `public/{config.js,favicon.svg,
mockServiceWorker.js}`, `tsr.config.json`, `vite.config.ts`, `vitest.setup.ts`,
`docker/{nginx.conf,nginx-entrypoint.sh}`, `.env.local.example`, `src/app/{main.tsx,root.tsx,
init.ts,providers/*,router/*}`, `src/pages/*.tsx`, все reference-слайсы SPA
(`entities/{session,todo,user}`, `features/{auth,create-todo,theme}`, `widgets/app-shell`),
`src/shared/{api/**,observability,ui/page-header,i18n/locales/*,config/env.d.ts}` — SPA-рантайм
(React/TanStack/MSW/Lingui/zustand) в шаблоне сайта не живёт.

**Перенесено как идентичное ядро (kinship):** `.claude/rules/{forward-only,comments}.md`,
`.claude/settings.json`, `.claude/skills/plan/SKILL.md`, `.commitlintrc.cjs`, `.npmrc`,
`.nvmrc`, `LICENSE`, `SECURITY.md`, `src/shared/lib/{index,cn,cn.test,invariant,invariant.test}.ts`
— `kin:diff` подтверждает побайтовое совпадение с `../spa-frontend-template`.

**Создано:**

| файл | зачем |
|---|---|
| `astro.config.ts` | норматив §4.2 дословно: плейсхолдер `site`, `static` + node standalone, `directory`, i18n ru/en, `session: false`, `prefetch: false` |
| `.prettierrc.json`, `.prettierignore` | Prettier только для `*.astro` (DECISIONS #10) |
| `src/content.config.ts`, `src/middleware.ts`, `src/env.d.ts` | навязанные Astro entry — тонкие реэкспорты; `env.d.ts` объявляет `*.astro` для tsc/typed-lint |
| `src/app/layouts/document.astro` | документ-шелл: `<html lang>`, `<head>` со `<slot name="head">`, `color-scheme`, favicon-набор, skip-link, лендмарки |
| `src/app/middleware/index.ts` | `X-Request-Id`, JSON-лог одной строкой без PII, `X-Robots-Tag` при `ROBOTS_POLICY=noindex` (только on-demand — в комментарии) |
| `src/shared/config/{runtime,site}.ts` + тесты | Zod по `process.env`, `getRuntimeConfig()`/`getPublicConfig()`, whitelist `PUBLIC_CONFIG_KEYS`, `SITE_NAME` |
| `src/shared/i18n/{locale,dict}.ts` + тест | локали, `localePath`/`stripLocale`, строки каркаса |
| `src/shared/lib/testing/a11y.ts` | `expectNoA11yViolations` поверх `axe-core` + happy-dom для фрагментов Container API |
| `src/shared/ui/index.ts` | каркас сегмента (каждый примитив — своя папка) |
| `src/widgets/{site-header,site-footer}` (+ `.astro.test.ts`) | каркас сайта на токенах; Container API + axe |
| `src/pages/{index,en/index,404}.astro`, `src/pages/healthz.ts` | главная ru/en (честный текст, один `<h1>`, 0 JS), 404, liveness `prerender = false` + `no-store` |
| `public/{favicon.ico,icon.svg,apple-touch-icon.png,icon-192.png,icon-512.png,icon-maskable-512.png,manifest.webmanifest}` | favicon-набор и манифест, сгенерированы из `icon.svg` |
| `docker/{entrypoint.sh,server.mjs}` | штамповка `SITE_URL` (`DIST_DIR` параметризован) и обёртка сервера (keep-alive 65 с, дренаж, fail-fast) |
| `.gate-fixtures/**` + `scripts/check-gate.mjs` | негативные фикстуры §4.5 (6 нарушений) и «гейт на гейт» |
| `scripts/kin-diff.mjs`, `docs/reference/kinship.md` | родство с SPA: корзины identical / near-identical / divergent, advisory-скрипт |

**Изменено:** `package.json` (имя, скрипты §4.4, версии §4.6), `pnpm-lock.yaml`,
`tsconfig.json` (`astro/tsconfigs/strictest` + флаги SPA), `biome.json`, `eslint.config.js`,
`steiger.config.ts`, `vitest.config.ts` (`getViteConfig`, проекты `astro`/`dom`),
`.size-limit.cjs`, `lefthook.yml` (+ `prettier --write` для staged `*.astro`),
`e2e/{playwright.config.ts,smoke.spec.ts}` (prod-сборка, `/healthz`, 3201, штамповка тем же
entrypoint'ом), `docker/Dockerfile` (3 стадии, secret `.npmrc`, прунинг, `USER node`,
`HEALTHCHECK`), `.dockerignore`, `.gitignore`, `.env.example`, `src/app/styles/index.css`
(токен-слой + системная тема `light-dark()`/`data-scheme`), `src/shared/{config,i18n}/index.ts`,
правила `.claude/rules/{fsd-architecture,env-local,tests-pipeline,shared-ui}.md`, `CLAUDE.md`,
`README.md`, `CONTRIBUTING.md`, `docs/README.md` (2 строки: deployment + kinship),
`docs/reference/deployment.md`.

Не тронуты (по brief): `.claude/skills/*` кроме `plan`, `docs/stack/**`,
`docs/reference/{architecture,ecosystem,observability}.md`, `docs/getting-started.md`,
`docs/contributing.md`, `.claude/plans/roadmap.md`, `docs/research/**`.

### 1.2 Правки этого прогона (доводка)

| файл | что | зачем |
|---|---|---|
| `eslint.config.js` (правка главной сессии, сохранена) | typed-lint блок: `ignores: ['src/**/*.astro/*.ts']`; блок виртуальных файлов: `parserOptions: { projectService: false }` | виртуальные `<script>`-блоки не лежат на диске: project service их захватывал, и `boundaries` на них молча не срабатывал; `check:gate` теперь ловит `boundaries/dependencies ×2` в `a.astro` |
| `docker/entrypoint.sh` | явная проверка `SITE_URL` с `exit 1` вместо `${SITE_URL:?}` | под busybox ash `${:?}` даёт код 2 и сообщение без префикса; оба fail-fast-пути теперь единообразны: код 1, `[entrypoint] …` / `[server] …` |
| `src/shared/config/runtime.server.test.ts` | +3 теста для `entrypoint.sh`: отказ без `SITE_URL`, штамповка только `html/xml/txt/mjs` во временном `DIST_DIR` со срезом хвостового слеша, «с плейсхолдером не штампует» | контракт штамповки был покрыт только e2e и ручной приёмкой |
| `src/app/styles/index.css` | `@import "tailwindcss" source("../..")` | автодетект источников Tailwind сканировал весь репозиторий (`docs/research` с листингами, правила с ❌-примерами `text-zinc-500`) и пёк 314 селекторов / 69 палитровых переменных; теперь только `src/`: CSS 38.5 → 8.9 КБ raw, **8.44 → 2.78 КБ gzip** (цель spike 3–5 КБ), 47 селекторов |
| `docs/reference/deployment.md` | точные сообщения/коды fail-fast; `/index.html` и `/en/index.html` — 200-дубли (зафиксированный статус) | forward-only описание фактического поведения |
| `.claude/rules/tests-pipeline.md` | «процессные» тесты покрывают и `entrypoint.sh`; строка таблицы `shared/config` | синк правила с кодом |
| `.claude/rules/env-local.md` | исключение из «не читать `process.env` мимо `shared/config`» для обёртки процесса `docker/*` | правило противоречило существующему `server.mjs` |

## 2. Зависимости

Все версии точные (без кареток), сверка с `pnpm view` (`pnpm-view-versions.txt`) и brief §4.6.
Запрещённых пакетов (`@astrojs/react`, `react*`, `@astrojs/sitemap`, `msw`, `@tanstack/*`,
`zustand`, `@lingui/*`, `vitest-axe`, `@fontsource*`, `satori`, `@resvg/*`) нет ни в
`package.json`, ни транзитивно в `pnpm-lock.yaml`. `pnpm install --frozen-lockfile` — «Already up to date».

| пакет | версия | зачем |
|---|---|---|
| `astro` | 7.3.3 | фреймворк; §4.6 |
| `@astrojs/node` | **11.1.6** (brief 11.1.5) | standalone-адаптер; latest патч в пределах правила «брать latest» |
| `sharp` | 0.35.4 | обязателен в `dependencies` (08 §7.7); в образе грузится: sharp 0.35.4 / libvips 8.18.6 |
| `zod` | 4.6.5 | схема runtime-конфига; далее — контент/JSON-LD |
| `@astrojs/check` | 0.9.10 | `astro check` = `typecheck` |
| `typescript` | 6.0.3 | 6.0.x (не 7: `typescript-eslint` требует `<6.1`) |
| `typescript-eslint` | 8.70.0 | typed-lint `.ts` + парсер frontmatter `.astro` |
| `eslint` / `@eslint/js` | 10.10.0 / 10.0.1 | flat config, `defineConfig` |
| `eslint-plugin-astro` / `astro-eslint-parser` | 3.2.1 / 3.1.0 | правила и парсер `.astro`, виртуальные `<script>` |
| `eslint-plugin-jsx-a11y` | 6.10.2 | без него `flat/jsx-a11y-recommended` разворачивается в ноль правил (фикстура `alt-text` это сторожит) |
| `eslint-plugin-boundaries` | 7.2.0 | границы FSD — центр тяжести архитектурной проверки |
| `eslint-import-resolver-typescript` | 4.4.5 | без резолвера `boundaries` — тихий no-op на `@/`-импортах |
| `globals` | 17.12.0 | `browser` + `node` globals |
| `@biomejs/biome` | 2.5.14 | форматтер/линтер TS/JS/JSON/CSS, линт `.astro` (`html.experimentalFullSupportEnabled`) |
| `prettier` / `prettier-plugin-astro` | 3.9.7 / 1.0.1 | формат только `*.astro` (DECISIONS #10) |
| `steiger` / `@feature-sliced/steiger-plugin` | 0.6.0 / 0.7.0 | структурный линтер FSD |
| `vitest` / `@vitest/coverage-v8` | 5.0.1 / 5.0.1 | два проекта `astro`/`dom`, coverage v8 |
| `happy-dom` | 20.14.5 | окружение `dom` и DOM для axe-хелпера |
| `axe-core` | 4.13.0 | a11y в компонент-тестах (вместо заброшенного `vitest-axe`) |
| `@playwright/test` / `@axe-core/playwright` | 1.63.0 / 4.13.0 | e2e на prod-сборке, axe страниц |
| `size-limit` / `@size-limit/file` | 14.0.0 / 14.0.0 | бюджеты CSS/HTML |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 / 4.3.3 | утилиты на собственном токен-слое |
| `lefthook` | 2.1.14 | git-hooks (pre-commit/commit-msg/pre-push) |
| `@commitlint/cli` / `@commitlint/config-conventional` | 21.2.2 / 21.2.2 | Conventional Commits |
| `@types/node` | 24.13.5 | не в §4.6; нужен для `types: ["node"]` (scripts, тесты, `server.mjs`-тесты); dist-tag `node24`, в prod-deps образа вырезается |

`pnpm.onlyBuiltDependencies`: `sharp`, `esbuild`, `@biomejs/biome`, `lefthook` — по §4.6.

## 3. Проверено

### 3.1 `pnpm check` (финальный прогон после правок, 12.8 с) — зелёный

```
typecheck  astro check: Result (39 files): 0 errors, 0 warnings, 1 hint
           (hint: 'toThrowError' is deprecated — src/shared/lib/invariant.test.ts, identical-файл kinship)
lint       biome: Checked 48 files. No fixes applied.   eslint: чисто
format     biome format: Checked 42 files.   prettier: All matched files use Prettier code style!
test       Test Files 6 passed (6)   Tests 22 passed (22)
steiger    ✔ No problems found!
check:gate eslint  ✓ a.astro boundaries/dependencies ×2  ✓ a.astro astro/jsx-a11y/alt-text
                   ✓ post-card.astro boundaries/dependencies  ✓ pages/index.astro no-restricted-imports ×2
                   ✓ entities/post/index.ts no-restricted-imports
           steiger ✓ a.astro fsd/forbidden-imports  ✓ post-card.astro fsd/forbidden-imports
                   ✓ pages/index.astro fsd/no-public-api-sidestep
           biome   ✓ a.astro lint/a11y/useAltText
           check:gate: все ожидаемые нарушения пойманы
build      prerendering: /404.html, /en/index.html, /index.html — Complete!
size       CSS (одна таблица)  2.78 kB gzipped / limit 15 kB
           HTML главной         1.52 kB gzipped / limit 20 kB
           HTML главной (en)    1.25 kB gzipped / limit 20 kB
```

### 3.2 `pnpm test:e2e` — 9 passed (3.3 с)

```
✓ / — 200, полный HTML с одним h1, без плейсхолдера origin (Googlebot UA)
✓ /en — 200 и lang="en"          ✓ /xx — честный 404 с разметкой
✓ /en/ → 301 на /en               ✓ /healthz — 200 ok, no-store, X-Request-Id из middleware
✓ / не грузит ни одного script-ресурса   ✓ без JavaScript: главная читается целиком
✓ axe: / без нарушений            ✓ axe: /404 без нарушений
```

После e2e фоновых процессов нет (`pgrep docker/server.mjs|astro dev|playwright` пусто), порт 3201
свободен. Порты 3201/3212 были свободны и до запуска.

### 3.3 Docker

`docker build -f docker/Dockerfile --secret id=npmrc,src=$HOME/.npmrc -t ssr-template-accept .`
— Docker Hub был доступен (`auth.docker.io` 200 за 0.95 с), сборка прошла с первого раза, без
`--pull=false`: зависимости из кеша, `COPY . .` + `pnpm build` 3.0 с, итого 5.4 с
(первая сборка этого прогона — 7.6 с). Образ `ssr-template-accept:latest` id `58d56580ad48`,
**300 МБ** (300 223 640 Б; `node_modules` 156.8 МБ / 214 пакетов, только musl-варианты нативных
бинарников; `dist` 880 КБ). В образе Node 24.21.0, `USER node`, `ENTRYPOINT /app/docker/entrypoint.sh`,
`CMD node ./docker/server.mjs`, `HEALTHCHECK wget -qO- http://127.0.0.1:3000/healthz` (команда
проверена изнутри: `ok exit=0`).

Контейнер (порт 3212, `SITE_URL=https://demo.example`, `accept-run-2.log`):

```
без SITE_URL             exit=1  [entrypoint] SITE_URL is required
SITE_URL=плейсхолдер     exit=1  [server] SITE_URL is required and must not be the build placeholder
старт                    [entrypoint] stamped 3 files: https://__site_origin__ -> https://demo.example
/                       200  3275B text/html      (curl -A Googlebot: 200, <html lang="ru">, 1×<h1>, 0×<script>, плейсхолдера нет)
/en                     200  2678B  lang="en", 1×<h1>
/xx  /en/xx  /404       404  1937B  (страница 404 с разметкой)
/healthz                200  "ok"  cache-control: no-store, x-request-id echo/uuid
/en/                    301 → /en          /healthz/  301 → /healthz
/index.html             200 (дубль главной)   /en/index.html 200 (дубль)   /404.html 200 (файл)
/favicon.ico /icon.svg /manifest.webmanifest   200
grep -rl __site_origin__ /app/dist | wc -l   → 0   (штамп в dist/server/{entry.mjs, chunks/node_*.mjs, virtual_astro_middleware.mjs})
заголовки /             Cache-Control: public, max-age=0; ETag; Connection: keep-alive; Keep-Alive: timeout=65
TTFB медиана 20 (LC_ALL=C)   /: 0.92 мс   /en: 0.99 мс   /healthz (on-demand): 1.09 мс
JSON-лог (LOG_LEVEL=debug)   {"ts":…,"lvl":"debug","method":"GET","path":"/healthz","status":200,"dur_ms":0.1,"rid":"…"}
docker stop без трафика      271 мс
дренаж, запрос в полёте      заголовки без CRLF → SIGTERM → CRLF через 1.5 с: HTTP/1.1 200 OK "ok"
                             ответ через 120 мс, `docker stop` завершился кодом 0 через 1897 мс
idle keep-alive сокет        закрыт сервером (closeIdleConnections), stop 277 мс
ROBOTS_POLICY=noindex        /healthz: x-robots-tag: noindex, nofollow; / и /xx — без заголовка (prerendered, by design)
контейнеры после проверки    none (все --rm)
```

Медленного роута в фазе 1 нет; «запрос в полёте» смоделирован сырым сокетом с недосланными
заголовками (`drain-test.mjs`): Node держит такое соединение активным, сервер дождался
завершения запроса после SIGTERM, ответил и закрылся. Дополнительно unit-тесты
`runtime.server.test.ts` (fail-fast) и `server-log.txt` предыдущего агента (`SIGTERM: drain … closed`).

### 3.4 `pnpm kin:diff` (advisory, exit 0)

```
идентично: ✓ .claude/rules/forward-only.md ✓ .claude/rules/comments.md ✓ .claude/settings.json
  ✓ .claude/skills/plan/SKILL.md ✓ .commitlintrc.cjs ✓ .npmrc ✓ .nvmrc ✓ LICENSE ✓ SECURITY.md
  ✓ src/shared/lib/{index,cn,cn.test,invariant,invariant.test}.ts
почти идентично (строк, которых нет у соседа): CLAUDE.md 68 · README.md 53 · roadmap.md 26 ·
  fsd-architecture.md 47 · env-local.md 30 · tests-pipeline.md 27 · shared-ui.md 24 ·
  index.css 47 · biome.json 20 · eslint.config.js 114 · steiger.config.ts 16 · vitest.config.ts 30 ·
  lefthook.yml 7 · .size-limit.cjs 7 · .gitignore 3 · .dockerignore 7 · .env.example 16 ·
  e2e/playwright.config.ts 17 · docs/README.md 2 · docs/reference/deployment.md 76
kin:diff: корзина «идентично» совпадает
```

### 3.5 Негативная проверка фикстуры

`<img src="/x.png" />` → `<img src="/x.png" alt="" />` в `.gate-fixtures/src/widgets/a/ui/a.astro`:

```
✗ src/widgets/a/ui/a.astro  astro/jsx-a11y/alt-text — поймано 0
✗ src/widgets/a/ui/a.astro  lint/a11y/useAltText — поймано 0
check:gate: 2 ожидаемых нарушений не поймано — гейт деградировал   (exit 1)
```

Фикстура возвращена (побайтово совпадает с бэкапом и с `a.astro.bak` предыдущего агента),
`pnpm check:gate` снова зелёный.

### 3.6 Самопроверка §6 / §5 п. 9–10

- Правила `fsd-architecture` / `env-local` / `tests-pipeline` / `shared-ui`, `CLAUDE.md`,
  `README.md`, `CONTRIBUTING.md`, `deployment.md`, `kinship.md` — только текущее состояние;
  sweep по «было/стало/теперь/раньше/устарел/changelog» даёт лишь самоописание правила
  forward-only. Комментарии в коде — WHY, по-русски (sweep по латинским комментариям пуст).
- `comments.md`, `forward-only.md` — без изменений (identical).
- Скиллы (кроме `plan`), `docs/stack`, `docs/reference/{architecture,ecosystem,observability}.md`,
  `docs/{getting-started,contributing}.md` не тронуты (mtime 27 авг).

## 4. Отклонения от спецификации и почему

1. **`eslint.config.js` ≠ 12 §9.2 «дословно»** (brief §5.3): (а) элемент `app` режется по
   сегментам (`src/app/*`, `capture: ['segment']`), политика `pages → app/layouts` — иначе
   страница не может импортировать документ-шелл (Astro не оборачивает страницы снаружи), и
   `app → app` для `layouts → styles`; (б) `tseslint.configs.recommended` глобально +
   `recommendedTypeChecked`, `consistent-type-imports`, `no-unused-vars` с `^_` — стиль SPA;
   (в) блок typed-lint включает `e2e/**/*.ts`; (г) `ignores` + `test-results`, `.gate-fixtures`,
   `docs`; (д) `defineConfig` из `eslint/config`; (е) блоки brief §4.5/§5.3 (public API:
   `no-restricted-syntax` + server-only `astro:*`/`node:*`; навязанные entry:
   `no-restricted-imports: off`; тесты); (ж) правка главной сессии: `ignores: ['src/**/*.astro/*.ts']`
   в typed-lint блоке и `projectService: false` в блоке виртуальных файлов — без неё
   `boundaries` не видел клиентский `<script>` (фикстура ловила 1 из 2).
2. **`docker/entrypoint.sh` ≠ листинг 08 §3**: явная проверка `SITE_URL` (`exit 1`, единый
   префикс) вместо `${SITE_URL:?}` (busybox → код 2); `mktemp` вместо `/tmp/stamp.list`; без
   замера времени в логе; `DIST_DIR` (по brief §4.4).
3. **`src/app/styles/index.css`: `source("../..")`** — не из spike: в этом репо лежат
   `docs/research` и правила с примерами классов, автодетект Tailwind их сканировал
   (8.44 КБ gzip CSS вместо целевых 3–5). Побочный эффект — классы вне `src/` не подхватываются
   (так и задумано). Остались 2 паразитных селектора `.com`/`.container` из токенов
   `example.com`/`AstroContainer` в тестах (≈ 200 Б) — не стоят `@source not`.
4. **`docker/Dockerfile` ≠ 08 §3**: `.npmrc` + `--mount=type=secret,id=npmrc` (brief «как в SPA»),
   `--ignore-scripts` (`prepare` → `lefthook install` требует git; нативные бинарники приходят
   optional-пакетами — sharp в образе загружается), в runtime-стадии нет `ENV SITE_URL=плейсхолдер`
   (иначе контейнер стартовал бы до server.mjs с «валидной» переменной), `--chmod=755`.
5. **`biome.json` ≠ 12 §9.5**: без `.svelte/.vue`, без блока `html.formatter` (формат `.astro`
   — Prettier, DECISIONS #10; override `**/*.astro → formatter.enabled: false`), `+ **/*.cjs`,
   исключены `.gate-fixtures`, `docs/research`.
6. **`.size-limit.cjs` ≠ 12 §9.7**: строки «JS островов» нет — островов нет, а size-limit
   падает на пустом glob'е (комментарий описывает строку для первого острова); CSS-лимит 15 КБ
   по brief §4.7 (в 12 §9.7 — 5 КБ); «HTML поста» появится в фазе 2; добавлена «HTML главной (en)».
7. **`tsconfig.json`**: помимо флагов SPA — `moduleDetection: force`, `types: ["node","vitest/globals"]`;
   `.gate-fixtures` исключён (у фикстур свой `tsconfig`).
8. **`package.json`**: `format`/`format:check` гоняют Biome + Prettier; `start` →
   `node ./docker/server.mjs` (brief §4.4, не `entry.mjs` из 12 §11.2); `test:watch` добавлен;
   `knip` из 12 §11.2 не ставился (brief §4.6 его не называет).
9. **`.env.local.example` удалён** — концепт SPA (`VITE_*` override); у Node-процесса один
   `.env.example` (rule `env-local`).
10. **`public/`**: кроме набора §4.1 — `icon-192/512/maskable-512.png`, на которые ссылается
    `manifest.webmanifest`; `og-default.png` — фаза 4/5.
11. **`docs/README.md`, `CONTRIBUTING.md`** (не в стоп-листе п. 10) поправлены минимально:
    ссылки на `deployment`/`kinship`, CONTRIBUTING под Astro. `docs/README.md` в остальном —
    SPA-содержание (8 kinds, strategy) до фазы 6.
12. **`toThrowError` deprecated (hint `astro check`)** в `invariant.test.ts` оставлен —
    identical-файл kinship; замена на `toThrow` — бэкпорт-кандидат в SPA (`kinship.md`).
13. **`check:gate`** гоняет Biome через `.gate-fixtures/biome.gate.json` (extends корневого) —
    корневой `biome.json` исключает `.gate-fixtures`; Steiger/ESLint — реэкспорт корневых конфигов.

## 5. Осталось / риски — что проверить владельцу

- **Дубли статики**: `/index.html`, `/en/index.html`, `/404.html` отвечают 200 (статик-хендлер
  адаптера). На prod закрывается `redirectRegex` на Traefik (фаза 7, `deployment.md`);
  страница 404 несёт `<meta name="robots" content="noindex">`.
- **Дренаж — «немой» сокет**: соединение, не отправившее ни байта, Node считает активным;
  оно держит `close()` до `SHUTDOWN_TIMEOUT_MS`, затем `drain timeout, forcing exit` (код 1).
  Замер: `SHUTDOWN_TIMEOUT_MS=4000` → `docker stop` 4.27 с. Traefik открывает соединения по
  запросу, так что в проде это только slowloris-сценарий; для compose — `stop_grace_period`
  ≥ `SHUTDOWN_TIMEOUT_MS` + запас (фаза 7).
- **`X-Robots-Tag`/`X-Request-Id`/JSON-лог не касаются prerendered и статичной 404** —
  by design; staging закрывает Traefik (три контура). Правило `render-safety` — фаза 3.
- **`Cache-Control: public, max-age=0` + ETag** на prerendered — дефолт адаптера; политика
  кеша on-demand/HTML — фаза 3.
- **Playwright `reuseExistingServer: !CI`**: если на 3201 висит старый сервер, e2e возьмёт его
  (со старой сборкой). Сейчас порт свободен.
- **Образы остались локально** (`ssr-template-accept` 58d56580ad48, `ssr-template-local`
  6a1d4449e89d) — контейнеры удалены, образы не трогал («ничего не удалять вне репо»).
- **Визуальная проверка в браузере** (light/dark, мобильный вьюпорт) — за главной сессией (§8);
  агентом проверены только сырой HTML и axe.
- Хвост CLAUDE.md «Состояние репозитория» честно описывает унаследованные доки/скиллы — его
  снимает фаза 6.

## 6. Данные для фазы 2

**Маршруты и режим:**

| маршрут | файл | режим | заметки |
|---|---|---|---|
| `/` | `src/pages/index.astro` | prerender | `<html lang="ru">`, `<title>`/`description` через `<slot name="head">` |
| `/en` | `src/pages/en/index.astro` | prerender | `lang="en"`; `/en/` → 301 `/en` |
| `/404` (любой неизвестный путь) | `src/pages/404.astro` | prerender | `noindex`; отдаётся статик-хендлером |
| `/healthz` | `src/pages/healthz.ts` | on-demand (`prerender = false`) | `200 ok`, `no-store`; проходит middleware (rid, лог, `X-Robots-Tag`) |

**Env-ключи (runtime):** `SITE_URL` (обязателен, без хвостового слеша, штампуется в `dist/`),
`ROBOTS_POLICY` (`index|noindex`), `RELEASE` (`unknown`), `LOG_LEVEL` (`debug|info|warn|error`,
`info`), `HOST`/`PORT` (`0.0.0.0`/`3000`), `NODE_ENV` (`production` в образе), `NODE_OPTIONS`,
`KEEP_ALIVE_TIMEOUT_MS` (`65000`), `SHUTDOWN_TIMEOUT_MS` (`15000`); `DIST_DIR` — только для
`entrypoint.sh` (e2e). В HTML — whitelist `PUBLIC_CONFIG_KEYS = ['SITE_URL', 'ROBOTS_POLICY']`.
Новый ключ = `shared/config/runtime.ts` + `.env.example` + таблица `deployment.md`.

**Готово к переиспользованию из `shared/*` и `app/*`:**

- `@/shared/config`: `getRuntimeConfig(env?)`, `getPublicConfig(env?)`, `PUBLIC_CONFIG_KEYS`,
  `SITE_ORIGIN_PLACEHOLDER`, `SITE_NAME`, типы `RuntimeConfig`/`RuntimeEnv`/`PublicConfig`.
- `@/shared/i18n`: `Locale`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `isLocale`, `localePath`,
  `stripLocale`, `t(locale, key)` + `DictKey` (строки каркаса; контент — в страницах/коллекциях).
- `@/shared/lib`: `cn`, `invariant`; `@/shared/lib/testing`: `expectNoA11yViolations(html)`.
- `@/shared/ui`: пустой каркас — примитив = `shared/ui/<name>/{<name>.astro,index.ts}`.
- `@/app/layouts/document.astro` (`locale` prop, `<slot name="head">`, default slot в `<main>`),
  `@/app/middleware` (rid/лог/`X-Robots-Tag` на on-demand), `@/widgets/{site-header,site-footer}`
  (`locale` prop; header считает ссылку на другую локаль через `stripLocale(Astro.url.pathname)`).
- Гейт: новый маршрут `.ts` с `prerender = false` попадает под middleware автоматически; новая
  граница — фикстура в `.gate-fixtures/` + строка `expected.json`; новый остров — строка
  `.size-limit.cjs` (`dist/client/_astro/*.js`, 30 KB gzip).
- Контент-коллекции: `src/content.config.ts` сейчас `collections = {}`; коллекцию импортировать
  напрямую из `@/entities/<x>/model/collection` (не через баррель), `.md` — внутри слайса.
