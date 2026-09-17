import { ContactForm } from '@/features/contact-form'
import { type Locale, localePath, t } from '@/shared/i18n'
import { Breadcrumbs } from '@/shared/ui/breadcrumbs'
import { Container } from '@/shared/ui/container'

export function ContactPage({ locale }: { locale: Locale }) {
  const d = t(locale)

  return (
    <Container>
      <Breadcrumbs
        items={[
          { name: d.home, href: localePath(locale, '/') },
          { name: d.contact, href: localePath(locale, '/contact') },
        ]}
      />
      <h1 className="text-heading-lg mt-3 font-semibold">{d.contact}</h1>
      <ContactForm locale={locale} />
    </Container>
  )
}
