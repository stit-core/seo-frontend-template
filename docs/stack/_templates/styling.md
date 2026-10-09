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
| классы-компоненты | `.button`, `.field`, `.note`, `.section-title`, `.prose` |

Проектная палитра — значения этих же ролей: _фирменные цвета_. Новая семантика — роль в
файле токенов и строка слоя сопоставления, а не сырой цвет в компоненте.

## Тема

| поле | значение |
|---|---|
| темы | блоки файла токенов; поле `THEME` (`shared/config/site.ts`) — тема по умолчанию и кнопка выбора |
| системная | блок `prefers-color-scheme` файла токенов — без JS |
| явный выбор | `data-theme="light\|dark"` на `<html>`, хранится в cookie `scheme` |
| остров | один инлайн-`<script>` в `<head>` (`features/theme`) — применяет выбор до первой отрисовки; печатается при `THEME.switcher` |
| оси помимо схемы | _нет_ (`data-brand`, `data-density` — по потребности) |

## Шрифты

| поле | значение |
|---|---|
| основной | системный стек `system-ui` — ноль байт по проводу и ноль CLS |
| моноширинный | системный `ui-monospace` |
| веб-шрифт | _нет_ |

Веб-шрифт — проектное решение и перф-риск: только self-host, только WOFF2, обязательный
сабсет кириллицы, preload не больше одного файла активной локали, бюджет ≤ 60 КБ.
Astro Fonts API (`subsets: ['cyrillic','latin']`) — способ его подключить.

## Типографика, отступы и размеры

| поле | значение |
|---|---|
| роли текста | `--type-<роль>-{size,leading,weight,tracking}` → одна утилита `text-<роль>`: `page-title`, `page-title-lg`, `section`, `card-title`, `lead`, `body`, `body-long`, `body-strong`, `label`, `helper`, `button`, `code` |
| отступы | шкала `--space-3xs…5xl` (`mt-md`, `gap-x-lg`) и ритм страницы `--rhythm-page-x`, `--rhythm-section-s\|m\|l`, `--rhythm-stack-display`; числовой шкалы Tailwind нет |
| размеры и радиусы | `--size-control-md`, `--size-icon-md`, `--size-thumbnail`, `--size-term`; `--radius-xs…lg` → `rounded-focus\|code\|control\|panel` |
| линии | `--border-width-default\|strong\|focus`, `--border-offset-focus\|underline` |
| ширина контейнера | `--size-measure` (колонка чтения, ≈ 72 знака), `--size-container` (страница: шапка, подвал), `--size-container-wide` (широкая сетка) → `max-w-<роль>` только в примитиве секции `shared/ui/section`: страницу собирают секции (`width`, `tone`, `rhythm`) |
| границы раскладки | `--breakpoint-tablet` (40rem), `--breakpoint-desktop` (60rem) → варианты `tablet:`, `desktop:` |
| scoped `<style>` | только layout (grid, позиционирование); цвета и типографика — утилитами |

## Бюджет

| что | лимит |
|---|---|
| CSS всего сайта | ≤ 15 КБ gzip (одна таблица, `.size-limit.cjs`) |
| HTML страницы | ≤ 20 КБ gzip (главная), ≤ 25 КБ gzip (запись) |

## Generates

- `src/app/styles/tokens.css` — значения дизайн-системы: роли, темы
- `src/app/styles/index.css` — слой сопоставления, классы-компоненты
- `astro.config.ts` — плагин Tailwind
- `.size-limit.cjs` — бюджеты CSS и HTML
- `src/features/theme/**` — остров темы и переключатель (если тема нужна)

## Открытые вопросы

- _что_
