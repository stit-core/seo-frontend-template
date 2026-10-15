import { AUTHORS } from '@/entities/author'
import {
  blogPath,
  findTranslation,
  isTagIndexable,
  listByTag,
  listPosts,
  listTags,
  type Page,
  type Post,
  pageCount,
  postPath,
  tagPath,
} from '@/entities/post'
import { type Locale, localePath, type Translations, t } from '@/shared/i18n'
import { invariant } from '@/shared/lib'
import { blogPosting } from '@/shared/seo'
import { type BlockProps, breadcrumbsOn, pageLocales } from '@/shared/strategy'
import type { breadcrumbs } from '@/widgets/breadcrumbs'
import { articleImagesOf, ogImageOf } from './images'

// Модели страниц блога — здесь, разметка — в .astro: страницы всех локалей делят и то и другое.

// Карта переводов из версий страницы по локалям её строки карты: адрес версии или ничего.
async function translationsOf(
  id: string,
  versionIn: (locale: Locale) => Promise<string | undefined>,
): Promise<Translations> {
  const versions = await Promise.all(
    pageLocales(id).map(async (locale) => [locale, await versionIn(locale)] as const),
  )
  return Object.fromEntries(
    versions.flatMap(([locale, path]) => (path === undefined ? [] : [[locale, path] as const])),
  )
}

// Крошки — у страницы шаблона карты с крошками (запись, тег): путь — главная и блог, последняя ступень — сама страница.
// Видимые крошки и BreadcrumbList печатает оболочка из этого пропа.
function crumbsOf(
  id: string,
  locale: Locale,
  current: string,
): BlockProps<typeof breadcrumbs> | undefined {
  if (!breadcrumbsOn(id)) return undefined
  return {
    id: 'breadcrumbs',
    variant: 'full-path',
    crumb: [
      { label: t(locale, 'nav.home'), link: { href: localePath(locale, '/') } },
      { label: t(locale, 'blog.title'), link: { href: blogPath(locale) } },
    ],
    current,
  }
}

// Автор записи на языке страницы: одни и те же строки уходят в видимую подпись и в Person.
function authorOf({ id, locale, data }: Post) {
  if (data.author === undefined) return undefined
  const author = AUTHORS[data.author]
  invariant(author, `post: автора ${data.author} записи ${id} нет в реестре entities/author`)
  return { id: data.author, name: author.name[locale], jobTitle: author.jobTitle?.[locale] }
}

export async function postPageModel(post: Post) {
  const { locale, data } = post
  const author = authorOf(post)
  // Перевод — только реальный twin по translationKey; slug перевода может отличаться.
  const translations = await translationsOf('post', async (other) => {
    const twin = await findTranslation(post, other)
    return twin && postPath(other, twin.slug)
  })
  // Превью ссылки и кадры разметки — из обложки записи; без обложки превью — карточка сайта.
  const cover = data.cover && data.coverAlt ? { src: data.cover, alt: data.coverAlt } : undefined
  const ogImage = cover && (await ogImageOf(cover.src, cover.alt))
  const imagePaths = cover && (await articleImagesOf(cover.src)).map(({ path }) => path)
  return {
    translations,
    ogImage,
    article: { published: data.pubDate, modified: data.updatedDate },
    author,
    crumbs: crumbsOf('post', locale, data.title),
    jsonLd: [
      blogPosting({
        locale,
        path: postPath(locale, post.slug),
        title: data.title,
        description: data.description,
        published: data.pubDate,
        updated: data.updatedDate,
        imagePaths,
        author,
      }),
    ],
  }
}

export async function blogListPageModel(locale: Locale, page: Page<Post>) {
  // Перевод — та же страница списка у локали, где она есть.
  const translations = await translationsOf('blog', async (other) =>
    page.current <= pageCount((await listPosts(other)).length)
      ? blogPath(other, page.current)
      : undefined,
  )
  // Страницы 2…N — свой сниппет выдачи: номер страницы в h1, title и description.
  const paged = (key: 'blog.pageTitle' | 'blog.title' | 'blog.description') =>
    page.current === 1
      ? t(locale, key)
      : t(locale, 'blog.paged', { text: t(locale, key), page: page.current })
  return {
    translations,
    title: paged('blog.pageTitle'),
    heading: paged('blog.title'),
    description: paged('blog.description'),
    tags: await listTags(locale),
    pagination: {
      current: page.current,
      last: page.last,
      newerHref: page.current > 1 ? blogPath(locale, page.current - 1) : undefined,
      olderHref: page.current < page.last ? blogPath(locale, page.current + 1) : undefined,
    },
  }
}

export async function tagPageModel(locale: Locale, tag: string) {
  // Тег с записями ниже порога — тонкая страница: она закрыта noindex. Перевод — страница тега
  // другой локали, и только от того же порога: hreflang на закрытую страницу не взаимен.
  const indexable = isTagIndexable((await listByTag(locale, tag)).length)
  const translations = await translationsOf('tag', async (other) =>
    other === locale || isTagIndexable((await listByTag(other, tag)).length)
      ? tagPath(other, tag)
      : undefined,
  )
  const heading = t(locale, 'blog.tag', { tag })
  return {
    noindex: !indexable,
    translations,
    title: heading,
    heading,
    description: t(locale, 'blog.tagDescription', { tag }),
    crumbs: crumbsOf('tag', locale, `#${tag}`),
  }
}
