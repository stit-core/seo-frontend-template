import Link from 'next/link'
import { type Locale, localePath, t } from '@/shared/i18n'
import { Container } from '@/shared/ui/container'

export function NotFoundPage({ locale }: { locale: Locale }) {
  const d = t(locale)

  return (
    <Container>
      <h1 className="text-heading-lg mt-10 font-semibold">{d.notFoundTitle}</h1>
      <p className="text-body-md text-muted mt-3">{d.notFoundText}</p>
      <p className="mt-4">
        <Link href={localePath(locale, '/')} className="underline">
          {d.home}
        </Link>
      </p>
    </Container>
  )
}
