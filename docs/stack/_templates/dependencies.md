---
id: stack.dependencies
kind: dependencies
name: dependencies
status: draft
---

# dependencies

## Базовая подборка (наследуется из шаблона)

| зона | пакет | мажор |
|---|---|---|
| Фреймворк | `astro` | 7 |
| Адаптер | `@astrojs/node` | 11 |
| Фиды | `@astrojs/rss` | 4 |
| Валидация | `zod` | 4 |
| Картинки | `sharp` | 0.35 |
| Стили | `tailwindcss`, `@tailwindcss/vite` | 4 |
| Доставка почты | `nodemailer` | 10 — динамический импорт только на канале `smtp` |
| Ошибки | `@sentry/node` | 10 — динамический импорт только при `SENTRY_DSN` |
| Типы | `typescript` (`astro/tsconfigs/strictest`), `@astrojs/check` | `~6.0` / 0.9 |
| Формат и линт | `@biomejs/biome`, `eslint` + `eslint-plugin-astro`, `eslint-plugin-boundaries`, `prettier` (`*.astro`), `steiger` | 2 / 10 / 7 / 3 / 0.6 |
| Тесты | `vitest`, `axe-core`, `@playwright/test`, `@axe-core/playwright` | 5 / 4 / 1 / 4 |
| Бюджеты | `size-limit`, `@size-limit/file` | 14 |
| Данные | `js-yaml` | 4 — тот же парсер, которым Astro читает frontmatter |
| Дисциплина | `lefthook`, `@commitlint/*` | 2 / 21 |

Мажор (у 0.x — минор), на котором шаблон держит пакет; в `package.json` — точная версия.
Runtime-зависимостей у образа ровно столько: выход Astro не self-contained — `entry.mjs`
импортирует `astro` и `zod`, обработка картинок — `sharp`.

TypeScript — `~6.0`, не 7: `@astrojs/check` (шаг `typecheck`) TypeScript 7 не поддерживает, а
typescript-eslint объявляет peer `<6.1` — с 7 падают `typecheck`, `lint` и `check:gate`. Переход —
отдельным планом, когда выйдут TypeScript 7.1 stable, typescript-eslint с его поддержкой и рабочий
`@astrojs/ts-content-mapper` (`typecheck` переезжает на `tsc`, `@astrojs/check` уходит).

## Проектные добавления

| пакет | назначение | почему не обойтись базовой подборкой |
|---|---|---|
| _name_ | _что делает_ | _обоснование_ |

Каждая строка означает +вес образа и +поверхность обновлений. Пакет в `dependencies`
попадает в прод-образ; инструмент разработки — в `devDependencies`.

## Запрещено

- ❌ Вендорные UI-киты — компоненты пишутся в проекте на своём токен-слое
- ❌ `@astrojs/sitemap` — строит URL от build-time origin, а origin здесь runtime
- ❌ Фреймворк островов (`@astrojs/react` и соседи) ради одного переключателя
- ❌ Второй парсер YAML/Markdown рядом с тем, что уже использует сборка
- ❌ Клиентский HTTP-клиент-пакет: у контентной страницы нет запросов из браузера

## Бюджеты

| что | лимит | где держится |
|---|---|---|
| CSS всего сайта | 15 КБ gzip | `.size-limit.cjs` |
| HTML главной | 20 КБ gzip | `.size-limit.cjs` |
| HTML записи | 25 КБ gzip | `.size-limit.cjs` |
| JS островов | 30 КБ gzip (файл в `dist`) / байты в unit-тесте (инлайн) | `.size-limit.cjs`, тест компонента |
| образ | _≤ 400 МБ_ | приёмка образа печатает размер — порога в ней нет |

## Generates

- `package.json#dependencies` / `#devDependencies`
- `.size-limit.cjs` — строки бюджетов
- `docker/Dockerfile` — прунинг build-машинерии в стадии `prod-deps`

## Открытые вопросы

- _что_
