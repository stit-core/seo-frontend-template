---
id: stack.styling
kind: styling
name: styling
status: draft
---

# styling

## Источники

- **Токен-слой**: собственный — `src/app/styles/index.css` (Tailwind v4 `@theme`
  + семантические CSS-переменные). Внешней дизайн-системы нет.
- **CSS framework**: Tailwind v4 (Oxide engine, `@theme`)
- **Темизация**: смена `data-scheme` на `<html>` переопределяет значения
  семантических токенов в `index.css`

## Корневой импорт

`src/app/styles/index.css`:

```css
@import "tailwindcss";

@theme { /* типографика, радиусы, шрифты */ }
@theme inline { /* семантические цвета → var(--scheme-*) */ }
```

## Темизация — оси

| ось | значения | управляется через |
|---|---|---|
| `data-scheme` | `light` / `dark` | `features/theme` store |
| `data-brand` | _список_ | _когда_ |
| `data-density` | `comfortable` / `compact` | _когда_ |

## Layout-конвенции проекта

- `shared/ui/` — проектные обёртки с layout-семантикой (PageHeader, DataTable)
- Тонкие, опираются только на семантические токены `index.css`
- Запрет: хардкод сырых цветов/размеров в компонентах — заводи семантический
  токен в `index.css`, потом используй утилиту

## Generates

- `src/app/styles/index.css`
- `vite.config.ts#plugins[tailwindcss]`

## Открытые вопросы

- _что_
