# docs/ — карта документации

Документация — **source of truth** для всего, что разворачивается в коде. Платформенные
артефакты (`docs/stack/`) заполняет `/stack-deep-dive` до `status: stable`; FSD-карта
живёт в соседнем `<org>/strategy`. По stable-артефактам `/de-template` разворачивает
фундамент, а `/scaffold` — отдельные страницы и коллекции.

## Слои

| каталог | вопрос | вход |
|---|---|---|
| [`stack/`](./stack/README.md) | **на какой платформе крутится сайт** (12 kinds, 2 из них условные) | `/stack-deep-dive` |
| [`reference/`](./reference/) | **как устроено то, что уже есть** (стационарные доки) | вручную |

## Reference

| документ | о чём |
|---|---|
| [`reference/architecture.md`](./reference/architecture.md) | FSD под Astro: слои, роутинг как слой, public API, кто держит границы |
| [`reference/rendering.md`](./reference/rendering.md) | режимы `static` / `dynamic`, карта маршрутов, кеш-заголовки, абсолютные URL, рецепт `cached` |
| [`reference/seo.md`](./reference/seo.md) | что шаблон держит сам, чек-лист страницы, три контура staging, чем проверяется |
| [`reference/deployment.md`](./reference/deployment.md) | Node-образ, штамповка `SITE_URL`, `server.mjs`, env-контракт |
| [`reference/observability.md`](./reference/observability.md) | JSON-лог, `X-Request-Id`, `/healthz`, Sentry по DSN, чем меряется скорость |
| [`reference/ecosystem.md`](./reference/ecosystem.md) | место сайта среди шаблонов stit, флоу (из корня проекта или прямой заход), контракты с соседями, STOP на image-in-registry |
| [`reference/infra-handoff.md`](./reference/infra-handoff.md) | контракт сервиса `site` с `<org>/infra`: что гарантирует образ, требования к среде и edge (Traefik, CrowdSec, журнал доступа), боты, приёмка |

## Для потребителя шаблона

- [`getting-started.md`](./getting-started.md) — путь «форк → свой сайт» (META: `/de-template` его удаляет)
- [`contributing.md`](./contributing.md) — устройство `.claude`-системы (наследуется форком)

## Правила и процедуры

Инварианты живут не здесь, а рядом с кодом: `.claude/rules/*.md` подгружаются
автоматически, когда агент читает файл под их `paths` (`forward-only` — всегда). Процедуры —
`.claude/skills/*`: `/smartdev`, `/plan`, `/init-service`, `/stack-deep-dive`,
`/de-template`, `/scaffold`, `/content`, `/seo-audit`, `/release`. Карта тем —
`CLAUDE.md § Карта: где что`.

## Внешние артефакты

Проектирование живёт в соседнем `<org>/strategy` (форк `business-strategy-template`,
sibling-checkout; резолв — поля `project-slug` / `strategy-path` / `surface` в
`docs/stack/service.md`, дефолт `../strategy`). Всё в `docs/projects/<slug>/`:

- **`fsd/<surface>/`** — карта слайсов поверхности, **первичный вход `/scaffold` и
  `/de-template`**; проектируется там (`/fsd-deep-dive`), здесь read-only;
- `vision.md` и продуктовые таблицы — в корне папки проекта;
- `interface/<surface>/` — кто, в какой ситуации, с какими данными: из этого растут
  тексты страниц;
- `screens/<surface>/` — экраны и блоки: композиция страницы;
- `services/<svc>/domains/<ctx>/` — доменные артефакты бэкенда, если он есть.

Контракт read-only и односторонний: этот репо в strategy не пишет.

## Forward-only

Все артефакты описывают текущее состояние. Без «было/стало», без changelog'ов внутри
текста, без следов отменённых решений. История — в `git log`.
