import type { Metadata } from 'next'
import type { Locale } from '@/shared/i18n'
import { ContactThanksPage, contactThanksMetadata } from '@/views/contact-thanks'

type Params = { params: Promise<{ lang: Locale }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  return contactThanksMetadata(lang)
}

export default async function Page({ params }: Params) {
  const { lang } = await params
  return <ContactThanksPage locale={lang} />
}
