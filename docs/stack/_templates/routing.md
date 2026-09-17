---
id: stack.routing
kind: routing
name: routing
status: draft
---

# routing

## TanStack Router

- Версия: `^1.95`
- Mode: **file-based** через `@tanstack/router-vite-plugin`
- Routes dir: `src/pages/`
- Generated tree: `src/app/router/routeTree.gen.ts` (коммитится)
- Default preload: `intent`
- Scroll restoration: on

## Layouts

| layout | использует pages |
|---|---|
| `__root` (AppShell) | _список_ |
| _custom_ | _список_ |

## Guards

| guard | где | редирект |
|---|---|---|
| `authenticated` | `/profile`, `/todos` | `/login` |
| _other_ | _где_ | _куда_ |

## Generates

- `vite.config.ts#plugins[TanStackRouterVite]`
- `src/app/router/index.ts` — `createRouter`
- `src/pages/__root.tsx` — корневой layout

## Открытые вопросы

- _что_
