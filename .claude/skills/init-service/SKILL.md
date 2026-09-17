---
name: init-service
description: Оркестратор онбординга потребителя шаблона — ведёт путь форк → привязка к FSD-карте из соседнего <org>/strategy (проектируется там его /fsd-deep-dive) → проектирование стека (stack-deep-dive) → de-template → /scaffold собственных слайсов, пока проект не перестанет помнить про шаблон. Активируй когда юзер форкнул spa-frontend-template и говорит "/init-service", "онбординг", "развернуть SPA из шаблона", "с чего начать новый фронтенд", или когда видишь свежий форк (package.json#name всё ещё @stit/spa-frontend-template, reference-слайсы auth/profile/todos/theme на месте). Сам не проектирует и не де-темплейтит — чейнит специализированные скиллы по порядку.
---

# Skill: init-service (онбординг-оркестратор)

Дирижёр пути «форк шаблона → свой проект». Не делает проектирование/генерацию
сам, а **ведёт по этапам и чейнит** специализированные скиллы. Один проход
доводит до проекта, который ничего не помнит про шаблон.

Полное описание пути для человека — `docs/getting-started.md`; этот скил его
исполняет.

## Когда применять

- "/init-service" / «онбординг» / «развернул форк, что дальше»
- Свежий форк: `package.json#name` ещё `@stit/spa-frontend-template`,
  reference-слайсы `features/auth`, `pages/profile`, `pages/todos`,
  `features/theme` на месте
- Юзер: «хочу развернуть свой SPA из шаблона»

## Когда НЕ применять

- Проект уже де-темплейтизирован (своё имя пакета, reference-слайсы удалены) —
  это обычный день-в-день, иди в `/smartdev`
- Юзер хочет добавить слайс/page/widget в уже-свой проект — это `/scaffold`,
  не онбординг

## Pre-flight

- [ ] Форк создан, репо склонирован (Gitea → **Use this template** → `<org>/<service>-frontend`)
- [ ] `pnpm install` прогнан
- [ ] `pnpm prepare` поставил lefthook-хуки
- [ ] Если нет — подскажи шаги 0 из `docs/getting-started.md` и дальше не иди

## Этапы (чейнить по порядку, не делать самому)

### 1. Привязаться к FSD-карте в `<org>/strategy`

- FSD-карта поверхности проектируется в соседнем `<org>/strategy`
  (`docs/projects/<slug>/fsd/<surface>/`, его `/fsd-deep-dive`) — **не здесь**
- Проверить sibling-checkout: `../strategy` (или `strategy-path`) существует
  и слой `fsd/<surface>/` заведён. Нет — next-step юзеру: «спроектируй
  FSD-карту в `<org>/strategy` (/fsd-deep-dive) и вернись», дальше не идти
- Записать `project-slug` / `strategy-path` / `surface` в
  `docs/stack/service.md` — по ним `/scaffold` и `/de-template` найдут карту
- Gate: записи карты, нужные первому развороту, — `status: stable`

### 2. Спроектировать стек → `/stack-deep-dive`

- Скопировать шаблоны `docs/stack/_templates/*.md` в `docs/stack/*.md`
- `/stack-deep-dive` ведёт волнами поверх базовых выборов шаблона
- Gate: все 8 артефактов `status: stable`, `Generates` непусты

### 3. Развернуть фундамент → `/de-template`

- Gate перед запуском: stack `stable`; stable-записи FSD-карты в strategy;
  нет открытых `**blocker**`-вопросов
- `/de-template` читает stable-артефакты и разворачивает по `Generates`:
  - `package.json#name`
  - `README.md`
  - `docker/nginx-entrypoint.sh` env defaults
  - `vite.config.ts#proxy.target` (если real-режим)
  - Prune reference-слайсов (`auth`, `profile`, `todos`, `theme`)
  - Удаление `docs/getting-started.md` (META)

### 4. Свои слайсы → `/scaffold`

Когда фундамент развёрнут — чейнить `/scaffold` под каждый stable-слайс
FSD-карты (`../strategy/docs/projects/<slug>/fsd/<surface>/`):

- `entities/*` — из `entities.md` карты
- `features/*` — из `features.md`
- `widgets/*` — из `widgets.md`
- `pages/*` — из `pages.md`

### 5. Финал

`pnpm check` зелёный → проект больше не помнит про шаблон. Сообщи юзеру:
онбординг закрыт, дальше обычный флоу через `/smartdev`. `docs/getting-started.md`
(META) удалён.

## Что init-service НЕ делает

- ❌ Не проектирует FSD-карту сам и не правит её — она в `<org>/strategy`
  (его `/fsd-deep-dive`); стек — `/stack-deep-dive` здесь
- ❌ Не правит фундамент руками и не де-темплейтит — это `/de-template`
- ❌ Не запускает `/de-template` до зелёных gate'ов
- ❌ Не пропускает проектирование ради «быстро сгенерить» — артефакты первичны

## Anti-patterns

- ❌ Кодить `src/` до того как спроектированы артефакты
- ❌ Удалять reference-слайсы до того как свои готовы (теряешь живой образец)
- ❌ Дублировать процедуру deep-dive внутри этого скилла
