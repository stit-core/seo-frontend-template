import { AUTHORS } from '@/entities/author'
import {
  blogPath,
  blogRoute,
  findTranslation,
  isTagIndexable,
  listByTag,
  listPosts,
  listTags,
  type Page,
  type Post,
  pageCount,
  postPath,
  postRoute,
  tagRoute,
} from '@/entities/post'
import { type Locale, localePath, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { invariant } from '@/shared/lib'
import { blogPosting, breadcrumbList, type Crumb } from '@/shared/seo'
import { articleImagesOf, ogImageOf } from './images'

// Логика секций блога — здесь, разметка — в .astro: ru- и en-страницы делят и то и другое.
const otherLocale = (locale: Locale): Locale | undefined =>
  SUPPORTED_LOCALES.find((candidate) => candidate !== locale)

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
  // Ссылка на перевод — только при реальном twin по translationKey; slug перевода может отличаться.
  const other = otherLocale(locale)
  const twin = other ? await findTranslation(post, other) : undefined
  // Превью ссылки и кадры разметки — из обложки записи; без обложки превью — карточка сайта.
  const cover = data.cover && data.coverAlt ? { src: data.cover, alt: data.coverAlt } : undefined
  const ogImage = cover && (await ogImageOf(cover.src, cover.alt))
  const imagePaths = cover && (await articleImagesOf(cover.src)).map(({ path }) => path)
  const crumbs: Crumb[] = [
    { name: t(locale, 'nav.home'), href: localePath(locale, '/') },
    { name: t(locale, 'blog.title'), href: blogPath(locale) },
    { name: data.title },
  ]
  return {
    alternatePath: twin ? postRoute(twin.slug) : undefined,
    ogImage,
    article: { published: data.pubDate, modified: data.updatedDate },
    author,
    crumbs,
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
      breadcrumbList(crumbs),
    ],
  }
}

export async function blogListPageModel(locale: Locale, page: Page<Post>) {
  // Ссылка на другую локаль — только если у неё есть такая же страница списка.
  const other = otherLocale(locale)
  const alternatePath =
    other && page.current <= pageCount((await listPosts(other)).length)
      ? blogRoute(page.current)
      : undefined
  // Страницы 2…N — свой сниппет выдачи: суффикс «— страница N» в h1, title и description.
  const pageSuffix = page.current === 1 ? '' : ` — ${t(locale, 'blog.page')} ${page.current}`
  const crumbs: Crumb[] = [
    { name: t(locale, 'nav.home'), href: localePath(locale, '/') },
    ...(page.current === 1
      ? [{ name: t(locale, 'blog.title') }]
      : [
          { name: t(locale, 'blog.title'), href: blogPath(locale) },
          { name: `${t(locale, 'blog.page')} ${page.current}` },
        ]),
  ]
  return {
    alternatePath,
    title: `${t(locale, 'blog.pageTitle')}${pageSuffix}`,
    heading: `${t(locale, 'blog.title')}${pageSuffix}`,
    description: `${t(locale, 'blog.description')}${pageSuffix}`,
    crumbs,
    jsonLd: [breadcrumbList(crumbs)],
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
  const other = otherLocale(locale)
  const alternatePath =
    other && isTagIndexable((await listByTag(other, tag)).length) ? tagRoute(tag) : undefined
  const heading = `${t(locale, 'blog.tagLead')} #${tag}`
  const crumbs: Crumb[] = [
    { name: t(locale, 'nav.home'), href: localePath(locale, '/') },
    { name: t(locale, 'blog.title'), href: blogPath(locale) },
    { name: `#${tag}` },
  ]
  return {
    noindex: !indexable,
    alternatePath,
    title: heading,
    heading,
    description: `${heading} — ${t(locale, 'blog.tagDescription')}`,
    crumbs,
    jsonLd: [breadcrumbList(crumbs)],
  }
}
