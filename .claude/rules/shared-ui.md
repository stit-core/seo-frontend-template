---
description: UI — .astro-компоненты на ролях дизайн-системы (файл токенов в форме ds_build и слой сопоставления «утилита → роль»), тема — data-theme, поле THEME и инлайн-остров, scoped-CSS только для layout, картинки через <Picture> с LCP-политикой, 0 JS по умолчанию — острова только по списку политики.
paths: ["src/**/ui/**", "src/app/layouts/**", "src/app/styles/**", "src/app/analytics/**", "src/shared/ui/**", "src/features/theme/**"]
---

# UI-компоненты

Примитивы и блоки — `.astro`-компоненты в проекте на собственном токен-слое; вендорные
UI-киты и их токены не подключаются: импорт любого `.css`, кроме `@/app/styles/index.css`, —
ошибка ESLint.

## Токены — единственный источник значений

- Значения — файл токенов дизайн-системы `src/app/styles/tokens.css` в форме производного
  `ds_build` соседнего strategy (`design/system.tokens.css`): имя переменной — путь токена
  (`color.bg.canvas` → `--color-bg-canvas`), темы и сокращённое движение — блоки `[data-theme]`,
  `prefers-color-scheme` и `[data-motion]`. ДС меняется заменой файла целиком: по строкам он не
  правится, форматтер его не трогает (`biome.json`)
- Слой сопоставления «утилита → роль» — блок `@theme inline` в `src/app/styles/index.css`,
  единственное место, которое знает переменные ДС. Компонент берёт роль утилитой,
  класс-компонент — `@apply` той же утилиты; `var(--color-…)` и `var(--primitive-…)` вне слоя не
  пишутся. У ДС с другими именами ролей меняются только правые части строк слоя
- Имя утилиты — свойство и роль: сегмент пути, который называет свойство, становится префиксом
  (`color.bg.canvas` → `bg-canvas`, `color.text.secondary` → `text-secondary`,
  `color.border.subtle` → `border-subtle`), у группы смысла остаётся её имя (`color.accent.bg` →
  `bg-accent`, `color.accent.text` → `text-accent`, `color.accent.solid` → `bg-accent-solid`,
  `color.danger.border` → `border-danger`, `color.focus-ring` → `outline-focus-ring`). Ключ слоя —
  пространство имён своего свойства (`--background-color-*`, `--text-color-*`,
  `--border-color-*`, `--outline-color-*`, `--text-decoration-color-*`), а не общее `--color-*`:
  роль фона не становится цветом текста, а имя ключа не совпадает с переменной ДС — одноимённая
  пара в `@theme inline` дала бы ссылку переменной на себя
- Роли цвета: `bg-canvas`, `bg-surface`, `bg-subtle`, `bg-accent`, `bg-accent-solid`, `bg-danger`,
  `text-primary`, `text-secondary`, `text-on-accent`, `text-accent`, `text-danger`,
  `border-subtle` (декоративный разделитель), `border-strong` (граница поля — не ниже 3:1 к
  фону), `border-accent`, `border-danger`, `decoration-accent`, `outline-focus-ring`. Кегли,
  радиусы и ширины — `text-body-md`, `text-heading-xl`, `rounded-control`, `max-w-content`,
  `max-w-page` — ключи `@theme` там же
- Классы-компоненты там же: `.button` (единственная заливка акцентом), `.field` (одна геометрия
  input/textarea), `.note` (врезка), `.section-title` (штрих акцента над заголовком раздела),
  `.prose` (тело markdown)
- ❌ сырые цвета/размеры в компонентах; нужна новая семантика — роль в файле токенов и строка
  слоя. ESLint в `.astro` валит инлайн-`style`, литерал цвета (`#…`, `rgb(…)`, `oklch(…)`) в
  классе (`bg-[#18181b]`), в цветовом атрибуте SVG (`fill`, `stroke`) и в `<style>`; палитра и
  гарнитуры Tailwind по умолчанию выключены в слое — `text-zinc-500` и `font-mono` не дают ни
  байта CSS, гарнитуры текста и кода страница получает от базовых стилей (роли `font.*`)
- Тест токен-слоя `app/styles/index.server.test.ts` держит на компиляторе Tailwind: закрытую
  палитру; утилиту роли — только у своего свойства; каждую переменную, на которую ссылается слой,
  — объявленной в файле токенов (роль, которой в файле нет, тест называет); темы поля `THEME` —
  равными темам файла; `color-scheme` — только из файла токенов
- Колонка чтения — `max-w-content` (≈ 72 знака), каркас сайта — `max-w-page`

## Тема: файл токенов и инлайн-остров

- Темы — блоки файла токенов: без выбора — системная, без JS (`prefers-color-scheme`); выбор —
  атрибут ДС `data-theme="light|dark"` на `<html>`. `color-scheme` объявляет только файл токенов:
  своего у оболочки и компонентов нет (тест токен-слоя и тест оболочки
  `app/layouts/document.astro.test.ts`)
- Поле `THEME` (`shared/config/site.ts`) — решение проекта: `default` — `system` или тема, которую
  оболочка ставит атрибутом; `switcher` — кнопка выбора в шапке и остров темы (без него нет ни
  кнопки, ни острова, ни его хеша в CSP — `on` в `ISLANDS`). Темы поля — ровно темы файла токенов
- Выбор хранит cookie `scheme` (техническая, согласия не требует). Читает её только сам остров:
  сервер тему не знает и на prerendered знать не может
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
Стиль компонента, который стоит не на каждой странице, Astro может инлайнить только в его
страницы, а CSP у prerendered-страниц одна на все — rule `render-safety` § Конфиг.

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

Форматирует `.astro` Prettier (`pnpm format`), линтят Biome (a11y-группа `lint/a11y/*`: `alt`,
`lang`, содержимое ссылок и заголовков, `type` кнопки, `tabindex`, роли и aria, интерактив без
клавиатуры) и ESLint (канон этого правила — `no-restricted-syntax` в `eslint.config.js`, фикстура
`.gate-fixtures/src/widgets/promo`); доступность отрисованного — axe в тестах компонентов и в
браузерном наборе.
