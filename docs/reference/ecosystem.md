# Экосистема

## Где этот шаблон

`ssr-frontend-template` — шаблон **индексируемого сайта**: контент, который должен
находиться в поиске, отдаётся первым HTML-ответом. Приложение за логином — другой
шаблон, `spa-frontend-template`. Проект может иметь оба одновременно: сайт на корне
домена, приложение на `app.${DOMAIN}`.

| нужно | берут |
|---|---|
| страницы, которые ищут в Google и Яндексе; блог, услуги, кейсы, лендинг | **этот шаблон** → форк `<org>/site` |
| кабинет, дашборд, что угодно за логином | `spa-frontend-template` → форк `<org>/frontend` |

## Соседние репозитории

Форки одной org клонируются sibling-checkout'ами рядом:

```
~/git/<org>/
├─ strategy/   ← business-strategy-template (design-time SoT: стратегия, продукт, FSD-карта)
├─ infra/      ← project-infra-template-compose (VPS проекта, операционный хаб)
├─ site/       ← ssr-frontend-template (этот репо)
├─ frontend/   ← spa-frontend-template (опционально)
├─ backend/    ← go-backend-template (опционально)
└─ <bot>/      ← telegram-bot-template (опционально)
```

| репо | первичная ответственность |
|---|---|
| `strategy/` | design-time SoT: бизнес-слои и продукт (vision, surface, interface, screens, **FSD-карта `fsd/<surface>/`**) |
| `site/` | сайт: контент, маршруты, SEO, форма, Docker-образ |
| `frontend/` | приложение за логином |
| `backend/` | HTTP API, доменная логика, БД — если сайту нужны данные извне |
| `infra/` | docker-compose VPS, секреты в `.env`, edge/ingress, **rollout тегов** |

## Контракты

| источник | потребитель | что |
|---|---|---|
| `strategy: projects/<slug>/fsd/<surface>/` | `site/` | карта слайсов — вход `/scaffold` и `/de-template` |
| `strategy: projects/<slug>/{interface,screens}/<surface>/` | `site/` | контекст: аудитории, ситуации, экраны, блоки — из них растут тексты страниц |
| `docs/stack/**` (здесь) | `/de-template`, `/scaffold` | платформенные решения: источник контента, маршруты, режимы, env |
| `docs/reference/deployment.md` (здесь) | `infra/` | env-контракт образа и требования к прокси |
| `docs/reference/infra-handoff.md` (здесь) | `infra/`, корп-карта, соседние шаблоны | рабочее задание cross-repo: `compose/site.yml`, Traefik, CrowdSec, приёмка первого деплоя |
| образ `git.${DOMAIN}/<org>/site:vX.Y.Z` | `infra/` | `/release` пушит; rollout — `make bump SVC=site TAG=<v>` там (правит `SITE_TAG` в `.env` VPS) |

Резолв путей соседа — поля `project-slug` / `strategy-path` (дефолт `../strategy`) /
`surface` в `docs/stack/service.md`. Чтение strategy — read-only и одностороннее: этот
репо в неё не пишет.

## Операционная модель

`<org>/infra` — операционный хаб проекта: задачи входят туда, оттуда агенты приходят
сюда и работают **обвязкой этого репо** (`CLAUDE.md`, словарь `pnpm`, скиллы, гейт
`pnpm check`). Прямой заход человека сюда — нормальный режим.

Этот репо **STOP'ает на image-in-registry**: деплой-команды чужих репо (`make bump`,
`make ship`, ssh) отсюда не запускаются — `/release` печатает handoff-блок, применяет
его оператор или агент в `<org>/infra`. Что сервису `site` нужно от compose и прокси —
[`infra-handoff.md`](./infra-handoff.md): готовый `compose/site.yml`, роутеры и
middleware Traefik, CrowdSec, приёмка первого деплоя и порядок сессий по соседним репо.
Короткая версия требований к прокси — `deployment.md § Требования к прокси`, env-контракт
образа — там же.

## Корп control-plane

`corp-infra-template` — корп-VPS: registry `git.stit.tech` (pull/push образов),
CrowdSec-whitelist egress проектных VPS. Managed = инстанс на `*.stit.tech`;
self-hosted = свой форк, вендор-лока нет. Source-of-truth карты экосистемы —
`corp-infra-template/docs/ecosystem.md`; там же конвенция sibling-checkout.

## Родство с `spa-frontend-template`

Два канонических шаблона делят **обвязку, а не код**: правила, скиллы, форму
документации, состав гейта. Общей npm-библиотеки нет, дизайн-системы нет — компоненты
пишутся в проекте на собственном токен-слое. Списки и сверка — `kinship.md` +
`pnpm kin:diff` (advisory, вне гейта).

## Шаблон vs проект

Шаблоны живут под оргом `stit-core` и форкаются через Gitea «Use this template».
Форк проходит `/init-service` → `/stack-deep-dive` → `/de-template`, после чего
становится самостоятельным проектом и про шаблон не помнит. Merge апстрима потребителю
недоступен в принципе: «Use this template» схлопывает историю.
