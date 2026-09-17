# Промпт для следующей сессии: сборка `ssr-frontend-template` на Astro

> Как использовать: открыть Claude Code (в этом репо или в новом `ssr-frontend-template`) и
> написать одной строкой: «Прочитай `/home/mm/git/stit-core/spa-frontend-template/docs/research/ssr/NEXT-SESSION.md`
> целиком и действуй по нему». Всё ниже — инструкция для той сессии.

## 0. Кто ты и что делаешь

Ты — главная (оркестрирующая) сессия. Ресёрч по второму фронт-шаблону экосистемы stit
**закрыт** (два раунда, 14 потоков, четыре эталонных spike). Твоя работа в этой сессии — три
шага, строго по порядку:

1. **Обговорить и зафиксировать решения** с владельцем (§3) — коротко, пакетами вопросов через
   `AskUserQuestion`, с дефолтами из §3. Не пересказывать ресёрч, не заново исследовать.
2. **Написать build-brief и отправить Fable-агента(ов) делать шаблон** (§4): агент —
   `general-purpose` с `model: "fable"`, по одной фазе за запуск, каждая фаза заканчивается гейтом.
3. **Перепроверить всё главной сессией** (§5): гейт, e2e, образ, curl-проверки, code-review,
   чек-лист приёмки. Только после этого — claim «готово».

Владелец формулирует цель так: **красивый, удобный, приятный шаблон без замудрённостей,
сделанный грамотно — по правилам, стандартам и трендам**. Это главный критерий при любом
выборе между «мощно» и «просто»: если фича не обязательна для контент-сайта в поиске —
она опция или её нет.

## 1. Где лежит ресёрч (читать выборочно, не всё)

Каталог: `/home/mm/git/stit-core/spa-frontend-template/docs/research/ssr/` (16 МБ, untracked —
судьбу коммита решает владелец; при переносе сессии в другой каталог пути остаются абсолютными).

| что | путь | зачем читать |
|---|---|---|
| **Сводный синтез** (единственный вход) | `00-synthesis.md` (HTML-версия `00-synthesis.html`, артефакт `https://claude.ai/code/artifact/d7427ee9-4b59-4048-acb3-31a3b9cee7b8`) | §1 TL;DR, §5.1 решение и `astro.config`, §6 архитектура, §6.5 бюджеты, §6.6 reference-слайсы, §7 SEO-MUST, §8 деплой, §9 обвязка/kinds/скиллы, §10 вопросы, §11 риски, **§12 план фаз с гейтами** |
| Handoff второго раунда | `round2/HANDOFF.md` | карта отчётов, «что не проверено» |
| Spike Astro (эталонный сайт, конфиги для переноса, 17 ловушек) | `round2/08-spike-astro.md`, исходники `round2/spikes/spike-astro/` (без `node_modules`: `pnpm install --frozen-lockfile`, порт 3201) | **основа кода фазы 1–2** |
| Инструменты гейта × `.astro`, FSD-раскладка, конфиги ESLint/Steiger/Biome/Vitest | `round2/12-tooling-fsd.md`, `round2/spikes/tooling-lab/` | гейт фазы 1 |
| Референс-архитектура контент-сайта (контент, рендер, картинки, формы, право РФ, kinds) | `round2/14-content-architecture.md` | фазы 2–6 |
| Дизайн шаблона (kinship, 13 kinds, скиллы, cross-repo) | `round2/13-template-v2.md`, `05-template-design.md` | фаза 6–7 |
| SEO-канон (Google + Яндекс), чек-листы страницы и релиза | `02-seo-canon.md` (+ `_sub-*.md`) | фаза 4, приёмка |
| Деплой одним Node-образом, `compose/site.yml`, env-контракт, дефекты infra | `04-runtime-deploy.md` | фаза 1 (Dockerfile), фаза 7 |
| Ландшафт и матрица (почему Astro) | `round2/07-landscape-v2.md` | только если владелец спросит «почему» |

Промпты агентов и контекст прошлых запусков — `round2/prompts/`. Повторно исследовать ничего
не нужно: отчёты написаны как спецификации (точные версии на 2026-09-16, листинги конфигов,
ловушки с URL).

## 2. Что уже решено (не открывать заново)

- **Фреймворк — Astro 7.3 + `@astrojs/node`** (`output: 'static'`, адаптер `standalone`, Vite 8.3);
  запасные Nuxt 4.5 и Next 16.3 — только если сработают условия пересмотра из синтеза §5.3.
- **Имя репозитория — `ssr-frontend-template`** (стоит в публичном roadmap); в прозе — «шаблон
  индексируемого сайта: static-first, SSR по необходимости». Форк потребителя — `<org>/site`,
  сервис в инфре `SVC=site` → `SITE_TAG` → `compose/site.yml` на корне `${DOMAIN}`.
- **Отдельный репозиторий**, родство с SPA — контрактом обвязки (`docs/reference/kinship.md`),
  не общим кодом; общей npm-библиотеки нет; `@stit/ui` не используется.
- **Обязательное наследие**: агентная обвязка (`CLAUDE.md`, rules, скиллы, `docs/stack` с
  `Generates`, planning-first, forward-only), FSD + Steiger (границы держит ESLint
  `boundaries@7` с резолвером + `no-restricted-imports`; Steiger — структура), гейт `pnpm check`
  (Biome, ESLint 10, `astro check`, Vitest 5, Playwright, size-limit, lefthook, commitlint).
- **Хостинг как в экосистеме**: один Node-образ `node:24-alpine` в `git.stit.tech`,
  docker-compose + Traefik + CrowdSec, один VPS на среду, без CDN, rollout `make bump SVC=site`.
- **Контент по умолчанию в git** (Markdown + Zod-коллекции внутри `entities/<name>/content/`),
  шов `ContentSource` для CMS/API; редиректы — данные; i18n — префикс `/en/` без авторедиректов.
- **SEO-канон** из `02-seo-canon.md` — MUST-ядро обязательно (первый HTML полный, честные
  404/410/308, один хост, absolute self-canonical, `robots.txt`/`sitemap.xml` из runtime,
  staging закрыт тремя контурами, hreflang взаимный, JSON-LD без `FAQPage`/`HowTo`/`SearchAction`,
  Яндекс-особенности).
- **Дефекты infra чинятся отдельным PR до первого сайта** (CrowdSec не видит HTTP-трафик Traefik;
  `sslRedirect` удалён в Traefik v3) — это `project-infra-template-compose`, не этот шаблон.

## 3. Что обговорить в начале сессии (с дефолтом «просто и грамотно»)

Задай эти вопросы пакетами по 3–4 через `AskUserQuestion`; у каждого — дефолт, который можно
принять молча. Полный список 27 вопросов с рекомендациями ресёрча — синтез §10; здесь только те,
что влияют на объём v1. Ответы запиши в `docs/research/ssr/DECISIONS.md` (одна таблица) и
перенеси в build-brief.

| # | вопрос | дефолт (просто) | что говорит ресёрч |
|---|---|---|---|
| 1 | **Шрифты** | **Системный стек (`system-ui`) без веб-шрифта.** Опция одной строкой: один variable-шрифт через Astro Fonts API (`subsets: ['cyrillic','latin']`), без ручного сабсеттинга и метрик фолбэка | владелец: «не упарываться в шрифты»; ресёрч предлагал Wix Madefor Text + Onest (29–35 КБ) — оставить как опцию в `styling.md` |
| 2 | **Абсолютные URL при prerender** (один образ на все среды) | **C**: prerender + плейсхолдер `https://__site_origin__` + подстановка `SITE_URL` в entrypoint (~30 строк, 32 файла за 0–10 мс) + e2e «плейсхолдера нет в ответе» | альтернатива A (образ на среду через build-arg) проще, но ломает инвариант экосистемы «один образ»; D (рендер на запрос + кеш) — не для v1 |
| 3 | **Режим рендера v1** | **Только static (prerender)** + on-demand для `robots.txt`/`sitemap.xml`/`rss.xml`/`healthz`/формы. Серверный кеш `memoryCache` + `routeRules` (вариант D) — **не в v1**, задокументированная опция для CMS/API | D требует single-flight, прогрева, вебхуков инвалидации — замудрённость для контент-сайта из git |
| 4 | **Пресеты** | **Один пресет `content-site`** (лендинг — его подмножество); `docs` — потом | ресёрч: `landing-template` из roadmap = пресет этого шаблона |
| 5 | **i18n в reference-наборе** | **ru + en включены** (каркас `/en/`, hreflang, `translationKey`), контент en — минимальный | без en нельзя проверить hreflang/404-на-непереведённое в гейте |
| 6 | **Форма обратной связи** | honeypot + time-trap + origin-check без JS; **один канал доставки** (`FORM_DELIVERY=backend` или `smtp`) с ретраями; спул на диске и второй канал — опция | ресёрч рекомендует ≥ 2 канала + durable-спул (ограничения Telegram/SMTP в РФ) — вынести в `forms`-раздел `content.md` как SHOULD |
| 7 | **Капча / аналитика / cookie-баннер** | `CAPTCHA_PROVIDER=none`; Метрика по `ANALYTICS=metrika\|none`, грузится после idle; **cookie-баннер — опция, выключен** | ресёрч: прямой нормы о баннере в РФ нет; согласие на аналитику — снижение риска, не требование |
| 8 | **OG-изображения** | статическая обложка поста / дефолт сайта; генератор satori+resvg — **не в v1** | `@resvg/resvg-js` без релизов с 2024 |
| 9 | **Кабинет/auth** | **нет в v1** (документированный путь через BFF-прокси + `SameSite=Lax`) | владелец: кабинет опционален |
| 10 | **Форматирование `.astro`** | **Prettier только для `*.astro`** (`prettier-plugin-astro`), остальное — Biome | ресёрч допускал «без автоформата» — для DX лучше плагин |
| 11 | **Состав `docs/stack`** | 13 kinds из §9.3, но `api`/`analytics` условные; при желании владельца — слить `images` в `content` | меньше kinds = короче `/stack-deep-dive` |
| 12 | **Негативные фикстуры гейта** (`.gate-fixtures/`) | **да** — единственная защита от молчаливых деградаций (Steiger fail-open) | обязательны |
| 13 | **Где создаётся репо и кто чинит infra** | владелец создаёт `ssr-frontend-template` на Gitea (Use this template от `spa-frontend-template`) и клонирует в `~/git/stit-core/ssr-frontend-template`; PR в `project-infra-template-compose` — отдельная сессия/агент | без репо Fable-агенту негде работать |
| 14 | **Коммит `docs/research/`** | закоммитить в этом репо одним `docs:`-коммитом (16 МБ, spike'и без `node_modules`) либо перенести в новый репо | иначе ресёрч живёт только в рабочем дереве |

Не спрашивать заново: финалист, имя, форк, отдельный репо, хостинг, наследие, SEO-канон (§2).

## 4. Build-brief для Fable-агента

После §3 напиши `docs/research/ssr/BUILD-BRIEF.md` (в новом репо — `docs/research/BUILD-BRIEF.md`)
и запускай агента **по одной фазе** (`Agent`, `subagent_type: general-purpose`, `model: "fable"`,
рабочий каталог — новый репо). Каждая фаза = отдельный запуск с отчётом; следующая — только
после зелёного гейта и твоей проверки (§5). Фазы и гейты — синтез §12 (не переписывать, ссылаться):

- **Фаза 1 — фундамент**: fork SPA → перенос идентичного ядра обвязки и токен-слоя
  `app/styles/index.css`; `astro.config.ts` из синтеза §5.1 и `08-spike-astro.md` §3;
  `tsconfig` (`astro/tsconfigs/strictest` + флаги SPA); FSD-дерево
  `src/{app,pages,widgets,features,entities,shared}` + навязанные реэкспорты (`content.config.ts`,
  `middleware.ts`, `actions/`); `shared/config` (Zod по `process.env`, `SITE_URL` обязателен);
  `docker/{Dockerfile,entrypoint.sh}`, `/healthz`, graceful shutdown; гейт целиком (ESLint 10 +
  `boundaries` с резолвером, Steiger, Biome, `astro check`, Vitest 5, Playwright на prod-сборке,
  size-limit, lefthook, commitlint), `.gate-fixtures/`, `docs/reference/kinship.md` + `pnpm kin:diff`.
- **Фаза 2 — контент-слой**: коллекции в `entities/<name>/content/{ru,en}`, `translationKey`,
  `draft`, `content/redirects.yaml` (301/410), `check:content`, `check:links`.
- **Фаза 3 — рендер**: `prerender` per route, вариант C (штамповка), `X-Robots-Tag` для on-demand,
  нормализация слеша; D — только документация.
- **Фаза 4 — SEO-слой**: `shared/seo/*`, `pages/{robots.txt,sitemap.xml,rss.xml}.ts`, JSON-LD
  (`Organization`+`WebSite`, `BreadcrumbList`, `Article`) с Zod-тестом, `e2e/seo.spec.ts`,
  `scripts/seo-check.mjs` в `pnpm check`.
- **Фаза 5 — reference-слайсы** по §6.6 в объёме решений §3 (индекс, about, blog с тегами и
  пагинацией, contacts + spasibo, legal/privacy с плейсхолдерами, 404/500, `now`); картинки
  build-time; тема из cookie; острова — vanilla/Preact.
- **Фаза 6 — обвязка**: `docs/stack` kinds + `_templates`, правила (`render-safety`,
  `seo-invariants`, `content-invariants`, переписанные `env-local`/`tests-pipeline`/
  `fsd-architecture`/`shared-ui`), скиллы (`smartdev`, `plan`, `init-service`, `stack-deep-dive`,
  `de-template`, `scaffold`, `release`, `seo-audit`, `content`), `docs/reference/*`,
  `getting-started.md`, `CLAUDE.md`, README.
- **Фаза 7 — инфра и экосистема**: `compose/site.yml`, канон `corp-infra-template/docs/ecosystem.md`,
  sweep «6 → 7» + удаление `@stit/ui`, `stit-public` — освежающим PR. Это cross-repo: отдельные
  сессии в соответствующих репо, по порядку из синтеза §9.5.

В каждом промпте агента обязательно:

- принципы владельца (§0) и решения (§2, §3) дословно; ссылки на конкретные разделы/файлы
  ресёрча по абсолютным путям — агент **не исследует заново**, а реализует по спецификации;
  версии пакетов — точные, из `08-spike-astro.md`/`12-tooling-fsd.md` (проверить `pnpm view`
  на день запуска, изменения — в отчёт);
- правила репо: forward-only (без «было/стало»), комментарии только WHY и по-русски,
  Conventional Commits, **никаких `--no-verify`**, коммитить только по явной просьбе,
  временные файлы — в scratchpad, не трогать соседние репо `~/git/stit-core/*`;
- «без замудрённостей»: каждая зависимость и каждая опция должны быть обоснованы одной строкой
  в отчёте фазы; экспериментальные API Astro — только те, что перечислены в спецификации;
- формат отчёта фазы: что сделано (файлы), как проверено (команды и вывод гейта), что
  отклонилось от спецификации и почему, что осталось.

## 5. Проверка главной сессией (после каждой фазы)

1. `pnpm check` зелёный локально (сам, не по словам агента); для фаз ≥ 4 — `pnpm seo:check`,
   `E2E_PROD=1 pnpm test:e2e`.
2. Образ: `docker build -f docker/Dockerfile --secret id=npmrc,src=$HOME/.npmrc -t site-local .`
   → запуск с `SITE_URL`, `ROBOTS_POLICY` → `curl`: `/` 200 и полный HTML без JS
   (`-A Googlebot` тоже), `/blog/net-takogo` 404, `/old` 301, `/about/` → нормализация,
   `/robots.txt`, `/sitemap.xml`, `/healthz`; `grep -r __site_origin__ dist` пуст после
   штамповки; `docker stop` дренаж < 1 с; размер образа.
3. Бюджеты (синтез §6.5): 0 script-ресурсов на индексируемых страницах, HTML ≤ 100 КБ,
   CSS ≤ 15 КБ, TTFB prerender ≤ 2 мс локально.
4. Код-ревью: `/code-review high` на диффе фазы + ручной проход по FSD-границам (импорты только
   через `index.ts`, server-only не в public API слайса), негативные фикстуры реально валят гейт.
5. Обвязка (фаза 6): прогнать `/init-service` → `/de-template` на тест-форке; `/scaffold page`
   даёт зелёный гейт; `docs/stack/*` все `stable`-способны, `Generates` непусты.
6. Красота и удобство: открыть сайт в браузере (Browser pane), light/dark, мобильный вьюпорт,
   формы, 404; всё, что выглядит «шаблонно-серо» или требует объяснений, — вернуть агенту.
7. Только после этого — обновить `.claude/plans/roadmap.md` нового репо и отчитаться владельцу.

## 6. Предусловия и порядок первого запуска

1. Владелец: создать `ssr-frontend-template` на Gitea (Use this template от `spa-frontend-template`),
   клонировать в `~/git/stit-core/ssr-frontend-template`, `pnpm install`. Решить судьбу коммита
   `docs/research/` (§3 п.14).
2. Эта сессия: §3 (решения) → `DECISIONS.md` → `BUILD-BRIEF.md` → агент фазы 1.
3. Параллельно (другая сессия/агент в `project-infra-template-compose`): PR по дефектам infra
   и `compose/site.yml` (синтез §8, `04-runtime-deploy.md` §3.9).
4. Лимиты: в прошлой сессии Opus-агенты упёрлись в недельный лимит; Fable-агентов запускать не
   больше 2–3 одновременно, при `403/429` — возобновлять через `SendMessage`, не перезапускать с нуля.

## 7. Что не проверено ресёрчем (учесть при приёмке)

- `pnpm.supportedArchitectures: { libc: ['musl'] }` для `sharp` в образе — проверить размер и работу `astro:assets`.
- Поведение за живым Traefik (сжатие, `X-Robots-Tag` через `customResponseHeaders`, keep-alive) — только на стенде.
- Доступность `api.telegram.org`/GA-доменов — с VPS заказчика, не с машины разработчика.
- `experimentalDisableStreaming` у `@astrojs/node` — при `output: 'static'` неактуально.
