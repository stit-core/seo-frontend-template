# Экосистема

Короткая версия для этого репо. Канон карты экосистемы и операционного флоу —
`docs/reference/ecosystem.md` в `<org>/infra` (форк `project-infra-template-compose`; в корне
проекта — `../infra/docs/reference/ecosystem.md`).

## Где этот шаблон

`seo-frontend-template` — шаблон **индексируемого сайта**: контент, который должен
находиться в поиске, отдаётся первым HTML-ответом. Приложение за логином — другой
шаблон, `spa-frontend-template`. Проект может иметь оба одновременно: сайт на корне
домена, приложение на `app.${DOMAIN}`.

| нужно | берут |
|---|---|
| страницы, которые ищут в Google и Яндексе; блог, услуги, кейсы, лендинг | **этот шаблон** → форк `<org>/site` |
| кабинет, дашборд, что угодно за логином | `spa-frontend-template` → форк `<org>/frontend` |

## Шаблоны и соседи

Шаблоны `stit-core/*` форкаются в репо клиентской орги `<org>/*`. Проект — папка
`~/git/<org>/`: в её корне — карта проекта `CLAUDE.md` и общие настройки сессии, в
папках корня — форки орги sibling-checkout'ами (`../<name>`). Из корня ведётся вся
работа ([`project-root.md`](https://github.com/stit-core/project-infra-template-compose/blob/main/docs/reference/project-root.md)):

```
~/git/<org>/   ← корень проекта (<org>/project): CLAUDE.md, .claude/settings.json, local/
├─ strategy/   ← business-strategy-template
├─ infra/      ← project-infra-template-compose
├─ site/       ← seo-frontend-template (этот репо)
├─ frontend/   ← spa-frontend-template (опционально)
├─ backend/    ← go-backend-template (опционально)
├─ <bot>/      ← telegram-bot-template (опционально)
└─ mobile/     ← mobile-template (опционально)
```

| шаблон → форк | роль |
|---|---|
| `business-strategy-template` → `<org>/strategy` | design-time source of truth: бизнес, AJTBD, SWOT, карта гипотез, продукты (vision/surface, interface, screens, **FSD-карта `fsd/<surface>/`**, telegram-bot-flow, mobile, services + domains), ИТ-периметр |
| `project-infra-template-compose` → `<org>/infra` | runtime проекта (docker-compose на VPS) и **хаб**: программы сквозных задач, выкатка тегов (`make bump`) |
| `go-backend-template` → `<org>/backend` | Go-сервис: HTTP API и данные — если сайту нужны данные извне |
| `spa-frontend-template` → `<org>/frontend` | React SPA (кабинет, всё за логином) |
| `seo-frontend-template` → `<org>/site` | **этот репо**: Astro SEO-сайт — контент, маршруты, SEO, форма, Docker-образ |
| `telegram-bot-template` → `<org>/<bot>` | Telegram-бот (Python, aiogram) |
| `mobile-template` → `<org>/mobile` | KMP-приложение Android + iOS; релиз — в магазины |

Библиотеки экосистемы — `golibinfra` (киты Go-сервисов) и `pylibinfra` (киты бота); сайт их не
потребляет.

## Как сюда приходят

1. **Корень проекта — первым.** Заводится папка `~/git/<org>/` с картой проекта `CLAUDE.md`;
   в неё клонируются все репо проекта (этот — в `site/`), и из неё ведётся вся работа — одной
   сессией Claude Code.
2. **Сначала проектирование — `<org>/strategy`.** До кода там проектируется всё, что можно, в
   том числе слой страницы сайта и его дизайн. Код начинается, когда проект продуман.
3. **Реализация — из корня.** Сессия корня (или её фоновый агент) приходит сюда, в `site/`, с
   задачей или фазой программы и работает **обвязкой этого репо**: сначала `CLAUDE.md` (с ним
   подхватываются правила и скиллы репо), дальше — словарь `pnpm`, скиллы, гейт `pnpm check`.
   Сквозная задача — программа в `.claude/plans/` хаба `<org>/infra`; её фаза ведётся планом
   здесь (`/plan`, `parent: infra:<slug>`). Изменение дизайна по ходу — в `../strategy`,
   скиллами strategy, а не здесь.
4. **Прямой заход сюда** (сессия в папке репо) — нормальный режим: та же обвязка, а то, что
   задевает соседей, оформляется handoff-блоком для хаба — его печатает `/release`; контракт
   сервиса `site` с хабом — [`infra-handoff.md`](./infra-handoff.md).

## Что репо берёт и отдаёт

| источник | потребитель | что |
|---|---|---|
| `../strategy/docs/projects/<slug>/fsd/<surface>/` | `site/` | карта слайсов — вход `/scaffold` и `/de-template` |
| `../strategy/docs/projects/<slug>/{interface,screens}/<surface>/` | `site/` | контекст: аудитории, ситуации, экраны, блоки — из них растут тексты страниц |
| `../strategy/.claude/skills/design-deep-dive/` (база знаний и утилиты) | `site/` | нормы SEO и GEO: реестр ботов `crawlers.yaml` — копией в `src/shared/seo` (сверяет `pnpm geo:probe`), `geo_probe.py` — шаг `/seo-audit`, `copy_lint.py` — шаг `/content`; утилиты запускаются из чекаута соседа его окружением, без соседа шаги пропускаются |
| `docs/stack/**` (здесь) | `/de-template`, `/scaffold` | платформенные решения: источник контента, маршруты, режимы, env |
| `docs/reference/deployment.md` (здесь) | `infra/` | env-контракт образа |
| `docs/reference/infra-handoff.md` (здесь) | `infra/` | контракт сервиса `site`: что гарантирует образ, требования к среде и edge, боты, приёмка; исполняет стек хаба |
| образ `<registry>/<org>/site:vX.Y.Z` | `infra/` | `/release` пушит (registry — `REGISTRY_HOST`, дефолт `git.stit.tech`); выкатка — `make bump SVC=site TAG=<v>` там (правит `SITE_TAG` в `.env` VPS) |

Резолв путей соседа — поля `project-slug` / `strategy-path` (дефолт `../strategy`) /
`surface` в `docs/stack/service.md`. Чтение strategy — read-only и одностороннее: этот
репо в неё не пишет.

Этот репо **останавливается на образе в registry**: деплой-команды чужих репо (`make bump`,
`make ship`, ssh) отсюда не запускаются — `/release` печатает handoff-блок, применяет его
агент или оператор в `<org>/infra` по канону хаба (`docs/reference/ecosystem.md § Handoff-блок
релиза` там). Контракт сервиса `site` — `infra-handoff.md`, env-контракт образа — `deployment.md`.

## Шаблон vs проект

Шаблоны живут под оргом `stit-core` и форкаются через Gitea «Use this template».
Форк проходит `/init-service` → `/stack-deep-dive` → `/de-template`, после чего
становится самостоятельным проектом и про шаблон не помнит. Merge апстрима потребителю
недоступен в принципе: «Use this template» схлопывает историю.
