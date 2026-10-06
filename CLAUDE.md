# ssr-frontend-template — гайд для агентов

Шаблон индексируемого сайта: **static-first, SSR по необходимости**. Astro 7.3 +
`@astrojs/node` (`output: 'static'`, `standalone`) / TypeScript 6 (`astro/tsconfigs/strictest`)
/ Tailwind v4 на собственном токен-слое / контент — Markdown в git внутри слайса сущности
(Content Layer `glob`, Zod 4-схема) / i18n `ru` + `en` / SEO-слой `shared/seo` (canonical,
hreflang, OG, JSON-LD; `robots.txt`/`sitemap.xml`/`rss.xml` on-demand на runtime origin) /
форма обратной связи без JS (PRG, антиспам-лестница, один канал доставки) / тема — единственный
остров / картинки `astro:assets` / FSD под линтером (ESLint 10 `boundaries` +
`no-restricted-imports`; Steiger — структура) / Biome 2 + Prettier (только `*.astro`) /
Vitest 5 (Container API) + Playwright на prod-сборке (HTTP-набор в гейте, браузер — в
`/release`) / size-limit / pnpm 10 / lefthook. Один Node-образ на все среды: origin
штампуется при старте.

Этот файл — **ядро (always-on) + роутер**. Детали — в `docs/`, контекстные правила — в
`.claude/rules/` (подгружаются по `paths`, когда читаешь файл их темы; `forward-only` — всегда),
процедуры — в `.claude/skills/`. Карта документации — `docs/README.md`.

## Точка входа

Сюда приходят двумя путями, и в обоих работаешь обвязкой этого репо — этот файл, скиллы,
гейт `pnpm check`:

- **агентом из хаба `<org>/infra`** — проект стартует в `<org>/strategy`, дальше работа идёт из
  операционного хаба: сквозная задача — план-программа в `.claude/plans/` инфры, оттуда её фаза
  приходит сюда (`../site`) и ведётся планом здесь (`/plan`, `parent: infra:<slug>`);
- **прямым заходом** — нормальный режим; то, что задевает соседей, уходит handoff-блоком для
  `<org>/infra` (его печатает `/release`, контракт сервиса `site` — `docs/reference/infra-handoff.md`).

Не знаешь, с чего начать, — `/smartdev`: покажет состояние и назовёт следующий шаг.
Содержательное изменение идёт через план — файл в `.claude/plans/` (`/plan`: критерии приёмки,
шаги с проверками, «Где мы сейчас» для продолжения после `/clear`), бэклог —
`.claude/plans/backlog.md`; напрямую — только атомарные правки и багфиксы.

## Экосистема

Этот репо — `<org>/site`, индексируемый сайт. Соседи — sibling-checkout'ы:

- `../strategy` (`business-strategy-template`) — design-time source of truth. FSD-карта сайта
  (`docs/projects/<slug>/fsd/<surface>/`) проектируется там (`/fsd-deep-dive`), здесь читается
  read-only (резолв — `docs/stack/service.md`): код пишется по артефактам, не наоборот, а правка
  карты — задача для strategy и её скиллов
- `../infra` (`project-infra-template-compose`) — runtime проекта на VPS и операционный хаб. Этот
  репо останавливается на образе в registry (`/release`); выкатка тега — только там
  (`make bump SVC=site TAG=vX.Y.Z`)
- `../frontend` (`spa-frontend-template`) — всё за логином; `../backend` — данные извне, если нужны

Соседи, флоу и контракты — `docs/reference/ecosystem.md`; канон экосистемы —
`docs/reference/ecosystem.md` в `<org>/infra`.

## Скиллы

| скилл | когда |
|---|---|
| `/smartdev` | начало сессии, после `/clear`: где я и что дальше |
| `/plan` | любое содержательное изменение — план в `.claude/plans/` |
| `/init-service` | свежий форк: оркестратор пути «шаблон → свой сайт» |
| `/stack-deep-dive` | платформа: `docs/stack/*.md` волнами до `stable` |
| `/de-template` | разворот фундамента по stable-артефактам (на каноническом репо — никогда) |
| `/scaffold` | `page` · `collection` · `feature` · `widget` · `route` по канону |
| `/content` | запись коллекции: frontmatter в бюджетах, перевод, `check:content` |
| `/seo-audit` | прогон `seo:check` + HTTP-набора + curl по домену, отчёт |
| `/release` | образ, приёмка, тег, пуш, handoff в `<org>/infra` |

## Команды

| команда | что делает |
|---|---|
| `pnpm dev` | `astro dev` — демон Astro 7 (`pnpm astro dev stop`), порт 4321 |
| `pnpm build` | `astro build` → `dist/{client,server}` (с плейсхолдером origin) |
| `pnpm start` | `node --env-file-if-exists=.env docker/server.mjs` — prod-сервер (требует `SITE_URL` и штамповку) |
| `pnpm typecheck` | `astro check` |
| `pnpm lint` | `biome check` + `eslint` — **здесь держатся границы FSD** |
| `pnpm format:check` | `biome format` + `prettier --check "src/**/*.astro"` |
| `pnpm test` | Vitest: проекты `astro` (node, Container API) и `dom` (happy-dom), покрытие широкого объёма с порогами |
| `pnpm test:http` | HTTP-набор `e2e/http/` после build: prod-сервер как контейнер (копия сборки, `entrypoint.sh` + `server.mjs`) на свободных портах, профили прод и staging |
| `pnpm test:e2e` | build + браузерный набор `e2e/browser/`: axe в двух темах, тема, форма без JS — обязательный шаг `/release` |
| `pnpm steiger` | структурный линтер FSD |
| `pnpm check:gate` | негативные фикстуры `.gate-fixtures/` обязаны валить ESLint/Steiger/Biome и свои скрипты гейта (`seo:check`, `check:links`, `check:content`) — ровно нарушениями из `expected.json` |
| `pnpm check:content` | контент-гейт до build: схема каждого `.md`, тело, переводы, ссылки, `content/redirects.yaml` |
| `pnpm check:links` | после build: все внутренние `href`/`src` в `dist/client` существуют |
| `pnpm seo:check` | после build: у каждой страницы `dist/client` title/description (уникальные, в бюджетах, не общие), self-canonical, `lang`, один h1, OG с картинкой, hreflang у каждой пары переводов, JSON-LD = видимое; `noindex`, острова, чужие ресурсы и типы JSON-LD — только по списку `scripts/lib/site-policy.mjs` |
| `pnpm size` | бюджеты `.size-limit.cjs` (CSS, HTML главной и поста) |
| `pnpm kin:diff` | advisory-сверка с `../spa-frontend-template` (вне gate) |
| `pnpm ttfb <origin> <path…>` | TTFB запущенного сервера: медиана/p90 20 запросов (`scripts/ttfb.mjs`) |
| `pnpm accept:image <image>` | приёмка собранного образа до пуша: fail-fast, штамповка, статусы, TTFB, staging, дренаж |
| `pnpm check` | **gate**: plan:check → typecheck → lint → format:check → test → steiger → check:gate → check:content → build → check:links → seo:check → size → test:http |

Перед claim «готово» / push — **`pnpm check`** (его же гоняет `lefthook pre-push`).

## Карта: где что

| Тема | Где |
|---|---|
| FSD под Astro: слои, навязанные entry, public API, server-only | rule `fsd-architecture` + `docs/reference/architecture.md` |
| Контент: frontmatter и бюджеты, один h1, черновики, переводы, `redirects.yaml`, контент-гейты | rule `content-invariants` |
| env, `SITE_URL`, плейсхолдер и штамповка, whitelist в HTML | rule `env-local` |
| Режимы рендера, карта маршрутов, кеш-заголовки, канон `astro.config.ts`, рецепт D | `docs/reference/rendering.md` + rule `render-safety` |
| Тесты: два проекта Vitest, Container API, axe, Playwright, покрытие и пороги | rule `tests-pipeline` |
| UI на токенах, тема-остров, картинки и LCP, scoped-CSS, 0 JS | rule `shared-ui` |
| Форма без JS: PRG, антиспам-лестница, согласие на ПДн, доставка | rule `forms-antispam` |
| Deployment: образ, entrypoint, `server.mjs`, env-контракт, требования к прокси | `docs/reference/deployment.md` |
| SEO: head через `DocumentLayout`, hreflang, OG, JSON-LD, `robots.txt`/`sitemap.xml`/фиды/ключ IndexNow, staging в три контура, гейты `seo:check` и HTTP-набор | rule `seo-invariants` + `docs/reference/seo.md` |
| Наблюдаемость: JSON-лог, `X-Request-Id`, `/healthz`, Sentry по DSN | `docs/reference/observability.md` |
| Платформа проекта: 12 kinds, порядок волн, гейт `stable` | `docs/stack/README.md` |
| Экосистема: соседи, флоу (хаб `<org>/infra` или прямой заход), контракты, STOP на image-in-registry | `docs/reference/ecosystem.md` |
| Что инфра обязана сделать под сервис `site`: `compose/site.yml`, Traefik, CrowdSec, приёмка | `docs/reference/infra-handoff.md` |
| Путь потребителя шаблона: форк → свой сайт | `docs/getting-started.md` |
| Устройство `.claude`-системы (правила, скиллы, план) | `docs/contributing.md` |
| Родство с SPA-шаблоном | `docs/reference/kinship.md` + `pnpm kin:diff` |
| Forward-only, комментарии | rules `forward-only`, `comments` |

## Инварианты

Ядро, которое держится в любой задаче. Полная форма и причины — в rule темы (карта выше),
большую часть нарушений ловит `pnpm check`.

- Static-first: всё prerender; `prerender = false` — только служебные маршруты, со строкой в
  карте `docs/reference/rendering.md` и явным `Cache-Control`
- Один образ на все среды: `SITE_URL` — runtime; сборка печёт плейсхолдер
  `https://__site_origin__`, `docker/entrypoint.sh` штампует `dist/client` при старте
- Границы FSD держит `pnpm lint` (ESLint с резолвером) вместе с `.gate-fixtures/`; Steiger —
  структура
- 0 JS на контентных страницах, кроме островов: тема (инлайн-`<script>` в `<head>`) и счётчик при
  заданном `METRIKA_ID`; острова, служебные `noindex`, чужие ресурсы и типы JSON-LD — только по
  списку `scripts/lib/site-policy.mjs`
- Контент — Markdown в `src/entities/<name>/content/<locale>/`; `draft: true` виден только в
  `astro dev`
- Каждая страница — через `DocumentLayout`; абсолютные URL — только `absoluteUrl()` из `shared/seo`
- Форма — без JS: PRG, антиспам-лестница, тело заявки не логируется
- Лог — один `log()` из `shared/observability`, без PII
- UI — `.astro` на токен-слое `src/app/styles/index.css`; вендорные UI-киты не подключаются
- TypeScript strict; `as any` — только с причиной (Biome ловит его лишь предупреждением)
- Комментарии — только WHY, кратко, по-русски; текст репо — forward-only

## Git workflow

- **Conventional Commits** (commitlint): `feat|fix|refactor|docs|test|chore|meta|perf|style`,
  формат `<type>(<scope>)?: <subject>`, subject ≤ 72
- **Push в `main` разрешён** (прямой или через PR); линейная история
- Хуки ставит `pnpm prepare` (`lefthook install`): pre-commit — Biome/Prettier/ESLint по staged,
  commit-msg — commitlint, pre-push — `pnpm check`

## Границы

Сначала спроси юзера — эти решения надолго меняют образ, зависимости или архитектуру сайта:
правка `docker/*`, `.npmrc`, `package.json#dependencies`; новый остров (клиентский `<script>`)
или интеграция Astro; изменение FSD-структуры (новый слой, переименование сегментов).

Хуки не обходятся: `--no-verify` закрыт deny-правилом `.claude/settings.json`, и пропустить
pre-push `pnpm check` может только сам юзер. `.env`, `*.pem`, `*.key` не коммитятся: секреты
живут только в env контейнера.

## Долгосрочное знание

Авто-память не используется: знание, которое должно пережить сессию, записывается в репо —
`CLAUDE.md`, `.claude/rules/`, `state/` скиллов, `docs/`.
