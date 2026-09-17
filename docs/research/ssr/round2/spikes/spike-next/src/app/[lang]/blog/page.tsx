import type { Metadata } from 'next'
import type { Locale } from '@/shared/i18n'
import { BlogListPage, blogListMetadata } from '@/views/blog-list'

export const revalidate = 60

type Params = { params: Promise<{ lang: Locale }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  return blogListMetadata(lang, 1)
}

export default async function Page({ params }: Params) {
  const { lang } = await params
  return <BlogListPage locale={lang} page={1} />
}
