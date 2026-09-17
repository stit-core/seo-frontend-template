# Экосистема

## Соседние репозитории

Экосистема stit — **6 форкаемых шаблонов** под оргом `stit-core` (этот репо
один из них: → `<org>/frontend`) + 3 общие библиотеки. Все форки одной org
клонируются **sibling-checkout'ами рядом**:

```
~/git/<org>/
├─ strategy/  ← business-strategy-template (design-time SoT: стратегия + продукт)
├─ infra/     ← project-infra-template-compose (VPS проекта; операционный хаб)
├─ backend/   ← go-backend-template (опционально)
├─ frontend/  ← spa-frontend-template (этот репо)
└─ <bot>/     ← telegram-bot-template (опционально)
```

Библиотеки (не форкаются, потребляются): `stit-core/ui-lib` (`@stit/ui`,
design-system — импортирует этот репо), `stit-core/golibinfra` (Go-kits для
backend), `stit-core/pylibinfra` (`tgbotkit` для бота).

## Кто что хранит

| репо | первичная ответственность |
|---|---|
| `strategy/` | design-time SoT: бизнес-слои + продукт (vision/surface, interface, screens, **FSD-карта `fsd/<surface>/`**, домены, сервисная топология, ИТ-периметр) |
| `backend/` | HTTP API, доменная логика, миграции БД, sqlc, NATS, outbox |
| `frontend/` | SPA: код по FSD-карте, mock-слой, runtime config, Docker image |
| `<bot>/` | Telegram-бот: диалоги aiogram_dialog по `telegram-bot-flow/` |
| `infra/` | docker-compose VPS, deploy, secrets через `.env`, edge/ingress; **rollout тегов** |

## Контракты между репо

| источник | потребитель | что |
|---|---|---|
| `strategy: projects/<slug>/fsd/<surface>/` | `frontend/` | **stable-карта слайсов** — вход `/scaffold` и `/de-template`; `src/`-пути выводятся из kind + slug |
| `strategy: projects/<slug>/{interface,screens}/<surface>/` + product-файлы | `frontend/` | контекст: ситуации, экраны, блоки, данные |
| `strategy: projects/<slug>/services/<svc>/domains/` | `backend/`, `frontend/` | DDD-сущности (для фронта — источник entities и mock-слоя) |
| `backend/openapi.json` | `frontend/` | контракт HTTP API (референс для рукописных zod-схем) |
| образ `git.${DOMAIN}/<org>/frontend:<vX.Y.Z>` | `infra/` | `/release` пушит; rollout — `make bump SVC=frontend TAG=<v>` в `<org>/infra` (правит `FRONTEND_TAG` в `.env` VPS) |

Резолв путей соседа — поля `project-slug` / `strategy-path` (дефолт
`../strategy`) / `surface` в `docs/stack/service.md`. Контракт чтения
strategy — read-only, односторонний.

## Операционная модель

`<org>/infra` — операционный хаб проекта: задачи входят туда, оттуда агенты
приходят сюда и работают **обвязкой этого репо** (`CLAUDE.md`, `pnpm`-словарь,
скиллы, гейт `pnpm check`). Прямой заход человека сюда — нормальный режим при
ролевом разделении команды. Этот репо **STOP'ает на image-in-registry**:
деплой-команды чужих репо (`make ship`, `make bump`, ssh) отсюда не
запускаются — handoff в `<org>/infra`.

## Корп control-plane

`corp-infra-template` — корп-VPS: registry `git.stit.tech` (pull/push
образов), CrowdSec-whitelist egress проектных VPS. Managed = инстанс на
`*.stit.tech`; self-hosted = свой форк — вендор-лока нет. **Source-of-truth
карты экосистемы — `corp-infra-template/docs/ecosystem.md`** (там же —
«Операционная модель агентов» и sibling-checkout конвенция).

## Шаблон vs проект

Шаблоны живут под оргом `stit-core` и форкаются через Gitea «Use this
template». Этот фронт-шаблон проходит `/init-service` → `/de-template`,
после чего становится независимым проектом.
