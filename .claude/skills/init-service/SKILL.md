---
name: init-service
description: Оркестратор онбординга форка ssr-frontend-template — ведёт путь форк → привязка к FSD-карте из соседнего <org>/strategy (её проектирует там /fsd-deep-dive) → стек (/stack-deep-dive) → /de-template → /scaffold своих страниц и коллекций, пока проект не перестанет помнить про шаблон. Применяй на свежем форке (pnpm check:identity красный: имя пакета шаблона, демо-идентичность и демо-факты оператора на месте) и когда юзер спрашивает, как превратить шаблон в свой сайт или с чего начать. Сам не проектирует и не де-темплейтит — чейнит специализированные скиллы по порядку.
---

# Skill: init-service (онбординг-оркестратор)

Дирижёр пути «форк шаблона → свой сайт». Не проектирует и не генерирует сам —
**ведёт по этапам и чейнит** специализированные скиллы. Один проход доводит до
проекта, который ничего не помнит про шаблон.

Путь для человека — `docs/getting-started.md`; этот скил его исполняет.

## Когда применять

- «/init-service» / «онбординг» / «развернул форк, что дальше»
- Свежий форк — `pnpm check:identity` красный: в файлах форка лицо шаблона — имя пакета, `SITE_NAME` и
  профили `src/shared/config/site.ts`, бриф и демо-факты оператора `strategy/`, знак, иконки и превью
  `public/`, демо-записи коллекций и строки `content/redirects.yaml`

## Когда НЕ применять

- Проект уже развёрнут (`pnpm check:identity` зелёный: лица шаблона в файлах форка нет) — это
  обычный день-в-день, иди в `/smartdev`
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
- Колонок `indexable`/`freshness` в FSD-карте нет: `indexable` выводится из `guard`,
  `freshness` — из источника контента, исключения пишутся строкой в
  `docs/stack/rendering.md`

### 2. Спроектировать стек → `/stack-deep-dive`

- Скопировать нужные `docs/stack/_templates/*.md` → `docs/stack/*.md`
  (10 обязательных; `api` и `analytics` — по ответу в первой волне)
- `/stack-deep-dive` ведёт волнами поверх дефолтов шаблона
- Gate: `pnpm check:stack --stable` зелёный — обязательные и заведённые условные `stable`, в каждой
  секции формы решение; blocker'ов в `state/` нет

### 3. Развернуть фундамент → `/de-template`

Gate перед запуском: стек `stable`; записи FSD-карты, нужные первому развороту,
`stable`; нет открытых `**blocker**`.

`/de-template` читает stable-артефакты и разворачивает по `Generates`:
переименование пакета, README, идентичность сайта и оператора, политика ПДн без
демо-фактов, prune неиспользуемой части reference-набора. Финал — зелёный
`pnpm check`.

### 4. Свои страницы и коллекции → `/scaffold`

По stable-записям FSD-карты (`<strategy-path>/docs/projects/<slug>/fsd/<surface>/`):

- `entities.md` → `/scaffold collection` (сущность с контентом); сущность без контента — вручную по
  rule `fsd-architecture`
- `pages.md` → `/scaffold page` (ru + en) и `/scaffold route` (служебный маршрут)
- `features.md` → `/scaffold feature`
- блоки секций планов `strategy/site/<поверхность>/plans/` → `/scaffold block` (блок каталога, которого ещё нет
  в `src/widgets/`)

После каждого — `pnpm typecheck && pnpm lint && pnpm steiger` зелёные.

### 5. Наполнить и выпустить

- Первые записи — `/content`
- Проверить выдачу — `/seo-audit`
- Образ в registry — `/release` (handoff в `<org>/infra`)

## Границы

Скилл только ведёт по этапам: FSD-карту проектирует `<org>/strategy`, стек —
`/stack-deep-dive`, фундамент разворачивает `/de-template`; их процедуры здесь не дублируются.

- `/de-template` — только после зелёных gate'ов этапа 3; проектирование не пропускается ради
  «быстро сгенерить», и `src/` не пишется, пока артефакты не заполнены
- reference-набор удаляется после того, как свои страницы готовы: до этого он живой образец
