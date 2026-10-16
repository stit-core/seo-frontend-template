import { AUTHORS } from '@/entities/author'
import {
  blogPath,
  findTranslation,
  isTagIndexable,
  listByTag,
  listPosts,
  type Page,
  type Post,
  pageCount,
  postCard,
  postPath,
  tagPath,
} from '@/entities/post'
import { type Locale, type Translations, t } from '@/shared/i18n'
import { invariant } from '@/shared/lib'
import { blogPosting } from '@/shared/seo'
import { pageLocales, relatedOf } from '@/shared/strategy'
import { articleImagesOf, ogImageOf } from './images'

// Модели страниц блога — здесь, разметка — в .astro: страницы всех локалей делят и то и другое. Тексты шаблонов —
// планы и copy deck страниц блога; модель даёт то, что приходит из коллекции.

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

// Автор записи на языке страницы: одни и те же строки уходят в видимую подпись и в Person.
function authorOf({ id, locale, data }: Post) {
  if (data.author === undefined) return undefined
  const author = AUTHORS[data.author]
  invariant(author, `post: автора ${data.author} записи ${id} нет в реестре entities/author`)
  return {
    id: data.author,
    name: author.name[locale],
    jobTitle: author.jobTitle?.[locale],
    profile: author.profile,
  }
}

// Связанные записи — правило «связанных» шаблона записи в карте: записи той же локали с общим тегом, новые первыми, не
// больше максимума правила; сама запись не связанная. Нет таких — секции нет.
async function relatedTo(post: Post) {
  const rule = relatedOf('post')
  invariant(rule.by === 'shared-tag', `post: связанные по ${rule.by} — записи связывает общий тег`)
  const related = (await listPosts(post.locale)).filter(
    (other) => other.id !== post.id && other.data.tags.some((tag) => post.data.tags.includes(tag)),
  )
  return related.slice(0, rule.max).map((other) => ({
    title: other.data.title,
    link: { href: postPath(other.locale, other.slug) },
  }))
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
    // Слоты записи шаблона: заголовок, лид, даты, автор и обложка.
    record: {
      title: data.title,
      lead: data.description,
      date: { published: data.pubDate, updated: data.updatedDate },
      author: author && { name: author.name, jobTitle: author.jobTitle, profile: author.profile },
      cover: data.cover,
      alt: data.coverAlt,
    },
    tags: data.tags.map((tag) => ({ label: `#${tag}`, href: tagPath(locale, tag) })),
    related: await relatedTo(post),
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
  return {
    translations,
    // Страницы 2…N — свой сниппет выдачи: номер страницы в h1, title и description.
    paged: (text: string) =>
      page.current === 1 ? text : t(locale, 'blog.paged', { text, page: page.current }),
    articles: page.items.map(postCard),
    pagination: {
      current: page.current,
      last: page.last,
      newer: page.current > 1 ? blogPath(locale, page.current - 1) : undefined,
      older: page.current < page.last ? blogPath(locale, page.current + 1) : undefined,
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
  // Подпись и вводный абзац тега — его заголовок и описание страницы, текущая крошка — сам тег.
  return {
    noindex: !indexable,
    translations,
    title: t(locale, 'blog.tag', { tag }),
    description: t(locale, 'blog.tagDescription', { tag }),
    current: `#${tag}`,
  }
}
