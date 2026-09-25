---
description: UI — .astro-компоненты на собственном токен-слое, тема через light-dark()/data-scheme и единственный остров, scoped-CSS только для layout, картинки через <Picture> с LCP-политикой, 0 JS по умолчанию.
paths: ["src/**/ui/**", "src/app/layouts/**", "src/app/styles/**", "src/app/analytics/**", "src/shared/ui/**", "src/features/theme/**"]
---

# UI-компоненты

Примитивы и блоки — `.astro`-компоненты в проекте на собственном токен-слое; вендорные
UI-киты и их токены не подключаются.

## Токены — единственный источник значений

- Только семантические утилиты и переменные из `src/app/styles/index.css`:
  `bg-app-bg`, `text-app-fg`, `text-muted`, `text-accent`, `bg-accent-soft`, `border-divider`,
  `text-link`, `text-body-md`, `text-heading-xl`, `rounded-control`, `max-w-content`,
  `max-w-page`, `--scheme-*`
- Классы-компоненты там же: `.button` (единственная заливка акцентом), `.field` (одна геометрия
  input/textarea), `.note` (врезка), `.section-title` (штрих акцента над заголовком раздела),
  `.prose` (тело markdown)
- ❌ сырые цвета/размеры в компонентах (`bg-[#18181b]`, `text-zinc-500`, inline `style`)
  и в `<meta>`/атрибутах; нужна новая семантика — новый токен в `index.css`
- Колонка чтения — `max-w-content` (≈ 72 знака), каркас сайта — `max-w-page`

## Тема: единственный остров

- Системная тема — без JS: `light-dark()` + `color-scheme` в токен-слое
- Явный выбор — `data-scheme="light|dark"` на `<html>`; хранится в cookie `scheme`
  (техническая, согласия не требует). Читает её только сам остров: сервер тему не знает и на
  prerendered знать не может
- Весь код острова — один инлайн-`<script is:inline>` в `<head>` (`features/theme/ui/theme-init`):
  применяет выбор **до первой отрисовки** и обслуживает кнопку делегированием. В `<body>`
  скриптов нет — ни одного, это держит e2e
- Кнопка (`ThemeToggle`) видна только при `html[data-js="on"]`: без JS выбор негде сохранить
- Тело острова уезжает в `<head>` каждой страницы как есть: оно плотное, без комментариев и
  прагм, форматтер его не трогает (`.prettierignore`), а `noDocumentCookie` выключен для файла
  в `biome.json` (Cookie Store API нет в Safari и Firefox). Отдельного файла в `dist` у него
  нет, поэтому бюджет один и измеряется один раз — байтами отрендеренного `<script>` в
  `theme-init.astro.test.ts`; внутри документа их же считают бюджеты HTML в `.size-limit.cjs`

## Scoped `<style>`

Только для layout (grid, позиционирование, показ/скрытие); значения — через утилиты или
`var(--…)`. Цвета и типографика в scoped-CSS не задаются.

## Картинки

- Только `<Picture>` из `astro:assets`: `formats={['avif', 'webp']}` + фолбэк-`<img src>`
  (Google индексирует именно его), `width`/`height` заданы всегда — иначе CLS
- Обложка записи — LCP: `loading="eager"`, `fetchpriority="high"`, без `lazy`;
  картинки списков и тела — `loading="lazy"`, `decoding="async"`
- Ширину картинки держит обёртка (`div` с утилитой ширины): адаптивные стили Astro задают
  самой картинке `width: 100%`
- Декоративная миниатюра, дублирующая заголовок-ссылку, — `alt=""`; содержательная — описательный
  `alt` (он попадает в Google Images)

## 0 JS по умолчанию

Компонент без `<script>`. Клиентский `<script>` — остров, только по решению: отдельный файл в
`dist` — строка бюджета в `.size-limit.cjs`, инлайн — байты в своём unit-тесте; его импорты
ESLint проверяет как обычный модуль. Сторонний скрипт (счётчик) — одна точка `app/analytics`,
грузится после `requestIdleCallback` и только при заданном идентификаторе в
`shared/config/site.ts`; пусто — сторонних скриптов нет вовсе.

## Где что

| что | где |
|---|---|
| слайс-локальный UI | `ui/`-сегмент слайса |
| переиспользуемый примитив | `shared/ui/<name>/{<name>.astro,index.ts}` — своя папка, explicit re-export |
| каркас сайта | `widgets/site-header`, `widgets/site-footer` |
| документ-шелл: `<html lang>`, `<head>` со `<slot name="head">`, лендмарки, skip-link | `app/layouts/document.astro` |
| переключатель темы | `features/theme` (`ThemeInit` в `<head>`, `ThemeToggle` в шапке) |

Форматирует `.astro` Prettier (`pnpm format`), линтят Biome и ESLint
(`astro/jsx-a11y/*`: `alt`, `lang`, заголовки, интерактив без клавиатуры).
