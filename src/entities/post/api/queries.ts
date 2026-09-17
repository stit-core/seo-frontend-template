import {
  type CollectionEntry,
  getCollection,
  getEntry,
  type RenderResult,
  render,
} from 'astro:content'
import { type Locale, SUPPORTED_LOCALES } from '@/shared/i18n'
import { invariant } from '@/shared/lib'
import type { PostData } from '../model/schema'

export type PostEntry = CollectionEntry<'post'>

export interface Post {
  readonly id: string
  readonly locale: Locale
  readonly slug: string
  readonly data: PostData
}

const isLocale = (value: string): value is Locale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value)

// Черновик виден только в `astro dev` — в списках, тегах и по URL, с пометкой в UI; сборка
// его не знает: ни в списках, ни в тегах, URL — 404. Preview-режима нет.
const isVisible = (data: PostData): boolean => import.meta.env.DEV || !data.draft

// id записи — `<locale>/<slug>` (путь от content/): язык задаёт каталог, не поле.
export function toPost(entry: PostEntry): Post {
  const [locale, slug, ...rest] = entry.id.split('/')
  invariant(
    locale !== undefined && isLocale(locale) && slug !== undefined && rest.length === 0,
    `post: id ${entry.id} должен быть <locale>/<slug>`,
  )
  return { id: entry.id, locale, slug, data: entry.data }
}

function byDateDesc(a: Post, b: Post): number {
  return b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.slug.localeCompare(b.slug)
}

export async function listPosts(locale: Locale): Promise<Post[]> {
  const entries = await getCollection(
    'post',
    ({ id, data }) => isVisible(data) && id.startsWith(`${locale}/`),
  )
  return entries.map(toPost).sort(byDateDesc)
}

export async function getPost(locale: Locale, slug: string): Promise<Post | undefined> {
  return (await listPosts(locale)).find((post) => post.slug === slug)
}

export async function listByTag(locale: Locale, tag: string): Promise<Post[]> {
  return (await listPosts(locale)).filter((post) => post.data.tags.includes(tag))
}

export async function listTags(locale: Locale): Promise<string[]> {
  const tags = new Set((await listPosts(locale)).flatMap((post) => post.data.tags))
  return [...tags].sort()
}

// Перевод — видимая запись другой локали с тем же translationKey; без него у страницы
// нет alternate-ссылки (и не будет hreflang).
export async function findTranslation(post: Post, locale: Locale): Promise<Post | undefined> {
  if (locale === post.locale) return post
  return (await listPosts(locale)).find(
    (candidate) => candidate.data.translationKey === post.data.translationKey,
  )
}

export async function renderPost(post: Post): Promise<RenderResult> {
  const entry = await getEntry('post', post.id)
  invariant(entry, `post: запись ${post.id} не найдена`)
  return render(entry)
}
