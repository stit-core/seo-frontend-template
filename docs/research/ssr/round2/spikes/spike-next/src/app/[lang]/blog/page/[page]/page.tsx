import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllPosts } from '@/entities/post'
import { LOCALES, type Locale } from '@/shared/i18n'
import { BlogListPage, blogListMetadata, totalPages } from '@/views/blog-list'

export const revalidate = 60
export const dynamicParams = false

type Params = { params: Promise<{ lang: Locale; page: string }> }

export async function generateStaticParams() {
  const params: Array<{ lang: string; page: string }> = []
  for (const lang of LOCALES) {
    const pages = totalPages((await getAllPosts(lang)).length)
    for (let n = 2; n <= pages; n += 1) params.push({ lang, page: String(n) })
  }
  return params
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, page } = await params
  return blogListMetadata(lang, Number(page))
}

export default async function Page({ params }: Params) {
  const { lang, page } = await params
  const n = Number(page)
  if (!Number.isInteger(n) || n < 2) notFound()
  return <BlogListPage locale={lang} page={n} />
}
