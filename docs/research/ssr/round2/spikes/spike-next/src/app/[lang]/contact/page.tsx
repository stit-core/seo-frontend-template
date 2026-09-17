import type { Metadata } from 'next'
import type { Locale } from '@/shared/i18n'
import { ContactPage, contactMetadata } from '@/views/contact'

type Params = { params: Promise<{ lang: Locale }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  return contactMetadata(lang)
}

export default async function Page({ params }: Params) {
  const { lang } = await params
  return <ContactPage locale={lang} />
}
