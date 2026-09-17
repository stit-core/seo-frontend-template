# Скелеты файлов

Готовые к копированию заготовки: подставить имя слайса, тексты и поля. Форма — как у
живых файлов reference-набора; если он ещё на месте, сверяйся с ним, а не с этим файлом.

---

## page — секция `src/pages/_<name>/<name>-page.astro`

```astro
---
import DocumentLayout from '@/app/layouts/document.astro'
import { type Locale, localePath, t } from '@/shared/i18n'
import { breadcrumbList } from '@/shared/seo'
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
  alternatePath="/<path>"
  jsonLd={[breadcrumbList(crumbs)]}
>
  <Breadcrumbs locale={locale} items={crumbs} class="mb-4" />
  <h1 class="text-heading-xl font-semibold tracking-tight">{copy.title}</h1>
  <p class="mt-4 text-body-lg text-muted">{copy.lead}</p>
</DocumentLayout>
```

Страница верхнего уровня — без `<Breadcrumbs>` и без `breadcrumbList`.
Служебная — проп `noindex` вместо `alternatePath`/`jsonLd`.

## page — обёртки локалей

`src/pages/<path>.astro`:

```astro
---
import NamePage from './_<name>/<name>-page.astro'

const locale = 'ru' as const
---

<NamePage locale={locale} />
```

`src/pages/en/<path>.astro` — то же с `locale = 'en'` и путём `../_<name>/<name>-page.astro`.

## page — строка в карте сайта

`src/pages/sitemap.xml.ts`, если страница индексируемая и вне коллекций:

```ts
{ route: '/<path>', locales: SUPPORTED_LOCALES },   // или [DEFAULT_LOCALE]
```

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
`.superRefine`.

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
неё `check:content` не увидит записи, а `seo:check` — пары переводов.

```js
{
  name: '<name>',
  dir: 'src/entities/<name>/content',
  schema: <name>Schema,
  entryRoute: (slug) => `/<path>/${slug}`,
  routes: ({ slugs }) => ['/<path>', ...slugs.map((slug) => `/<path>/${slug}`)],
}
```

## collection — `api/queries.ts`

Обязанности: фильтр `draft` (виден только в `astro dev` — `import.meta.env.DEV`), фильтр
локали по префиксу id, сортировка по `pubDate` вниз, поиск перевода по `translationKey`.
Тесты — `vi.mock('astro:content')` с фикстурами через `vi.hoisted`, оба режима
(`vi.stubEnv('DEV', false | true)`).

---

## widget — `ui/<name>.astro` и `index.ts`

```astro
---
import type { Locale } from '@/shared/i18n'

interface Props {
  locale: Locale
  class?: string | undefined
}

const { locale, class: className } = Astro.props
---

<section class={className}>
  <!-- разметка -->
</section>
```

```ts
export { default as <Name> } from './ui/<name>.astro'
```

Тест рядом — Container API + `expectNoA11yViolations`:

```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations } from '@/shared/lib/testing'
import <Name> from './<name>.astro'

describe('<Name>', () => {
  it('рендерится и проходит axe', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(<Name>, { props: { locale: 'ru' } })
    expect(html).toContain('<section')
    await expectNoA11yViolations(html)
  })
})
```

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

const locale = 'ru' as const

// Роут важнее middleware: живой или персональный ответ не кешируется.
Astro.response.headers.set('cache-control', 'private, no-store')
---

<DocumentLayout locale={locale} title="Заголовок" description="Описание." noindex>
  <h1 class="text-heading-xl font-semibold tracking-tight">Заголовок</h1>
</DocumentLayout>
```

Каждый такой маршрут — строка в `docs/reference/rendering.md` и в
`docs/stack/rendering.md`, и он не попадает в `sitemap.xml`.
