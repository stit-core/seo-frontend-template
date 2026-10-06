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
  (бюджеты сниппета: title — от трёх слов до 65 знаков и не общий, description 70–170 —
  их держит `seo:check`)
- есть перевод → `alternatePath="<путь без префикса локали>"`; нет — проп не ставится,
  и hreflang не печатается
- вложенная страница → один массив крошек: он же в `<Breadcrumbs>`, он же в
  `jsonLd={[breadcrumbList(crumbs)]}`
- служебная (подтверждение, результат, техническая) → проп `noindex`, маршрут без префикса
  локали — в `NOINDEX_ROUTES` (`scripts/lib/site-policy.mjs`), **без** строки в `STATIC_ROUTES`
- индексируемая вне коллекций → строка в `STATIC_ROUTES` (`src/pages/sitemap.xml.ts`)
  на каждую локаль, в которой она есть
- тексты — в объекте `COPY` секции на обе локали; подписи навигации — в
  `src/shared/i18n/dict.ts`
- условия и вычисления секции (ссылка на перевод, крошки, разметка) — в `.ts`-модели рядом с
  ней (как `_blog/sections.ts`) с unit-тестом; в `.astro` — разметка
- **тест обязателен**: строка на каждую локаль в `src/pages/_tests/pages.astro.test.ts` — язык,
  self-canonical или `noindex`, hreflang пары, типы JSON-LD, один `h1`; индексируемая — ещё и
  адрес в ожидаемой карте `src/pages/_tests/endpoints.server.test.ts`

Не нужно: править e2e — цели HTTP- и браузерного наборов (`e2e/site.ts`) выводятся из
`dist/client`, `src/pages` и контента, и новая страница попадает в них сама.

## collection

```
src/entities/<name>/
├─ content/<locale>/<slug>.md      записи; обложки — content/covers/<translationKey>.png
├─ model/schema.ts                 Zod-схема frontmatter (прямой import { z } from 'zod')
├─ model/collection.ts             defineCollection + glob({ base })
├─ api/queries.ts                  списки, запись, перевод; фильтр draft и локали
├─ lib/paths.ts                    маршруты коллекции
├─ ui/<name>-card.astro            карточка списка
└─ index.ts                        explicit re-export без примитивов astro:* и node:*
```

Плюс три точки регистрации, без них коллекции «нет»:

1. `src/content.config.ts` — импорт **напрямую из модуля** (`@/entities/<name>/model/collection`)
2. `scripts/lib/content.mjs` — запись в реестре `collections` (каталог, схема, порождаемые
   маршруты): по нему работают `check:content` и `seo:check`; `.gate-fixtures/` не трогается —
   у мини-проектов гейта на гейт свой реестр
3. страницы списка и записи в `src/pages/**` (обе локали) + строки в карте маршрутов

Схема обязана дать: бюджеты `title`/`description`, `pubDate`, `draft` с дефолтом `false`,
`translationKey`. Первая запись — через `/content`, иначе списки пустые и `getStaticPaths`
не порождает ни одного пути.

**Тесты обязательны** — без них храповик покрытия (rule `tests-pipeline`) краснеет без подсказки
(скелеты — `references/templates.md`):

- `model/schema.test.ts` — валидный и невалидный frontmatter, дефолт `draft`, бюджеты
  граничными литералами (не константами модуля)
- `api/queries.test.ts` — по образцу `entities/post/api/queries.test.ts`: `vi.mock('astro:content')`
  через `vi.hoisted`, фильтр черновиков и локали, сортировка, перевод — в обоих режимах `DEV`
- записи коллекции — строкой в `COLLECTIONS` общих фикстур `src/pages/_tests/fixtures.ts` (без
  неё — ошибка typecheck); страницы списка и записи — строки в
  `src/pages/_tests/pages.astro.test.ts`, их адреса — в ожидаемой карте
  `src/pages/_tests/endpoints.server.test.ts`

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

**Тесты обязательны** (образец — `features/contact-form`): `model/schema.test.ts` — значения и
бюджеты полей граничными литералами; `api/<name>.server.test.ts` — каждый исход и строка лога
без PII; `ui/<name>.astro.test.ts` — Container API + `expectNoA11yViolations`; маршрут фичи —
тест в `src/pages/_tests/` (раздел route).

## widget

```
src/widgets/<name>/
├─ ui/<name>.astro
├─ ui/<name>.astro.test.ts    Container API + expectNoA11yViolations
└─ index.ts
```

Widget заводится при **≥ 2 страницах-потребителях** или если это часть каркаса сайта.
Блок одной страницы живёт рядом с ней — в `src/pages/_<name>/`.

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
- **тест обязателен** — в `src/pages/_tests/`: endpoint вызывается напрямую
  (`endpoints.server.test.ts`), страница — `renderToResponse` Container API
  (`contact.astro.test.ts`); проверяются статус, тело или разметка, `Cache-Control` и
  `X-Robots-Tag` — по каждому исходу маршрута

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

Без `export *`, без импортов, без объявлений и вызовов в самом `index.ts` и без примитивов
Astro и Node (`astro:content`, `node:*`): страница берёт данные запросами слайса. Клиентский
`<script>` импортирует только свой слайс, `@/shared/lib` и `@/shared/i18n` (rule
`fsd-architecture`).

## Post-flight (обязательно)

```bash
pnpm format           # Prettier для .astro: новый файл почти всегда не в его стиле
pnpm typecheck        # нет битых импортов и пропсов
pnpm lint             # границы FSD (ESLint boundaries) и правила
pnpm steiger          # структура: public API, сегменты, имена
pnpm test             # тесты артефакта и пороги покрытия
```

Для `collection` дополнительно `pnpm check:content`; перед claim «готово» — `pnpm check`.

## Что НЕ делать

- ❌ Сегменты `components/`, `hooks/`, `utils/`, `types/` — группировка по типу запрещена
- ❌ `export *` из `index.ts`
- ❌ Импорт соседнего слайса того же слоя — поднимай общее в `entities`/`shared` или
  композируй в widget/page
- ❌ Импорт мимо public API (`@/<layer>/<slice>/<segment>/…` или относительным путём из слайса)
- ❌ Каталог вне слоёв (`src/components`, `src/lib`) и `eslint-disable` в коде
- ❌ `prerender = false` на контентной странице
- ❌ Слайс «на будущее»: блок одной страницы — в `src/pages/_<name>/`
