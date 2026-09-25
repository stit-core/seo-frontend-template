# Родство с `spa-frontend-template`

Два канонических шаблона экосистемы делят **обвязку, а не код**: общей npm-библиотеки
нет, потребителю merge апстрима недоступен в принципе (Gitea «Use this template»
схлопывает историю). Синхронизируются только два канонических репозитория — этим
чеклистом и advisory-скриптом `pnpm kin:diff` (вне `pnpm check`): он сверяет корзину
«идентично» с sibling-checkout `../spa-frontend-template` (путь — `SPA_TEMPLATE_PATH`).
Списки ниже — единственный источник для скрипта: он читает блоки `identical` и
`near-identical` из этого файла.

Канонический источник общих файлов — SPA-шаблон; обратный бэкпорт — для идей,
рождённых здесь (см. последний раздел).

## Идентично

Расхождение в этой корзине — ошибка: `kin:diff` завершается ненулевым кодом.

```identical
.claude/rules/forward-only.md
.claude/rules/comments.md
.claude/settings.json
.claude/skills/plan/SKILL.md
.claude/skills/plan/references/plan-template.md
scripts/validate-plan.sh
.commitlintrc.cjs
.npmrc
.nvmrc
LICENSE
src/shared/lib/index.ts
src/shared/lib/cn.ts
src/shared/lib/cn.test.ts
src/shared/lib/invariant.ts
src/shared/lib/invariant.test.ts
```

## Почти идентично

Одинаковая роль и форма, содержание адаптировано под Astro/Node. `kin:diff`
показывает объём расхождения, но не считает его ошибкой.

```near-identical
CLAUDE.md
README.md
SECURITY.md
.claude/plans/backlog.md
.claude/skills/plan/references/repo.md
.claude/rules/fsd-architecture.md
.claude/rules/env-local.md
.claude/rules/tests-pipeline.md
.claude/rules/shared-ui.md
src/app/styles/index.css
biome.json
eslint.config.js
steiger.config.ts
vitest.config.ts
lefthook.yml
.size-limit.cjs
.gitignore
.dockerignore
.env.example
e2e/playwright.config.ts
docs/README.md
docs/reference/deployment.md
```

- `src/app/styles/index.css` — те же имена токенов и семантика; тема через `light-dark()`
  + `color-scheme` (системная без JS, `data-scheme` переключает).
- Конфиги гейта — та же цепочка `typecheck → lint → format:check → test → steiger →
  build → size` плюс `check:gate`; внутри шагов — инструменты Astro.
- `CLAUDE.md`, `SECURITY.md`, правила, `docs/` — та же форма (ядро + роутер, path-scoped
  rules, карта документации); `SECURITY.md` — тот же контакт и процесс, скоуп под
  Node-образ и env контейнера.

## Расходится

Общего нет — у сайта другая природа рантайма: `astro.config.ts`, `tsconfig.json`
(`astro/tsconfigs/strictest`), `docker/*` (Node-образ, штамповка origin, обёртка
сервера), `src/**` кроме `shared/lib`, `.gate-fixtures/`, `scripts/*`, `.prettierrc.json`
(только `*.astro`), `e2e/*.spec.ts`, бюджеты `.size-limit.cjs` (вес HTML/CSS вместо
вендорных чанков).

## Бэкпорт-кандидаты в SPA-шаблон

- `eslint-plugin-boundaries` с `settings['import/resolver']` (без резолвера правило —
  тихий no-op на `@/`-импортах) и `no-restricted-imports` по `@/<layer>/*/*`.
- ESLint 10 (`@eslint/js@10` peer-требует `eslint ^10`).
- Негативные фикстуры гейта `.gate-fixtures/` + `check:gate`.
- Тема через `light-dark()` в токен-слое.
- `toThrowError` → `toThrow` в `invariant.test.ts` (в Vitest 5 алиас помечен deprecated).
