---
description: UI — .astro-компоненты на собственном токен-слое, тема через light-dark()/data-scheme, scoped-CSS только для layout, 0 JS по умолчанию.
globs: ["src/**/ui/**", "src/app/layouts/**", "src/app/styles/**", "src/shared/ui/**"]
---

# UI-компоненты

Внешней дизайн-системы нет. Примитивы и блоки — `.astro`-компоненты в проекте, без
вендорных UI-китов и их токенов.

## Токены — единственный источник значений

- Только семантические утилиты и переменные из `src/app/styles/index.css`:
  `bg-app-bg`, `text-app-fg`, `text-muted`, `border-divider`, `text-link`, `text-body-md`,
  `text-heading-xl`, `rounded-control`, `max-w-content`, `--scheme-*`
- ❌ сырые цвета/размеры в компонентах (`bg-[#18181b]`, `text-zinc-500`, inline `style`)
  и в `<meta>`/атрибутах; нужна новая семантика — новый токен в `index.css`
- Тема: `light-dark()` + `color-scheme` в токен-слое — системная без JS; явный выбор —
  `data-scheme="light|dark"` на `<html>`

## Scoped `<style>`

Только для layout (grid, позиционирование); значения — через утилиты или `var(--…)`.
Цвета и типографика в scoped-CSS не задаются.

## 0 JS по умолчанию

Компонент без `<script>`. Клиентский `<script>` — остров, только по решению: строка
бюджета в `.size-limit.cjs`; его импорты ESLint проверяет как обычный модуль.

## Где что

| что | где |
|---|---|
| слайс-локальный UI | `ui/`-сегмент слайса |
| переиспользуемый примитив | `shared/ui/<name>/{<name>.astro,index.ts}` — своя папка, explicit re-export |
| каркас сайта | `widgets/site-header`, `widgets/site-footer` |
| документ-шелл: `<html lang>`, `<head>` со `<slot name="head">`, лендмарки, skip-link | `app/layouts/document.astro` |

Форматирует `.astro` Prettier (`pnpm format`), линтят Biome и ESLint
(`astro/jsx-a11y/*`: `alt`, `lang`, заголовки, интерактив без клавиатуры).
