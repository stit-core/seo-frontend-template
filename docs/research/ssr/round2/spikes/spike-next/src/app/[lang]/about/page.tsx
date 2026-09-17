import type { Metadata } from 'next'
import type { Locale } from '@/shared/i18n'
import { AboutPage, aboutMetadata } from '@/views/about'

type Params = { params: Promise<{ lang: Locale }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  return aboutMetadata(lang)
}

export default async function Page({ params }: Params) {
  const { lang } = await params
  return <AboutPage locale={lang} />
}
