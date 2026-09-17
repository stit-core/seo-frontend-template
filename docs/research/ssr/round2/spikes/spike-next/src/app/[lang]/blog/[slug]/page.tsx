import type { Metadata } from 'next'
import { getPostSlugs } from '@/entities/post'
import { LOCALES, type Locale } from '@/shared/i18n'
import { PostPage, postMetadata } from '@/views/post'

export const revalidate = 3600
export const dynamicParams = false

type Params = { params: Promise<{ lang: Locale; slug: string }> }

export async function generateStaticParams() {
  const params: Array<{ lang: string; slug: string }> = []
  for (const lang of LOCALES) {
    for (const slug of await getPostSlugs(lang)) params.push({ lang, slug })
  }
  return params
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, slug } = await params
  return postMetadata(lang, slug)
}

export default async function Page({ params }: Params) {
  const { lang, slug } = await params
  return <PostPage locale={lang} slug={slug} />
}
