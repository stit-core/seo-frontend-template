# ssr-frontend-template — гайд для агентов

Шаблон индексируемого сайта: **static-first, SSR по необходимости**. Astro 7.3 +
`@astrojs/node` (`output: 'static'`, `standalone`) / TypeScript 6 (`astro/tsconfigs/strictest`)
/ Tailwind v4 на собственном токен-слое / контент — Markdown в git внутри слайса сущности
(Content Layer `glob`, Zod 4-схема) / i18n `ru` + `en` / FSD под линтером (ESLint 10
`boundaries` + `no-restricted-imports`; Steiger — структура) / Biome 2 + Prettier (только
`*.astro`) / Vitest 5 (Container API) + Playwright на prod-сборке / size-limit /
pnpm 10 / lefthook. Один Node-образ на все среды: origin штампуется при старте.

Этот файл — **ядро (always-on) + роутер**. Детали — в `docs/`, контекстные правила —
в `.claude/rules/` (path-scoped), процедуры — в `.claude/skills/`. Карта документации —
`docs/README.md`.

Скиллы `.claude/skills/*` (кроме `plan`), `docs/stack/**`,
`docs/reference/{architecture,ecosystem,observability}.md`, `docs/getting-started.md`,
`docs/contributing.md` — по плану `.claude/plans/roadmap.md`.

## Точка входа

- **Planning-first.** Любое содержательное изменение идёт через план — секция в
  `.claude/plans/roadmap.md` (skill `/plan`). Прямая правка — только truly-atomic
  и багфиксы.
- Дизайн (FSD-карта) проектируется в соседнем `<org>/strategy`; этот репо её читает.
  Код пишется по артефактам, не наоборот.

## Команды

| команда | что делает |
|---|---|
| `pnpm dev` | `astro dev` — демон Astro 7 (`pnpm astro dev stop`), порт 4321 |
| `pnpm build` | `astro build` → `dist/{client,server}` (с плейсхолдером origin) |
| `pnpm start` | `node --env-file-if-exists=.env docker/server.mjs` — prod-сервер (требует `SITE_URL` и штамповку) |
| `pnpm typecheck` | `astro check` |
| `pnpm lint` | `biome check` + `eslint` — **здесь держатся границы FSD** |
| `pnpm format:check` | `biome format` + `prettier --check "src/**/*.astro"` |
| `pnpm test` | Vitest: проекты `astro` (node, Container API) и `dom` (happy-dom) |
| `pnpm test:e2e` | Playwright на prod-сборке через `docker/entrypoint.sh` + `server.mjs` (3201) |
| `pnpm steiger` | структурный линтер FSD |
| `pnpm check:gate` | негативные фикстуры `.gate-fixtures/` обязаны валить ESLint/Steiger/Biome |
| `pnpm check:content` | контент-гейт до build: схема каждого `.md`, тело, переводы, ссылки, `content/redirects.yaml` |
| `pnpm check:links` | после build: все внутренние `href`/`src` в `dist/client` существуют |
| `pnpm size` | бюджеты `.size-limit.cjs` (CSS, HTML главной и поста) |
| `pnpm kin:diff` | advisory-сверка с `../spa-frontend-template` (вне gate) |
| `pnpm check` | **gate**: typecheck → lint → format:check → test → steiger → check:gate → check:content → build → check:links → size |

Перед claim «готово» / push — **`pnpm check`** (его же гоняет `lefthook pre-push`).

## Карта: где что

| Тема | Где |
|---|---|
| FSD под Astro: слои, навязанные entry, public API, server-only | rule `fsd-architecture` |
| Контент: frontmatter и бюджеты, один h1, черновики, переводы, `redirects.yaml`, контент-гейты | rule `content-invariants` |
| env, `SITE_URL`, плейсхолдер и штамповка, whitelist в HTML | rule `env-local` |
| Тесты: два проекта Vitest, Container API, axe, Playwright | rule `tests-pipeline` |
| UI на токенах, тема, scoped-CSS, 0 JS | rule `shared-ui` |
| Deployment: образ, entrypoint, `server.mjs`, env-контракт | `docs/reference/deployment.md` |
| Родство с SPA-шаблоном | `docs/reference/kinship.md` + `pnpm kin:diff` |
| Forward-only, комментарии | rules `forward-only`, `comments` |

## Инварианты

- `astro.config.ts`: `output: 'static'`, `build.format: 'directory'`, `trailingSlash: 'never'`,
  `session: false`, `prefetch: false`, `markdown.syntaxHighlight: false` (Shiki инлайнит
  сырые цвета мимо токен-слоя), плагин `yaml-modules` (`content/*.yaml` → данные на
  сборке); без `<ClientRouter/>`, без `@astrojs/react` / `@astrojs/sitemap`;
  `cache`/`routeRules` не задаются
- **Границы FSD держит `pnpm lint`** (ESLint с резолвером), Steiger — структура: он fail-open
  на `.astro`-целях. Негативные фикстуры `.gate-fixtures/` — часть gate
- Public API — `index.ts` с explicit re-exports (`.ts` и `.astro`); в `index.ts` нет
  импортов, объявлений и вызовов; server-only (`astro:*`, `node:*`) не реэкспортируется
- Навязанные Astro entry (`src/{content.config.ts,middleware.ts,actions/**,env.d.ts}`) —
  тонкие входы (реэкспорт, пустое объявление, декларация типов); коллекции импортируются
  напрямую из модуля слайса
- Единственный импорт вверх — `pages → app/layouts` (документ-шелл); секции страницы —
  `src/pages/_<name>/` (вне роутинга)
- Контент — `src/entities/<name>/content/<locale>/<slug>.md`; язык — каталог; `draft: true`
  виден только в `astro dev`, в сборке — нигде; непереведённое под чужой локалью — 404;
  бюджеты `title`/`description` — в Zod-схеме; литерал плейсхолдера origin в контенте запрещён
- Редиректы — данные `content/redirects.yaml` (301/308/410, один хоп; query сохраняется;
  слеш-вариант `/old/` Astro сначала нормализует 301-м), обслуживает `app/middleware`;
  `404.astro` — on-demand, чтобы путь без файла доходил до middleware; `meta refresh` и
  `redirects` в `astro.config.ts` не используются
- `SITE_URL` — runtime: сборка печёт `https://__site_origin__`, `docker/entrypoint.sh`
  штампует `dist/client` при старте, `server.mjs` с плейсхолдером не стартует; HTML не
  предсжимать; абсолютные URL только в `<head>`/JSON-LD/фидах/sitemap
- 0 JS на контентных страницах; остров — по решению, строка в `.size-limit.cjs`
- Biome formatter + ESLint flat + Prettier для `*.astro`; TypeScript strict без `as any`
  без причины
- UI — `.astro` на токен-слое `src/app/styles/index.css`, без внешней DS
- Комментарии — только WHY, кратко, по-русски; текст репо — forward-only

## Git workflow

- **Conventional Commits**: `feat|fix|refactor|docs|test|chore|meta|perf|style`,
  формат `<type>(<scope>)?: <subject>`, subject ≤ 72
- **Push в `main` разрешён** (прямой или через PR); линейная история
- Gate `lefthook pre-push → pnpm check` (skip только при явной просьбе юзера)
- git-хуки ставятся `pnpm prepare` (== `lefthook install`)

## Границы

### Делать всегда
- Перед claim «готово» — `pnpm check`
- **Изменение — через план** (skill `/plan`). Отклонение — осознанное
- Cross-feature — только через подъём в entities/shared или композицию в widget/page
- Новое правило границ — фикстура в `.gate-fixtures/` + строка в `expected.json`
- Новая коллекция контента — `model/{schema,collection}.ts`, импорт в `src/content.config.ts`
  напрямую из модуля, строка в реестре `scripts/check-content.mjs`
- Новый env-ключ — `shared/config` + `.env.example` + таблица в `deployment.md`

### Сначала спросить
- Правка `docker/*`, `.npmrc`, `package.json#dependencies`
- Новый остров (клиентский `<script>`), новая интеграция Astro
- Изменение FSD-структуры (новый слой, переименование сегментов)
- Любой `--no-verify`

### Не делать никогда
- `--no-verify` без явного разрешения юзера
- Коммитить `.env`, `*.pem`, `*.key`
- `export *` из `index.ts`; импорт мимо public API (`@/<layer>/<slice>/<segment>/…`)
- Импорт внешней дизайн-системы; сырые цвета/размеры вместо токенов
- `Astro.site`/`astro:i18n` для абсолютных URL; `import.meta.env.VITE_*` для среды
- Предсжатие HTML на сборке; `build.format: 'file'`

## Forward-only

Любой текст в репо описывает **только текущее состояние** — не «было/стало».
История — в `git log` + Conventional Commits. Полное правило —
`.claude/rules/forward-only.md`.

## Авто-память

Запись в файловую авто-память запрещена глобально (см. `~/.claude/CLAUDE.md`).
Не предлагай «сохранить в память». Долгосрочное знание — в репо: `CLAUDE.md`,
`.claude/rules/`, `state/` каждого скила.
