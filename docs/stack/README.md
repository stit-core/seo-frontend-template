# Stack-артефакты

Дизайн платформы/стека фронта — **первичный source of truth** и **вход для
скила `/de-template`**: 8 singleton-артефактов, по одному на kind,
заполняются через `/stack-deep-dive`.

Где FSD-карта в `../strategy` (`docs/projects/<slug>/fsd/<surface>/`)
отвечает на «как нарезано», `docs/stack/` отвечает на «на какой платформе
крутится»: какой runtime, какие env, какие deps, как версионируется, как
деплоится.

## Kinds

| kind | файл | что описывает |
|---|---|---|
| `service` | `service.md` | имя, scope (`@org/<service>`), repository URL, image registry |
| `runtime` | `runtime.md` | node version, browser support, polyfills, target |
| `config` | `config.md` | runtime config keys, env, секреты-классы |
| `routing` | `routing.md` | TanStack Router конфигурация, layouts |
| `api` | `api.md` | HTTP-клиент, zod-контракты, mock-стратегия, auth scheme |
| `styling` | `styling.md` | токен-слой, темы, layout-конвенции |
| `observability` | `observability.md` | Sentry, web-vitals |
| `dependencies` | `dependencies.md` | внешние deps вне базовой подборки, reasoning |

Каждый артефакт обязан иметь секцию **Generates** — что из него родится.

## Frontmatter

```yaml
id: stack.<name>
kind: <name>
name: <name>
status: draft
```

## Workflow

1. Скопировать `_templates/<kind>.md` → `docs/stack/<kind>.md` (8 штук)
2. `/stack-deep-dive` — заполнить волнами поверх базовых выборов шаблона
3. Промоушн `draft → stable`
4. `/de-template` читает stable-артефакты и разворачивает фундамент

## Gate

`/de-template` не запускается, пока не все 8 артефактов `stable`.
Зеркалит FSD-gate.
