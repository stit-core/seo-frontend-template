import { getRuntimeConfig } from '@/shared/config'
import { type Locale, localePath, t } from '@/shared/i18n'
import { Breadcrumbs } from '@/shared/ui/breadcrumbs'
import { Container } from '@/shared/ui/container'

export function NowPage({ locale }: { locale: Locale }) {
  const d = t(locale)
  const config = getRuntimeConfig()

  return (
    <Container>
      <Breadcrumbs
        items={[
          { name: d.home, href: localePath(locale, '/') },
          { name: d.now, href: localePath(locale, '/now') },
        ]}
      />
      <h1 className="text-heading-lg mt-3 font-semibold">{d.now}</h1>
      <p className="text-body-md mt-3" data-testid="server-time">
        {new Date().toISOString()}
      </p>
      <dl className="text-body-sm text-muted mt-4">
        <dt>SITE_URL</dt>
        <dd data-testid="site-url">{config.siteUrl}</dd>
        <dt className="mt-2">RELEASE</dt>
        <dd>{config.release}</dd>
        <dt className="mt-2">indexable</dt>
        <dd>{String(config.indexable)}</dd>
      </dl>
    </Container>
  )
}
