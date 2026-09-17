---
id: stack.service
kind: service
name: service
status: draft
---

# service

## Идентичность

| поле | значение |
|---|---|
| name | _<service>_ |
| scope | `@<org>/frontend` |
| repository | `git@git.stit.tech:<org>/frontend.git` |
| image registry | `git.stit.tech/<org>/frontend` |
| version scheme | _semver / git-sha_ |
| owners | _кто_ |

## Связь с экосистемой

Sibling-checkout'ы форков одной org (`~/git/<org>/…`):

- strategy: `git.stit.tech/<org>/strategy` — design SoT; поля резолва ниже
- backend: `git.stit.tech/<org>/backend` (если есть)
- infra: `git.stit.tech/<org>/infra` — деплой-звено (rollout: `make bump SVC=frontend TAG=` там)

| поле | значение |
|---|---|
| project-slug | _папка продукта в `<strategy-path>/docs/projects/<slug>/`_ |
| strategy-path | `../strategy` _(дефолт; override — свой путь)_ |
| surface | _slug SPA-поверхности из `surface.md` strategy — какую поверхность реализует этот фронт_ |

## Generates

- `package.json` — `name`, `version`
- `README.md` — шапка проекта
- `docker/Dockerfile` — `LABEL` метаданные

## Открытые вопросы

- _что_
