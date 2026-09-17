import type { Metadata } from 'next'
import type { Locale } from '@/shared/i18n'
import { HomePage, homeMetadata } from '@/views/home'

type Params = { params: Promise<{ lang: Locale }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  return homeMetadata(lang)
}

export default async function Page({ params }: Params) {
  const { lang } = await params
  return <HomePage locale={lang} />
}
