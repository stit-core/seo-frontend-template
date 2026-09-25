---
name: scaffold
description: Разложить один новый артефакт сайта по канону за один проход — page (страница ru + en через DocumentLayout), collection (коллекция контента со схемой, запросами и маршрутами), feature, widget, route (служебный on-demand маршрут). Источник — stable-запись FSD-карты в соседнем <org>/strategy (docs/projects/<slug>/fsd/<surface>/); src/-пути скилл выводит сам из kind и slug. Применяй, когда в сайт добавляется страница, коллекция, фича, виджет или служебный маршрут, и когда /init-service или /de-template доходит до реализации своих слайсов. Правка существующего слайса — прямая правка, не этот скилл.
---

# Skill: scaffold

Создаёт файлы одного артефакта по канону этого шаблона и оставляет гейт зелёным.
Не интервьюирует про бизнес — карта слайсов проектируется в `<org>/strategy` (его
`/fsd-deep-dive`), платформенные решения — в `docs/stack` (`/stack-deep-dive`).

Резолв карты — поля `project-slug` / `strategy-path` / `surface` в
`docs/stack/service.md` (дефолт `../strategy`). Готовые скелеты файлов —
`references/templates.md`.

## Когда применять

- «/scaffold <kind> <имя>» — `page` · `collection` · `feature` · `widget` · `route`
- «создай страницу услуг», «добавь коллекцию вакансий», «нужен виджет отзывов»
- `/init-service` или `/de-template` чейнит этап «свои слайсы»

## Pre-flight

- [ ] Запись есть в FSD-карте (`fsd/<surface>/<kind>.md`) со `status: stable`.
      Нет соседа или записи — next-step «спроектируй в `<org>/strategy`
      (`/fsd-deep-dive`)»; выдумывать слайс здесь нельзя
- [ ] Имя в kebab-case, не конфликтует с существующим
- [ ] Для `page`/`route` — решён режим рендера в `docs/stack/rendering.md`

## Вопросы юзеру (≤ 3, это не интервью)

1. **Индексируется?** (для `page`/`route`) — от этого `noindex`, строка в
   `STATIC_ROUTES` и участие в карте сайта
2. **Есть перевод?** — страница заводится сразу на обеих локалях или только на `ru`
3. **Что внутри** — какие сегменты слайса нужны (`ui`, `model`, `api`, `lib`)

---

## page

```
src/pages/_<name>/<name>-page.astro   разметка страницы (общая для локалей)
src/pages/<path>.astro                ru-обёртка: locale = 'ru'
src/pages/en/<path>.astro             en-обёртка: locale = 'en'
```

Обязательное:

- страница рендерится через `DocumentLayout` с уникальными `title` и `description`
  (бюджеты сниппета: title ≤ 65, description 70–170 — их держит `seo:check`)
- есть перевод → `alternatePath="<путь без префикса локали>"`; нет — проп не ставится,
  и hreflang не печатается
- вложенная страница → один массив крошек: он же в `<Breadcrumbs>`, он же в
  `jsonLd={[breadcrumbList(crumbs)]}`
- служебная (подтверждение, результат, техническая) → проп `noindex`, **без** строки
  в `STATIC_ROUTES`
- индексируемая вне коллекций → строка в `STATIC_ROUTES` (`src/pages/sitemap.xml.ts`)
  на каждую локаль, в которой она есть
- тексты — в объекте `COPY` секции на обе локали; подписи навигации — в
  `src/shared/i18n/dict.ts`

Не нужно: править `e2e/site.ts` — списки страниц он выводит из `dist/client`. Ключевую
страницу стоит добавить в `PAGES` спека `e2e/a11y.spec.ts`.

## collection

```
src/entities/<name>/
├─ content/<locale>/<slug>.md      записи; обложки — content/covers/<translationKey>.png
├─ model/schema.ts                 Zod-схема frontmatter (прямой import { z } from 'zod')
├─ model/collection.ts             defineCollection + glob({ base })
├─ api/queries.ts                  списки, запись, перевод; фильтр draft и локали
├─ lib/paths.ts                    маршруты коллекции
├─ ui/<name>-card.astro            карточка списка
└─ index.ts                        explicit re-export без server-only символов
```

Плюс три точки регистрации, без них коллекции «нет»:

1. `src/content.config.ts` — импорт **напрямую из модуля** (`@/entities/<name>/model/collection`)
2. `scripts/lib/content.mjs` — запись в реестре `collections` (каталог, схема, порождаемые
   маршруты): по нему работают `check:content` и `seo:check`
3. страницы списка и записи в `src/pages/**` (обе локали) + строки в карте маршрутов

Схема обязана дать: бюджеты `title`/`description`, `pubDate`, `draft` с дефолтом `false`,
`translationKey`. Первая запись — через `/content`, иначе списки пустые и `getStaticPaths`
не порождает ни одного пути.

## feature

```
src/features/<name>/
├─ ui/<name>.astro
├─ model/schema.ts    если есть ввод от человека
├─ api/<name>.ts      если есть серверная сторона
└─ index.ts
```

Сценарий с результатом («отправить заявку», «подписаться»). По умолчанию — **без
JavaScript**: форма шлёт нативный POST, ответ рисует сервер. Остров заводится решением
проекта: строка в `docs/stack/rendering.md § Интерактивность` и бюджет (файл в `dist` —
строка в `.size-limit.cjs`, инлайн — байты в unit-тесте).

## widget

```
src/widgets/<name>/
├─ ui/<name>.astro
├─ ui/<name>.astro.test.ts    Container API + expectNoA11yViolations
└─ index.ts
```

Widget заводится при **≥ 2 страницах-потребителях** или если это часть каркаса сайта.
Блок одной страницы живёт рядом с ней — в `src/pages/_<name>/`; иначе Steiger поймает
`insignificant-slice`.

## route

`src/pages/<name>.ts` (endpoint) или `src/pages/<name>.astro` (если ответ — разметка):

```ts
export const prerender = false
```

Обязательное для каждого on-demand маршрута:

- явный `Cache-Control`: публичный HTML — `no-cache` (умолчание middleware), живой или
  персональный — `private, no-store` в самом роуте, файл для краулера — короткий
  `public, max-age`
- `X-Robots-Tag: noindex` там, где ответ не страница выдачи; страница — проп `noindex`
- **строка в карте маршрутов** `docs/reference/rendering.md` и в `docs/stack/rendering.md`
- вне `sitemap.xml`

Обработчик формы — страница, а не endpoint: без JavaScript ответом на POST обязана быть
разметка, а успех — 303 (PRG).

---

## Public API

`index.ts` слайса — только explicit re-exports:

```ts
export type { Post } from './api/queries'
export { listPosts } from './api/queries'
export { default as PostCard } from './ui/post-card.astro'
```

Без `export *`, без импортов, без объявлений и вызовов в самом `index.ts` и без
server-only символов (`astro:content`, `node:*`) — их серверный entry импортирует
напрямую из модуля.

## Post-flight (обязательно)

```bash
pnpm format           # Prettier для .astro: новый файл почти всегда не в его стиле
pnpm typecheck        # нет битых импортов и пропсов
pnpm lint             # границы FSD (ESLint boundaries) и правила
pnpm steiger          # структура: public API, сегменты, значимость слайса
```

Для `collection` дополнительно `pnpm check:content`; перед claim «готово» — `pnpm check`.

## Что НЕ делать

- ❌ Сегменты `components/`, `hooks/`, `utils/`, `types/` — группировка по типу запрещена
- ❌ `export *` из `index.ts`
- ❌ Импорт соседнего слайса того же слоя — поднимай общее в `entities`/`shared` или
  композируй в widget/page
- ❌ Импорт мимо public API (`@/<layer>/<slice>/<segment>/…`)
- ❌ `prerender = false` на контентной странице
- ❌ Слайс «на будущее» — Steiger `insignificant-slice`
