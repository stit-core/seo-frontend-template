import { createFileRoute, redirect } from '@tanstack/react-router'
import { readSession } from '@/shared/api/session'
import { robotsMeta } from '@/shared/seo'
import { PageHeader } from '@/shared/ui/page-header'
import { SiteShell } from '@/widgets/site-shell'

// ssr:'data-only' — beforeLoad выполняется на сервере (можно отдать 302),
// а компонент рендерится только в браузере.
export const Route = createFileRoute('/account')({
  ssr: 'data-only',
  head: () => ({ meta: [{ title: 'Кабинет' }, ...robotsMeta(true)] }),
  beforeLoad: () => {
    // redirect() по умолчанию отдаёт 307 — для guard'а нужен явный statusCode
    if (!readSession()) throw redirect({ to: '/login', statusCode: 302 })
  },
  pendingComponent: () => <p className="px-6 py-8">Загрузка кабинета…</p>,
  component: () => (
    <SiteShell>
      <PageHeader title="Кабинет" />
    </SiteShell>
  ),
})
