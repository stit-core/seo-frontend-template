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
| токен-слой | собственный — `src/app/styles/index.css` (Tailwind v4 `@theme` + семантические переменные) |
| CSS-фреймворк | Tailwind v4 через `@tailwindcss/vite` |
| внешняя дизайн-система | нет и не заводится: компоненты пишутся в проекте как `.astro` |
| подсветка кода | `markdown.syntaxHighlight: false` — Shiki инлайнит сырые цвета мимо токенов |

## Палитра и семантика

| группа | токены |
|---|---|
| поверхности | `--scheme-app-bg`, `--scheme-surface`, `--scheme-surface-muted`, `--scheme-divider` |
| текст | `--scheme-app-fg`, `--scheme-muted`, `--scheme-link` |
| акцент и действие | `--scheme-accent`, `--scheme-accent-soft`, `--scheme-action-bg`, `--scheme-action-fg`, `--scheme-focus` |
| ошибка | `--scheme-danger`, `--scheme-danger-soft` |
| классы-компоненты | `.button`, `.field`, `.note`, `.section-title`, `.prose` |

Проектная палитра — значения этих же переменных: _фирменные цвета_. Новая семантика —
новый токен здесь, а не сырой цвет в компоненте.

## Тема

| поле | значение |
|---|---|
| системная | `light-dark()` + `color-scheme` в токен-слое — без JS |
| явный выбор | `data-scheme="light\|dark"` на `<html>`, хранится в cookie `scheme` |
| остров | один инлайн-`<script>` в `<head>` (`features/theme`) — применяет выбор до первой отрисовки |
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

## Типографика и колонки

| поле | значение |
|---|---|
| шкала | `text-body-sm/md/lg`, `text-heading-md/lg/xl` |
| колонка чтения | `max-w-content` (≈ 72 знака) |
| каркас страницы | `max-w-page` |
| scoped `<style>` | только layout (grid, позиционирование); цвета и типографика — утилитами |

## Бюджет

| что | лимит |
|---|---|
| CSS всего сайта | ≤ 15 КБ gzip (одна таблица, `.size-limit.cjs`) |
| HTML страницы | ≤ 20 КБ gzip (главная), ≤ 25 КБ gzip (запись) |

## Generates

- `src/app/styles/index.css` — токены, классы-компоненты, тема
- `astro.config.ts` — плагин Tailwind
- `.size-limit.cjs` — бюджеты CSS и HTML
- `src/features/theme/**` — остров темы и переключатель (если тема нужна)

## Открытые вопросы

- _что_
