---
id: stack.dependencies
kind: dependencies
name: dependencies
status: draft
---

# dependencies

## Базовая подборка (наследуется из шаблона)

| зона | пакет | версия (≥) |
|---|---|---|
| Bundler | `vite` | 8 |
| React | `react`, `react-dom` | 19.2 |
| Router | `@tanstack/react-router` | 1.95 |
| Query | `@tanstack/react-query` | 5 |
| Forms | `@tanstack/react-form` | 1 |
| State | `zustand` | 5 |
| HTTP | собственный fetch-враппер (`shared/api/client.ts`), без пакета | — |
| Validation | `zod` | 4 |
| i18n | `@lingui/core`, `@lingui/react` (runtime-only) | 5 |
| Styling | `tailwindcss` | 4 |
| Mock | `msw`, `@mswjs/data`, `@faker-js/faker` | 2 / 0.16 / 10 |
| Observability | `@sentry/react`, `web-vitals` | 8 / 4 |
| Testing | `vitest`, `@testing-library/*`, `vitest-axe`, `playwright` | 4 / latest |
| Lint | `@biomejs/biome`, `eslint`, `typescript-eslint`, `steiger` | 2 / 9 / 8 / 0.6 |
| Compiler | `babel-plugin-react-compiler` + правила в `eslint-plugin-react-hooks` | 1 / 7 |

## Проектные добавления

| пакет | назначение | reasoning |
|---|---|---|
| _name_ | _что делает_ | _почему добавили_ |

## Запрещено

- ❌ Дублирование функционала базовых пакетов (axios вместо своего fetch-враппера, Redux вместо Zustand+Query)
- ❌ Внешние UI-киты / DS (Material UI, shadcn, chakra…) — компоненты пишутся в проекте
- ❌ Полифиллы без явной причины (target es2024 покрывает 99%)

## Generates

- `package.json#dependencies` / `package.json#devDependencies`

## Открытые вопросы

- _что_
