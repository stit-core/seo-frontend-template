# Фаза 6 — обвязка: отчёт

## 1. Сделано
- **`docs/stack`**: `README.md` — каталог 12 kinds (колонки «обязателен», условие для `api`/`analytics`,
  порядок волн, словарь статусов, гейт). `_templates/` — 12 форм с предзаполненными дефолтами шаблона:
  новые `content` (источник, коллекции, **кто редактирует** с блокирующим инвариантом, картинки, поиск),
  `rendering` (режимы, карта маршрутов, абсолютные URL, острова), `seo`, `analytics`; переписаны
  `service` (`infra-svc: site`, домены), `runtime`, `routing`, `styling`, `api` (обработчики + лестница
  + доставка), `observability`, `config` (колонка «в HTML?»), `dependencies`. У каждого — непустой `Generates`.
- **Скиллы**: переписаны `smartdev`, `init-service`, `stack-deep-dive` (12 волн, cross-kind проверки,
  4 reference'а), `de-template` (гейт + этапы A.1–A.10 + `references/prune.md` в двух режимах),
  `scaffold` (`page`/`collection`/`feature`/`widget`/`route` + `references/templates.md`), `release`
  (образ, приёмка, тег, handoff, SEO- и юридический чек-листы). Новые: `seo-audit`, `content`.
  `plan` — без изменений (корзина «идентично»).
- **Приёмка образа**: `scripts/accept-image.sh` + `pnpm accept:image <image>` — шаг 2 `/release`.
- **Reference**: переписаны `architecture.md`, `ecosystem.md`, `observability.md`; новый `seo.md`;
  переписаны `docs/README.md`, `getting-started.md`, `contributing.md`.
- **Ядро**: `CLAUDE.md` — секция «Скиллы», строки карты (architecture/seo/observability/stack/ecosystem/
  getting-started/contributing), `accept:image`, снята строка «по плану roadmap». `README.md` — раздел
  «Из шаблона — в свой сайт», таблица документации, команды, структура. `CONTRIBUTING.md` — актуальный
  состав гейта + ссылка на `docs/contributing.md`.
- **Сверка правил** (10 шт.) с кодом: расхождений нет — `src/actions/**` в конфигах Steiger/ESLint,
  токены и классы `index.css` совпадают, env-таблица = Zod-схема, лимит формы 64 КБ,
  `consent: z.literal(true)`, проекты Vitest `astro`/`dom`. Правила не правились.

## 2. Зависимости
Нет.

## 3. Проверено
- `pnpm check` — **exit 0**: vitest 35 файлов / 162 теста; steiger «No problems»; `check:content` 12 записей,
  2 редиректа; `check:links` 802; `seo:check` 34 страницы (hreflang 22, пар 11); size 4.24 / 4.39 / 3.82 / 4.37 kB.
- `pnpm test:e2e` — **80 passed**. `pnpm kin:diff` — корзина «идентично» совпадает.
- **Прогон `/de-template` на форке** (`<scratchpad>/fork-test`, дерево рабочей копии + symlink `node_modules`):
  - Gate-4 **упал как положено**: `grep -rn '{{OPERATOR_' src/` → 4 совпадения в `legal/privacy.astro` → STOP.
  - Заполнены фиктивные реквизиты (ООО «Акме», ИНН, адрес, `privacy@acme.example`), пакет → `@acme/site`,
    идентичность `site.ts`, `company.ts`, тексты главных, `redirects.yaml` (`/uslugi → /contacts`).
  - Режим «без блога»: удалены `entities/post`, `widgets/post-list`, `pages/{blog,en/blog,_blog}`, оба
    `rss.xml.ts`, `shared/seo/rss*`, `e2e/content.spec.ts`; поправлены 11 точек по prune-листу
    (реестр коллекций, `content.config.ts`, `check-content.mjs`, `sitemap.xml.ts`, шапка/подвал,
    `seo-head.astro` + тест, баррель seo, `dict.ts`, `.size-limit.cjs`, `index.server.test.ts`).
  - Итог: `pnpm check` **exit 0**; сборка 9 страниц без блога, `check:links` 130, `seo:check` 9 (пар 3);
    живой сервер: `sitemap.xml` — 7 URL **без `/blog`**, `robots.txt` открыт, `/blog` → 404,
    `/uslugi` → 301 `/contacts` одним хопом.
- **`/scaffold page /services`** (ru + en, indexable, hreflang, строка в `STATIC_ROUTES`, пункт меню):
  `pnpm format` → `typecheck` 0 errors → `lint` clean → `steiger` «No problems». Повторный `pnpm check`
  на форке — exit 0 (11 страниц, `seo:check` пар 4, `check:links` 168). Форк никуда не коммитился.
- Фоновых процессов нет, порты 3201/3202/3299/4321 свободны.

## 4. Отклонения от спецификации
- Kind `images` не заводится (DECISIONS #11) — пайплайн картинок в секции `content.md`; в каноническом
  репо `docs/stack/<kind>.md` не заполняются, только `_templates` (указание главной сессии).
- Добавлены `scripts/accept-image.sh` и `pnpm accept:image` (суть `reports/accept-image.sh` перенесена в `/release`).
- `/de-template` дополнительно удаляет `kinship.md` + `kin:diff`, `docs/research/**` и одноразовые скиллы
  `init-service`/`de-template`: в развёрнутом проекте это мусор и ложные триггеры.
- Три правки процедур **по итогам прогона на форке**: A.1 исключает `.claude`/`docs/research` из `sed`
  (сплошная замена ломала триггеры скиллов онбординга); A.7 и prune-лист называют
  `middleware/index.server.test.ts` (ходит по демо-редиректам); post-flight `/scaffold` начинается с `pnpm format`.

## 5. Осталось / риски
- E2E-спеки на форке не чистились: вне гейта форка; шаг есть в prune-листе.
- Прунинг «без блога» — ~15 точек правки, все reviewable-руками: автоматизации by design нет.
- `docs/research/NEXT-SESSION.md` и `reports/accept-image.sh` удаляет главная сессия в финале; roadmap не трогал.

## 6. Данные для фазы 7 (in-repo handoff для infra)
- `compose/site.yml`: сервис **без `read_only: true`** (штамповка пишет в `/app/dist/client`),
  `stop_grace_period` ≥ `SHUTDOWN_TIMEOUT_MS` (15 с) + запас, `mem_limit` 768 МБ ↔ `NODE_OPTIONS`,
  healthcheck на `/healthz`, env: обязательный `SITE_URL` + `ROBOTS_POLICY`/`LOG_LEVEL`/`RELEASE`/`FORM_*`.
- Traefik: `basicAuth` + `customResponseHeaders: X-Robots-Tag` на staging; **rate-limit на `/api/contact`**
  (пример: average 10, period 1m, burst 5, `ipStrategy.depth 1`); `X-Forwarded-Proto`/`-For` обязательны;
  `redirectRegex` для `/index.html` и `/en/index.html`; `www` → apex, `http` → `https`, `compress`,
  `secure-headers@file` (приложение security-заголовки не дублирует). Источник — `deployment.md § Требования к прокси`.
- Sweep «6 → 7»: от SPA-обвязки не осталось ничего, кроме корзины «идентично» `kin:diff`
  (`forward-only`, `comments`, `/plan`, `settings.json`, commitlint, `.nvmrc`/`.npmrc`, LICENSE,
  `shared/lib/{cn,invariant}`) — скиллы, доки, формы `docs/stack` переписаны под Astro-шаблон.
