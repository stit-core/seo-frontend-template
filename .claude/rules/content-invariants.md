---
description: Контент в git — frontmatter и бюджеты, один h1, alt, переводы и черновики, редиректы как данные (YAML → данные на сборке), контентные гейты check:content / check:links.
paths: ["src/entities/*/content/**", "src/entities/*/model/schema.ts", "src/entities/*/api/**", "src/shared/redirects/**", "src/app/middleware/redirects.ts", "astro.config.ts", "content/**", "scripts/check-content.mjs", "scripts/check-links.mjs", "scripts/lib/content.mjs"]
---

# Контент-инварианты

Контент — Markdown в git внутри слайса сущности (`src/entities/<name>/content/`), схема —
Zod в `model/schema.ts` (прямой `import { z } from 'zod'`), коллекция — `model/collection.ts`
(`glob({ base })`), доступ — `api/queries.ts`. Ошибка схемы = красная сборка; раньше и
понятнее её ловит `pnpm check:content`.

## Файл записи

- Путь: `content/<locale>/<slug>.md`. **Язык задаёт каталог** — поля `lang` нет; `<locale>`
  ∈ `SUPPORTED_LOCALES` (`shared/i18n`); slug — только `a-z`, `0-9`, дефисы. Id записи —
  `<locale>/<slug>`, URL — `/blog/<slug>` (`/en/blog/<slug>`)
- Frontmatter — строгая мапа (неизвестное поле, в т.ч. опечатка, — ошибка):
  `title` (25–65 символов), `description` (70–170), `pubDate`, `updatedDate?` (не раньше
  `pubDate`; единственный источник `lastmod` в sitemap и `dateModified` в JSON-LD), `cover?` +
  `coverAlt?` (только вместе; обложка — и `og:image` записи), `tags` (slug'и, без дублей),
  `draft` (по умолчанию `false`), `translationKey` (slug, общий для переводов)
- Бюджеты `title`/`description` — часть схемы: это ширина сниппета выдачи, не «пожелание».
  `title` и `description` уникальны внутри локали — у каждой страницы свой сниппет
- YAML — полный (`js-yaml`, им же Astro читает frontmatter): значение с `: ` или с ведущим
  спецсимволом — в кавычках. Дата без времени (`2026-01-01`) — календарная, полночь UTC;
  `formatDate`/`isoDate` (`shared/i18n`) тоже считают в UTC, поэтому день не «съезжает»
  ни в каком часовом поясе сборки
- Литерала плейсхолдера origin (хост из `SITE_ORIGIN_PLACEHOLDER`, `shared/config`) в записи
  нет ни во frontmatter, ни в теле: штамповка при старте контейнера переписала бы его в
  HTML. Описывать словами («фиктивный origin-плейсхолдер»), не литералом

## Тело

- Ровно один `<h1>` на странице — из `title`; в теле заголовки только `##` и глубже, без
  скачков уровней; сырой `<h1>` тоже запрещён
- У каждой картинки — осмысленный `alt`; путь — относительный от файла, файл существует
- Ссылки на свои страницы — корневые (`/blog/x`), без хвостового слеша и `.html`, только
  на существующие маршруты (черновик — не маршрут); относительные `./x.md` запрещены
- В теле нет `<script>` и `meta refresh`; абсолютные URL своего origin — только в `<head>`

## Черновики и переводы

- `draft: true` виден только в `astro dev` (`import.meta.env.DEV` в `api/queries.ts`): в
  списках, тегах и по URL, с пометкой «Черновик» в карточке и статье. В сборке записи нет
  нигде — не в списках, не в тегах, URL — 404 (и не будет в sitemap/RSS); страницу черновика в
  `dist/client` валит `seo:check`. Preview-режима
  нет; ссылка на черновик из опубликованной записи — ошибка `check:content`
- Переводы — параллельные каталоги `ru/`, `en/` с общим `translationKey`; slug'и могут
  отличаться. `translationKey` уникален внутри локали; запись без twin — норма.
  Fallback-режима нет: непереведённая запись под другой локалью — 404, а не копия. Ссылка
  на перевод (и hreflang) — только при реальном twin (`findTranslation`)
- Обложки — `content/covers/<translationKey>.png` (1600×900), общие для локалей:
  `cover: ../covers/<key>.png` + `coverAlt`

## Списки

- `/blog` — страница 1; `/blog/page/N` — только 2…N (`/blog/page/1` нет; ровно 5 записей —
  одна страница, пустых нет); у страницы N — `title`, `description` и `h1` с суффиксом
  «— страница N»; страницы тегов — только для тегов видимых записей. `getStaticPaths`
  ru/en-обёрток — общие функции `src/pages/_blog/static-paths.ts`

## Редиректы — данные

- `content/redirects.yaml`: список `{ from, to?, status, note? }`; `status` ∈ `301 | 308 |
  410`; у `410` нет `to`; `to` — корневой путь **или** абсолютный `http(s)` URL; `from` —
  корневой путь в нижнем регистре, без query и хвостового слеша. Пустой файл (или только
  комментарии) — пустая таблица
- Один хоп: `to` не совпадает ни с чьим `from` (нет цепочек и циклов), `from` — не
  существующий маршрут, внутренний `to` существует, дублей `from` нет
  (`shared/redirects` + `check:content`)
- YAML разбирается на сборке (плагин `yaml-modules` в `astro.config.ts`, `js-yaml`;
  тип `*.yaml` — `src/env.d.ts`): в серверный бандл попадают данные, а не парсер; Zod
  проверяет их при загрузке модуля, файл в контейнере не нужен
- Обслуживает `app/middleware` до роутинга, по точному `pathname`; `404.astro` поэтому
  on-demand — иначе путь без файла не дошёл бы до middleware. Query переезжает в
  `Location` (`/old?x=1` → `/blog?x=1`; у внешней цели — после её собственной). Хвостовой
  слеш срезает сам Astro 301-м ещё до middleware (`trailingSlash: 'never'`), поэтому
  `/old/` — два хопа: `/old`, затем цель; в данных это не цепочка, `from` пишется без слеша.
  Регистр не нормализуется: URL к нему чувствительны, как и везде на сайте. `410` — тело
  без стилей + `X-Robots-Tag: noindex`
- `meta refresh` и `redirects` в `astro.config.ts` не используются. Ссылок на адреса из
  `redirects.yaml` в разметке нет — `check:links`

## Гейты

- `pnpm check:content` (до `build`): схема каждого `.md`, тело, литерал плейсхолдера,
  уникальность `title`/`description`/`translationKey` в локали, ссылки по списку маршрутов
  (`src/pages` + контент + `public/`), `redirects.yaml`
- `pnpm check:links` (после `build`): каждый внутренний `href`/`src`/`srcset` в
  `dist/client` существует (файл, `<path>/index.html` или on-demand маршрут)
- Скрипты читают YAML напрямую `js-yaml` и исполняют TS-модули напрямую (Node strip-types),
  поэтому импортируют только «листовые» модули без `@/`-алиасов и относительных импортов:
  `model/schema.ts`, `lib/paginate.ts`, `shared/redirects/table.ts`, `shared/i18n/locale.ts`,
  `shared/config/runtime.ts`
- Новая коллекция — запись в реестре `collections` модуля `scripts/lib/content.mjs` (каталог,
  схема, порождаемые маршруты): каталог `src/entities/*/content` вне реестра и запись реестра без
  каталога — ошибка `check:content`
- Сами скрипты под гейтом: негативные фикстуры `.gate-fixtures/{content,links}` обязаны давать
  ровно нарушения из `expected.json` (`pnpm check:gate`); новая проверка — новое нарушение в
  фикстуре тем же коммитом
