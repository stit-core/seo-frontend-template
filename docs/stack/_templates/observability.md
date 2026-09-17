---
id: stack.observability
kind: observability
name: observability
status: draft
---

# observability

## Sentry

- SaaS / self-hosted GlitchTip: _какой_
- DSN: через `window.__APP_CONFIG__.SENTRY_DSN`
- Активация: dynamic import при непустом DSN
- traces sample rate: `0.1`
- session replay: _нужен ли (privacy-чувствительно)_

## Web Vitals

- LCP / INP / CLS / FCP / TTFB
- dev: `console.info`
- prod: Sentry если активен, иначе noop

## Generates

- `src/shared/observability/index.ts` — Sentry + web-vitals
- `docker/nginx-entrypoint.sh` — env `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `RELEASE`

## Открытые вопросы

- _что_
