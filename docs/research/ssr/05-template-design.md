# 05 — Дизайн `ssr-frontend-template` как шаблона экосистемы stit

Поток: устройство самого шаблона + его место в экосистеме (репо-стратегия, имя,
агентная обвязка, kinds, FSD-канон, инфра, витрина). Не про выбор фреймворка
(поток 01) и не про канон SEO по существу (поток 02) — только про то, **куда
это ложится в шаблоне и в соседях**.

---

## 1. TL;DR

1. **Отдельный репозиторий `ssr-frontend-template` (вариант A)** — рекомендация.
   Экосистема уже так устроена: `go-backend-template` и `telegram-bot-template` —
   разные репо с *одинаковой обвязкой* и **разным** набором `docs/stack`-kinds
   (8 против 11). Родственность обеспечивается каноном обвязки, а не общим кодом.
2. **Вариант B («один фронт-шаблон с переключателем рендера») технически возможен**
   — SPA-режим в TanStack Start документирован (`spa: { enabled: true }` →
   prerender шелла в `/_shell.html`, deploy на статику с rewrite-правилами), —
   **но экономически неверен**: он требует переписать уже готовый SPA-шаблон на
   Start (другой билд, другой рантайм-класс, потеря бюджета «150 KB initial,
   nginx, без Node») ради переключателя, который потребителю SPA не нужен.
   Опция сохраняется на уровне *проекта-потребителя*, не шаблона.
3. **Вариант C (общая npm-библиотека `@stit/fe-*`) — нет.** Общего кода на
   ~300 строк (`cn`, `invariant`, fetch-враппер, zod-конфиг); публикация npm-пакета
   — новый контракт для экосистемы без CI-раннера; и он прямо противоречит
   инварианту «всё в проекте, agnostic», из-за которого уже отказались от `@stit/ui`.
   Пересмотреть — только если появится третий фронт-шаблон (`landing-template` в
   roadmap!) **и** общего кода станет > ~2000 строк.
4. **Синхронизация A обеспечивается чеклистом, не git-механикой.** Gitea при
   «Use this template» **схлопывает историю в один коммит** — потребитель физически
   не может мержить апстрим. Значит синхронизировать надо только два канонических
   репо между собой: `docs/reference/kinship.md` (три списка: identical /
   near-identical / intentionally divergent) + опциональный `pnpm kin:diff`
   против sibling-checkout `../spa-frontend-template`.
5. **Имя форка — `<org>/site`** (не `frontend`: проект может иметь и SPA-приложение,
   и индексируемый сайт одновременно). Сервис в инфре `SVC=site` → `SITE_TAG` →
   `compose/site.yml` на корневом `${DOMAIN}` (перебивает always-on `landing`).
   Имя репо-шаблона — оставить `ssr-frontend-template` (уже в публичном roadmap).
6. **`docs/stack`: 8 → 10 kinds.** Новые — `rendering.md` (режим рендера и кеша
   на маршрут/группу, коды ответов, инвалидация) и `seo.md` (идентичность сайта,
   OG, JSON-LD, локали/hreflang, robots incl. AI-боты, sitemap, верификации).
   Встраивать в `routing`/`config` нельзя: у них другой `Generates` и другой гейт.
7. **FSD-канон в strategy менять не обязательно.** Дефолтный путь — вывод
   `indexable` из `pages.guard` + таблица исключений в `docs/stack/rendering.md`.
   Минимальный канон-PR (если владелец захочет): **две** колонки в `fsd/_template/pages.md`
   — `indexable` (`yes|no`) и `freshness` (`static|periodic|live|per-user`), обе
   в языке смысла, без `src/`-путей и библиотек (канон это прямо запрещает).
   SEO-копирайт (title/description для выдачи) в FSD-карту **не** заводить — это
   не UX-описание экрана, а маркетинговый текст; его место — `docs/stack/seo.md`.
8. **Обвязка: +2 правила и +1 скилл.** Правила `ssr-safety` (браузерные глобалы,
   синглтоны на сервере, per-request QueryClient, форвардинг cookie, что нельзя
   сериализовать в payload) и `seo-invariants` (`head()` на каждой page, абсолютный
   canonical, один h1, реальный 404, noindex для приватного). Скилл `/seo-audit` —
   прогон по собранному прод-серверу; реализован как playwright-проект `seo`,
   поэтому скилл тонкий (запусти → интерпретируй → покажи, какой артефакт править).
9. **Reference-слайсы — контентные, не todo-шные.** `entities/article` вместо
   `todo`; pages `index` (prerender + WebSite/Organization), `about` (prerender),
   `blog` (список, ISR, фасеты и canonical), `blog/$slug` (ISR + Article JSON-LD +
   честный 404), `login` (public **но** noindex), `profile` (`ssr:false` + guard);
   server-routes `sitemap.xml` / `robots.txt`. Каждый режим рендера и каждый
   SEO-приём — ровно по одному разу.
10. **Cross-repo правок — 7 репозиториев**, порядок обязателен: канон
    `corp-infra-template/docs/ecosystem.md` первым (сам документ это требует),
    дальше strategy (опц.), infra, backend (опц.), spa-frontend, «6 шаблонов»-sweep,
    витрина `stit-public` последней. Витрина уже сильно отстала от факта — добавление
    SSR стоит делать одним заходом с её освежением.

---

## 2. Findings

### 2.0 База: что именно наследует форк (инвентаризация обвязки SPA-шаблона)

Проверено чтением репо `/home/mm/git/stit-core/spa-frontend-template` (ветка `main`).

| зона | состав |
|---|---|
| ядро | `CLAUDE.md` (ядро + роутер: точка входа, «проектирование первично», команды, карта, стиль, git workflow, границы, forward-only, авто-память) |
| правила | `.claude/rules/{forward-only,fsd-architecture,comments,shared-ui,env-local,tests-pipeline}.md` — 6 шт., path-scoped |
| скиллы | `smartdev`, `plan`, `init-service`, `stack-deep-dive` (+4 references, `state/`), `de-template` (+`references/prune.md`), `scaffold`, `release` — 7 шт. |
| планы | `.claude/plans/roadmap.md` — единый, `## Active` / `## Backlog`, секция удаляется по закрытии |
| settings | `.claude/settings.json` — `permissions.deny` на publish/`--no-verify`/force-push/reset/clean/memory-write |
| доки | `docs/README.md` (карта), `docs/getting-started.md` ([META], удаляется), `docs/contributing.md` (устройство `.claude`), `docs/reference/{architecture,ecosystem,deployment,observability}.md` |
| артефакты | `docs/stack/README.md` + `_templates/<kind>.md` × 8, frontmatter `id/kind/name/status`, обязательная секция **Generates**, гейт «все 8 stable → `/de-template`» |
| гейт | `pnpm check` = typecheck + lint + format:check + test + steiger + build + size; `lefthook pre-push` гоняет то же |
| cross-repo | резолв соседа полями `project-slug` / `strategy-path` (дефолт `../strategy`) / `surface` в `docs/stack/service.md`; чтение FSD-карты — read-only |

Это и есть «родственность», которую SSR-шаблон обязан воспроизвести один-в-один
по **форме**, расходясь по **содержанию**. Ниже везде считаю это базой.

**Попутная находка (drift, чинить независимо):** `spa-frontend-template/docs/reference/ecosystem.md`
до сих пор пишет «`stit-core/ui-lib` (`@stit/ui`, design-system — импортирует этот
репо)», хотя `package.json` его не содержит, а `CLAUDE.md`/README/`rules/shared-ui.md`
прямо запрещают внешнюю DS. Ту же фразу несут `ecosystem.md` у go-backend,
telegram-bot, project-infra, strategy и `corp-infra-template/docs/ecosystem.md`
(там `@stit/ui` нарисован стрелкой от `<org>/frontend`). Это **тот же sweep**, что
и «6 → 7 шаблонов», — делать одним проходом.

### 2.1 Внешний факт: SPA-режим в TanStack Start (влияет на вариант B)

**Проверено 2026-09-15** по исходникам документации TanStack Start (копия docs
в scratchpad, канонические URL — в «Источниках»).

- **SPA-режим существует и конфигурируется флагом.** Опции плагина:
  `tanstackStart({ spa: { enabled: true } })` — и для Vite, и для Rsbuild.
  Источник: `framework/react/spa-mode`.
- **Как работает:** после обычного билда добавляется шаг prerender — рендерится
  **только root-маршрут**, на месте матчей — `pending`-фолбэк роутера, результат
  кладётся в `/_shell.html` (`spa.prerender.outputPath` настраивается), и все 404
  переписываются на шелл. Доп. опции — `spa.maskPath`, `spa.prerender.{crawlLinks,retryCount}`.
  В шелле доступен `router.isShell()`; `loader` root-маршрута выполняется при
  prerender и его данные попадают в шелл.
- **Деплой на статику задокументирован:** правила rewrite (пример на Netlify
  `_redirects`) — сначала статические файлы, потом allow-list `/_serverFn/*` и
  `/api/*` на динамический сервер (если он есть), потом catch-all → `/_shell.html`.
  То есть SPA-выход **можно раздавать nginx-ом** (аналог текущего `try_files … /index.html`,
  только целевой файл `/_shell.html`).
- **Прямая оговорка документации:** SPA-режим «**Less SEO friendly**» — краулеры
  «_may_ have a harder time indexing your application».
- **Рядом — полноценный prerender/SSG** (`prerender: { enabled, crawlLinks,
  autoStaticPathsDiscovery, filter, failOnError, … }` + пер-страничный
  `pages: [{ path, prerender: { enabled, outputPath } }]`), с автодискавери
  статических маршрутов (параметрические `/$id`, layout-маршруты `_`, роуты без
  компонента — исключаются) и краулингом ссылок.
- **ISR — не отдельная фича, а HTTP-кеш:** «leverages standard HTTP cache headers
  that work with any CDN» — prerender на билде + `Cache-Control`
  (`max-age`/`s-maxage`/`stale-while-revalidate`) поверх. Источник: `framework/react/isr`.
- **Selective SSR — на маршрут:** свойство `ssr` у route принимает
  `true | false | 'data-only'` **и функцию** (`ssr: ({ params, search }) => …`);
  дефолт задаётся `createStart(() => ({ defaultSsr: false }))`. Источник:
  `framework/react/selective-ssr`.
- **SEO-инструменты в ядре:** `head` на route (`meta`, в т.ч. динамический из
  `loaderData`), отдельный гайд `framework/react/seo` и даже `framework/react/geo`
  (Generative Engine Optimization — политика под LLM-краулеры).

**Вывод для дизайна:** «один код — и статика за nginx, и SSR на Node» —
**технически подтверждено**. Но переключатель живёт в плагине Start, значит
кодовая база обязана быть Start-приложением; сегодняшний SPA-шаблон таковым не
является (чистый Vite + `@tanstack/react-router` + `router-plugin`). См. 2.2-B.

> Отдельно: точные версии `@tanstack/react-start`, совместимость с Vite 8 /
> Rolldown и статус релиза — зона потока 01/06, здесь на них не опираюсь.

### 2.2 Стратегия репозитория: A / B / C

#### Вариант A — отдельный `ssr-frontend-template`, форк SPA-шаблона, дальше расходятся

**За**

- Совпадает с уже работающим паттерном экосистемы: два сервис-шаблона (`go-backend`,
  `telegram-bot`) — разные репо с одинаковой обвязкой и **разным** числом
  `docs/stack`-kinds (8 против 11, у бота ещё и опциональный kind `i18n`).
  Значит «родственность» в stit — это **контракт обвязки**, не общий код.
- Два разных STOP-контракта в инфре: nginx-образ на статике vs Node-процесс.
  Разные Dockerfile, healthcheck, лимиты памяти, класс инцидентов. Один репо =
  один деплой-класс — это инвариант всей экосистемы (`<SVC>_TAG`, `compose/<svc>.yml`).
- Reference-слайсы можно сделать **учебными по своей теме** (контентный сайт),
  а не компромиссом «и то, и это». Учебная ценность шаблона — его главный актив.
- Гейт и бюджеты честные: у SPA бюджет «initial JS ≤ 150 KB gzip», у сайта —
  вес документа, TTFB, полнота HTML. В одном репо эти бюджеты конфликтуют.
- Риск нуля: SPA-шаблон объявлен «готов» на публичной витрине; его не трогаем.

**Против**

- Дублируется обвязка: 6 правил, 7 скиллов, 4 reference-дока, ~10 конфигов.
  Правка канона (например, формата `state/<kind>.md`) делается дважды.
- Расхождение неизбежно и незаметно: через полгода `/plan` в двух репо разный.

**Дисциплина синхронизации (ключевой вопрос варианта A)**

Прежде всего — **синхронизировать надо только два канонических репо**, не форки:
Gitea при «Use this template» **схлопывает историю шаблона в один коммит** нового
репо (открытый issue go-gitea/gitea#27964 просит опцию «Preserve Git History»
именно потому, что сейчас `git merge` апстрима падает на `refusing to merge
unrelated histories`). Значит:

- ❌ **git merge из ветки `base` / subtree** — мимо цели. Потребителю недоступно
  в принципе; между двумя шаблонами даст перманентные конфликты, потому что
  расходятся ровно те файлы, что и должны (`vite.config.ts`, `docker/*`,
  `src/app/*`, `.size-limit.cjs`, `e2e/*`).
- ✅ **Явный контракт родства + механическая сверка.** Завести в SSR-шаблоне
  `docs/reference/kinship.md` с тремя списками (identical / near-identical /
  intentionally divergent — черновик в §3.4) и опциональный скрипт
  `pnpm kin:diff`, который диффает identical-список против sibling-checkout
  `../spa-frontend-template` и печатает отчёт. Sibling нет — деградирует
  gracefully (та же конвенция, что у `strategy-path`). В гейт **не** включать:
  шаблон не должен краснеть от отсутствия соседа. Строку отчёта показывать в
  `/smartdev` как advisory.
- Порядок правок: канонический источник обвязки — **SPA-шаблон** (он старше и
  «готов»); SSR-шаблон подтягивает. Исключение — новые общие идеи, рождённые в
  SSR (например, поле `infra-svc` в `service.md`, см. §3.6), — бэкпортируются в SPA.

#### Вариант B — один `frontend-template` с переключателем рендера

Форма: `docs/stack/rendering.md` с полем `mode: spa | ssr`, два Dockerfile,
`/de-template` прунит лишнюю ветку.

**За**

- SPA-режим Start реально существует и документирован (§2.1) — переключатель не
  фантазия.
- Один репо — одна обвязка, ноль drift'а.
- Потребитель может начать как SPA и позже включить SSR без переписывания кода.

**Против (решающее)**

- Это **не** «добавить SSR к текущему SPA-шаблону», а **мигрировать готовый
  SPA-шаблон на Start** и только потом добавить флаг. Под нож идут: собственный
  `vite.config.ts` с Rolldown `codeSplitting.groups`, `index.html` с
  `/config.js`, `main.tsx`-бутстрап, nginx-образ, `.size-limit.cjs`-бюджеты,
  `docker/nginx-entrypoint.sh`, весь `env-local`-контракт. Ради потребителей,
  которым SSR не нужен.
- **Два рантайм-класса в одном репо** — у шаблона перестаёт быть один STOP-контракт:
  `/release` должен решать, какой образ пушить; `docs/reference/deployment.md`
  раздваивается; инфра-сторона получает два разных `compose/*.yml` из одного
  `SVC`. Экосистема этого нигде не делает.
- **`/de-template` становится самой сложной частью шаблона.** Сейчас он прунит
  учебные слайсы; в варианте B он должен вырезать половину инфраструктуры
  (Dockerfile, nginx-конфиг, entrypoint, e2e-проекты, бюджеты, половину
  reference-слайсов) — и делать это идемпотентно и обратимо.
- **Reference-слайсы деградируют.** Учебный набор, который демонстрирует и
  «SPA с MSW в Service Worker», и «SSR с ISR и sitemap», не демонстрирует
  толком ни того, ни другого; а prune-лист удваивается.
- **Mock-режим разный по устройству:** в браузере — Service Worker (`msw/browser`,
  `public/mockServiceWorker.js`), на сервере — перехват в процессе (`msw/node`).
  В одном шаблоне это два разных bootstrap-пути и два разных `/de-template`-ветвления.
- **«Шаблон-комбайн» ломает главный жанр stit** — «форкнул и через `/de-template`
  забыл про шаблон». Чем больше развилок в шаблоне, тем дольше и рискованнее
  разворот.

**Когда B становится правильным** (критерии для владельца):

- если SPA-шаблон **всё равно** решено мигрировать на TanStack Start (например,
  ради единого data-слоя и server functions) — тогда переключатель почти бесплатен;
- если появится ≥3 потребителей, которым реально нужно переключать режим
  *внутри жизни одного проекта*;
- если поддержка двух репо эмпирически съедает > ~20 % времени на шаблоны.

#### Вариант C — общая npm-библиотека `@stit/fe-*`

**За** (по аналогии с `golibinfra` / `pylibinfra`)

- В экосистеме уже принят жанр «общая библиотека инфра-кирпичей».
- Кандидаты на вынос очевидны: `shared/lib/{cn,invariant}`, fetch-враппер,
  `RuntimeConfigSchema`, mock-движок (db/persist/scenarios/devtools), будущие
  seo-хелперы.

**Против (решающее)**

- **Объём не тот.** `cn` — 3 строки, `invariant` — 3, клиент — ~60, конфиг — ~40.
  `golibinfra` несёт pgkit/outbox/NATS/authn — вещи, которые копировать нельзя;
  здесь копировать ничего не больно.
- **Прямо против инварианта шаблона.** «UI-компоненты пишутся в проекте,
  design-system-agnostic; импорт внешней DS/вендорных UI-китов — никогда»
  (`CLAUDE.md § Не делать никогда`, rule `shared-ui`). Библиотека `@stit/fe-kit`
  вернёт ровно ту зависимость, от которой отказались вместе с `@stit/ui`.
- **Новый операционный контракт.** В экосистеме нет CI-раннера (сознательно);
  npm-пакет требует registry, версионирования, релиз-ритуала, `.npmrc` с
  креденшелами в Dockerfile (там уже есть `--mount=type=secret,id=npmrc`, но
  сейчас он пустой по сути). Это плата, которой сегодня нет.
- **Форк перестаёт быть автономным.** Сейчас `/de-template` оставляет проект,
  который «ничего не помнит про шаблон». С библиотекой — помнит навсегда.

**Когда C становится правильным:** появление третьего фронт-шаблона
(`landing-template` уже стоит в публичном roadmap!) **и** общий код > ~2000 строк
**и** готовность держать npm-релизный контур. Тогда честнее вынести не «UI», а
**mock-движок + seo-хелперы** — самые объёмные и самые одинаковые куски.

#### Рекомендация

**A** + чеклист родства. Дополнительно зафиксировать в `docs/reference/kinship.md`
критерии пересмотра (см. выше), чтобы решение не «зависло по умолчанию».

### 2.3 Имя и роль форка

| вопрос | решение | почему |
|---|---|---|
| имя репо-шаблона | `ssr-frontend-template` | уже опубликовано в `stit-public/docs/roadmap.md` как «в планах»; менять публичное обещание дороже, чем жить с техническим именем. В прозе роль формулировать как «шаблон индексируемого сайта (SSR/SSG)» |
| имя форка | **`<org>/site`** | проект может иметь **и** SPA-приложение (`<org>/frontend`, `app.${DOMAIN}`), **и** сайт (`<org>/site`, `${DOMAIN}`) одновременно; `site` короткое, читается в sibling-дереве и в `SITE_TAG` |
| отвергнутые | `<org>/web` — не различает (SPA тоже web); `<org>/frontend-ssr` — уродливо в `FRONTEND_SSR_TAG` и раскрывает технику вместо роли | |
| сервис в инфре | `SVC=site` → `SITE_TAG` в `.env` VPS → `compose/site.yml` | конвенция `<SVC>_TAG` (UPPER_SNAKE) из канона `corp-infra-template/docs/ecosystem.md` |
| роут | корневой `${DOMAIN}`, дефолтный traefik-priority (перебивает `landing` с `priority: 1` — это уже предусмотрено комментарием в `compose/landing.yml`) | |
| канонический хост | **решение проекта**, но одно: apex или `www`, второй — 301 через traefik-middleware. Фиксируется в `docs/stack/seo.md § Идентичность` + правится в `<org>/infra` | для SEO обязателен один канонический хост |
| scope пакета | `@<org>/site` | зеркалит `@<org>/frontend` |
| образ | `git.stit.tech/<org>/site:<vX.Y.Z>` | |
| sibling-дерево | `~/git/<org>/{strategy,infra,backend,frontend,site,<bot>}` | |
| `surface.type` в strategy | **`web`, без изменений** | канон surface прямо запрещает технологию в типе («Поверхность — `web`, реализованная на чём угодно»). Признак «сайт для поиска» выводится из `lives-at` (apex-домен) + page-уровня. Если владельцу нужен явный сигнал на поверхности — самое дешёвое и канон-совместимое: колонка `discovery` (`search \| direct \| invite`) — это продуктовый факт, не стек. Опционально, не блокер |

Замечание: `lives-at` в `surface.md` уже несёт домен («`partner.example.com`») —
это естественный upstream для `SITE_URL`. Никаких новых полей для этого не нужно.

### 2.4 `docs/stack`: сохранить 8 и добавить 2

Прецедент: `telegram-bot-template` держит **11** kinds (`service`, `runtime`,
`storage`, `dialogs`, `backends`, `messaging`, `auth`, `observability`, `config`,
`dependencies`) + опциональный `i18n`. То есть число kinds — **не** часть канона
экосистемы; канон — это форма (singleton на kind, frontmatter `id/kind/name/status`,
обязательная секция `Generates`, гейт «всё stable → `/de-template`»,
`state/<kind>.md` как память скилла).

Итог для SSR-шаблона — **10 kinds**:

| kind | статус | что меняется |
|---|---|---|
| `service` | наследуется | + поле `infra-svc: site` (по нему `/release` печатает `make bump SVC=site`) |
| `runtime` | **расширяется** | разделить «Node (build)» и «Node (runtime)»: порт, graceful shutdown, healthcheck-путь, конкурентность, память. Отдельный kind `server.md` не заводить — это тот же вопрос «на чём крутится» |
| `config` | **расширяется** | роллап env остаётся, но источник другой: не `window.__APP_CONFIG__` из nginx-entrypoint, а `process.env` сервера + **явно whitelisted** публичный подмножество, сериализуемое в HTML |
| `routing` | наследуется | layouts/guards/preload — без изменений; режим рендера сюда **не** класть |
| **`rendering`** | **новый** | режим на маршрут/группу, revalidate, `Cache-Control`, `indexable`, участие в sitemap, коды 404/410/500, инвалидация, streaming |
| `api` | **расширяется** | + секция «Серверный доступ к API»: internal base URL vs публичный, форвардинг cookie, что происходит при SSR-запросе |
| **`seo`** | **новый** | идентичность сайта, OG/Twitter, JSON-LD, локали/hreflang, robots (incl. AI-боты), sitemap-источники, верификации/счётчики, staging-noindex |
| `styling` | наследуется | + no-flash темы (см. §2.7 про `features/theme`) |
| `observability` | **расширяется** | серверная сторона Sentry + логи процесса в stdout |
| `dependencies` | наследуется | базовая подборка другая |

**Почему `rendering` — отдельный kind, а не секция `routing.md`.**
У `routing.md` `Generates` = структура роут-дерева (`routeTree.gen.ts`, layout-роуты,
guard-обвязка). У `rendering` `Generates` = совсем другие артефакты: конфиг
prerender-списка в плагине, per-route `ssr`-флаги, заголовки кеша (и их зеркало в
traefik), источник `sitemap.xml`, `e2e/rendering.spec.ts`. Смешав их, получим
артефакт, у которого `Generates` нельзя проверить целиком — а это, по
`stack-deep-dive/references/workflow-patterns.md`, «главная дыра».

**Почему `seo` — отдельный kind, а не секции в `config.md`.**
`config.md` — роллап **ключей env** (это его роль по канону: «каждый env,
объявленный любым kind'ом, обязан быть здесь»). Смысловые решения (apex или www,
какие локали, какие типы JSON-LD, пускаем ли `GPTBot`) в таблицу ключей не лезут.
Плюс отдельный kind даёт **гейт**: `/de-template` не стартует, пока `seo.md` не
stable — ровно то, что нужно (§2.9). Env из `seo.md` при этом **обязаны**
доехать в `config.md` — это штатный cross-kind роллап, который `stack-deep-dive`
уже умеет помечать `**blocker**` в `state/config.md`.

**Цена:** интервью растёт на 2 волны. Митигация — обе формы поставляются
предзаполненными дефолтами шаблона (как сегодняшние 8), так что `/stack-deep-dive`
спрашивает только проектные вариации; в `seo.md` по-настоящему обязательных
ответов четыре: канонический хост, бренд, дефолтный `description`, список локалей.

### 2.5 FSD-карта в strategy: нужны ли SEO-поля

**Что есть сейчас** (канон `business-strategy-template`):

- `fsd/_template/pages.md`: `slug · name · description · screen · path · guard
  (public | authenticated | <who>) · widgets · features · entities · status`.
- `screens/_template/screen.md` frontmatter: `slug · name · description · shell ·
  blocks · situations · who · route · viewport · … · status`. **Есть** `name` и
  `description` — но это UX-описание («Master/detail: список + фильтры»), а не
  текст для выдачи.
- Канон FSD прямо запрещает: `src/`-пути, имена файлов, импорты, **названия
  библиотек**; `fsd-audit` ловит это как `semantics`-warning.
- `surface.md`: `type` (`web|mobile|api|admin|bot|desktop|embed|other`), `lives-at` (домен).

**Разбор вариантов**

1. **SEO-копирайт (title/description для SERP) в FSD-карту — нет.**
   `screen.description` — «одна фраза о сущности» для аналитика; SERP-title/description
   — маркетинговый текст с ограничениями длины (~60 / ~155) и ключевыми словами,
   который правят маркетологи и который меняется без изменения экрана. Класть его
   в карту слайсов — смешать две скорости изменения. Плюс `market.md` в strategy
   **прямо запрещает** маркетинговую копию у себя («❌ Маркетинговая копия… здесь
   наблюдаемые свойства, а не позиционирование») — сигнал, что репо не про копирайт.
   Место SEO-копии: дефолты — `docs/stack/seo.md`, per-page — `head()` в коде
   рядом со страницей (и, для контентных сущностей, поля самой сущности:
   `article.title/excerpt`).

2. **`rendering` (ssr/prerender/isr/client-only) в `pages.md` — нет.** Это
   исполнительная сторона (буквально имена возможностей фреймворка), канон её
   запрещает, `fsd-audit` пометит warning'ом.

3. **`indexable` — да, если владелец готов на канон-PR.** Это продуктовый факт:
   «эта страница существует для того, чтобы её нашли в поиске». Он **не** выводится
   из `guard` однозначно: `public`, но `noindex` — это `/login`, страницы «спасибо»,
   результаты поиска, фасетные фильтры, preview-ссылки.

4. **`freshness` вместо `rendering`** — канон-совместимая формулировка того же
   решения в языке смысла: `static` (меняется не чаще релиза) / `periodic`
   (меняется сама, но одинакова для всех) / `live` (на каждый запрос) /
   `per-user`. Фронт выводит из неё режим (prerender / isr / ssr / client-only)
   в `docs/stack/rendering.md`. Библиотек и путей в артефакте по-прежнему нет.

**Рекомендация — двухступенчато:**

- **Путь без изменения канона (обязательный, работает с любой версией strategy).**
  `docs/stack/rendering.md` SSR-шаблона держит таблицу маршрутов; правило вывода
  по умолчанию: `guard: public` → кандидат на `indexable: да`, `guard ≠ public` →
  `indexable: нет` + `Cache-Control: private, no-store` + `ssr` не на сервере.
  Исключения перечисляются явными строками в этой же таблице. `/scaffold page`
  спрашивает 2 вопроса, если строки нет. Это важно и само по себе: у потребителя
  может быть форк strategy более старой версии.

- **Минимальный канон-PR в `business-strategy-template` (опционально, ускоряет).**
  1. `docs/projects/_template/fsd/_template/pages.md`: +2 опциональные колонки
     `indexable` (`yes|no`, дефолт выводится из `guard`) и `freshness`
     (`static|periodic|live|per-user`), с формулировками в «Колонки» и одной
     фразой в критериях page.
  2. `docs/projects/_template/fsd/README.md`: строка в «Принципы оформления» о
     том, что обе колонки — язык смысла, не реализации; и в «Потребитель слоя» —
     что карту читают форки `<org>/frontend` **и** `<org>/site`.
  3. `.claude/skills/fsd-audit/SKILL.md § Проверки → layer-refs`: два правила —
     `indexable: yes` при `guard ≠ public` → **error**; `freshness: per-user` при
     `indexable: yes` → **warning**.
  4. `.claude/skills/fsd-deep-dive/SKILL.md`: два вопроса в раунд по `pages`
     (опции: «для поиска / только по ссылке», «меняется реже релиза / сама /
     на каждый запрос / у каждого своё»).
  5. `docs/README.md § handoff-контракт`: строка потребителя `<org>/site`.
  Правки **forward-only**: колонки просто появляются в форме, без пометок «новое».

- **`surface.md` — не трогать** (см. §2.3).

### 2.6 Скиллы: дельта относительно SPA-шаблона

| скилл | дельта |
|---|---|
| `/smartdev` | шаблонность определять по `@stit/ssr-frontend-template` в `package.json` и по наличию reference-страниц `blog/`; +строка «SEO-гейт: `seo.md`/`rendering.md` — stable?»; +advisory-строка `kin:diff` |
| `/plan` | без изменений (identical) |
| `/init-service` | те же 5 этапов; в этапе 2 гейт «все **10** артефактов stable»; перед этапом 3 печатать **SEO-гейт**-сводку (канонический хост, локали, список indexable-маршрутов, источники sitemap) — это то, что потребитель пропускает чаще всего |
| `/stack-deep-dive` | порядок волн: `service → runtime → config → routing → **rendering** → api → **seo** → styling → observability → dependencies`. `rendering` после `routing` (нужен перечень маршрутов), `seo` после `rendering` (нужен `indexable`). Cross-kind правила: (а) каждая page из FSD-карты присутствует в таблице `rendering` — иначе `**blocker**` в `state/rendering.md`; (б) `indexable` не противоречит `guard`; (в) `SITE_URL`, `ROBOTS_POLICY`, `*_VERIFICATION` из `seo.md` обязаны быть в `config.md` |
| `/de-template` | Phase A меняется существенно: **A.3** — вместо `docker/nginx-entrypoint.sh` + `public/config.js` разворачивается env-контракт Node-процесса и whitelist публичных ключей; **A.3b** — `robots.txt`/`sitemap.xml` server-routes из `seo.md`; **A.3c** — prerender-список и per-route `ssr` из `rendering.md`; **A.5** — prune контентных reference-страниц (`blog/*`, `about`) и `entities/article`; **A.6** — удалить SPA-специфику, если её принесли из родителя (`public/config.js`, SPA-fallback, `mockServiceWorker.js` при серверном моке). Гейт «10 stable» |
| `/scaffold` | **самая большая правка.** Для `page` добавляются шаги: (1) режим рендера — из строки `rendering.md`, если её нет — 2 вопроса и запись строки; (2) `head()`-скелет (title/description/canonical/OG) с подстановкой из `seo.md`; (3) JSON-LD — предложить тип из `seo.md § Структурированные данные`; (4) для параметрических маршрутов — обработка «не найдено» честным 404; (5) регистрация в источнике sitemap; (6) SEO-e2e-stub (код ответа + `<title>` + canonical + noindex). Новый kind **`route`** (server route: sitemap/robots/feed) |
| `/release` | Node-образ вместо nginx; `SVC` берётся из `service.md § infra-svc` (`site`), handoff-блок `make bump SVC=site TAG=vX.Y.Z`; в `RISK:` обязательная строка про prerendered-контент внутри образа (правка контента = пересборка образа, если prerender включён) |
| **`/seo-audit`** | **новый**, контракт — §3.5 |

### 2.7 Reference-слайсы SSR-шаблона

Принцип набора: **каждый режим рендера и каждый SEO-приём — ровно один раз**,
набор целиком удаляется `/de-template`, и он же читается как учебник.

```
src/pages/
├── __root.tsx          дефолтный head() (title-template, description, OG-дефолты,
│                       Organization JSON-LD), <HeadContent/> + <Scripts/>, AppShell
├── index.tsx           prerender · WebSite + Organization JSON-LD · 3 последние статьи
├── about.tsx           prerender · статический контент · BreadcrumbList · hreflang-альтернаты
├── blog/index.tsx      ISR · список + пагинация ?page= + фасет ?tag=
│                       (учит: self-canonical на странице пагинации, noindex на фасетах)
├── blog/$slug.tsx      ISR · Article JSON-LD · OG-картинка · BreadcrumbList ·
│                       честный 404 на неизвестный slug · lastmod для sitemap
├── login.tsx           public, НО noindex (учит: public ≠ indexable) · форма + CSRF
├── profile.tsx         ssr:false + guard · per-user · noindex · private, no-store
├── sitemap[.]xml.ts    server route: статические маршруты из карты + статьи из API
└── robots[.]txt.ts     server route: политика из seo.md + ROBOTS_POLICY (staging)

src/widgets/
├── app-shell/          header/nav/footer, skip-link, переключатель языка и темы
└── breadcrumbs/        используется на about + blog + blog/$slug (≥2 page-рефа →
                        pages-first соблюдён) и питает BreadcrumbList JSON-LD

src/features/
├── auth/               LoginForm (тот же, что в SPA) — учит SSR-форвардингу cookie
└── theme/              ВАЖНОЕ отличие от SPA: scheme и locale хранятся в cookie,
                        а не в localStorage, и читаются на сервере → data-scheme
                        рендерится сразу (без FOUC). Это главный «SSR-урок» слайса

src/entities/
├── article/            slug, title, excerpt, body, publishedAt, updatedAt,
│                       coverUrl, tags[] → питает Article JSON-LD, OG-картинку,
│                       lastmod sitemap, список и деталь
├── session/            как в SPA
└── user/               как в SPA

src/shared/
├── seo/                buildMeta(), canonical(), hreflangAlternates(), jsonLd()
├── api/                клиент, знающий про сервер (internal base URL, форвардинг cookie)
├── config/ i18n/ lib/ observability/ ui/
```

**Почему `article`, а не `todo`.** Todo-CRUD — это идентичность SPA-шаблона
(приватное приложение, оптимистичные апдейты). Идентичность сайта — **контент**:
список/деталь/slug/дата обновления — ровно те данные, которые нужны
`Article`-разметке, `lastmod` в sitemap и OG-карточке. Один и тот же учебный
CRUD в двух шаблонах — упущенная возможность научить второй теме.

**Почему auth остаётся.** SSR + httpOnly-cookie + `ssr:false`-страница — главная
ловушка жанра; без неё шаблон не научит. И это же сохраняет родство с
`features/auth` SPA-шаблона (сравнимый код рядом).

**Что НЕ включать** (чтобы набор оставался удаляемым): отдельную страницу поиска
(её роль закрывает фасет `?tag=` в блоге), `create-todo`-аналог, вторую
контентную сущность (`tag` — поле статьи, не entity), newsletter-форму
(дублирует урок формы из `auth`).

**Mock-сценарии** — те же четыре имени (родство): `empty` (0 статей: пустое
состояние + sitemap только из статики), `populated` (12 статей, 3 тега,
реалистичные даты — чтобы пагинация и фасеты были видны), `authenticated`,
`error`.

**Сравнение с `pages/index.tsx` SPA-шаблона.** Там главная — заглушка на 10 строк
(«зайди под любым email»), потому что предмет шаблона в другом месте (`/todos`).
В SSR-шаблоне главная — **сам предмет**: её HTML должен содержать контент до
гидратации, нести `WebSite` + `Organization` и быть prerender'ной. Это надо
зафиксировать явно в `references/prune.md`: `pages/index.tsx` — «заменить, не
удалять», и заменяющая страница обязана сохранить `head()` и JSON-LD.

### 2.8 Правила (`.claude/rules/`): +2

Наследуются с правками: `forward-only` (identical), `comments` (identical),
`fsd-architecture` (+ размещение server-routes, + `shared/seo` как сегмент),
`shared-ui` (+ токен-слой и no-flash тема), `env-local` (**переписывается**:
нет `window.__APP_CONFIG__`; есть server env + явный публичный whitelist),
`tests-pipeline` (+ серверные тесты, + SEO-e2e).

Новые:

- **`ssr-safety`** (path-scope `src/**`): нет обращений к `window`/`document`/
  `localStorage` на уровне модуля и в рендере; нет модульных синглтонов,
  хранящих per-request состояние (сегодняшний `queryClient` — модульный синглтон
  в `app/providers/query.tsx`: на сервере это утечка данных между пользователями,
  нужен per-request); cookie форвардятся явно, не «магически»; в сериализуемый
  payload не попадает ничего, что не прошло whitelist; `Date`/`Math.random`/
  локаль-зависимое форматирование — источник hydration mismatch.
- **`seo-invariants`** (path-scope `src/pages/**`): у каждой page есть `head()`;
  `canonical` абсолютный и self-referencing; ровно один `h1`; приватное —
  `noindex`; «не найдено» — реальный 404, а не редирект на главную; у изображений
  заданы размеры; hreflang-симметрия; `?utm_*`/сортировки не порождают
  индексируемых дублей.

### 2.9 Ecosystem-правки: конкретные файлы, в порядке зависимостей

Порядок задан самим каноном: «Чтобы изменить контракт — сначала откройте PR в
`corp-infra-template/docs/ecosystem.md`, синхронизация остальных репо — отдельные
коммиты».

**1. `corp-infra-template`** (канон — первым)
- `docs/ecosystem.md`: «6 форкаемых шаблонов» → 7; ASCII-диаграмма — четвёртый
  сервис-бокс `<org>/site ← ssr-frontend-template` (и стрелка `@stit/ui` от
  `<org>/frontend` — **удалить**, это drift); строка в «Identity per repo»;
  «Семейство — 9 репо» → 10; happy-path §2 — строка форка; Skill index — `/seo-audit`
  в строке сервис-шаблонов и `ssr-frontend-template` в строках
  `/init-service … /scaffold` и `/release`; в «Image registry» — упоминание
  `SITE_TAG` в перечне конвенции `<SVC>_TAG`.

**2. `business-strategy-template`** (опционально — только если принят канон-PR §2.5)
- `docs/projects/_template/fsd/_template/pages.md` (+2 колонки),
  `docs/projects/_template/fsd/README.md` (потребители слоя + принципы),
  `.claude/skills/fsd-audit/SKILL.md` (+2 проверки),
  `.claude/skills/fsd-deep-dive/SKILL.md` (+2 вопроса),
  `docs/README.md § handoff-контракт` (+строка `<org>/site`),
  `CLAUDE.md` (перечень «6 шаблонов» → 7; `@stit/ui`-строка).

**3. `project-infra-template-compose`** (без него шаблон некуда деплоить)
- `compose/site.yml` — **новый**: `image: ${REGISTRY_HOST:-git.stit.tech}/${PROJECT_NAME}/site:${SITE_TAG}`,
  `profiles: [site]`, `container_name: site`, healthcheck на `/healthz` самого
  приложения, сети `proxy` (+`backend-net`, если выбран BFF-проксирование `/api`),
  traefik-labels на `Host(\`${DOMAIN}\`)` с дефолтным priority + middleware
  `crowdsec@file,secure-headers@file,rate-limit@file`, отдельный роутер-редирект
  `www.${DOMAIN}` → apex (или наоборот), `mem_limit` (Node — новый класс
  потребления для этого стека).
- `.env.example`: `SITE_TAG`, `COMPOSE_PROFILES=…,site`, публичные env сайта
  (`SITE_URL`, `ROBOTS_POLICY`, `API_BASE_URL_INTERNAL`, `SENTRY_*`).
- `docs/project/README.md § Generates → инфра`: сегодня таблица маппит
  `frontend` + `hosting: here` → «— (always-on `landing`)», что для контейнерного
  сайта неверно; нужна строка `frontend (hosting: here, SSR)` → профиль `site` →
  `compose/site.yml`.
- `docs/project/_templates/service.md`: в `## Hosting`/`## Generates` — пример
  для frontend `hosting: here`.
- `docs/project/_templates/stack.md § Service map`: пример-строка
  `| site | frontend | here | \`<org>/site\` (форк ssr-frontend-template) | публичный сайт |`
  рядом с существующей `| web | frontend | external | … (CDN) | SPA |`.
- `docs/reference/architecture.md § Что НЕ в шаблоне`: строка «Frontend (static SPA
  или SSR) — `compose/frontend.yml`» конкретизируется в `compose/site.yml`.
- `.claude/skills/add-service/SKILL.md`: сайт как пример public-сервиса с Node.
- `docs/reference/ecosystem.md`, `CLAUDE.md § Оркестрация` (таблица соседей):
  строка `../site`.
- `docs/reference/runbook.md`: строка про рестарты/OOM Node-процесса (если раздел
  подходит — проверить).

**4. `go-backend-template`** (только если выбрана схема auth без BFF-прокси)
- `internal/platform/authgate/cookie.go`: cookie сейчас `HttpOnly`,
  `SameSite=Strict`, `Path=/`, **без `Domain`** → host-only для `api.${DOMAIN}`.
  Два следствия для SSR: (а) серверный рендер на `${DOMAIN}` **не увидит**
  cookie вовсе; (б) `SameSite=Strict` не отдаёт cookie при переходе с внешней
  выдачи, значит первый SSR-рендер всегда анонимный. Если выбран прямой доступ
  сайта к `api.${DOMAIN}` — нужны env `COOKIE_DOMAIN` (`.${DOMAIN}`) и
  `COOKIE_SAMESITE` (`Lax`) + CORS-политика. Если выбран BFF-прокси `/api` внутри
  Node-процесса (через `backend-net`) — **изменений в бэкенде не нужно**, но нужна
  сеть в `compose/site.yml`.
  *Глубокий разбор auth-в-SSR — зона другого потока; здесь фиксирую только
  cross-repo последствие.*

**5. `spa-frontend-template`**
- `docs/reference/ecosystem.md`: 6 → 7 шаблонов; sibling-дерево + `site/`;
  удалить строку про `@stit/ui`; добавить абзац «сосед: `ssr-frontend-template` —
  когда нужен индексируемый сайт; этот шаблон — когда приложение за логином».
- `README.md`: одна строка «нужен SEO/индексируемый сайт → `ssr-frontend-template`».
- (опц., бэкпорт) `docs/stack/_templates/service.md`: поле `infra-svc` (сегодня
  `/release` хардкодит `SVC=frontend`).

**6. Sweep «6 → 7 шаблонов» + удаление `@stit/ui`** (механический, одним заходом)
- `telegram-bot-template/docs/reference/ecosystem.md` и `CLAUDE.md`
- `go-backend-template/docs/reference/ecosystem.md`
- `project-infra-template-compose/docs/reference/ecosystem.md`
- `business-strategy-template/CLAUDE.md`, `docs/README.md`

**7. `stit-public`** (витрина — последней, когда репо реально открыт)
- `docs/roadmap.md`: `ssr-frontend-template` из «Планируется» → «Готово»;
  **решить судьбу `landing-template`** (см. §4).
- `docs/templates.md`: раздел `### ssr-frontend-template` + строка в схеме связей.
- `README.md`: бейдж `open_templates-5` → `-7`; строка в таблице карты.
- `docs/getting-started.md`: строка в таблице «задача → шаблон»
  («сайт, который должен находиться в поиске»).
- ⚠️ Витрина сильно отстала от факта независимо от SSR: там всё ещё
  `project-docs-template` (переименован в `business-strategy-template`), нет
  `telegram-bot-template`, инфра описана через Vault/OTLP, у SPA указан `@stit/ui`.
  Добавлять SSR в такой текст — углублять drift; разумнее один
  «освежающий» PR, в котором SSR — один из пунктов.

### 2.10 Путь потребителя SSR-шаблона: чем отличается от SPA

Каркас тот же (`docs/getting-started.md`, [META], удаляется `/de-template`):
форк → `/smartdev` → `/init-service` → `/stack-deep-dive` → `/de-template` →
`/scaffold` → `pnpm check` → `/release` → `make bump` в `<org>/infra`.

Отличия:

1. **Новый шаг «SEO-дизайн» между FSD-картой и стеком.** До кода надо ответить:
   какие страницы существуют для поиска; какой канонический хост (apex/www);
   какие локали и нужен ли hreflang; откуда берётся sitemap (статические маршруты
   + какие сущности); какой бренд/title-шаблон/дефолтный description; что с
   AI-краулерами; должен ли staging быть закрыт от индексации. Вход — `pages.md`
   FSD-карты (перечень маршрутов + `guard`); выход — `docs/stack/{rendering,seo}.md`.
2. **Гейт.** Формально он уже есть — `/de-template` требует **все 10** артефактов
   `stable`, значит SEO-артефакт закрыт тем же механизмом. Но `/init-service`
   должен печатать **SEO-гейт отдельной сводкой** перед этапом 3: именно этот
   шаг потребитель склонен проскочить, а исправлять после индексации дорого
   (смена канонического хоста = потеря позиций).
3. **Второй, рантайм-гейт:** `pnpm seo:audit` зелёный на локальном прод-билде
   **до первого `/release`**. В `pnpm check` не входит (нужен поднятый сервер) —
   как и `test:e2e`.
4. **Cross-repo next-step на инфру,** которого у SPA нет: DNS на apex **и** www,
   traefik-редирект на канонический хост, `ROBOTS_POLICY=noindex` на всех
   не-prod средах. `/de-template` печатает это в своём чеклисте.
5. **Иной смысл mock-режима.** У SPA mock — «крутится без бэкенда в браузере».
   У сайта mock — ещё и «prerender/SSR собирается без бэкенда», то есть mock
   обязан работать в серверном процессе на этапе билда. Это видно потребителю
   сразу (первый `pnpm build` дергает данные).

---

## 3. Рекомендации (черновики)

### 3.1 Структура репозитория (дельта к SPA-шаблону помечена ▲)

```
ssr-frontend-template/
├── CLAUDE.md                      тот же скелет разделов; ▲ разделы про SSR-границы
├── README.md CONTRIBUTING.md SECURITY.md LICENSE
├── biome.json .commitlintrc.cjs lefthook.yml .nvmrc .npmrc tsconfig.json
├── eslint.config.js               ▲ +ignores серверных артефактов сборки
├── steiger.config.ts              ▲ +исключения для server-routes и серверного entry
├── vite.config.ts                 ▲ tanstackStart({ prerender, pages, … }) + react + tailwind
├── vitest.config.ts vitest.setup.ts
├── .size-limit.cjs                ▲ бюджет client-бандла + вес HTML-документа
├── .env.example .env.local.example ▲ серверные env, без VITE_-рантайма
├── docker/Dockerfile              ▲ build node:24 → runtime node:24-alpine (не nginx),
│                                     non-root, PORT/HOST, HEALTHCHECK на /healthz
├── e2e/
│   ├── playwright.config.ts       ▲ projects: smoke | seo; webServer = прод-билд
│   ├── smoke.spec.ts
│   └── seo.spec.ts                ▲ инварианты из rendering.md/seo.md
├── docs/
│   ├── README.md getting-started.md contributing.md
│   └── reference/
│       ├── architecture.md        ▲ +серверный слой, где живут server-routes
│       ├── ecosystem.md           ▲ роль <org>/site, соседи, контракты
│       ├── deployment.md          ▲ Node-образ, env, кеш-заголовки, healthcheck
│       ├── observability.md       ▲ +серверная сторона
│       ├── seo.md                 ▲ НОВЫЙ: канон технического SEO шаблона
│       └── kinship.md             ▲ НОВЫЙ: контракт родства с spa-frontend-template
├── docs/stack/
│   ├── README.md                  ▲ 10 kinds
│   └── _templates/{service,runtime,config,routing,rendering▲,api,seo▲,styling,observability,dependencies}.md
├── .claude/
│   ├── rules/{forward-only,comments,fsd-architecture,shared-ui,env-local,
│   │          tests-pipeline,ssr-safety▲,seo-invariants▲}.md
│   ├── skills/{smartdev,plan,init-service,stack-deep-dive,de-template,
│   │           scaffold,release,seo-audit▲}/
│   ├── plans/roadmap.md
│   └── settings.json
├── public/{favicon.svg, og/default.png▲}
└── src/{app,pages,widgets,features,entities,shared}      см. §2.7
```

### 3.2 Черновик `docs/stack/_templates/rendering.md`

> Черновик. Конкретные имена опций фреймворка намеренно **не** зашиты в форму —
> их подставит поток выбора фреймворка; артефакт описывает решение, не API.

```markdown
---
id: stack.rendering
kind: rendering
name: rendering
status: draft
---

# rendering

## Режимы

| режим | когда применяется | что это значит для запроса |
|---|---|---|
| `prerender` | контент меняется не чаще релиза | HTML собран на билде, отдаётся как статика |
| `isr` | контент общий для всех, меняется чаще релиза | HTML кешируется на `revalidate`, обновляется фоном |
| `ssr` | контент зависит от запроса, но не от пользователя | HTML собирается на каждый запрос |
| `client-only` | персональное / интерактивное, не для поиска | сервер отдаёт каркас, данные — на клиенте |

## Карта маршрутов

Перечень маршрутов — из `pages.md` FSD-карты поверхности
(`<strategy-path>/docs/projects/<slug>/fsd/<surface>/pages.md`). Строка на
маршрут или на группу. Инвариант: `guard ≠ public` ⇒ `indexable: нет`,
`Cache-Control: private, no-store`, компонент на сервере не рендерится.

| path | режим | revalidate | Cache-Control | indexable | в sitemap |
|---|---|---|---|---|---|
| `/` | `prerender` | — | `public, s-maxage=300, stale-while-revalidate=86400` | да | да |
| `/about` | `prerender` | — | то же | да | да |
| `/blog` | `isr` | `300s` | то же | да | да |
| `/blog/$slug` | `isr` | `600s` | то же | да | да (из данных) |
| `/blog?tag=*` | `isr` | `300s` | то же | **нет** (фасет) | нет |
| `/login` | `ssr` | — | `private, no-store` | нет | нет |
| `/profile` | `client-only` | — | `private, no-store` | нет | нет |
| _добавить_ | | | | | |

## Нештатные коды

| ситуация | код | что отдаём |
|---|---|---|
| неизвестный параметр маршрута | `404` | страница «не найдено», `noindex` |
| снятая публикация | `410` | _или 404 — решение проекта_ |
| ошибка загрузки данных | `500` | error-страница, `noindex`, без кеша |
| канонический хост | `301` | редирект на `SITE_URL` |

## Инвалидация

_Чем обновляется кеш: TTL / вебхук от бэкенда / только релиз. Для `prerender` —
явно: изменение контента требует пересборки образа._

## Streaming

_Включён ли стриминг ответа, для каких маршрутов, что попадает в первый чанк._

## Generates

- конфиг сборки: список prerender-маршрутов и пер-маршрутные флаги рендера
- `src/pages/**` — `head()`, `loader`, режим рендера маршрута
- заголовки кеша (сервер + зеркало в traefik, если решает edge)
- источник `sitemap.xml`
- `e2e/seo.spec.ts` — коды ответов и наличие контента в HTML

## Открытые вопросы

- _что_
```

### 3.3 Черновик `docs/stack/_templates/seo.md`

```markdown
---
id: stack.seo
kind: seo
name: seo
status: draft
---

# seo

## Идентичность сайта

| поле | значение |
|---|---|
| канонический хост | `https://<domain>` — **один**, второй отдаёт 301 |
| `SITE_URL` | runtime env, абсолютный origin без хвостового слэша |
| бренд | _<Название>_ |
| title-шаблон | `%s · <Бренд>`; главная — без суффикса |
| дефолтный `description` | _<текст, 50–160 символов>_ |
| дефолтная OG-картинка | `/og/default.png`, 1200×630 |
| иконки | `favicon.svg`, `apple-touch-icon.png` |

## Социальные карточки

- Open Graph: `og:type`, `og:title`, `og:description`, `og:url`, `og:image`, `og:locale`
- Twitter: `summary_large_image`
- Откуда берётся картинка страницы: _поле сущности / генератор / дефолт_

## Структурированные данные (JSON-LD)

| тип | где | источник полей |
|---|---|---|
| `Organization` | все страницы (корневой layout) | этот артефакт |
| `WebSite` | главная | этот артефакт |
| `BreadcrumbList` | страницы глубже первого уровня | иерархия маршрута |
| `Article` | страницы контентной сущности | `entities/<name>` |
| _добавить_ | _где_ | _откуда_ |

## Локали и hreflang

Список локалей — из `shared-lib.md § i18n` FSD-карты поверхности.

| locale | URL-схема | роль |
|---|---|---|
| `ru` | `/` | default (`x-default`) |
| `en` | `/en/…` | supported |

Политика: одна локаль на URL; альтернаты взаимно симметричны; `lang` на `<html>`.

## robots-политика

| агент | политика |
|---|---|
| `*` | allow, кроме Disallow ниже |
| AI-краулеры (`GPTBot`, `ClaudeBot`, `CCBot`, `PerplexityBot`, `Google-Extended`, …) | _allow / disallow — решение владельца_ |
| Disallow | `/login`, `/profile`, `/*?*utm_`, _…_ |

Не-prod: `ROBOTS_POLICY=noindex` ⇒ `X-Robots-Tag: noindex, nofollow` на все
ответы + `robots.txt: Disallow: /`.

## Sitemap

| источник | что даёт | lastmod |
|---|---|---|
| статические маршруты | строки `rendering.md` с `indexable: да` | дата сборки |
| _<контентная сущность>_ | `GET /v1/<…>` | `updatedAt` сущности |

Разбиение на sitemap-index при > 50 000 URL или > 50 МБ.

## Верификация и счётчики

| система | механизм | значение |
|---|---|---|
| Google Search Console | meta `google-site-verification` или DNS | env |
| Яндекс.Вебмастер | meta `yandex-verification` или DNS | env |
| Яндекс.Метрика / GA | id счётчика | env; провайдер — `integration.md` в `<org>/strategy` |

Счётчики грузятся отложенно и не влияют на LCP.

## Generates

- `src/shared/seo/*` — построение меты, canonical, hreflang, JSON-LD
- корневой layout — дефолтная `head()` + `Organization`
- server-routes `robots.txt`, `sitemap.xml`
- `config.md` — env `SITE_URL`, `ROBOTS_POLICY`, `*_VERIFICATION`, `METRIKA_ID`
- `e2e/seo.spec.ts` — инварианты canonical / robots / JSON-LD / OG

## Открытые вопросы

- _что_
```

### 3.4 Черновик `docs/reference/kinship.md`

```markdown
# Родство с spa-frontend-template

Два фронт-шаблона stit — родственники: одна обвязка, разные рантаймы.
`spa-frontend-template` — приложение за логином, статика за nginx.
Этот — индексируемый сайт, серверный рендер, Node в рантайме.
Канонический источник общих файлов — SPA-шаблон; сюда они подтягиваются.

## Идентично (расхождение = ошибка)

`.claude/rules/{forward-only,comments}.md` · `.claude/skills/{plan,smartdev}/SKILL.md`
(с точностью до имени репо) · `biome.json` · `.commitlintrc.cjs` · `lefthook.yml` ·
`.npmrc` · `.nvmrc` · `LICENSE` · `SECURITY.md` · `vitest.setup.ts` ·
`src/shared/lib/{cn,invariant}.ts` + их тесты · `src/shared/ui/page-header/` ·
`src/app/styles/index.css`

## Одинаково по форме, расходится по содержанию

`CLAUDE.md` (порядок и состав разделов) · `README.md` · `CONTRIBUTING.md` ·
`docs/README.md` · `docs/contributing.md` · `docs/stack/README.md` +
`_templates/*` · `eslint.config.js` · `tsconfig.json` · `steiger.config.ts` ·
`.claude/rules/{fsd-architecture,shared-ui,tests-pipeline,env-local}.md` ·
`.claude/skills/{init-service,stack-deep-dive,de-template,scaffold,release}/SKILL.md` ·
`docs/reference/{architecture,ecosystem,deployment,observability}.md`

## Расходится намеренно (не сверять)

`vite.config.ts` · `docker/*` · точка входа документа и бутстрап (`src/app/*`) ·
`src/shared/api/*` · `.size-limit.cjs` · `e2e/*` · `.env.example` ·
reference-слайсы · `.claude/rules/{ssr-safety,seo-invariants}.md` ·
`.claude/skills/seo-audit/`

## Сверка

`pnpm kin:diff` — диффает первый список против sibling-checkout
`../spa-frontend-template` и печатает отчёт. Соседа нет — печатает next-step,
не падает. В `pnpm check` не входит: шаблон не краснеет из-за отсутствия соседа.

## Когда пересматривать раздельность репозиториев

- решено мигрировать SPA-шаблон на тот же фреймворк, что и этот;
- появился третий фронт-шаблон и общий код перевалил ~2000 строк;
- поддержка двух обвязок занимает больше пятой части времени на шаблоны.
```

### 3.5 Контракт скилла `/seo-audit`

```yaml
name: seo-audit
description: >
  Прогон SEO-канона по собранному сайту: коды ответов, мета и canonical,
  политика индексации, robots.txt, sitemap.xml, JSON-LD, OG, hreflang,
  наличие контента в HTML до гидратации. Активируй перед первым /release,
  после добавления/переименования маршрутов, при «страница не индексируется».
  Ничего не правит — сообщает, какой артефакт и какой файл чинить.
```

- **Когда НЕ применять:** вместо `pnpm check` (тот про код); на dev-сервере
  (нужен прод-билд); до `stable` у `seo.md`/`rendering.md`.
- **Pre-flight:** `docs/stack/{seo,rendering}.md` — `stable`; поднят прод-билд
  (`pnpm build && pnpm start`) или задан `BASE_URL` внешнего стенда.
- **Механика:** скилл тонкий — основную работу делает детерминированный
  playwright-проект `seo` (`pnpm seo:audit`), сгенерированный `/de-template` из
  таблицы маршрутов `rendering.md`. Скилл запускает его, читает отчёт и
  **маршрутизирует находки к артефактам** (`seo.md` / `rendering.md` / конкретная
  page / `<org>/infra`).
- **Группы проверок:**
  1. *Доступность* — 200 на каждом `indexable` маршруте; 404 на выдуманном
     параметре; 301 неканонического хоста; нет цепочек редиректов.
  2. *Мета* — непустой уникальный `<title>` ≤ 60; `description` 50–160;
     ровно один `h1`; абсолютный self-referencing `canonical`; `lang` на `<html>`.
  3. *Индексация* — `noindex` ровно там, где `indexable: нет`; `X-Robots-Tag`
     не противоречит мете; на не-prod — всё закрыто.
  4. *robots.txt* — парсится, ссылается на sitemap, не блокирует indexable,
     политика AI-ботов совпадает с `seo.md`.
  5. *sitemap.xml* — валидный XML; все indexable внутри; ни одного noindex /
     404 / редиректного URL; абсолютные URL на каноническом хосте; валидный `lastmod`.
  6. *JSON-LD* — парсится; типы из `seo.md`; обязательные поля;
     `BreadcrumbList` совпадает с иерархией пути.
  7. *OG/Twitter* — `og:title/description/url/image`; картинка доступна и ≥ 1200×630.
  8. *hreflang* — симметрия альтернатов, наличие `x-default`.
  9. *Контент в HTML* — ключевой текст присутствует в ответе сервера, а не только
     после гидратации (grep по сырому HTML).
  10. *Производительность* (вручную) — LCP / CLS / INP на трёх репрезентативных
      маршрутах.
- **Выход:** отчёт по группам, severity (`error`/`warning`/`hint`), «что править
  и где». Вердикт: чисто / warnings / errors.
- **Гейт:** 1–9 — часть `pnpm seo:audit` (отдельный stage, как `test:e2e`);
  10 — по запросу.

### 3.6 Мелочи, которые стоит внести заодно

- `docs/stack/_templates/service.md`: поле `infra-svc` (`site` / `frontend`) —
  `/release` перестаёт хардкодить `SVC=`. Бэкпортировать в SPA-шаблон.
- `steiger.config.ts`: заранее продумать исключения для server-routes — если
  они обязаны лежать в `routesDirectory` (то есть в `src/pages/`), это надо
  зафиксировать исключением и строкой в rule `fsd-architecture`; альтернатива
  (отдельный каталог серверных роутов) **требует проверки возможностей
  фреймворка** — не выдумывать.
- `.size-limit.cjs`: добавить запись на вес prerender'ного документа — дешёвый
  способ ловить раздувание HTML в том же гейте.

---

## 4. Риски и открытые вопросы владельцу

1. **Судьба `landing-template`.** В публичном roadmap он стоит отдельной строкой
   («генератор продающих лендингов»), но лендинг — это ровно `prerender`-режим
   сайта без API. Либо он становится **пресетом/сценарием** SSR-шаблона (тогда
   строку из roadmap убрать и объявить это явно), либо остаётся отдельным — и
   тогда фронт-шаблонов станет три, что напрямую усиливает аргумент за вариант C
   (общая библиотека). Решение влияет и на имя репо, и на §2.2.
2. **Два фронта в одном проекте.** Подтвердить схему «`<org>/frontend` на
   `app.${DOMAIN}` + `<org>/site` на `${DOMAIN}`»: это две поверхности в
   `surface.md` strategy, две папки `fsd/<surface>/`, два `<SVC>_TAG`. Если
   владелец считает, что у проекта всегда один фронт, — часть §2.3 упрощается.
3. **Принимать ли канон-PR в strategy** (2 колонки в `pages.md`) или жить на
   выводе из `guard` + таблице `rendering.md`. Рекомендация: шаблон обязан
   работать и без PR; PR — ускорение, а не зависимость.
4. **Схема auth в SSR:** BFF-прокси `/api` внутри Node-процесса (тогда нужна
   сеть `backend-net` в `compose/site.yml`, изменений в бэкенде нет) **или**
   прямой доступ к `api.${DOMAIN}` (тогда нужны `COOKIE_DOMAIN` и
   `COOKIE_SAMESITE=Lax` в `go-backend-template` + CORS). Выбор меняет список
   cross-repo правок.
5. **Node в проде — новый операционный класс** для `project-infra-template-compose`
   (память, рестарты, graceful shutdown, OOM). Нужен ли `mem_limit` по умолчанию
   и строка в runbook — вопрос к владельцу инфра-шаблона.
6. **Бюджеты.** `size-limit` на initial JS для сайта менее показателен, чем TTFB
   и вес документа. Нужно ли переопределять пороги и вводить бюджет HTML —
   решение владельца (черновик в §3.6).
7. **Витрина отстала от факта** (5 шаблонов, `project-docs-template`, Vault/OTLP,
   `@stit/ui` у SPA). Добавлять SSR в такой текст = углублять drift. Предлагаю
   отдельный «освежающий» PR, в котором SSR — один из пунктов.
8. **`@stit/ui` в канонах.** Решение «DS не используем» зафиксировано в
   SPA-шаблоне, но ecosystem-доки пяти репо и — что важнее — **канон screens**
   в strategy построены на манифесте `@stit/ui` (`ui:Button`, `icon:*`,
   `/screen-audit` читает манифест). Для SSR-шаблона это не блокер (он читает
   `fsd/`, не `screens/`), но расхождение стоит зафиксировать явно, чтобы
   потребитель не спотыкался.
9. **Не проверено здесь:** зрелость и версии выбранного фреймворка, поведение
   mock-слоя на сервере, конкретные имена опций сборки. Всё это — входы из
   потоков 01/02/03/06; формы артефактов в §3.2–3.3 намеренно framework-neutral,
   чтобы их не пришлось переписывать.

---

## 5. Источники

**Внешние (проверено 2026-09-15):**

- TanStack Start — SPA mode: `spa: { enabled: true }`, prerender шелла в
  `/_shell.html`, `maskPath`, rewrite-правила для статик-хостинга, `isShell()` —
  https://tanstack.com/start/latest/docs/framework/react/spa-mode
- TanStack Start — Static Prerendering: `prerender: { enabled, crawlLinks,
  autoStaticPathsDiscovery, filter, failOnError, … }`, `pages: [{ path, prerender }]`,
  правила автодискавери —
  https://tanstack.com/start/latest/docs/framework/react/static-prerendering
- TanStack Start — Selective SSR: `ssr: true | false | 'data-only'` и
  функциональная форма, `createStart({ defaultSsr })` —
  https://tanstack.com/start/latest/docs/framework/react/selective-ssr
- TanStack Start — ISR через стандартные HTTP-кеш-заголовки —
  https://tanstack.com/start/latest/docs/framework/react/isr
- TanStack Start — SEO (`head` на route, динамическая мета из `loaderData`, OG) —
  https://tanstack.com/start/latest/docs/framework/react/seo
  (и соседний гайд GEO — https://tanstack.com/start/latest/docs/framework/react/geo)
  *Тексты документации прочитаны из копии docs, снятой параллельным потоком в
  scratchpad (`tsdocs/`), структура подтверждена `tanstack-docs-config` — канонические
  адреса выше.*
- Gitea: «Use this template» схлопывает историю шаблона в один коммит; опция
  сохранения истории — открытый запрос (issue создан 2023-11-08, открыт на дату
  проверки) — https://github.com/go-gitea/gitea/issues/27964 ·
  https://docs.gitea.com/1.21/usage/template-repositories

**Внутренние (прочитано целиком, 2026-09-15):**

- `spa-frontend-template`: `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`,
  `docs/{README,getting-started,contributing}.md`, `docs/reference/*.md`,
  `docs/stack/README.md` + `_templates/*.md` (8), `.claude/rules/*.md` (6),
  `.claude/skills/*/SKILL.md` (7) + `references/*`, `.claude/plans/roadmap.md`,
  `.claude/settings.json`, весь `src/**`, `package.json`, `vite.config.ts`,
  `vitest.config.ts`, `tsconfig.json`, `steiger.config.ts`, `eslint.config.js`,
  `.size-limit.cjs`, `index.html`, `docker/*`, `e2e/*`, `.env.example`, `lefthook.yml`
- `business-strategy-template`: `docs/projects/_template/fsd/README.md` +
  `_template/{pages,app,shared-api,shared-lib,shared-ui}.md`,
  `docs/projects/_template/project/{surface,market,integration}.md`,
  `docs/projects/_template/screens/{README.md,_template/screen.md}`,
  `.claude/skills/{fsd-deep-dive,fsd-audit}/SKILL.md`, `CLAUDE.md`, `docs/README.md`
- `corp-infra-template/docs/ecosystem.md`
- `project-infra-template-compose`: `CLAUDE.md`, `docs/project/README.md`,
  `docs/project/_templates/{service,stack}.md`, `docs/reference/{ecosystem,architecture}.md`,
  `compose/{landing,backend}.yml`, `.env.example`,
  `.claude/skills/{init-project,de-template,add-service}/SKILL.md`
- `telegram-bot-template`: `CLAUDE.md`, `docs/reference/ecosystem.md`, `docs/stack/README.md`
- `go-backend-template`: `docs/reference/ecosystem.md`,
  `internal/platform/authgate/cookie.go`
- `stit-public`: `README.md`, `docs/{roadmap,templates,getting-started}.md`
