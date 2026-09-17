---
id: stack.runtime
kind: runtime
name: runtime
status: draft
---

# runtime

## Node

- Версия dev: `24 LTS`
- Менеджер: `pnpm 10` через corepack
- ESM-only (`"type": "module"`)

## Browser

- Target: `es2024`
- Поддержка: _Chrome ≥ 110, Firefox ≥ 110, Safari ≥ 16.4, Edge ≥ 110_
- Polyfills: _нужны ли (обычно нет на 2026)_

## React

- Версия: `19.2.x`
- Compiler: `1.0` — полный проход (`compilationMode: 'all'`)
- View Transitions: _включаем для навигаций?_

## Generates

- `.nvmrc`
- `package.json#engines`
- `tsconfig.json#target` / `vite.config.ts#build.target`

## Открытые вопросы

- _что_
