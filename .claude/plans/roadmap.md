# Roadmap

Единый план активной работы. Любое содержательное изменение идёт через секцию
здесь (skill `/plan`). План переживает `/clear`.

## Active

_пусто_

## Backlog

- Cross-repo часть инфры по `docs/reference/infra-handoff.md` (`project-infra-template-compose`:
  `compose/site.yml`, Traefik-роутер `site`, staging `basicAuth` + `X-Robots-Tag`, rate-limit
  `/api/contact`, дефекты infra; `corp-infra-template/docs/ecosystem.md`; `spa-frontend-template`;
  `stit-public`) — отдельными сессиями в тех репо
- Нормализация регистра URL одним 308 (канон I-5) — middleware; сейчас URL чувствительны
  к регистру, canonical = реальный адрес
- Sentry: полный трейсинг требует init до импорта приложения (`docker/server.mjs`); сейчас —
  ленивая инициализация на первом исключении
- Живой SMTP в гейте отсутствует: канал `smtp` проверен только на ветке «не настроен»
- `/legal/privacy` — только ru; английская версия политики при потребности потребителя
- `/de-template` (этап A.10): судьба `docs/reference/infra-handoff.md` в форке — раздел про
  `compose/site.yml` оставить, разделы про другие репо прунить
