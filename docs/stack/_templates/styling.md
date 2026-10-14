---
id: stack.styling
kind: styling
name: styling
status: draft
---

# styling

## Источники

| поле | значение |
|---|---|
| токен-слой | `src/app/styles/tokens.css` — значения дизайн-системы в форме производного `ds_build` (роли, темы, сокращённое движение); `src/app/styles/index.css` — слой сопоставления «утилита → роль» (Tailwind v4 `@theme inline`) и классы-компоненты |
| CSS-фреймворк | Tailwind v4 через `@tailwindcss/vite` |
| компоненты | свои `.astro` на этом токен-слое; вендорные UI-киты не подключаются |
| подсветка кода | `markdown.syntaxHighlight: false` — Shiki инлайнит сырые цвета мимо токенов |

## Палитра и семантика

| группа | роли файла токенов |
|---|---|
| поверхности | `--color-bg-canvas`, `--color-bg-surface`, `--color-bg-subtle` |
| границы | `--color-border-subtle` (разделитель), `--color-border-strong` (поле, не ниже 3:1) |
| текст | `--color-text-primary`, `--color-text-secondary`, `--color-text-on-accent` |
| акцент и действие | `--color-accent-bg`, `--color-accent-border`, `--color-accent-solid`, `--color-accent-solid-hover`, `--color-accent-text`, `--color-focus-ring` |
| ошибка | `--color-danger-bg`, `--color-danger-border`, `--color-danger-text` |
| классы-компоненты | `.button`, `.field`, `.note`, `.section-title`, `.prose`, `.touch-target` (цель касания 44 px при `pointer: coarse`), `.honeypot` (ловушка формы) |

Проектная палитра — значения этих же ролей: _фирменные цвета_. Новая семантика — роль в
файле токенов и строка слоя сопоставления, а не сырой цвет в компоненте.

## Тема

| поле | значение |
|---|---|
| темы | блоки файла токенов; поле `THEME` (`shared/config/site.ts`) — тема по умолчанию и кнопка выбора |
| системная | блок `prefers-color-scheme` файла токенов — без JS |
| явный выбор | `data-theme="light\|dark"` на `<html>`, хранится в `localStorage` (ключ `theme`; движение — `data-motion` и ключ `motion`) |
| остров | один инлайн-`<script>` в `<head>` (`features/preferences`) — ставит выбор темы и движения до первой отрисовки; где он стоит, решает его строка `ISLANDS` (при кнопке темы или переключателе движения — весь сайт) |
| оси помимо темы и движения | _нет_ (`data-brand`, `data-density` — по потребности) |

## Шрифты

| поле | значение |
|---|---|
| гарнитуры ролей | стеки файла токенов: семейство с файлом — `var(--font-<ключ>, <стек>)` (форма производного CSS strategy), системное — литералом |
| файлы | список `src/app/styles/fonts.ts` — строки шрифтов манифеста продукта strategy (семейство, насыщенность, начертание, файл WOFF2 с лицензией; `unicodeRange` — подмножество, `preload` — начертание первого экрана) |
| подключение | Astro Fonts API, локальный провайдер: `@font-face` с метрическим фолбэком, `<Font>` в оболочке |
| шаблон | _список пуст_ — системные стеки, 0 байт шрифтов |

Веб-шрифт — решение ДС и перф-риск: только self-host и WOFF2, у кириллицы — своё подмножество,
preload — не больше двух файлов на странице (`seo:check`), вес — строка `.size-limit.cjs` с
первым файлом; колонку чтения форк перемеряет под ширину знака своего шрифта (rule `shared-ui`).

## Типографика, отступы и размеры

| поле | значение |
|---|---|
| роли текста | `--type-<роль>-{family,size,leading,weight,tracking}` → одна утилита `text-<роль>`: `page-title`, `page-title-lg`, `section`, `card-title`, `lead`, `body`, `body-long`, `body-strong`, `label`, `helper`, `button`, `code` |
| отступы | шкала `--space-3xs…5xl` (`mt-md`, `gap-x-lg`) и ритм страницы `--rhythm-page-x`, `--rhythm-section-s\|m\|l`, `--rhythm-stack-display`; числовой шкалы Tailwind нет |
| размеры и радиусы | `--size-control-md`, `--size-icon-md`, `--size-thumbnail`, `--size-term`; `--radius-xs…lg` → `rounded-focus\|code\|control\|panel` |
| линии | `--border-width-default\|strong\|focus`, `--border-offset-focus\|underline` |
| ширина контейнера | `--size-measure` (колонка чтения: строка тела — около 60 знаков и не длиннее 75), `--size-container` (страница: шапка, подвал), `--size-container-wide` (широкая сетка) → `max-w-<роль>` только в примитиве секции `shared/ui/section`: страницу собирают секции (`width`, `tone`, `rhythm`) |
| границы раскладки | `--breakpoint-tablet` (40rem), `--breakpoint-desktop` (60rem) → варианты `tablet:`, `desktop:` |
| scoped `<style>` | только layout (grid, позиционирование); цвета и типографика — утилитами |

## Бюджет

| что | лимит |
|---|---|
| CSS всего сайта | ≤ 6,5 КБ brotli (одна таблица, `.size-limit.cjs`) |
| HTML страницы | ≤ 5 КБ brotli (самая тяжёлая страница сборки) |
| шрифты ДС | строка с первым файлом: факт с запасом не меньше 10 %, у шаблона — 0 |

## Generates

- `src/app/styles/tokens.css` — значения дизайн-системы: роли, темы
- `src/app/styles/index.css` — слой сопоставления, классы-компоненты
- `src/app/styles/fonts.ts` — список шрифтов ДС: файлы и начертания для Fonts API
- `astro.config.ts` — плагин Tailwind
- `.size-limit.cjs` — бюджеты CSS, HTML и шрифтов
- `src/features/preferences/**` — остров предпочтений и кнопки выбора темы и движения

## Открытые вопросы

- _что_
