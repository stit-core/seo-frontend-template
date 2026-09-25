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
| name | _<site>_ |
| scope | `@<org>/site` |
| repository | `git@git.stit.tech:<org>/site.git` |
| image registry | `git.stit.tech/<org>/site` |
| `infra-svc` | `site` — по нему `/release` печатает `make bump SVC=site TAG=` |
| version scheme | `semver` (`vX.Y.Z`); `:latest`/`:edge` не выпускаются |
| owners | _кто_ |

## Домены

| среда | хост | закрыт |
|---|---|---|
| prod | `https://<domain>` — канонический origin, он же `SITE_URL` | нет |
| staging | `https://staging.<domain>` | Traefik `basicAuth` + `X-Robots-Tag`, `ROBOTS_POLICY=noindex` |

Канонический хост один: `www` → apex и `http` → `https` разворачивает Traefik.

## Связь с экосистемой

Sibling-checkout'ы форков одной org (`~/git/<org>/…`):

- strategy: `git.stit.tech/<org>/strategy` — design SoT; поля резолва ниже
- infra: `git.stit.tech/<org>/infra` — runtime проекта и операционный хаб (rollout: `make bump SVC=site TAG=` там)
- backend: `git.stit.tech/<org>/backend` (если сайт берёт данные извне)
- frontend: `git.stit.tech/<org>/frontend` — приложение за логином (если есть)

| поле | значение |
|---|---|
| project-slug | _папка продукта в `<strategy-path>/docs/projects/<slug>/`_ |
| strategy-path | `../strategy` _(дефолт; override — свой путь)_ |
| surface | _slug поверхности из `surface.md` strategy — какую поверхность реализует этот сайт_ |

Чтение strategy — read-only и одностороннее: сайт в неё не пишет.

## Generates

- `package.json` — `name`, `version`
- `README.md` — шапка проекта
- `/release` — registry-путь образа и `make bump SVC=<infra-svc>` в handoff
- `src/shared/config/site.ts` — `SITE_NAME`, `SITE_SAME_AS` (репозиторий, профили)

## Открытые вопросы

- _что_
