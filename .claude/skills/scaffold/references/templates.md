# Скелеты файлов

Готовые к копированию заготовки: подставить имя слайса, тексты и поля. Форма — как у
живых файлов reference-набора; если он ещё на месте, сверяйся с ним, а не с этим файлом.

---

## page — разметка `src/pages/_<name>/<name>-page.astro`

```astro
---
import DocumentLayout from '@/app/layouts/document.astro'
import { type Locale, localePath, t } from '@/shared/i18n'
import { breadcrumbList } from '@/shared/seo'
import { pageVersions } from '@/shared/strategy'
import { Heading } from '@/shared/ui/heading'
import { Section } from '@/shared/ui/section'
import { Breadcrumbs } from '@/widgets/breadcrumbs'

interface Props {
  locale: Locale
}

const { locale } = Astro.props

const COPY = {
  ru: {
    title: 'Заголовок страницы',
    description: 'Описание страницы для выдачи: 70–170 символов, уникальное среди всех страниц.',
    lead: 'Первый абзац.',
  },
  en: {
    title: 'Page title',
    description: 'Page description for search results: 70–170 characters, unique across the site.',
    lead: 'Opening paragraph.',
  },
} satisfies Record<Locale, unknown>

const copy = COPY[locale]
const crumbs = [
  { name: t(locale, 'nav.home'), href: localePath(locale, '/') },
  { name: copy.title },
]
---

<DocumentLayout
  locale={locale}
  title={copy.title}
  description={copy.description}
  translations={pageVersions('<id>')}
  jsonLd={[breadcrumbList(crumbs)]}
>
  <Section labelledby="page-title">
    <Breadcrumbs locale={locale} items={crumbs} class="mb-md" />
    <Heading id="page-title" level={1}>
      {copy.title}
    </Heading>
    <p class="mt-stack-display text-lead text-secondary">{copy.lead}</p>
  </Section>
</DocumentLayout>
```

Страница верхнего уровня — без `<Breadcrumbs>` и без `breadcrumbList`.
Служебная — проп `noindex` вместо `jsonLd`.

Страница собрана из секций: каждый раздел — свой `<Section>` с подписью лендмарка
(`labelledby` — id своего `<Heading>`, без видимого заголовка — `label`). Ширину даёт `width`
(`reading` — умолчание, `page`, `wide`, `full`), полосу фона — `tone`, шаг — `rhythm`; класс
ширины (`max-w-*`) в странице или блоке — ошибка ESLint:

```astro
<Section labelledby="details">
  <Heading id="details" level={2}>
    {copy.details}
  </Heading>
  <p class="mt-lg text-body">{copy.text}</p>
</Section>
```

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
шаблон маршрута, модуль и типы JSON-LD (служебная — свой тест по образцу подтверждения заявки):

```ts
import * as NamePage from '../[...locale]/<path>.astro'

['/[...locale]/<path>', NamePage, () => ['BreadcrumbList']],
```

Адреса, языки и hreflang тест берёт из getStaticPaths маршрута: страница на одном языке — без hreflang.

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
значения (`text`, `action`, `fact`, `list(…)`, `group({…})`):

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

Разметка — `html` блока каталога; пропсы — контракта, тексты — только из них:

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
      <ActionLink href={cta.href} label={ctaLabel} kind="primary" />
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

Тест рядом — Container API на пропсах контракта: разметка — разбором (`parseHtml`: элементы,
атрибуты, текст), а не подстрокой тега; каждый слот — на своём месте; доступность —
`expectNoA11yViolations`:

```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import <BlockName> from './<block-id>.astro'

const astro = await AstroContainer.create()
const cards = [
  { title: 'Замер', body: 'Приедем в удобный день.' },
  { title: 'Смета', body: 'Посчитаем за три дня.' },
]
const slots = { id: 'benefits', variant: '<variant>', title: 'Как мы работаем', card: cards }

describe('<BlockName>', () => {
  it('секция подписана заголовком с id секции плана, карточки — все и по порядку', async () => {
    const section = parseHtml(await astro.renderToString(<BlockName>, { props: slots })).querySelector('section')
    expect(section?.getAttribute('aria-labelledby')).toBe('benefits')
    expect(section?.querySelector('h2')?.textContent).toBe('Как мы работаем')
    const items = [...(section?.querySelectorAll('ul > li') ?? [])]
    expect(items.map((item) => item.querySelector('h3')?.textContent)).toEqual(['Замер', 'Смета'])
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(await astro.renderToString(<BlockName>, { props: slots }))
  })
})
```

Страница ставит блок пропсами своей секции: `<BlockName {...<blockName>.props(page, '<section-id>')} />`,
`page` — `strategyPage('<page-id>', locale)`. Новый блок тест контракта
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

```astro
---
export const prerender = false

import DocumentLayout from '@/app/layouts/document.astro'
import { Heading } from '@/shared/ui/heading'
import { Section } from '@/shared/ui/section'

const locale = 'ru' as const

// Роут важнее middleware: живой или персональный ответ не кешируется.
Astro.response.headers.set('cache-control', 'private, no-store')
---

<DocumentLayout locale={locale} title="Заголовок" description="Описание." noindex>
  <Section labelledby="page-title">
    <Heading id="page-title" level={1}>
      Заголовок
    </Heading>
  </Section>
</DocumentLayout>
```

Каждый такой маршрут — строка в `docs/reference/rendering.md` и в
`docs/stack/rendering.md`, и он не попадает в `sitemap.xml`.

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
