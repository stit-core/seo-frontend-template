---
name: stack-deep-dive
description: Проектирование стека SPA — заполняет 8 артефактов docs/stack/{service,runtime,config,routing,api,styling,observability,dependencies}.md поверх базовых выборов шаблона, через волны интерактивных вопросов. Активируй когда юзер говорит "/stack-deep-dive", "спроектируй стек", "что в платформе", или когда оркестратор /init-service пришёл к этапу 2.
---

# Skill: stack-deep-dive

Интервьюер по платформе. Базовые выборы шаблона уже зафиксированы (Vite 8,
React 19.2, TanStack, Tailwind v4, MSW, …) — здесь решаем **проектные**
вариации: имя сервиса, registry, конкретный список env, какие проектные deps.

## Когда применять

- "/stack-deep-dive"
- Юзер: «настроим стек», «выберем версии», «что в платформе»
- Оркестратор `/init-service` пришёл к этапу 2

## Pre-flight

- [ ] FSD-карта поверхности в `../strategy` (`docs/projects/<slug>/fsd/<surface>/`)
      заведена (хотя бы draft) — `shared-api.md` карты нужен для `stack/api.md`
- [ ] `docs/stack/*.md` существуют (или скопированы из `_templates/`)

## Порядок (от внутреннего к внешнему)

1. **`service.md`** — имя сервиса, scope, repo URL, registry, owners
2. **`runtime.md`** — node, browser target, React Compiler mode
3. **`config.md`** — все env (runtime + build-time), их дефолты, источники
4. **`routing.md`** — layouts, guards, default preload
5. **`api.md`** — контракт API (zod-схемы), auth scheme, mock-сущности
6. **`styling.md`** — какие оси темизации активны (scheme/brand/density)
7. **`observability.md`** — Sentry SaaS/self-hosted, web-vitals
8. **`dependencies.md`** — проектные добавления вне базовой подборки

Обязательные секции, Generates и anti-patterns по каждому kind —
`references/field-checklists.md`. Режимы входа (заведение / сырьё /
углубление) и cross-kind drift — `references/workflow-patterns.md`.

## Волны (3-5 за раз)

Те же принципы что у `/fsd-deep-dive`. По каждому артефакту:

1. Подсветить базовые выборы шаблона (что уже зашито)
2. Спросить проектные вариации
3. Заполнить таблицу + `Generates`
4. Открытые вопросы / решения / следующие шаги → `state/<kind>.md`
   (формат — `references/state-format.md`)

## Промоушн draft → stable

См. `references/draft-stable.md`. Контракт зеркалит fsd-deep-dive.

## Что НЕ делать

- ❌ Спорить о базовых выборах шаблона (Vite vs Webpack, TanStack vs RR) —
  это решено в BLUEPRINT, обсуждение — отдельный issue в шаблонном репо
- ❌ Не активировать `/de-template` до stable всех 8
- ❌ Не добавлять проектные deps без записи в `dependencies.md`
