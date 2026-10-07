---
description: UI — .astro-компоненты на собственном токен-слое, тема через light-dark()/data-scheme и инлайн-остров, scoped-CSS только для layout, картинки через <Picture> с LCP-политикой, 0 JS по умолчанию — острова только по списку политики.
paths: ["src/**/ui/**", "src/app/layouts/**", "src/app/styles/**", "src/app/analytics/**", "src/shared/ui/**", "src/features/theme/**"]
---

# UI-компоненты

Примитивы и блоки — `.astro`-компоненты в проекте на собственном токен-слое; вендорные
UI-киты и их токены не подключаются: импорт любого `.css`, кроме `@/app/styles/index.css`, —
ошибка ESLint.

## Токены — единственный источник значений

- Только семантические утилиты и переменные из `src/app/styles/index.css`:
  `bg-app-bg`, `text-app-fg`, `text-muted`, `text-accent`, `bg-accent-soft`, `border-divider`,
  `text-link`, `text-body-md`, `text-heading-xl`, `rounded-control`, `max-w-content`,
  `max-w-page`, `--scheme-*`
- Классы-компоненты там же: `.button` (единственная заливка акцентом), `.field` (одна геометрия
  input/textarea), `.note` (врезка), `.section-title` (штрих акцента над заголовком раздела),
  `.prose` (тело markdown)
- ❌ сырые цвета/размеры в компонентах; нужна новая семантика — новый токен в `index.css`.
  ESLint в `.astro` валит инлайн-`style`, литерал цвета (`#…`, `rgb(…)`, `oklch(…)`) в классе
  (`bg-[#18181b]`), в цветовом атрибуте SVG (`fill`, `stroke`) и в `<style>`; палитра Tailwind по
  умолчанию выключена в токен-слое — `text-zinc-500` не даёт ни байта CSS (держит тест токен-слоя
  `app/styles/index.server.test.ts`)
- Колонка чтения — `max-w-content` (≈ 72 знака), каркас сайта — `max-w-page`

## Тема: инлайн-остров

- Системная тема — без JS: `light-dark()` + `color-scheme` в токен-слое
- Явный выбор — `data-scheme="light|dark"` на `<html>`; хранится в cookie `scheme`
  (техническая, согласия не требует). Читает её только сам остров: сервер тему не знает и на
  prerendered знать не может
- Весь код острова — один инлайн-`<script is:inline data-island="theme">` в `<head>`
  (`features/theme/ui/theme-init`): применяет выбор **до первой отрисовки** и обслуживает
  кнопку делегированием. В `<body>` скриптов нет — ни одного; исполняемый скрипт страницы —
  только остров из списка `ISLANDS` (`scripts/lib/site-policy.mjs`) с его `data-island`, а
  обработчик в атрибуте (`onclick=`) и `javascript:`-адрес — тот же скрипт мимо списка: это
  держит `seo:check` на каждой странице сборки и HTTP-набор на on-demand страницах. Браузер
  исполняет остров, только если хеш его тела — в CSP: правка тела — новый `hash` острова в
  `ISLANDS` (его печатает упавший тест острова)
- Кнопка (`ThemeToggle`) видна только при `html[data-js="on"]`: без JS выбор негде сохранить
- Тело острова уезжает в `<head>` каждой страницы как есть: оно плотное, без комментариев и
  прагм, форматтер его не трогает (`.prettierignore`), а `noDocumentCookie` выключен для файла
  в `biome.json` (Cookie Store API нет в Safari и Firefox). Отдельного файла в `dist` у него
  нет, поэтому бюджет один и измеряется один раз — байтами отрендеренного `<script>` в
  `theme-init.astro.test.ts`; внутри документа их же считают бюджеты HTML в `.size-limit.cjs`

## Scoped `<style>`

Только для layout (grid, позиционирование, показ/скрытие); значения — через утилиты или
`var(--…)`. Цвета и типографика в scoped-CSS не задаются (литерал цвета валит ESLint).

## Картинки

- Только `<Picture>` из `astro:assets` (сырой `<img>` в `.astro` валит ESLint):
  `formats={['avif', 'webp']}` + фолбэк-`<img src>` (Google индексирует именно его),
  `width`/`height` заданы всегда — иначе CLS
- Обложка записи — LCP: над h1, `loading="eager"`, `fetchpriority="high"`, без `lazy`;
  картинки списков и тела — `loading="lazy"`, `decoding="async"`. `seo:check`: у картинки над
  h1 (кандидат в LCP) нет `lazy` и есть `fetchpriority="high"`, у каждой `<img>` — `width` и
  `height`; кандидата он узнаёт по месту, поэтому место и загрузку обложки держит тест
  `post-article`, размеры слота миниатюры — тест карточки
- Ширину картинки держит обёртка (`div` с утилитой ширины): адаптивные стили Astro задают
  самой картинке `width: 100%`
- Декоративная миниатюра, дублирующая заголовок-ссылку, — `alt=""`; содержательная — описательный
  `alt` (он попадает в Google Images)

## 0 JS по умолчанию

Компонент без `<script>`; `client:*` — ошибка ESLint (фреймворка островов нет). Клиентский
`<script>` — остров, только по решению: имя и хеш тела — строка `ISLANDS`
(`scripts/lib/site-policy.mjs`), `data-island` на теге; отдельный файл в `dist` — строка
бюджета в `.size-limit.cjs`, инлайн — байты и хеш в своём unit-тесте; его импорты ESLint
проверяет как обычный модуль. Ресурсы — со своего сайта: чужой origin (шрифты, CDN) — только
строкой в `RESOURCE_ORIGINS` там же (её же пропускает CSP); `@font-face` — с `font-display`
swap, fallback или optional. Сторонний скрипт (счётчик) — одна точка `app/analytics`, грузится
после `requestIdleCallback` и только при заданном идентификаторе в `shared/config/site.ts`;
пусто — сторонних скриптов нет вовсе. Его origin — `sources` острова в `ISLANDS`: CSP пропускает
их, только когда остров печатается (`on`).

## Где что

| что | где |
|---|---|
| слайс-локальный UI | `ui/`-сегмент слайса |
| переиспользуемый примитив | `shared/ui/<name>/{<name>.astro,index.ts}` — своя папка, explicit re-export |
| каркас сайта | `widgets/site-header`, `widgets/site-footer` |
| документ-шелл: `<html lang>`, `<head>` со `<slot name="head">`, лендмарки, skip-link | `app/layouts/document.astro` |
| переключатель темы | `features/theme` (`ThemeInit` в `<head>`, `ThemeToggle` в шапке) |

Форматирует `.astro` Prettier (`pnpm format`), линтят Biome и ESLint
(`astro/jsx-a11y/*`: `alt`, `lang`, заголовки, интерактив без клавиатуры; канон этого правила —
`no-restricted-syntax` в `eslint.config.js`, фикстура `.gate-fixtures/src/widgets/promo`).
