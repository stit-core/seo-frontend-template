---
name: scaffold
description: Разложить один новый артефакт сайта по канону за один проход — page (страница на языках её строки карты через DocumentLayout), collection (коллекция контента со схемой, запросами и маршрутами), feature, block (блок каталога strategy — секция страницы по плану), route (служебный on-demand маршрут). Источник — stable-запись FSD-карты в соседнем <org>/strategy (docs/projects/<slug>/fsd/<surface>/), у block — каталог блоков и планы в strategy/; src/-пути скилл выводит сам из kind и slug. Применяй, когда в сайт добавляется страница, коллекция, фича, блок или служебный маршрут, и когда /init-service или /de-template доходит до реализации своих слайсов. Правка существующего слайса — прямая правка, не этот скилл.
---

# Skill: scaffold

Создаёт файлы одного артефакта по канону этого шаблона и оставляет гейт зелёным.
Не интервьюирует про бизнес — карта слайсов проектируется в `<org>/strategy` (его
`/fsd-deep-dive`), платформенные решения — в `docs/stack` (`/stack-deep-dive`).

Резолв карты — поля `project-slug` / `strategy-path` / `surface` в
`docs/stack/service.md` (дефолт `../strategy`). Готовые скелеты файлов —
`references/templates.md`.

## Когда применять

- «/scaffold <kind> <имя>» — `page` · `collection` · `feature` · `block` · `route`
- «создай страницу услуг», «добавь коллекцию вакансий», «нужен блок отзывов»
- `/init-service` или `/de-template` чейнит этап «свои слайсы»

## Pre-flight

- [ ] Запись есть в FSD-карте (`fsd/<surface>/<kind>.md`) со `status: stable`.
      Нет соседа или записи — next-step «спроектируй в `<org>/strategy`
      (`/fsd-deep-dive`)»; выдумывать слайс здесь нельзя. Для `block` — секция плана в
      `strategy/site/<поверхность>/plans/` ставит блок каталога `strategy/kb/site/04-blocks/blocks.yaml`
- [ ] Имя в kebab-case, не конфликтует с существующим
- [ ] Для `page`/`route` — решён режим рендера в `docs/stack/rendering.md`

## Вопросы юзеру (≤ 3, это не интервью)

1. **Индексируется?** (для `page`/`route`) — от этого `noindex` и участие в карте сайта
2. **На каких языках?** — языки страницы — строка карты `strategy/site/<поверхность>/site-map.yaml`:
   версии `languages` и `lang_versions` страницы
3. **Что внутри** — какие сегменты слайса нужны (`ui`, `model`, `api`, `lib`)

---

## page

```
src/pages/_<name>/<name>-page.astro   разметка страницы (общая для локалей)
src/pages/[...locale]/<path>.astro    маршрут — один файл на все локали: getStaticPaths = localeRoutes('<id>')
```

Обязательное:

- страница — строка карты `strategy/site/<поверхность>/site-map.yaml` (`id`, `url`, `parent`):
  маршрут собирает её на языках её версий в карте, сегмент локали — параметр `[...locale]`

- страница рендерится через `DocumentLayout` с уникальными `title` и `description`
  (бюджеты сниппета: title — от трёх слов до 65 знаков и не общий, description 70–170 —
  их держит `seo:check`)
- карта переводов — `translations={pageVersions('<id>')}`: версии страницы на языках карты; у
  страницы на одном языке hreflang не печатается
- крошки — только у страницы шаблона карты с `breadcrumbs: true` и с глубины 2 (`breadcrumbsOn('<id>')`):
  один проп оболочки `crumbs` — пропсы блока `breadcrumbs` (ступени пути и текущая страница); видимые
  крошки и `BreadcrumbList` оболочка печатает из него. Шапку и подвал ставит оболочка — секциями плана
  страницы (`chrome`), у страницы без своего плана — главной
- служебная (подтверждение, результат, техническая) → проп `noindex`, маршрут без префикса
  локали — в `NOINDEX_ROUTES` (`scripts/lib/site-policy.mjs`)
- карту сайта не трогать: её пишет сборка по страницам `dist/client` — индексируемая страница
  попадает в неё сама, служебная с `noindex` — нет
- тексты — в объекте `COPY` разметки страницы на каждую локаль; подписи навигации — в
  `src/shared/i18n/dict.ts`
- условия и вычисления страницы (ссылка на перевод, крошки, JSON-LD) — в `.ts`-модели рядом с
  её разметкой (как `_blog/models.ts`) с unit-тестом; в `.astro` — разметка
- страница собрана из секций: каждый раздел — `<Section>` из `@/shared/ui/section` с подписью
  (`labelledby` — id своего `<Heading>`, заголовок страницы — `id="page-title"`); ширину, фон и
  шаг задают её пропсы, класс ширины в странице — ошибка ESLint (rule `shared-ui`)
- **тест обязателен**: строка маршрута в `src/pages/_tests/pages.astro.test.ts` — на каждой
  локали страницы язык, self-canonical или `noindex`, hreflang версий, типы JSON-LD, один `h1`,
  страница — из секций

Не нужно: править e2e — цели HTTP- и браузерного наборов (`e2e/site.ts`) выводятся из
`dist/client`, `src/pages` и контента, и новая страница попадает в них сама.

## collection

```
src/entities/<name>/
├─ content/<locale>/<slug>.md      записи; обложки — content/covers/<translationKey>.jpg|png
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
3. страницы списка и записи в `src/pages/[...locale]/**` (файл маршрута — один на все локали) +
   строки в карте маршрутов

Схема обязана дать: бюджеты `title`/`description`, `pubDate`, `draft` с дефолтом `false`,
`translationKey`. Первая запись — через `/content`, иначе списки пустые и `getStaticPaths`
не порождает ни одного пути.

**Тесты обязательны** — без них храповик покрытия (rule `tests-pipeline`) краснеет без подсказки
(скелеты — `references/templates.md`):

- `model/schema.test.ts` — валидный и невалидный frontmatter, дефолт `draft`, бюджеты
  граничными литералами (не константами модуля)
- `api/queries.test.ts` — по образцу `entities/post/api/queries.test.ts`: `vi.mock('astro:content')`
  через `vi.hoisted`, записи на локалях теста (`withTestLocales`), фильтр черновиков и локали,
  сортировка, перевод — в обоих режимах `DEV`
- записи коллекции — строкой в `COLLECTIONS` общих фикстур `src/pages/_tests/fixtures.ts` (без
  неё — ошибка typecheck); страница списка — строка в `src/pages/_tests/pages.astro.test.ts`,
  маршруты записей — на локалях и карте теста по образцу `src/pages/_tests/blog.astro.test.ts`

## feature

```
src/features/<name>/
├─ ui/<name>.astro
├─ model/schema.ts    если есть ввод от человека
├─ api/<name>.ts      если есть серверная сторона
└─ index.ts
```

Сценарий с результатом («отправить заявку», «подписаться»). По умолчанию — **без
JavaScript**: форма шлёт нативный POST, ответ рисует сервер. Остров заводится моментом
спецификации движения или плана страницы: строка в `docs/stack/rendering.md § Интерактивность` и
строка реестра `ISLANDS` (`src/shared/config/islands.ts`) — основание, страницы и бюджет в brotli;
инлайн — ещё хеш тела, файл — путь компонента.

**Тесты обязательны** (образец — `features/contact-form`): `model/schema.test.ts` — значения и
бюджеты полей граничными литералами; `api/<name>.server.test.ts` — каждый исход и строка лога
без PII; `ui/<name>.astro.test.ts` — Container API + `expectNoA11yViolations`; маршрут фичи —
тест в `src/pages/_tests/` (раздел route).

## block

```
src/widgets/<block-id>/
├─ model/block.ts               контракт: defineBlock — id блока каталога, варианты, слоты
├─ ui/<block-id>.astro          разметка — html блока каталога, внутри — Section
├─ ui/<block-id>.astro.test.ts  Container API + expectNoA11yViolations
└─ index.ts                     контракт <blockName> и компонент <BlockName>
```

Источник — блок каталога `strategy/kb/site/04-blocks/blocks.yaml` (анатомия, варианты, `html`,
телефон) и секции планов `strategy/site/<поверхность>/plans/`, которые его ставят. Блок — widget при
любом числе страниц; блок, который не ставит ни один план, не заводится.

Обязательное:

- слайс — id блока каталога; варианты — те, что ставят планы (варианты каталога); вариант — раскладка
  той же анатомии: что даёт секция плана, блок печатает в любом своём варианте, кроме элемента, который
  вариант снимает в каталоге (`drops`)
- слоты — id элементов анатомии: обязательные в вариантах блока и все, что заполняют планы; вид
  значения — `text`, `action` (адрес цели, у версии основного языка — с `hreflang`; подпись — свой
  текстовый элемент: `cta` ↔ `cta-label`, пары по порядку плана — `labelled`), `untargeted` (действие
  без цели в плане — адрес собирает код), `fact`, `media` (медиа-слот: чтение его не заполняет),
  `unshown` (текст, который блок принимает и не показывает, — только успех формы: слот `form-success`
  блока с формой), `date` (дата записи
  коллекции — её кладёт страница), `list(…)` (элемент, который план заполняет не раз), `group({…})`
  (набор каталога с его элементами); необязательный — `.optional()`
- пропсы компонента — `BlockProps<typeof <block>>`: id секции плана, вариант и слоты; тексты — только
  из пропсов; public API — контракт `<blockName>` и компонент `<BlockName>` (имена — от id блока: по
  имени компонента тест контракта рендерит секции планов)
- разметка — `html` блока каталога: секция страницы — `<Section>` с подписью своим `<Heading>`, чей id —
  id секции плана (на него ведёт якорь `#<id>` действия), уровень — `heading` анатомии (один h1 на
  странице); набор — список, карточка — `Card`; действие — `ActionLink`; раскладка на телефоне —
  `mobile` блока каталога
- страница ставит блок пропсами своей секции — `<HeroText {...heroText.props(page, 'hero')} />`,
  страница — `strategyPage('<id>', locale)`: не та секция, вариант не блока, слот вне его анатомии или
  без значения — ошибка сборки с ключом секции; блок каркаса (роль `header`, `footer`) ставит оболочка —
  его лендмарк из `html` каталога на `Container` страницы, а не `Section`
- тест контракта `src/pages/_tests/blocks.astro.test.ts` судит новый блок без правки: слайс — id
  каталога, контракт и компонент — в public API, варианты и слоты — из каталога, обязательные элементы
  приняты, секции планов снимка и фикстуры базы — вариант блока и принятые слоты, а их разметка —
  заголовок с id секции уровня каталога и секция целиком: каждый текст — целый текст своего элемента,
  адрес действия — ссылка на цель с её языком (каркас — в своём лендмарке, кроме разделов без версии
  на языке страницы)
- **тест обязателен** — `ui/<block-id>.astro.test.ts` на секции блока в проекте теста (`TEST_SITE`,
  `shared/lib/testing/site.ts`: план страницы и тексты на языках теста): секция целиком на каждом языке
  (`sectionFaults`), подпись своим заголовком, каждый слот — на своём месте (текст, адрес действия,
  каждый экземпляр набора по порядку), у картинки блока — `sizes` контейнера её секции (`SLOT_SIZES`,
  как у обложки записи), axe

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
- ❌ Блок «на будущее»: блок заводится, когда его ставит секция плана, а слот — когда его требует
  каталог или заполняет план
- ❌ Облик мимо ДС: палитра, шрифты и движение — только роли токен-слоя и проза ДС, плагин вёрстки
  `frontend-design` — с этим ограничением (rule `shared-ui`)
