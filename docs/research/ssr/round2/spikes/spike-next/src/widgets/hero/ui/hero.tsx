import Link from 'next/link'
import { type Locale, localePath, t } from '@/shared/i18n'

export function Hero({ locale }: { locale: Locale }) {
  const d = t(locale)

  return (
    <section className="py-10">
      <h1 className="text-heading-lg font-semibold">{d.tagline}</h1>
      <p className="text-body-md text-muted mt-3">{d.heroLead}</p>
      <Link
        href={localePath(locale, '/blog')}
        className="bg-action-bg text-action-fg rounded-control mt-6 inline-block px-4 py-2"
      >
        {d.cta}
      </Link>
    </section>
  )
}
