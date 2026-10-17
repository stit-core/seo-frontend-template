# Скелеты файлов

Готовые к копированию заготовки: подставить имя слайса, тексты и поля. Форма — как у
живых файлов reference-набора; если он ещё на месте, сверяйся с ним, а не с этим файлом.

---

## page — данные `strategy/site/<поверхность>/`

Строка карты (`site-map.yaml`: `id`, `url`, `parent`, при нужде `template` и `lang_versions`), план
`plans/<id>.yaml` и copy deck `copy/<id>.yaml` (на другом языке — `copy/<id>.<lang>.yaml`) — форма
strategy: образец — план и copy deck «О компании» проекта шаблона (`plans/about.yaml`, `copy/about.yaml`).
Секции плана — блоки каталога по порядку страницы, шапка и подвал — тоже секции; тексты слотов — в copy
deck по ключу `page/section/slot`, мета — `meta` страницы (заголовок с брендом, описание), контакты и
реквизиты — факты (`facts*.yaml`). Валидаторы соседа по проекту — без `error` (`site_validate.py`,
`copydeck.py check`).

## page — разметка `src/pages/_<name>/<name>-page.astro`

```astro
---
import files from 'virtual:strategy/<id>'
import DocumentLayout from '@/app/layouts/document.astro'
import type { Locale } from '@/shared/i18n'
import { pageOf, pageVersions } from '@/shared/strategy'
import { HeroText, heroText } from '@/widgets/hero-text'
import { Prose, prose } from '@/widgets/prose'

interface Props {
  locale: Locale
}

const { locale } = Astro.props
const page = pageOf(files, locale)
---

<DocumentLayout
  locale={locale}
  chrome={page}
  translations={pageVersions(page.id)}
  meta={page.meta}
>
  <HeroText {...heroText.props(page, 'hero')} />
  <Prose {...prose.props(page, '<section-id>')} />
</DocumentLayout>
```

Страница — блоки секций своего плана по порядку (секцию без блока шаблона заводит `/scaffold block`):
пропсы блока — его секция плана, свою `Section` с подписью заголовком рисует блок. Шапку и подвал ставит
оболочка секциями плана, который передаёт страница (`chrome`; без своего плана — модуль главной
`virtual:strategy/home`). Значения из коллекции — третьим аргументом пропсов: наборы записей
(`articleCards.props(page, '<section-id>', { article })`) и, у шаблона коллекции (`templateOf`), слоты записи.
Крошки — у страницы шаблона карты с `breadcrumbs: true` и с глубины 2: секция `breadcrumbs` её плана,
проп оболочки `crumbs={breadcrumbs.props(page, 'breadcrumbs')}`; видимые крошки и `BreadcrumbList`
оболочка печатает из него. Разметка — проп `jsonLd`: фабрики `shared/seo` типов `seo.structured_data`
плана по порядку (`aboutPage({ locale, path: page.url, name: page.meta.title })`; тип без фабрики —
фабрика вместе со страницей), `BreadcrumbList` оболочка печатает из крошек. Служебная — проп `noindex`.
Текста литералом в разметке нет: тексты — copy deck и факты, подпись интерфейса — строка словаря `t()`.

## page — маршрут `src/pages/[...locale]/<path>.astro`

Один файл на все локали: пути — языки версий страницы `<id>` в карте, сегмент дефолтной локали пуст.

```astro
---
import type { GetStaticPaths, InferGetStaticPropsType } from 'astro'
import { localeRoutes } from '@/shared/strategy'
import NamePage from '../_<name>/<name>-page.astro'

export const getStaticPaths = (() => localeRoutes('<id>')) satisfies GetStaticPaths

type Props = InferGetStaticPropsType<typeof getStaticPaths>

const { locale } = Astro.props
---

<NamePage locale={locale} />
```

## page — тест

`src/pages/_tests/pages.astro.test.ts`: импорт маршрута и строка в таблице индексируемых страниц —
шаблон маршрута, модуль и id страницы карты (по нему тест судит крошки; служебная — свой тест по образцу
подтверждения заявки):

```ts
import * as NamePage from '../[...locale]/<path>.astro'

['/[...locale]/<path>', NamePage, '<id>'],
```

Адреса, языки и hreflang тест берёт из getStaticPaths маршрута: страница на одном языке — без hreflang.
Типы JSON-LD — `seo.structured_data` плана: их на каждой странице снимка сверяет тест сам.

---

## collection — `model/schema.ts`

```ts
import type { SchemaContext } from 'astro:content'
import { z } from 'zod'

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const TITLE_LENGTH = { min: 25, max: 65 } as const
export const DESCRIPTION_LENGTH = { min: 70, max: 170 } as const

const slug = z.string().regex(SLUG_RE, 'только a-z, 0-9 и дефисы')

// Язык записи — каталог content/<locale>/, не поле: один источник истины.
export const <name>Schema = ({ image }: SchemaContext) =>
  z.strictObject({
    title: z.string().trim().min(TITLE_LENGTH.min).max(TITLE_LENGTH.max),
    description: z.string().trim().min(DESCRIPTION_LENGTH.min).max(DESCRIPTION_LENGTH.max),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    cover: image().optional(),
    coverAlt: z.string().trim().min(1).optional(),
    draft: z.boolean().default(false),
    translationKey: slug,
  })

export type <Name>Data = z.infer<ReturnType<typeof <name>Schema>>
```

`strictObject` обязателен: опечатка в имени поля должна ломать сборку, а не молча
исчезать. Поля со связью (`cover` ⊥ `coverAlt`, `updatedDate` ≥ `pubDate`) — через
`.superRefine`. Подпись автора — поле `author` и контекст схемы как у `post`
(`PostSchemaContext`): id реестра `entities/author` коллекции передаёт `src/content.config.ts`,
подпись в слот статьи ставит страница.

## collection — `model/collection.ts`

```ts
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { <name>Schema } from './schema'

// Контент живёт внутри слайса; id записи — путь от base: `<locale>/<slug>`.
export const <name>Collection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/entities/<name>/content' }),
  schema: <name>Schema,
})
```

## collection — регистрация

`src/content.config.ts` (импорт напрямую из модуля, не через баррель):

```ts
import { <name>Collection } from '@/entities/<name>/model/collection'

export const collections = { <name>: <name>Collection }
```

`scripts/lib/content.mjs` — запись в реестре: каталог, схема, маршруты коллекции. Без
неё каталог контента вне реестра валит `check:content`, а `seo:check` не сверит пары переводов.

```js
{
  name: '<name>',
  dir: 'src/entities/<name>/content',
  schema: <name>Schema,
  entryRoute: (slug) => `/<path>/${slug}`,
  routes: ({ slugs }) => ['/<path>', ...slugs.map((slug) => `/<path>/${slug}`)],
}
```

У коллекции со страницами тегов — ещё `tagRoute: (tag) => `/<path>/tag/${tag}`` (и эти адреса в
`routes`): по нему `seo:check` держит порог индексации тега — от трёх записей локали страница
индексируется, ниже — только с `noindex` (`isTagIndexable` в `entities/post`, `TAG_INDEX_MIN_POSTS`
политики сборки).

## collection — `api/queries.ts`

Обязанности: фильтр `draft` (виден только в `astro dev` — `import.meta.env.DEV`), фильтр
локали по префиксу id, сортировка по `pubDate` вниз, поиск перевода по `translationKey`.
Тесты — `vi.mock('astro:content')` с фикстурами через `vi.hoisted`, оба режима
(`vi.stubEnv('DEV', false | true)`): образец — `src/entities/post/api/queries.test.ts`.

## collection — тесты схемы и маршрутов

`model/schema.test.ts` — бюджеты граничными литералами: константа модуля под тестом молча
сдвинулась бы вместе с ошибкой.

```ts
const image = (() =>
  z.object({ src: z.string(), width: z.number(), height: z.number() })) as unknown as ImageFunction
const schema = <name>Schema({ image })

it('title — 25…65 знаков', () => {
  expect(schema.safeParse({ ...valid, title: 'x'.repeat(25) }).success).toBe(true)
  expect(schema.safeParse({ ...valid, title: 'x'.repeat(24) }).success).toBe(false)
  expect(schema.safeParse({ ...valid, title: 'x'.repeat(66) }).success).toBe(false)
})
```

`src/pages/_tests/fixtures.ts` — массив `readonly CollectionEntry<'<name>'>[]` и строка в
`COLLECTIONS` (мок `astro:content` отдаёт записи по имени коллекции; коллекция без строки —
ошибка typecheck); страница списка — строка в `pages.astro.test.ts` (как у page), маршруты записей
и пары переводов — на локалях и карте теста по образцу `blog.astro.test.ts` (rule `tests-pipeline`
§ Локали).

---

## block — `model/block.ts`, `ui/<block-id>.astro` и `index.ts`

Контракт — id блока каталога, варианты, которые ставят планы, и слоты — id элементов анатомии с видом
значения (`text`, `action`, `untargeted`, `fact`, `media`, `unshown`, `date`, `image`, `list(…)`, `group({…})`,
`records({…})`):

```ts
import { action, defineBlock, group, text } from '@/shared/strategy'

export const <blockName> = defineBlock({
  id: '<block-id>',
  variants: ['<variant>'],
  slots: {
    title: text,
    cta: action.optional(),
    'cta-label': text.optional(),
    card: group({ title: text, body: text }),
  },
})
```

Разметка — `html` блока каталога; пропсы — контракта, тексты секции — только из них (строка словаря —
лишь подпись интерфейса: лендмарк, заглушка пустого списка, термин пары); цель действия на основном
языке — с её `hreflang`:

```astro
---
import type { BlockProps } from '@/shared/strategy'
import { ActionLink } from '@/shared/ui/action'
import { Card } from '@/shared/ui/card'
import { Heading } from '@/shared/ui/heading'
import { Section } from '@/shared/ui/section'
import type { <blockName> } from '../model/block'

type Props = BlockProps<typeof <blockName>>

const { id, title, cta, 'cta-label': ctaLabel, card: cards } = Astro.props
---

<Section labelledby={id}>
  <Heading id={id} level={2}>
    {title}
  </Heading>
  <ul class="mt-lg grid gap-lg tablet:grid-cols-2">
    {cards.map((card) => (
      <Card title={card.title}>
        <p>{card.body}</p>
      </Card>
    ))}
  </ul>
  {cta && ctaLabel && (
    <p class="mt-xl">
      <ActionLink href={cta.href} hreflang={cta.hreflang} label={ctaLabel} kind="primary" />
    </p>
  )}
</Section>
```

Секция подписана своим заголовком: id — id секции плана (на него ведёт якорь `#<id>` действия),
уровень — `heading` анатомии. Ссылка вне строки текста несёт класс `touch-target` — цель касания на
таче (rule `shared-ui`).

```ts
export { <blockName> } from './model/block'
export { default as <BlockName> } from './ui/<block-id>.astro'
```

Тест рядом — Container API на секции блока в проекте теста: план страницы с секцией блока и её тексты на
языках теста — строки `TEST_SITE` (`src/shared/lib/testing/site.ts`); разметка — разбором (`parseHtml`:
элементы, атрибуты, текст), а не подстрокой тега; секция целиком на каждом языке — `sectionFaults`;
доступность — `expectNoA11yViolations`:

```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { strategyPage } from '@/shared/strategy'
import { <blockName> } from '../model/block'
import <BlockName> from './<block-id>.astro'

// Секция — страница <page-id> проекта теста на его локалях.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const render = async (locale = testLocale('ru')) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(<BlockName>, {
    props: <blockName>.props(strategyPage('<page-id>', locale), '<section-id>'),
  })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('<BlockName>', () => {
  it('секция плана — в разметке на каждом языке страницы', async () => {
    for (const locale of [testLocale('ru'), testLocale('en')]) {
      const { html } = await render(locale)
      const page = strategyPage('<page-id>', locale)
      expect(sectionFaults(html, page, '<section-id>', <blockName>), locale).toEqual([])
    }
  })

  it('секция подписана заголовком с id секции плана, карточки — все и по порядку', async () => {
    const { section } = await render()
    expect(section?.getAttribute('aria-labelledby')).toBe('<section-id>')
    expect(section?.querySelector('h2')?.id).toBe('<section-id>')
    expect([...(section?.querySelectorAll('ul > li h3') ?? [])].map((h3) => h3.textContent)).toEqual([
      '<текст card-1-title>',
      '<текст card-2-title>',
    ])
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
```

Страница ставит блок пропсами своей секции: `<BlockName {...<blockName>.props(page, '<section-id>')} />`,
`page` — `pageOf(files, locale)`, `files` — модуль `virtual:strategy/<page-id>`. Новый блок тест контракта
`src/pages/_tests/blocks.astro.test.ts` находит сам.

---

## route — endpoint `src/pages/<name>.ts`

```ts
export const prerender = false

import type { APIRoute } from 'astro'

export const GET: APIRoute = () =>
  new Response('ok', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Живой ответ — не для общих кешей; файл для краулера — короткий public, max-age.
      'cache-control': 'no-store',
      // Ответ не страница выдачи.
      'x-robots-tag': 'noindex',
    },
  })
```

`export const prerender = false` стоит **первой строкой**: Astro читает его статически.

## route — страница `src/pages/<name>.astro`

Страница на запрос — тоже страница карты: строка карты, план и copy deck в `strategy/`, как у page.

```astro
---
export const prerender = false

import files from 'virtual:strategy/<id>'
import DocumentLayout from '@/app/layouts/document.astro'
import { localeOf } from '@/shared/i18n'
import { pageOf } from '@/shared/strategy'
import { HeroText, heroText } from '@/widgets/hero-text'

// Язык — по префиксу запрошенного пути: под `/en/…` человек читает английскую версию.
const locale = localeOf(Astro.url.pathname)
const page = pageOf(files, locale)

// Роут важнее middleware: живой или персональный ответ не кешируется.
Astro.response.headers.set('cache-control', 'private, no-store')
---

<DocumentLayout
  locale={locale}
  chrome={page}
  meta={page.meta}
  noindex
>
  <HeroText {...heroText.props(page, 'hero')} />
</DocumentLayout>
```

Каждый такой маршрут — строка в `docs/reference/rendering.md` и в
`docs/stack/rendering.md`, и он не попадает в `sitemap.xml`; серверный бандл везёт данные только его
страницы (модуль `virtual:strategy/<id>` — `seo:check`).

## route — тест

Endpoint — в `src/pages/_tests/endpoints.server.test.ts` (хелпер `get` вызывает `GET` с
параметрами пути):

```ts
import { GET as name } from '../<name>.ts'

describe('<name>', () => {
  it('ответ и заголовки', async () => {
    const response = await get(name)
    expect([response.status, await response.text()]).toEqual([200, 'ok'])
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
  })
})
```

Страница — `renderToResponse`, как в `src/pages/_tests/contact.astro.test.ts`: статус,
`Cache-Control` и разметка каждого исхода.
