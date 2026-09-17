---
name: init-service
description: Оркестратор онбординга потребителя шаблона ssr-frontend-template — ведёт путь форк → привязка к FSD-карте из соседнего <org>/strategy (проектируется там его /fsd-deep-dive) → проектирование стека (/stack-deep-dive) → /de-template → /scaffold собственных страниц и коллекций, пока проект не перестанет помнить про шаблон. Активируй когда юзер форкнул ssr-frontend-template и говорит "/init-service", "онбординг", "развернуть сайт из шаблона", "с чего начать новый сайт", или когда видишь свежий форк (package.json#name всё ещё @stit/ssr-frontend-template, демо-идентичность и плейсхолдеры оператора на месте). Сам не проектирует и не де-темплейтит — чейнит специализированные скиллы по порядку.
---

# Skill: init-service (онбординг-оркестратор)

Дирижёр пути «форк шаблона → свой сайт». Не проектирует и не генерирует сам —
**ведёт по этапам и чейнит** специализированные скиллы. Один проход доводит до
проекта, который ничего не помнит про шаблон.

Путь для человека — `docs/getting-started.md`; этот скил его исполняет.

## Когда применять

- «/init-service» / «онбординг» / «развернул форк, что дальше»
- Свежий форк — любой из признаков:
  - `package.json#name` ещё `@stit/ssr-frontend-template`
  - `src/pages/legal/privacy.astro` содержит `{{OPERATOR_NAME}}`
  - демо-идентичность в `src/shared/config/site.ts` и `src/entities/company/model/company.ts`
  - reference-набор на месте: `src/entities/post/content/**`, демо-строки `content/redirects.yaml`

## Когда НЕ применять

- Проект уже развёрнут (своё имя пакета, плейсхолдеров нет) — это обычный
  день-в-день, иди в `/smartdev`
- Юзер хочет добавить страницу/коллекцию в уже-свой проект — это `/scaffold`
- Юзер хочет написать запись — это `/content`

## Pre-flight

- [ ] Форк создан, репо склонирован (Gitea → **Use this template** → `<org>/site`)
- [ ] `pnpm install` прогнан
- [ ] `pnpm prepare` поставил lefthook-хуки
- [ ] `pnpm dev` открывается на `http://localhost:4321`

Если нет — подскажи шаг 0 из `docs/getting-started.md` и дальше не иди.

## Этапы (чейнить по порядку, не делать самому)

### 1. Привязаться к FSD-карте в `<org>/strategy`

- Карта поверхности проектируется в соседнем `<org>/strategy`
  (`docs/projects/<slug>/fsd/<surface>/`, его `/fsd-deep-dive`) — **не здесь**
- Проверить sibling-checkout: `../strategy` (или `strategy-path`) существует и
  слой `fsd/<surface>/` заведён. Нет — next-step юзеру: «спроектируй FSD-карту в
  `<org>/strategy` (`/fsd-deep-dive`) и вернись», дальше не идти
- Записать `project-slug` / `strategy-path` / `surface` в `docs/stack/service.md`
- Карта старой версии (без колонок `indexable`/`freshness`) — норма: `indexable`
  выводится из `guard`, `freshness` — из источника контента, исключения пишутся
  строкой в `docs/stack/rendering.md`

### 2. Спроектировать стек → `/stack-deep-dive`

- Скопировать нужные `docs/stack/_templates/*.md` → `docs/stack/*.md`
  (10 обязательных; `api` и `analytics` — по ответу в первой волне)
- `/stack-deep-dive` ведёт волнами поверх дефолтов шаблона
- Gate: все обязательные и все заведённые условные — `status: stable`,
  `Generates` непусты, blocker'ов в `state/` нет

### 3. Развернуть фундамент → `/de-template`

Gate перед запуском: стек `stable`; записи FSD-карты, нужные первому развороту,
`stable`; нет открытых `**blocker**`.

`/de-template` читает stable-артефакты и разворачивает по `Generates`:
переименование пакета, README, идентичность сайта и оператора, политика ПДн без
плейсхолдеров, prune неиспользуемой части reference-набора. Финал — зелёный
`pnpm check`.

### 4. Свои страницы и коллекции → `/scaffold`

По stable-записям FSD-карты (`<strategy-path>/docs/projects/<slug>/fsd/<surface>/`):

- `entities.md` → `/scaffold collection` (коллекция контента) или `entity`
- `pages.md` → `/scaffold page` (ru + en) и `/scaffold route` (служебный маршрут)
- `features.md` → `/scaffold feature`
- `widgets.md` → `/scaffold widget` (блок на ≥ 2 страницах)

После каждого — `pnpm typecheck && pnpm lint && pnpm steiger` зелёные.

### 5. Наполнить и выпустить

- Первые записи — `/content`
- Проверить выдачу — `/seo-audit`
- Образ в registry — `/release` (handoff в `<org>/infra`)

## Что init-service НЕ делает

- ❌ Не проектирует FSD-карту (она в `<org>/strategy`) и не проектирует стек сам
- ❌ Не правит фундамент руками — это `/de-template`
- ❌ Не запускает `/de-template` до зелёных gate'ов
- ❌ Не пропускает проектирование ради «быстро сгенерить»

## Anti-patterns

- ❌ Писать `src/` до того как артефакты заполнены
- ❌ Удалять reference-набор до того как свои страницы готовы (теряешь живой образец)
- ❌ Дублировать процедуру deep-dive внутри этого скилла
