import type { Metadata } from 'next'
import type { Locale } from '@/shared/i18n'
import { NowPage, nowMetadata } from '@/views/now'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ lang: Locale }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  return nowMetadata(lang)
}

export default async function Page({ params }: Params) {
  const { lang } = await params
  return <NowPage locale={lang} />
}
