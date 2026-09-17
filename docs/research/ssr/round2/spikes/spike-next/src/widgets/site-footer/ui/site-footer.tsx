import type { Locale } from '@/shared/i18n'
import { t } from '@/shared/i18n'
import { Container } from '@/shared/ui/container'

export function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="border-divider text-body-sm text-muted mt-12 border-t">
      <Container className="py-6">
        {t(locale).siteName} · spike · {new Date().getUTCFullYear()}
      </Container>
    </footer>
  )
}
