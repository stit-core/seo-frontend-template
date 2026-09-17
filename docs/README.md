# docs/ — карта документации

Документация — **source of truth** для всего, что разворачивается в коде.
Артефакты платформы (`docs/stack/`) заполняет `/stack-deep-dive` до
`status: stable`; FSD-карта живёт в соседнем `<org>/strategy` (см. ниже).
По stable-артефактам `/de-template` разворачивает фундамент проекта, а
`/scaffold` — отдельные слайсы.

## Слои

| каталог | вопрос | вход |
|---|---|---|
| [`stack/`](./stack/README.md) | **на какой платформе крутится фронт** (8 артефактов стека) | `/stack-deep-dive` |
| [`reference/`](./reference/) | **архитектура и устройство** (стационарные доки) | вручную |

## Внешние артефакты

Проектирование живёт в соседнем `<org>/strategy` (форк
`business-strategy-template`, sibling-checkout; резолв — поля
`project-slug`/`strategy-path`/`surface` в `docs/stack/service.md`, дефолт
`../strategy`); всё в `docs/projects/<slug>/` этого соседа:

- **`fsd/<surface>/`** — FSD-карта этой поверхности (8 файлов слайсов:
  entities · features · pages · widgets · app · shared-*) — **первичный
  вход `/scaffold` и `/de-template`**; проектируется там (`/fsd-deep-dive`
  strategy-репо), здесь read-only.
- `vision.md` + таблицы user/capability/surface/… — product-файлы в корне
  папки проекта.
- `interface/<surface>/` — who, stage, situation, zone, block, ux-substrate,
  data-items (контекст).
- `services/<svc>/domains/<ctx>/` — DDD-артефакты бэкенда (если есть).
- `screens/<surface>/` — flow, screen, block, shell (контекст композиции).

Контракт read-only и односторонний: этот репо в strategy не пишет.

## Reference

- [`reference/architecture.md`](./reference/architecture.md) — слои, импорты, public API
- [`reference/ecosystem.md`](./reference/ecosystem.md) — место в экосистеме шаблонов (strategy/infra/backend/frontend/bot + корп control-plane)
- [`reference/observability.md`](./reference/observability.md) — Sentry, web-vitals
- [`reference/deployment.md`](./reference/deployment.md) — Dockerfile, nginx, runtime config
- [`getting-started.md`](./getting-started.md) — для потребителя шаблона (META, удаляется в de-template)
- [`contributing.md`](./contributing.md) — устройство `.claude`-системы (наследуется форком)

## Forward-only

Все артефакты — текущее состояние. Без «было/стало», без changelog'ов внутри
текста, без следов отменённых решений. История — в `git log`.
