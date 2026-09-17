import { type Locale, localePath, t } from '@/shared/i18n'
import { Breadcrumbs } from '@/shared/ui/breadcrumbs'
import { Container } from '@/shared/ui/container'

export function AboutPage({ locale }: { locale: Locale }) {
  const d = t(locale)

  return (
    <Container>
      <Breadcrumbs
        items={[
          { name: d.home, href: localePath(locale, '/') },
          { name: d.about, href: localePath(locale, '/about') },
        ]}
      />
      <h1 className="text-heading-lg mt-3 font-semibold">{d.about}</h1>
      <p className="text-body-md text-muted mt-3">{d.tagline}</p>
      <p className="text-body-md mt-3">{d.heroLead}</p>
    </Container>
  )
}
