import { createFileRoute } from '@tanstack/react-router'
import { robotsMeta, seoLinks } from '@/shared/seo'
import { PageHeader } from '@/shared/ui/page-header'
import { SiteShell } from '@/widgets/site-shell'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [{ title: 'Вход' }, ...robotsMeta(true)],
    links: seoLinks('/login', 'ru'),
  }),
  component: () => (
    <SiteShell>
      <PageHeader title="Вход" description="Служебная страница, из индекса исключена." />
    </SiteShell>
  ),
})
